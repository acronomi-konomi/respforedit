/**
 * Стегонатор — Main Application Entry Point
 *
 * Initializes both:
 *  - Clean Encryption (AES-256-GCM + encoding wrappers)
 *  - Steganography (linguistic stego via Az.js + StegoEngine)
 *
 * Exposes a global API for integration with Tampermonkey, extensions, etc.
 */

import CleanCrypto from './core/clean-crypto.js';
import { getEncoderById, detectEncoder, getEncoderList } from './core/encoders/index.js';
import LayoutSwitchEncoder from './core/encoders/layout-switch-encoder.js';
import { StegoAnalyzer } from './ui/stego-analyzer.js';

// ─── Bridge API ──────────────────────────────────────────────
//
// ## Security Model
//
// The bridge is the ONLY communication channel between our
// encryption module and the insecure web messenger.
//
// CRITICAL RULES:
// 1. Outgoing messages contain ONLY encrypted/encoded text — NEVER plaintext or passwords
// 2. Incoming messages only carry (text, chatId, timestamp) — nothing else
// 3. Auto-detection returns ONLY metadata (isEncrypted, algorithm) — NEVER decrypted text
// 4. Decryption is ALWAYS triggered by user action in our UI, never by bridge API calls
// 5. Passwords are NEVER exposed through any API endpoint
// 6. The StegoEngine and CryptoEngine instances are NEVER accessible through the API
//
// ## Supported Platforms
//
// - Android: Two separate WebViews communicating via JSI bridge
// - Python: Two web windows communicating via PyWebView API
// - Browser extension: Extension has isolated context, no bridge needed
// - iframe: postMessage with origin validation
//

class BridgeAPI {
    constructor() {
        this.enabled = true;  // Bridge ON by default — API only accessible within app's own context
        this.method = 'postMessage'; // 'postMessage' | 'jsi' | 'pywebview' | 'clipboard'
        this.targetOrigin = '*';
        this.autoDecode = false;
        this.allowDetection = true;  // Detection ON by default — returns only metadata, never plaintext
        this._incomingCallback = null;
        this._detectCallCount = 0;
        this._detectCallWindow = 0;
        this._DETECT_RATE_LIMIT = 30; // max detection calls per 60 seconds
        this._sessionToken = null;
    }

    /**
     * Generate a new session token for bridge authentication.
     * Must be called before using postMessage communication.
     * @returns {string} The generated session token
     */
    initSessionToken() {
        this._sessionToken = crypto.randomUUID();
        return this._sessionToken;
    }

    /**
     * Get the current session token.
     * @returns {string|null} The current token, or null if not initialized
     */
    getToken() {
        return this._sessionToken;
    }

    configure({ enabled, method, targetOrigin, autoDecode, allowDetection }) {
        if (enabled !== undefined) this.enabled = enabled;
        if (method !== undefined) this.method = method;
        if (targetOrigin !== undefined) this.targetOrigin = targetOrigin;
        if (autoDecode !== undefined) this.autoDecode = autoDecode;
        if (allowDetection !== undefined) this.allowDetection = allowDetection;
    }

    // ─── (a) Send encrypted text TO the messenger ─────────────
    //
    // SECURITY: Only sends the encrypted/encoded text — NEVER the password or plaintext.
    // The messenger only receives opaque ciphertext.

    async send(encryptedText, chatId, timestamp) {
        if (!this.enabled) return false;

        const payload = {
            type: 'stegonator-outgoing',
            text: encryptedText,
            chatId: chatId || '',
            timestamp: timestamp || Date.now()
        };

        switch (this.method) {
            case 'postMessage':
                return this._sendPostMessage(payload);
            case 'jsi':
                return this._sendJSI(payload);
            case 'pywebview':
                return this._sendPyWebView(payload);
            case 'clipboard':
                return this._sendClipboard(payload);
            default:
                return false;
        }
    }

    _sendPostMessage(payload) {
        try {
            // Include session token in outgoing payload for authentication
            payload.token = this._sessionToken;
            if (window.parent !== window) {
                window.parent.postMessage(payload, this.targetOrigin);
                return true;
            }
            if (window.opener) {
                window.opener.postMessage(payload, this.targetOrigin);
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Bridge postMessage failed:', e);
            return false;
        }
    }

    _sendJSI(payload) {
        try {
            if (window.AndroidBridge && window.AndroidBridge.sendMessage) {
                window.AndroidBridge.sendMessage(JSON.stringify(payload));
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Bridge JSI failed:', e);
            return false;
        }
    }

    _sendPyWebView(payload) {
        try {
            if (window.pywebview && window.pywebview.api && window.pywebview.api.on_message) {
                window.pywebview.api.on_message(JSON.stringify(payload));
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Bridge PyWebView failed:', e);
            return false;
        }
    }

    async _sendClipboard(payload) {
        try {
            await navigator.clipboard.writeText(payload.text);
            return true;
        } catch (e) {
            console.warn('Bridge clipboard failed:', e);
            return false;
        }
    }

    // ─── (b) Receive text FROM the messenger for decryption ───
    //
    // SECURITY: Only receives (text, chatId, timestamp).
    // The messenger cannot access the decryption engine or passwords.
    // Decryption happens entirely within our isolated context.

    listen(callback) {
        this._incomingCallback = callback;

        // postMessage listener (iframe, extension content script)
        window.addEventListener('message', (event) => {
            if (!this.enabled) return;

            // Origin validation: reject messages from unexpected origins
            if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
                console.warn('Bridge: rejected message from untrusted origin:', event.origin);
                return;
            }

            const data = event.data;
            if (data && data.type === 'stegonator-incoming') {
                // Token validation: require matching session token
                if (!this._sessionToken) {
                    console.warn('Bridge: rejected incoming message — no session token initialized');
                    return;
                }
                if (data.token !== this._sessionToken) {
                    console.warn('Bridge: rejected incoming message — token mismatch');
                    return;
                }

                this._handleIncoming({
                    text: String(data.text || ''),
                    chatId: String(data.chatId || ''),
                    timestamp: Number(data.timestamp) || Date.now()
                });
            }
        });

        // JSI listener (Android WebView bridge)
        // The Android bridge calls this method to deliver incoming messages
        window.StegonatorBridge = {
            onIncoming: (jsonStr) => {
                if (!this.enabled) return;
                try {
                    const data = JSON.parse(jsonStr);
                    this._handleIncoming({
                        text: String(data.text || ''),
                        chatId: String(data.chatId || ''),
                        timestamp: Number(data.timestamp) || Date.now()
                    });
                } catch (e) {
                    console.warn('Bridge JSI incoming parse error:', e);
                }
            },
            // Detection request from the messenger side
            detect: (jsonStr) => {
                if (!this.enabled || !this.allowDetection) {
                    return JSON.stringify({ isEncrypted: false, algorithm: null, isStego: false });
                }
                try {
                    const data = JSON.parse(jsonStr);
                    const result = this.detectEncryption(String(data.text || ''));
                    return JSON.stringify(result);
                } catch (e) {
                    return JSON.stringify({ isEncrypted: false, algorithm: null, isStego: false, error: 'Detection failed' });
                }
            }
        };

        // PyWebView listener
        if (window.pywebview) {
            // PyWebView can call our bridge methods directly
            window.pywebview.api.stegonator_incoming = (jsonStr) => {
                if (!this.enabled) return;
                try {
                    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
                    this._handleIncoming({
                        text: String(data.text || ''),
                        chatId: String(data.chatId || ''),
                        timestamp: Number(data.timestamp) || Date.now()
                    });
                } catch (e) {
                    console.warn('Bridge PyWebView incoming parse error:', e);
                }
            };
        }
    }

    _handleIncoming(safeData) {
        // Validate input lengths to prevent abuse
        if (safeData.text.length > 100000) {
            console.warn('Bridge: incoming text too long, ignoring');
            return;
        }
        if (safeData.chatId.length > 256) {
            console.warn('Bridge: incoming chatId too long, ignoring');
            return;
        }

        if (this._incomingCallback) {
            this._incomingCallback(safeData);
        }
    }

    // ─── (c) Auto-detection: is text encrypted? Which algorithm? ─
    //
    // SECURITY: Returns ONLY metadata — never decrypts, never returns plaintext.
    // This endpoint allows the bridge to check if a message looks encrypted
    // so it can route it to our module for decryption.
    //
    // Returns:
    //   { isEncrypted: boolean, algorithm: string|null, isStego: boolean, stegoCapacity: number }
    //
    // Detection order:
    //   1. Check CRY magic bytes → AES-256-GCM (CleanCrypto)
    //   2. Check encoder signatures → base64, invisible, emoji, chinese, compression, layout
    //   3. Check steganographic capacity → linguistic stego

    detectEncryption(text) {
        if (!text || typeof text !== 'string') {
            return { isEncrypted: false, algorithm: null, isStego: false, stegoCapacity: 0 };
        }

        // Rate limiting
        const now = Date.now();
        if (now - this._detectCallWindow > 60000) {
            this._detectCallCount = 0;
            this._detectCallWindow = now;
        }
        this._detectCallCount++;
        if (this._detectCallCount > this._DETECT_RATE_LIMIT) {
            return { isEncrypted: false, algorithm: null, isStego: false, stegoCapacity: 0, rateLimited: true };
        }

        // 1. Check CRY magic bytes (0x43, 0x52, 0x59) → AES-256-GCM from CleanCrypto
        const cryBytes = _base64urlToBytes(text);
        if (cryBytes && cryBytes.length >= 3 &&
            cryBytes[0] === 0x43 && cryBytes[1] === 0x52 && cryBytes[2] === 0x59) {
            return { isEncrypted: true, algorithm: 'AES-256-GCM', isStego: false, stegoCapacity: 0 };
        }

        // 2. Check encoder signatures (base64, invisible, emoji, chinese, compression, layout)
        try {
            const encoder = detectEncoder(text);
            if (encoder) {
                return { isEncrypted: true, algorithm: encoder.label || encoder.id, isStego: false, stegoCapacity: 0 };
            }
        } catch (e) { /* detection failed */ }

        // 3. Check layout switch (Cyrillic text with Latin layout or vice versa)
        try {
            const layoutDecoded = LayoutSwitchEncoder.decodeToString(text);
            if (layoutDecoded && layoutDecoded !== text) {
                return { isEncrypted: true, algorithm: 'Раскладка', isStego: false, stegoCapacity: 0 };
            }
        } catch (e) { /* not layout switch */ }

        // 4. Check steganographic capacity (without decrypting!)
        //    If the text has capacity in our stego channels, it MIGHT contain hidden data.
        //    This is a heuristic — it can't confirm stego without the password.
        if (state.stegoReady && state.stegoAnalyzer) {
            try {
                const autoChannels = state.stegoAnalyzer.getAutoChannels(text);
                if (autoChannels.length > 0) {
                    const analysis = state.stegoEngine.analyzeCarrier(text);
                    if (analysis.totalBits > 0) {
                        return {
                            isEncrypted: true,
                            algorithm: 'Стего',
                            isStego: true,
                            stegoCapacity: analysis.totalBits,
                            stegoChannels: autoChannels.length
                        };
                    }
                }
            } catch (e) { /* stego analysis failed */ }
        }

        return { isEncrypted: false, algorithm: null, isStego: false, stegoCapacity: 0 };
    }

    // ─── Internal: Auto-decode (only called by bridge listener) ──
    //
    // SECURITY: This is an INTERNAL method — NOT exposed through the public API.
    // It's only called by the bridge incoming message handler when autoDecode is enabled.
    // The result is shown in our UI only — never sent back through the bridge.

    async _tryAutoDecode(text, password, chatId) {
        if (!text || !password) return null;

        // 1. Try clean encryption auto-detect (base64, invisible, emoji, etc.)
        try {
            const encoder = detectEncoder(text);
            if (encoder) {
                let decodedBytes;
                if (encoder.decode.constructor.name === 'AsyncFunction') {
                    decodedBytes = await encoder.decode(text);
                } else {
                    decodedBytes = encoder.decode(text);
                }
                if (decodedBytes) {
                    try {
                        const decrypted = await cleanCrypto.decrypt(decodedBytes, password, chatId);
                        return { text: decrypted, method: encoder.label || 'auto' };
                    } catch (e) { /* wrong password or not encrypted */ }
                }
            }
        } catch (e) { /* detection failed */ }

        // 2. Try AES-256 base64
        try {
            const bytes = _base64urlToBytes(text);
            if (bytes) {
                const decrypted = await cleanCrypto.decrypt(bytes, password, chatId);
                return { text: decrypted, method: 'AES-256' };
            }
        } catch (e) { /* not AES-256 */ }

        // 3. Try steganography decode (if engine is ready)
        if (state.stegoReady && state.stegoEngine) {
            try {
                const autoChannels = state.stegoAnalyzer
                    ? state.stegoAnalyzer.getAutoChannels(text)
                    : [];
                if (autoChannels.length > 0) {
                    state.stegoEngine.setActiveChannels(autoChannels);
                }
                const message = await state.stegoEngine.decodeMessage(text, password);
                return { text: message, method: 'Стего' };
            } catch (e) { /* not stego text */ }
        }

        return null;
    }

    // ─── Safe stego encode (for bridge use) ────────────────────
    //
    // SECURITY: Returns only stego text — never the plaintext secret.
    // The bridge caller gets the encoded carrier text, nothing else.

    async stegoEncode(secretMessage, carrierText, password) {
        if (!this.enabled) return null;
        if (!state.stegoReady || !state.stegoEngine) return null;
        try {
            const autoChannels = state.stegoAnalyzer
                ? state.stegoAnalyzer.getAutoChannels(carrierText)
                : [];
            if (autoChannels.length > 0) {
                state.stegoEngine.setActiveChannels(autoChannels);
            }
            return await state.stegoEngine.encodeMessage(secretMessage, carrierText, password);
        } catch (e) {
            return null;
        }
    }

    // ─── Safe stego decode (for bridge use) ────────────────────
    //
    // SECURITY: Returns decoded text — but ONLY for the trusted bridge.
    // This is NOT exposed through the public web API.

    async stegoDecode(stegoText, password) {
        if (!this.enabled) return null;
        if (!state.stegoReady || !state.stegoEngine) return null;
        try {
            const autoChannels = state.stegoAnalyzer
                ? state.stegoAnalyzer.getAutoChannels(stegoText)
                : [];
            if (autoChannels.length > 0) {
                state.stegoEngine.setActiveChannels(autoChannels);
            }
            return await state.stegoEngine.decodeMessage(stegoText, password);
        } catch (e) {
            return null;
        }
    }
}

const bridge = new BridgeAPI();

// ─── State ───────────────────────────────────────────────────

const state = {
    mode: 'encryption',        // 'encryption' | 'steganography'
    subMode: 'aes256',         // encryption: aes256, invisible, base64, compression, emoji, chinese, layout
                               // stego: stego-encode, stego-decode, stego-recovery
    direction: 'encode',       // 'encode' | 'decode'
    chatId: '',
    stegoReady: false,
    stegoEngine: null,
    stegoAnalyzer: null,       // StegoAnalyzer instance for real-time analysis
    charLimit: 4096,
};

// ─── DOM References ──────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    loading: $('#loading'),
    loadingProgress: $('#loadingProgressBar'),
    // Header
    chatIdDisplay: $('#chatIdDisplay'),
    btnSettings: $('#btnSettings'),
    // Tabs
    mainTabs: $('#mainTabs'),
    subtabsEncryption: $('#subtabsEncryption'),
    subtabsSteganography: $('#subtabsSteganography'),
    // Encryption input
    panelEncryption: $('#panelEncryption'),
    encryptInput: $('#encryptInput'),
    encryptPassword: $('#encryptPassword'),
    btnToggleEncryptPw: $('#btnToggleEncryptPw'),
    encryptDirection: $('#encryptDirection'),
    btnEncryptSend: $('#btnEncryptSend'),
    btnEncryptCopy: $('#btnEncryptCopy'),
    // Encryption result preview
    encryptResultSection: $('#encryptResultSection'),
    encryptResultPreview: $('#encryptResultPreview'),
    btnEncryptResultCopy: $('#btnEncryptResultCopy'),
    btnBridgeSend: $('#btnBridgeSend'),
    // Stego encode
    panelStegoEncode: $('#panelStegoEncode'),
    secretMessage: $('#secret-message'),
    carrierText: $('#carrier-text'),
    passwordEncode: $('#password-encode'),
    btnToggleStegoEncPw: $('#btnToggleStegoEncPw'),
    btnEncode: $('#btn-encode'),
    outputText: $('#output-text'),
    btnCopy: $('#btn-copy'),
    // Stego decode
    panelStegoDecode: $('#panelStegoDecode'),
    stegoText: $('#stego-text'),
    passwordDecode: $('#password-decode'),
    btnToggleStegoDecPw: $('#btnToggleStegoDecPw'),
    btnDecode: $('#btn-decode'),
    decodedMessage: $('#decoded-message'),
    // Stego recovery
    panelStegoRecovery: $('#panelStegoRecovery'),
    recoveryText: $('#recovery-text'),
    passwordRecovery: $('#password-recovery'),
    btnToggleStegoRecPw: $('#btnToggleStegoRecPw'),
    btnRecovery: $('#btn-recovery'),
    recoveryResult: $('#recovery-result'),
    // Settings
    settingsOverlay: $('#settingsOverlay'),
    settingsPanel: $('#settingsPanel'),
    btnCloseSettings: $('#btnCloseSettings'),
    stegoChannelsSection: $('#stegoChannelsSection'),
    settingCurrentChatId: $('#settingCurrentChatId'),
    settingRememberPw: $('#settingRememberPw'),
    newChatIdInput: $('#newChatIdInput'),
    newChatPwInput: $('#newChatPwInput'),
    btnAddChatPw: $('#btnAddChatPw'),
    chatPasswordList: $('#chatPasswordList'),
    synThreshold: $('#syn-threshold'),
    thresholdVal: $('#threshold-val'),
    // Bridge settings
    settingBridgeEnabled: $('#settingBridgeEnabled'),
    settingBridgeMethod: $('#settingBridgeMethod'),
    settingBridgeTarget: $('#settingBridgeTarget'),
    settingBridgeAutoDecode: $('#settingBridgeAutoDecode'),
    settingBridgeAllowDetection: $('#settingBridgeAllowDetection'),
    // Stats
    statChannels: $('#stat-channels'),
    statBits: $('#stat-bits'),
    statEfficiency: $('#stat-efficiency'),
    statTime: $('#stat-time'),
    secretLength: $('#secret-length'),
    secretBytes: $('#secret-bytes'),
    // Toast
    toastArea: $('#toastArea'),
};

// ─── Clean Crypto Instance ───────────────────────────────────

const cleanCrypto = new CleanCrypto();

// ─── Toast ───────────────────────────────────────────────────

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `cm-toast cm-toast--${type}`;
    toast.textContent = message;
    dom.toastArea.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 250);
    }, 2500);
}

// ─── Helpers ─────────────────────────────────────────────────

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Mode Switching ──────────────────────────────────────────

function switchMainMode(category) {
    state.mode = category;

    // Update tabs
    $$('.cm-tab').forEach(t => t.classList.toggle('active', t.dataset.category === category));

    // Show/hide subtabs
    dom.subtabsEncryption.classList.toggle('cm-hidden', category !== 'encryption');
    dom.subtabsSteganography.classList.toggle('cm-hidden', category !== 'steganography');

    // Show/hide stego channels in settings
    dom.stegoChannelsSection.classList.toggle('visible', category === 'steganography');

    // Set default sub-mode
    if (category === 'encryption') {
        switchSubMode('aes256');
    } else {
        switchSubMode('stego-encode');
    }
}

function switchSubMode(mode) {
    state.subMode = mode;

    // Update subtab pills
    $$('.cm-subtab').forEach(s => s.classList.toggle('active', s.dataset.mode === mode));

    // Show correct input panel
    dom.panelEncryption.classList.toggle('active', mode !== 'stego-encode' && mode !== 'stego-decode' && mode !== 'stego-recovery');
    dom.panelStegoEncode.classList.toggle('active', mode === 'stego-encode');
    dom.panelStegoDecode.classList.toggle('active', mode === 'stego-decode');
    dom.panelStegoRecovery.classList.toggle('active', mode === 'stego-recovery');
}

function switchDirection(dir) {
    state.direction = dir;
    $$('.cm-direction-toggle__btn').forEach(b => b.classList.toggle('active', b.dataset.direction === dir));

    // Update placeholder
    if (dir === 'encode') {
        dom.encryptInput.placeholder = 'Введите сообщение для шифрования…';
    } else {
        dom.encryptInput.placeholder = 'Вставьте зашифрованное сообщение…';
    }

    // Hide encryption result preview when switching direction
    if (dom.encryptResultSection) {
        dom.encryptResultSection.style.display = 'none';
    }
    if (dom.encryptResultPreview) {
        dom.encryptResultPreview.textContent = '';
    }
}

// ─── Encryption Result Preview ───────────────────────────────

function _showEncryptResult(text) {
    if (dom.encryptResultPreview) {
        dom.encryptResultPreview.textContent = text;
    }
    if (dom.encryptResultSection) {
        dom.encryptResultSection.style.display = '';
    }
}

// ─── Live Encryption Preview ─────────────────────────────────

let _encryptPreviewTimer = null;
function _tryEncryptPreview() {
    clearTimeout(_encryptPreviewTimer);
    _encryptPreviewTimer = setTimeout(async () => {
        // Only preview in encode direction with text + password
        if (state.direction !== 'encode') return;

        const text = dom.encryptInput?.value?.trim();
        const password = _getPassword();

        if (!text || !password) {
            // Clear preview if missing requirements
            if (dom.encryptResultPreview) dom.encryptResultPreview.textContent = '';
            if (dom.encryptResultSection) dom.encryptResultSection.style.display = 'none';
            return;
        }

        try {
            let result;

            if (state.subMode === 'layout') {
                result = LayoutSwitchEncoder.encodeString(text, false);
            } else if (state.subMode === 'aes256') {
                const encrypted = await cleanCrypto.encrypt(text, password, state.chatId);
                result = _bytesToBase64url(encrypted);
            } else {
                const encrypted = await cleanCrypto.encrypt(text, password, state.chatId);
                const encoder = getEncoderById(state.subMode === 'invisible' ? 'invisible-spaces'
                    : state.subMode === 'base64' ? 'base64'
                    : state.subMode === 'compression' ? 'compression'
                    : state.subMode === 'emoji' ? 'emoji'
                    : state.subMode === 'chinese' ? 'chinese'
                    : null);

                if (!encoder) return;

                if (encoder.encode.constructor.name === 'AsyncFunction') {
                    result = await encoder.encode(encrypted);
                } else {
                    result = encoder.encode(encrypted);
                }
            }

            if (result && dom.encryptResultPreview) {
                dom.encryptResultPreview.textContent = result;
                // Mark as preview
                const previewIndicator = dom.encryptResultSection?.querySelector('.cm-preview-indicator');
                if (previewIndicator) previewIndicator.textContent = 'Предпросмотр';
                if (dom.encryptResultSection) dom.encryptResultSection.style.display = '';
            }
        } catch (e) {
            // Silent fail for preview
        }
    }, 300);
}

// ─── Clean Encryption ────────────────────────────────────────

async function handleEncryptSend() {
    // In decode mode, only strip ASCII whitespace (tabs, newlines, regular spaces).
    // Do NOT use .trim() — it strips Unicode Zs characters (NBSP, Em Space, etc.)
    // which are used as data in the invisible encoder.
    let text;
    if (state.direction === 'decode') {
        text = dom.encryptInput.value.replace(/^[\t\n\r ]+/, '').replace(/[\t\n\r ]+$/, '');
    } else {
        text = dom.encryptInput.value.trim();
    }
    if (!text) return;

    const password = _getPassword();
    const chatId = state.chatId;

    if (state.direction === 'encode') {
        // ENCODE
        try {
            let result;

            if (state.subMode === 'layout') {
                // Layout switch (no encryption, just obfuscation)
                result = LayoutSwitchEncoder.encodeString(text, false);
                showToast('Закодировано сменой раскладки', 'success');
            } else if (state.subMode === 'aes256') {
                // AES-256 with base64 output
                const encrypted = await cleanCrypto.encrypt(text, password, chatId);
                result = _bytesToBase64url(encrypted);
                showToast('Зашифровано AES-256-GCM', 'success');
            } else {
                // Other encoders: encrypt first, then encode
                const encrypted = await cleanCrypto.encrypt(text, password, chatId);
                const encoder = getEncoderById(state.subMode === 'invisible' ? 'invisible-spaces'
                    : state.subMode === 'base64' ? 'base64'
                    : state.subMode === 'compression' ? 'compression'
                    : state.subMode === 'emoji' ? 'emoji'
                    : state.subMode === 'chinese' ? 'chinese'
                    : null);

                if (!encoder) {
                    showToast('Неизвестный кодировщик', 'error');
                    return;
                }

                if (encoder.encode.constructor.name === 'AsyncFunction') {
                    result = await encoder.encode(encrypted);
                } else {
                    result = encoder.encode(encrypted);
                }

                const label = encoder.label || state.subMode;
                showToast(`Зашифровано (${label})`, 'success');
            }

            // Show result in preview
            _showEncryptResult(result);

            // Try bridge send if enabled
            if (bridge.enabled) {
                const sent = await bridge.send(result, chatId);
                if (sent) {
                    showToast('Отправлено через мост', 'success');
                }
            }

            dom.encryptInput.value = '';
        } catch (e) {
            showToast('Ошибка шифрования: ' + e.message, 'error');
            console.error(e);
        }
    } else {
        // DECODE
        try {
            let decoded;

            if (state.subMode === 'layout') {
                decoded = LayoutSwitchEncoder.decodeToString(text);
                if (decoded) {
                    _showEncryptResult(decoded);
                    showToast('Декодировано', 'success');
                } else {
                    showToast('Не удалось определить раскладку', 'error');
                }
            } else if (state.subMode === 'aes256') {
                // Try base64 decode first
                const bytes = _base64urlToBytes(text);
                if (bytes) {
                    decoded = await cleanCrypto.decrypt(bytes, password, chatId);
                    _showEncryptResult(decoded);
                    showToast('Дешифровано', 'success');
                } else {
                    showToast('Неверный формат Base64', 'error');
                }
            } else {
                // Auto-detect encoder and decode
                const encoder = detectEncoder(text);
                if (!encoder) {
                    showToast('Не удалось определить тип кодировки', 'error');
                    return;
                }

                let decodedBytes;
                if (encoder.decode.constructor.name === 'AsyncFunction') {
                    decodedBytes = await encoder.decode(text);
                } else {
                    decodedBytes = encoder.decode(text);
                }

                if (!decodedBytes) {
                    showToast('Ошибка декодирования', 'error');
                    return;
                }

                // Try to decrypt
                try {
                    decoded = await cleanCrypto.decrypt(decodedBytes, password, chatId);
                    _showEncryptResult(decoded);
                    showToast(`Дешифровано (${encoder.label})`, 'success');
                } catch (e) {
                    showToast('Неверный пароль или повреждённые данные', 'error');
                }
            }

            dom.encryptInput.value = '';
        } catch (e) {
            showToast('Ошибка дешифровки: ' + e.message, 'error');
            console.error(e);
        }
    }
}

// ─── Steganography ───────────────────────────────────────────

async function handleStegoEncode() {
    if (!state.stegoReady) {
        showToast('Движок стеганографии ещё загружается…', 'warning');
        return;
    }

    const secret = dom.secretMessage.value;
    const carrier = dom.carrierText.value;
    const password = dom.passwordEncode.value;

    if (!secret || !carrier || !password) {
        showToast('Заполните все поля!', 'error');
        return;
    }

    dom.btnEncode.disabled = true;
    dom.btnEncode.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-zap"/></svg> Кодирование…';

    try {
        // Auto-detect channels from carrier text, then filter by user toggle
        let autoChannels = state.stegoAnalyzer
            ? state.stegoAnalyzer.getAutoChannels(carrier)
            : [];
        // Only letter-stego can be optionally disabled —
        // safe because it's always last in the bases array and
        // the decoder auto-detects it (returns all-zero indices when not encoded)
        if (!_isLetterStegoEnabled()) {
            autoChannels = autoChannels.filter(ch => ch !== 'letter-stego');
        }
        if (autoChannels.length > 0) {
            state.stegoEngine.setActiveChannels(autoChannels);
        }

        const stegoText = await state.stegoEngine.encodeMessage(secret, carrier, password);
        dom.outputText.textContent = stegoText;

        const stats = state.stegoEngine.getStats();
        if (dom.statChannels) dom.statChannels.textContent = stats.channels;
        if (dom.statBits) dom.statBits.textContent = stats.bits;
        if (dom.statEfficiency) dom.statEfficiency.textContent = (stats.efficiency || 0) + '%';
        if (dom.statTime) dom.statTime.textContent = stats.time + ' мс';

        showToast('Сообщение закодировано в стего-текст', 'success');
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
        console.error(e);
    } finally {
        dom.btnEncode.disabled = false;
        dom.btnEncode.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-zap"/></svg> Кодировать';
    }
}

async function handleStegoDecode() {
    if (!state.stegoReady) {
        showToast('Движок стеганографии ещё загружается…', 'warning');
        return;
    }

    const stegoText = dom.stegoText.value;
    const password = dom.passwordDecode.value;

    if (!stegoText || !password) {
        showToast('Заполните все поля!', 'error');
        return;
    }

    dom.btnDecode.disabled = true;
    dom.btnDecode.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-search"/></svg> Декодирование…';

    try {
        // Auto-detect ALL channels from stego text — do NOT filter by user settings.
        // The decoder must see the same channels the encoder used.
        // If letter-stego was disabled during encoding, the decoder still
        // detects it but reads all-zero indices (safe: trailing zeros
        // in the mixed-radix number don't affect M).
        const autoChannels = state.stegoAnalyzer
            ? state.stegoAnalyzer.getAutoChannels(stegoText)
            : [];
        if (autoChannels.length > 0) {
            state.stegoEngine.setActiveChannels(autoChannels);
        }

        const message = await state.stegoEngine.decodeMessage(stegoText, password);
        dom.decodedMessage.textContent = message;

        showToast('Сообщение декодировано', 'success');
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
        console.error(e);
    } finally {
        dom.btnDecode.disabled = false;
        dom.btnDecode.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-search"/></svg> Декодировать';
    }
}

function handleStegoRecovery() {
    dom.btnRecovery.disabled = true;
    dom.btnRecovery.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-shield"/></svg> Восстановление…';

    try {
        showToast('Функция восстановления в разработке', 'warning');
    } finally {
        dom.btnRecovery.disabled = false;
        dom.btnRecovery.innerHTML = '<svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-shield"/></svg> Восстановить';
    }
}

// ─── Password Management ─────────────────────────────────────

function _getPassword() {
    // Try to get from current chat's saved password
    const chatId = state.chatId;
    const saved = CleanCrypto.getSavedPassword(chatId);
    if (saved) return saved;

    // Otherwise use the input field
    return dom.encryptPassword.value;
}

function _loadChatPasswords() {
    const passwords = CleanCrypto.getAllPasswords();
    dom.chatPasswordList.innerHTML = '';

    for (const [chatId, pw] of Object.entries(passwords)) {
        const entry = document.createElement('div');
        entry.className = 'cm-chat-entry';
        entry.innerHTML = `
            <span class="cm-chat-entry__id">${_escapeHtml(chatId)}</span>
            <span class="cm-chat-entry__pw">${'•'.repeat(Math.min(pw.length, 8))}</span>
            <button class="cm-chat-entry__remove" data-chat-id="${_escapeHtml(chatId)}" type="button"><svg class="cm-icon cm-icon--sm"><use href="assets/icons/sprite.svg#icon-trash"/></svg></button>
        `;
        dom.chatPasswordList.appendChild(entry);
    }

    // Remove buttons
    dom.chatPasswordList.querySelectorAll('.cm-chat-entry__remove').forEach(btn => {
        btn.addEventListener('click', () => {
            CleanCrypto.removePassword(btn.dataset.chatId);
            _loadChatPasswords();
            showToast('Пароль удалён', 'info');
        });
    });
}

function _addChatPassword() {
    const chatId = dom.newChatIdInput.value.trim();
    const pw = dom.newChatPwInput.value.trim();

    if (!chatId || !pw) {
        showToast('Введите ID чата и пароль', 'error');
        return;
    }

    CleanCrypto.savePassword(chatId, pw);
    dom.newChatIdInput.value = '';
    dom.newChatPwInput.value = '';
    _loadChatPasswords();
    showToast('Пароль сохранён', 'success');
}

// ─── Settings ────────────────────────────────────────────────

function openSettings() {
    dom.settingsPanel.classList.add('open');
    dom.settingsOverlay.classList.add('open');
}

function closeSettings() {
    dom.settingsPanel.classList.remove('open');
    dom.settingsOverlay.classList.remove('open');
}

// ─── Settings Persistence ──────────────────────────────────────

function _saveSettings() {
    try {
        const settings = {
            // General
            defaultAlgo: state.subMode,
            chatId: state.chatId,
            charLimit: state.charLimit,
            // Password storage preference
            rememberPassword: dom.settingRememberPw?.checked || false,
            // Bridge settings
            bridgeEnabled: bridge.enabled,
            bridgeMethod: bridge.method,
            bridgeTargetOrigin: bridge.targetOrigin,
            bridgeAutoDecode: bridge.autoDecode,
            bridgeAllowDetection: bridge.allowDetection,
            // Stego channel toggles
            letterStegoEnabled: _isLetterStegoEnabled(),
            // Synonym threshold
            synThreshold: dom.synThreshold?.value ? parseFloat(dom.synThreshold.value) : undefined,
            // Letter density
            letterDensity: dom.letterDensity?.value ? parseInt(dom.letterDensity.value) : undefined,
        };
        localStorage.setItem('cryptoMsg_settings', JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save settings:', e);
    }
}

function _loadSettings() {
    try {
        const raw = localStorage.getItem('cryptoMsg_settings');
        if (!raw) return;
        const settings = JSON.parse(raw);

        // General
        if (settings.defaultAlgo) state.subMode = settings.defaultAlgo;
        if (settings.chatId) {
            state.chatId = settings.chatId;
            dom.chatIdDisplay.textContent = state.chatId;
            dom.settingCurrentChatId.value = state.chatId;
        }
        if (settings.charLimit) state.charLimit = settings.charLimit;

        // Password storage preference
        if (settings.rememberPassword !== undefined && dom.settingRememberPw) {
            dom.settingRememberPw.checked = settings.rememberPassword;
        }

        // Bridge settings
        if (settings.bridgeEnabled !== undefined) {
            bridge.configure({ enabled: settings.bridgeEnabled });
            if (dom.settingBridgeEnabled) dom.settingBridgeEnabled.checked = settings.bridgeEnabled;
            // Show/hide bridge detail rows
            const detailRows = document.querySelectorAll('#bridge-method-row, #bridge-target-row, #bridge-autodecode-row, #bridge-allow-detection-row');
            detailRows.forEach(el => el.classList.toggle('cm-hidden', !settings.bridgeEnabled));
        }
        if (settings.bridgeMethod !== undefined) {
            bridge.configure({ method: settings.bridgeMethod });
            if (dom.settingBridgeMethod) dom.settingBridgeMethod.value = settings.bridgeMethod;
        }
        if (settings.bridgeTargetOrigin !== undefined) {
            bridge.configure({ targetOrigin: settings.bridgeTargetOrigin });
            if (dom.settingBridgeTarget) dom.settingBridgeTarget.value = settings.bridgeTargetOrigin;
        }
        if (settings.bridgeAutoDecode !== undefined) {
            bridge.configure({ autoDecode: settings.bridgeAutoDecode });
            if (dom.settingBridgeAutoDecode) dom.settingBridgeAutoDecode.checked = settings.bridgeAutoDecode;
        }
        if (settings.bridgeAllowDetection !== undefined) {
            bridge.configure({ allowDetection: settings.bridgeAllowDetection });
            if (dom.settingBridgeAllowDetection) dom.settingBridgeAllowDetection.checked = settings.bridgeAllowDetection;
        }

        // Stego channel toggles
        if (settings.letterStegoEnabled !== undefined) {
            const cb = document.getElementById('chLetterStego');
            if (cb) cb.checked = settings.letterStegoEnabled;
        }

        // Synonym threshold
        if (settings.synThreshold !== undefined && dom.synThreshold) {
            dom.synThreshold.value = settings.synThreshold;
            if (dom.thresholdVal) dom.thresholdVal.textContent = settings.synThreshold.toFixed(2);
        }

        // Letter density
        if (settings.letterDensity !== undefined && dom.letterDensity) {
            dom.letterDensity.value = settings.letterDensity;
            if (dom.densityVal) dom.densityVal.textContent = settings.letterDensity + '%';
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
    }
}

// ─── Stego Capacity Stats & Live Analysis ───────────────────

function updateStegoStats() {
    if (!state.stegoReady) return;

    const secret = dom.secretMessage?.value || '';
    const carrier = dom.carrierText?.value || '';

    const secretBytes = state.stegoEngine?.crypto
        ? state.stegoEngine.crypto.stringToBytes(secret).length
        : new TextEncoder().encode(secret).length;

    // Use analyzer for auto channel detection
    const autoChannels = state.stegoAnalyzer
        ? state.stegoAnalyzer.getAutoChannels(carrier)
        : [];

    // Set the engine's active channels to the auto-detected ones
    if (autoChannels.length > 0) {
        state.stegoEngine.setActiveChannels(autoChannels);
    }

    // Analyze capacity with auto channels
    let capacityBits = 0;
    if (carrier && autoChannels.length > 0) {
        try {
            const analysis = state.stegoEngine.analyzeCarrier(carrier);
            capacityBits = Math.floor(analysis.totalBits);
        } catch (e) {
            // silent
        }
    }

    // Calculate required bits (encrypted message size)
    const overhead = state.stegoEngine.crypto
        ? state.stegoEngine.crypto.getOverhead(secretBytes)
        : 2;
    const encryptedBytes = secretBytes + overhead;
    const requiredBits = encryptedBytes * 8;

    // Update capacity badge
    const badge = document.getElementById('capacity-badge');
    if (badge) {
        badge.textContent = `${capacityBits} бит`;
        badge.classList.remove('cm-stego-capacity-badge--low', 'cm-stego-capacity-badge--ok');
        if (capacityBits === 0) {
            badge.classList.add('cm-stego-capacity-badge--low');
        } else if (capacityBits < requiredBits) {
            badge.classList.add('cm-stego-capacity-badge--ok');
        }
    }
}

/**
 * Try to generate a live preview of the stego encoding.
 * Shows result even if capacity is insufficient (with warning).
 * Only requires carrier text + password; secret message can be empty for preview.
 */
let _livePreviewTimer = null;
function _tryLivePreview() {
    clearTimeout(_livePreviewTimer);
    _livePreviewTimer = setTimeout(async () => {
        if (!state.stegoReady) return;

        const secret = dom.secretMessage?.value || '';
        const carrier = dom.carrierText?.value || '';
        const password = dom.passwordEncode?.value || '';

        if (!carrier || !password) {
            if (dom.outputText) dom.outputText.textContent = '';
            return;
        }

        // Use a default secret if empty (for preview purposes)
        const previewSecret = secret || 'тест';

        try {
            let autoChannels = state.stegoAnalyzer
                ? state.stegoAnalyzer.getAutoChannels(carrier)
                : [];
            // Respect letter-stego toggle (same as handleStegoEncode)
            if (!_isLetterStegoEnabled()) {
                autoChannels = autoChannels.filter(ch => ch !== 'letter-stego');
            }
            if (autoChannels.length > 0) {
                state.stegoEngine.setActiveChannels(autoChannels);
            }

            const stegoText = await state.stegoEngine.encodeMessage(previewSecret, carrier, password);
            if (dom.outputText) {
                if (!secret) {
                    dom.outputText.textContent = stegoText + '\n\n⚠ Предпросмотр (введите секретное сообщение)';
                } else {
                    dom.outputText.textContent = stegoText;
                }
            }
        } catch (e) {
            if (dom.outputText) {
                dom.outputText.textContent = `⚠ ${e.message}`;
            }
        }
    }, 500);
}

/**
 * Render analysis result to the carrier overlay and channel badges.
 * Called by StegoAnalyzer.onChange callback.
 */
function _renderAnalysisResult(result) {
    // Set engine's active channels from the analysis result,
    // filtering by user's letter-stego toggle
    if (state.stegoEngine && result.channels.length > 0) {
        let activeChannelNames = result.channels
            .filter(ch => ch.bits > 0)
            .map(ch => ch.name);
        // Only letter-stego can be optionally disabled —
        // it's safe because it's always last in the bases array and
        // returns all-zero indices when not encoded (trailing zeros
        // don't affect the mixed-radix number M).
        if (!_isLetterStegoEnabled()) {
            activeChannelNames = activeChannelNames.filter(ch => ch !== 'letter-stego');
        }
        if (activeChannelNames.length > 0) {
            state.stegoEngine.setActiveChannels(activeChannelNames);
        }
    }

    // Update carrier overlay with highlighted HTML
    // Only update if the analysis text matches the current textarea value,
    // otherwise the overlay would show stale highlighted text that misaligns the cursor.
    const carrier = dom.carrierText;
    const overlay = document.getElementById('carrier-overlay');
    if (overlay && carrier) {
        if (result.text === carrier.value) {
            if (result.highlightedHTML) {
                overlay.innerHTML = result.highlightedHTML;
            } else {
                overlay.innerHTML = '';
            }
            // Re-sync scroll after replacing overlay content with highlighted HTML
            _syncCarrierScroll();
        }
        // If text has changed since analysis started, _syncCarrierOverlay
        // already set plain text — leave it until next analysis catches up.
    }

    // Update channel badges — show all detected channels,
    // but mark letter-stego as disabled if user toggled it off
    const lsEnabled = _isLetterStegoEnabled();
    const chEl = document.getElementById('stego-channels');
    if (chEl) {
        if (result.channels.length === 0) {
            chEl.innerHTML = '<span style="font-size:11px;color:var(--cm-text-muted);">Каналы не обнаружены</span>';
        } else {
            chEl.innerHTML = result.channels.map(ch => {
                const c = ch.color;
                const isDisabled = (ch.name === 'letter-stego' && !lsEnabled);
                const dimStyle = isDisabled ? 'opacity:0.4;text-decoration:line-through;' : '';
                return `<span class="cm-stego-channel-badge" style="background:${c.bg};border-color:${c.border};color:${c.text};${dimStyle}">`
                    + `<span class="cm-stego-channel-badge__dot" style="background:${c.border};"></span>`
                    + `${ch.label}`
                    + `<span class="cm-stego-channel-badge__bits">${ch.bits.toFixed(1)}b</span>`
                    + `</span>`;
            }).join('');
        }
    }

    // Update capacity badge
    const badge = document.getElementById('capacity-badge');
    if (badge) {
        // Calculate effective bits (excluding letter-stego if disabled)
        const effectiveBits = lsEnabled
            ? result.totalBits
            : result.channels
                .filter(ch => ch.name !== 'letter-stego')
                .reduce((sum, ch) => sum + ch.bits, 0);
        const bits = Math.floor(effectiveBits);
        badge.textContent = `${bits} бит`;
        badge.classList.remove('cm-stego-capacity-badge--low', 'cm-stego-capacity-badge--ok');
        const secret = dom.secretMessage?.value || '';
        const secretBytes = state.stegoEngine?.crypto
            ? state.stegoEngine.crypto.stringToBytes(secret).length
            : new TextEncoder().encode(secret).length;
        const overhead = state.stegoEngine?.crypto
            ? state.stegoEngine.crypto.getOverhead(secretBytes)
            : 2;
        const requiredBits = (secretBytes + overhead) * 8;
        if (bits === 0) {
            badge.classList.add('cm-stego-capacity-badge--low');
        } else if (bits < requiredBits) {
            badge.classList.add('cm-stego-capacity-badge--ok');
        }
    }

    // Try live preview whenever analysis updates
    _tryLivePreview();
}

// ─── Stego Channel Auto-Detection ────────────────────────────

/**
 * Check if letter-stego is enabled via the settings checkbox.
 * Only letter-stego can be safely disabled — all other channels are always active
 * because disabling them would break decoding (the decoder auto-detects them
 * from the text and reads "natural" non-zero indices that corrupt the mixed-radix number).
 */
function _isLetterStegoEnabled() {
    const cb = document.getElementById('chLetterStego');
    return cb ? cb.checked : true;
}

function updateActiveChannels() {
    if (!state.stegoReady) return;

    // Auto-detect channels from current carrier text
    const carrier = dom.carrierText?.value || '';
    if (carrier && state.stegoAnalyzer) {
        const autoChannels = state.stegoAnalyzer.getAutoChannels(carrier);
        // Only letter-stego can be optionally disabled
        const active = _isLetterStegoEnabled()
            ? autoChannels
            : autoChannels.filter(ch => ch !== 'letter-stego');
        if (active.length > 0) {
            state.stegoEngine.setActiveChannels(active);
        }
    }
    updateStegoStats();
}

// ─── Base64url Helpers ───────────────────────────────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_DECODE = new Map();
B64_CHARS.split('').forEach((ch, i) => B64_DECODE.set(ch, i));

function _bytesToBase64url(bytes) {
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const bits = (a << 16) | (b << 8) | c;
        result += B64_CHARS[(bits >> 18) & 0x3F];
        result += B64_CHARS[(bits >> 12) & 0x3F];
        result += (i + 1 < bytes.length) ? B64_CHARS[(bits >> 6) & 0x3F] : '';
        result += (i + 2 < bytes.length) ? B64_CHARS[bits & 0x3F] : '';
    }
    return result;
}

function _base64urlToBytes(str) {
    if (!str) return null;
    if (str.length === 0) return new Uint8Array(0);

    const len = str.length;
    const remainder = len % 4;
    if (remainder === 1) return null; // invalid base64

    // Calculate exact output byte count
    let outputLen;
    if (remainder === 0) {
        outputLen = Math.floor(len / 4) * 3;
    } else if (remainder === 2) {
        outputLen = Math.floor(len / 4) * 3 + 1;
    } else { // remainder === 3
        outputLen = Math.floor(len / 4) * 3 + 2;
    }

    const bytes = new Uint8Array(outputLen);
    let byteIdx = 0;
    let i = 0;

    // Process complete groups of 4 chars → 3 bytes
    while (i + 4 <= len) {
        const a = B64_DECODE.get(str[i++]) ?? 0;
        const b = B64_DECODE.get(str[i++]) ?? 0;
        const c = B64_DECODE.get(str[i++]) ?? 0;
        const d = B64_DECODE.get(str[i++]) ?? 0;
        const bits = (a << 18) | (b << 12) | (c << 6) | d;
        bytes[byteIdx++] = (bits >> 16) & 0xFF;
        bytes[byteIdx++] = (bits >> 8) & 0xFF;
        bytes[byteIdx++] = bits & 0xFF;
    }

    // Process remaining chars (2 or 3)
    if (remainder === 2) {
        const a = B64_DECODE.get(str[i]) ?? 0;
        const b = B64_DECODE.get(str[i + 1]) ?? 0;
        bytes[byteIdx++] = ((a << 2) | (b >> 4)) & 0xFF;
    } else if (remainder === 3) {
        const a = B64_DECODE.get(str[i]) ?? 0;
        const b = B64_DECODE.get(str[i + 1]) ?? 0;
        const c = B64_DECODE.get(str[i + 2]) ?? 0;
        bytes[byteIdx++] = ((a << 2) | (b >> 4)) & 0xFF;
        bytes[byteIdx++] = ((b << 4) | (c >> 2)) & 0xFF;
    }

    return bytes;
}

// ─── Stego Carrier Overlay Sync ──────────────────────────────

/**
 * Sync the carrier overlay with the textarea content.
 * Immediately shows plain text (matching textarea exactly) so cursor stays aligned.
 * The debounced analysis will later replace with highlighted HTML.
 */
function _syncCarrierOverlay() {
    const carrier = dom.carrierText;
    const overlay = document.getElementById('carrier-overlay');
    if (!carrier || !overlay) return;

    if (!carrier.value) {
        // Show placeholder text (no highlights)
        overlay.setAttribute('data-placeholder', carrier.placeholder || '');
        overlay.innerHTML = '';
    } else {
        // Immediately show plain text — keeps cursor aligned with visible text.
        // The debounced analyzer will replace this with highlighted HTML shortly.
        overlay.removeAttribute('data-placeholder');
        // Use textContent for safety (no XSS) + white-space:pre-wrap handles newlines
        overlay.textContent = carrier.value;
    }

    // Re-sync scroll position after content change
    _syncCarrierScroll();
}

/**
 * Sync the overlay scroll position with the textarea.
 * The overlay uses overflow:hidden — only JS can scroll it.
 * Must be called after every overlay content update and on textarea scroll.
 */
function _syncCarrierScroll() {
    const overlay = document.getElementById('carrier-overlay');
    if (overlay && dom.carrierText) {
        overlay.scrollTop = dom.carrierText.scrollTop;
        overlay.scrollLeft = dom.carrierText.scrollLeft;
    }
}

// ─── Stego Tooltip System ───────────────────────────────────

let _stegoTooltipEl = null;
let _stegoTooltipTimer = null;

/**
 * Initialize the stego tooltip system.
 * Creates a fixed-position tooltip element and sets up hover detection
 * on the carrier overlay's highlighted spans via mousemove.
 */
function _initStegoTooltip() {
    // Create tooltip element
    _stegoTooltipEl = document.createElement('div');
    _stegoTooltipEl.className = 'cm-stego-tooltip';
    const messenger = document.querySelector('.crypto-messenger');
    if (messenger) {
        messenger.appendChild(_stegoTooltipEl);
    } else {
        document.body.appendChild(_stegoTooltipEl);
    }

    // Listen for mousemove on the carrier container to detect hover over highlights
    const container = document.getElementById('carrierContainer');
    if (container) {
        container.addEventListener('mousemove', (e) => {
            _handleStegoHover(e, container);
        });
        container.addEventListener('mouseleave', () => {
            _hideStegoTooltip();
        });
    }
}

function _handleStegoHover(e, container) {
    const overlay = document.getElementById('carrier-overlay');
    if (!overlay) return;

    // Find all highlighted spans and check if mouse is over any
    const spans = overlay.querySelectorAll('.stego-hl[data-tooltip]');
    let found = null;

    for (const span of spans) {
        const rect = span.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            found = span;
            break;
        }
    }

    if (found) {
        const tooltipText = found.getAttribute('data-tooltip');
        if (tooltipText) {
            _showStegoTooltip(tooltipText, found);
        }
    } else {
        _hideStegoTooltip();
    }
}

function _showStegoTooltip(text, anchorEl) {
    if (!_stegoTooltipEl) return;

    clearTimeout(_stegoTooltipTimer);

    // Decode HTML entities in tooltip text (data-tooltip may contain &#10; for newlines)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const decodedText = tempDiv.textContent || tempDiv.innerText || text;
    _stegoTooltipEl.textContent = decodedText;

    // Position above the anchor element
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    let top = rect.top - 8;

    // Make sure tooltip is visible
    _stegoTooltipEl.style.left = left + 'px';
    _stegoTooltipEl.style.top = top + 'px';
    _stegoTooltipEl.style.transform = 'translate(-50%, -100%)';

    // Adjust if tooltip goes off-screen
    requestAnimationFrame(() => {
        const tooltipRect = _stegoTooltipEl.getBoundingClientRect();
        if (tooltipRect.left < 8) {
            _stegoTooltipEl.style.left = (8 + tooltipRect.width / 2) + 'px';
        }
        if (tooltipRect.right > window.innerWidth - 8) {
            _stegoTooltipEl.style.left = (window.innerWidth - 8 - tooltipRect.width / 2) + 'px';
        }
        if (tooltipRect.top < 8) {
            // Show below instead
            _stegoTooltipEl.style.top = (rect.bottom + 8) + 'px';
            _stegoTooltipEl.style.transform = 'translate(-50%, 0)';
        }
    });

    _stegoTooltipEl.classList.add('visible');
}

function _hideStegoTooltip() {
    if (!_stegoTooltipEl) return;
    _stegoTooltipTimer = setTimeout(() => {
        _stegoTooltipEl.classList.remove('visible');
    }, 100);
}

// ─── Event Listeners ─────────────────────────────────────────

function initEventListeners() {
    // Main mode tabs
    $$('.cm-tab').forEach(tab => {
        tab.addEventListener('click', () => switchMainMode(tab.dataset.category));
    });

    // Sub-mode tabs
    $$('.cm-subtab').forEach(subtab => {
        subtab.addEventListener('click', () => switchSubMode(subtab.dataset.mode));
    });

    // Direction toggle
    $$('.cm-direction-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => switchDirection(btn.dataset.direction));
    });

    // Encrypt send
    dom.btnEncryptSend?.addEventListener('click', handleEncryptSend);
    dom.encryptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEncryptSend();
        }
    });

    // Encrypt input live preview
    dom.encryptInput?.addEventListener('input', _tryEncryptPreview);

    // Password toggles
    _initPasswordToggle(dom.btnToggleEncryptPw, dom.encryptPassword);
    _initPasswordToggle(dom.btnToggleStegoEncPw, dom.passwordEncode);
    _initPasswordToggle(dom.btnToggleStegoDecPw, dom.passwordDecode);
    _initPasswordToggle(dom.btnToggleStegoRecPw, dom.passwordRecovery);

    // Encrypt copy
    dom.btnEncryptCopy?.addEventListener('click', () => {
        _copyToClipboard(dom.encryptInput.value);
    });

    // Encrypt result copy
    dom.btnEncryptResultCopy?.addEventListener('click', () => {
        const text = dom.encryptResultPreview?.textContent;
        if (text) _copyToClipboard(text);
    });

    // Bridge send
    dom.btnBridgeSend?.addEventListener('click', async () => {
        const text = dom.encryptResultPreview?.textContent;
        if (!text) return;
        const sent = await bridge.send(text, state.chatId);
        if (sent) {
            showToast('Отправлено через мост', 'success');
        } else {
            showToast('Мост не подключён или отправка не удалась', 'warning');
        }
    });

    // Bridge settings
    dom.settingBridgeEnabled?.addEventListener('change', () => {
        const enabled = dom.settingBridgeEnabled.checked;
        bridge.configure({ enabled });
        // Show/hide bridge detail rows based on enabled state
        const detailRows = document.querySelectorAll('#bridge-method-row, #bridge-target-row, #bridge-autodecode-row, #bridge-allow-detection-row');
        detailRows.forEach(el => el.classList.toggle('cm-hidden', !enabled));
        showToast(enabled ? 'Мост включён' : 'Мост выключен', 'info');
        _saveSettings();
    });

    dom.settingBridgeMethod?.addEventListener('change', () => {
        bridge.configure({ method: dom.settingBridgeMethod.value });
        _saveSettings();
    });

    dom.settingBridgeTarget?.addEventListener('change', () => {
        bridge.configure({ targetOrigin: dom.settingBridgeTarget.value });
        _saveSettings();
    });

    dom.settingBridgeAutoDecode?.addEventListener('change', () => {
        bridge.configure({ autoDecode: dom.settingBridgeAutoDecode.checked });
        _saveSettings();
    });

    dom.settingBridgeAllowDetection?.addEventListener('change', () => {
        bridge.configure({ allowDetection: dom.settingBridgeAllowDetection.checked });
        _saveSettings();
    });

    // Stego encode
    dom.btnEncode?.addEventListener('click', handleStegoEncode);
    dom.secretMessage?.addEventListener('input', () => {
        updateStegoStats();
        _tryLivePreview();
    });
    // ─── Quick-insert aliases: [steg-email], [steg-phone], [steg-url] ───
    // When user types these aliases, they auto-expand to realistic placeholders
    const STEG_ALIASES = {
        '[steg-email]': 'ivanov.petrov@yandex.ru',
        '[steg-phone]': '+79001234567',
        '[steg-url]':   'https://example.com/page',
    };
    let _aliasExpanding = false; // guard against infinite loop

    function _expandStegAliases(textarea) {
        if (_aliasExpanding) return; // prevent re-entry
        const text = textarea.value;

        for (const [alias, replacement] of Object.entries(STEG_ALIASES)) {
            const aliasIdx = text.indexOf(alias);
            if (aliasIdx !== -1) {
                _aliasExpanding = true;
                const before = text.slice(0, aliasIdx);
                const after = text.slice(aliasIdx + alias.length);
                textarea.value = before + replacement + after;
                // Place cursor after the replacement
                const newCursor = aliasIdx + replacement.length;
                textarea.setSelectionRange(newCursor, newCursor);
                showToast(`Алиас ${alias} → ${replacement}`, 'info');
                break; // only expand one alias at a time
            }
        }
    }

    // Check for aliases on input
    dom.carrierText?.addEventListener('input', () => {
        // Check for alias expansion (has re-entry guard)
        _expandStegAliases(dom.carrierText);
        _aliasExpanding = false;
        // Sync overlay immediately (cheap) — keeps cursor aligned
        _syncCarrierOverlay();
        // Debounce the heavy analysis (non-blocking)
        if (state.stegoAnalyzer) {
            state.stegoAnalyzer.analyzeDebounced(dom.carrierText.value);
        } else {
            // Fallback: update stats synchronously only if no analyzer
            updateStegoStats();
        }
    });
    dom.passwordEncode?.addEventListener('input', _tryLivePreview);
    dom.passwordDecode?.addEventListener('input', () => {});

    // Carrier textarea scroll sync → overlay
    // Overlay uses overflow:hidden, so only JS can scroll it.
    dom.carrierText?.addEventListener('scroll', _syncCarrierScroll);

    // Explicitly handle paste: ensure analysis triggers after paste
    dom.carrierText?.addEventListener('paste', () => {
        // Use requestAnimationFrame to ensure the paste has been applied to textarea.value
        requestAnimationFrame(() => {
            _syncCarrierOverlay();
            // Debounce the heavy analysis (non-blocking)
            if (state.stegoAnalyzer) {
                state.stegoAnalyzer.analyzeDebounced(dom.carrierText.value);
            }
        });
    });

    // Stego tooltip system (fixed-position, not clipped by overflow)
    _initStegoTooltip();

    // Stego decode
    dom.btnDecode?.addEventListener('click', handleStegoDecode);

    // Stego recovery
    dom.btnRecovery?.addEventListener('click', handleStegoRecovery);

    // Stego copy
    dom.btnCopy?.addEventListener('click', () => {
        _copyToClipboard(dom.outputText.textContent);
    });

    // Settings
    dom.btnSettings?.addEventListener('click', openSettings);
    dom.btnCloseSettings?.addEventListener('click', closeSettings);
    dom.settingsOverlay?.addEventListener('click', closeSettings);

    // Chat ID
    dom.settingCurrentChatId?.addEventListener('change', () => {
        state.chatId = dom.settingCurrentChatId.value.trim();
        dom.chatIdDisplay.textContent = state.chatId || '—';

        // Auto-fill password if saved
        const saved = CleanCrypto.getSavedPassword(state.chatId);
        if (saved) {
            dom.encryptPassword.value = saved;
            dom.passwordEncode.value = saved;
            dom.passwordDecode.value = saved;
        }
    });

    // Chat password management
    dom.btnAddChatPw?.addEventListener('click', _addChatPassword);

    // Remember password toggle - save password when chatId changes
    dom.settingRememberPw?.addEventListener('change', () => {
        _saveSettings();
        if (dom.settingRememberPw.checked && state.chatId) {
            const pw = dom.encryptPassword.value;
            if (pw) {
                CleanCrypto.savePassword(state.chatId, pw);
                _loadChatPasswords();
            }
        }
    });

    // Stego channel toggles
    $$('.channel-toggle').forEach(cb => {
        cb.addEventListener('change', () => { updateActiveChannels(); _saveSettings(); });
    });

    // Synonym threshold slider
    dom.synThreshold?.addEventListener('input', () => {
        const val = parseFloat(dom.synThreshold.value);
        if (dom.thresholdVal) dom.thresholdVal.textContent = val.toFixed(2);
        const synCh = state.stegoEngine?.channels?.['synonyms'];
        if (synCh) synCh.setThreshold(val);
        updateStegoStats();
        _saveSettings();
    });

    // Letter density slider
    dom.letterDensity?.addEventListener('input', () => {
        const val = parseInt(dom.letterDensity.value);
        if (dom.densityVal) dom.densityVal.textContent = val + '%';
        const letterCh = state.stegoEngine?.channels?.['letter-stego'];
        if (letterCh) letterCh.setDensity(val / 100);
        updateStegoStats();
        _saveSettings();
    });

    // Synonym mode buttons
    $$('.syn-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.syn-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.synmode;
            const synCh = state.stegoEngine?.channels?.['synonyms'];
            if (synCh) synCh.setMode(mode);

            // Show/hide backend rows
            const backendRows = [document.getElementById('backend-url-row'),
                                document.getElementById('backend-status-row'),
                                document.getElementById('backend-check-row')];
            backendRows.forEach(el => el?.classList.toggle('cm-hidden', mode !== 'backend'));

            updateStegoStats();
        });
    });

    // Backend check
    document.getElementById('btn-check-backend')?.addEventListener('click', async () => {
        const synCh = state.stegoEngine?.channels?.['synonyms'];
        const statusEl = document.getElementById('backend-status');
        if (!synCh || !statusEl) return;

        const urlInput = document.getElementById('backend-url');
        if (urlInput) synCh.setBackendUrl(urlInput.value.trim());

        statusEl.textContent = '⏳ Проверка…';
        statusEl.style.color = 'var(--cm-text-muted)';
        const ok = await synCh.checkBackend();
        statusEl.textContent = ok ? '✅ Доступен' : '❌ Недоступен';
        statusEl.style.color = ok ? 'var(--cm-accent)' : 'var(--cm-danger)';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });

    // Bridge incoming messages listener
    // SECURITY: Decrypted text is shown in our UI only — never sent back through the bridge
    bridge.listen(async ({ text, chatId, timestamp }) => {
        if (!bridge.autoDecode) return;
        const password = CleanCrypto.getSavedPassword(chatId) || dom.encryptPassword.value;
        if (!password) return;

        try {
            const result = await bridge._tryAutoDecode(text, password, chatId);
            if (result) {
                _showEncryptResult(result.text);
                showToast(`Авто-декодирование (${result.method})`, 'success');
            }
        } catch (e) {
            // silent
        }
    });
}

function _initPasswordToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        // Update icon
        const use = btn.querySelector('use');
        if (use) {
            use.setAttribute('href', `assets/icons/sprite.svg#icon-${isPassword ? 'eye-off' : 'eye'}`);
        }
    });
}

function _copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Скопировано!', 'success');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Скопировано!', 'success');
    });
}

// ─── Initialize StegoEngine (async, non-blocking) ────────────

async function initStegoEngine() {
    try {
        if (typeof Az === 'undefined') {
            console.warn('Az.js not loaded, steganography disabled');
            return;
        }

        const { default: StegoEngine } = await import('./core/engine.js');
        const engine = new StegoEngine();

        if (dom.loadingProgress) dom.loadingProgress.style.width = '30%';

        await engine.loadChannels('');

        if (dom.loadingProgress) dom.loadingProgress.style.width = '100%';

        state.stegoEngine = engine;
        state.stegoReady = true;
        window.__stegoEngine = engine; // debug

        // Create analyzer for auto channel detection and highlighting
        const analyzer = new StegoAnalyzer(engine);
        analyzer.onChange(_renderAnalysisResult);

        // Connect analyzer progress indicator
        analyzer.onProgress((analyzing) => {
            const container = document.getElementById('carrierContainer');
            if (container) {
                container.classList.toggle('analyzing', analyzing);
            }
        });

        state.stegoAnalyzer = analyzer;

        // Initialize StegoT9
        const { default: StegoT9 } = await import('./ui/stego-t9.js');
        if (dom.carrierText) {
            new StegoT9(dom.carrierText, engine);
        }

        // Initial stats
        updateActiveChannels();

        console.log('✅ StegoEngine ready. Channels:', Object.keys(engine.channels).length);
    } catch (e) {
        console.error('❌ StegoEngine init error:', e);
    }
}

// ─── Main Init ───────────────────────────────────────────────

async function init() {
    console.log('🔒 Стегонатор initializing…');

    // Load chat passwords (only if user previously opted in)
    _loadChatPasswords();

    // Load all saved settings from localStorage
    _loadSettings();

    // Init event listeners
    initEventListeners();

    // Set initial mode
    switchMainMode('encryption');
    switchDirection('encode');

    // Hide loading (stego engine loads in background)
    setTimeout(() => {
        if (dom.loading) {
            dom.loading.classList.add('hidden');
            setTimeout(() => dom.loading.style.display = 'none', 400);
        }
    }, 300);

    // Init stego engine (async, non-blocking)
    initStegoEngine().then(() => {
        // Re-hide loading after stego is ready
        if (dom.loading) {
            dom.loading.classList.add('hidden');
            setTimeout(() => dom.loading.style.display = 'none', 400);
        }
    });

    // Init Dev Tester (Ctrl+Shift+D)
    try {
        const { initDevShortcut, toggleDevPanel, runAllTests } = await import('./dev/dev-tester.js');
        initDevShortcut(state.stegoEngine);

        // Double-click on logo to open dev panel
        const logoEl = document.querySelector('.cm-header__logo');
        if (logoEl) {
            logoEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                toggleDevPanel(state.stegoEngine);
            });
        }

        // Expose to API
        window.StegonatorAPI.runDevTests = () => runAllTests(state.stegoEngine);
        window.StegonatorAPI.toggleDevPanel = () => toggleDevPanel(state.stegoEngine);

        console.log('🧪 Dev Tester ready (Ctrl+Shift+D)');
    } catch (e) {
        console.warn('Dev Tester not loaded:', e.message);
    }

    console.log('✅ Стегонатор ready!');
}

// ─── Public API (for integration: Tampermonkey, extensions, etc.) ──

window.StegonatorAPI = {
    /**
     * Set the current chat ID (for per-chat password management)
     * @param {string} chatId
     */
    setChatId(chatId) {
        state.chatId = chatId;
        dom.chatIdDisplay.textContent = chatId || '—';
        dom.settingCurrentChatId.value = chatId;

        // Auto-fill saved password
        const saved = CleanCrypto.getSavedPassword(chatId);
        if (saved) {
            dom.encryptPassword.value = saved;
            dom.passwordEncode.value = saved;
            dom.passwordDecode.value = saved;
        }
    },

    /**
     * Encrypt a message and return the encoded string
     * @param {string} plaintext
     * @param {string} password
     * @param {string} mode - 'aes256', 'invisible', 'base64', 'emoji', 'chinese', 'layout'
     * @returns {Promise<string>}
     */
    async encrypt(plaintext, password, mode = 'aes256') {
        const chatId = state.chatId;

        if (mode === 'layout') {
            return LayoutSwitchEncoder.encodeString(plaintext, false);
        }

        const encrypted = await cleanCrypto.encrypt(plaintext, password, chatId);

        if (mode === 'aes256') {
            return _bytesToBase64url(encrypted);
        }

        const encoderId = mode === 'invisible' ? 'invisible-spaces' : mode;
        const encoder = getEncoderById(encoderId);
        if (!encoder) throw new Error('Unknown encoder: ' + mode);

        if (encoder.encode.constructor.name === 'AsyncFunction') {
            return await encoder.encode(encrypted);
        }
        return encoder.encode(encrypted);
    },

    // REMOVED: decrypt() — returns plaintext, should NOT be in public API
    // REMOVED: autoDecode() — returns plaintext, should NOT be in public API
    // REMOVED: getStegoEngine() — exposes engine internals, should NOT be in public API

    /**
     * Detect if text contains encrypted or steganographic content.
     * Returns ONLY metadata — never decrypts or returns plaintext.
     * @param {string} text
     * @returns {{ isEncrypted: boolean, algorithm: string|null, isStego: boolean, stegoCapacity: number }}
     */
    detect(text) {
        return bridge.detectEncryption(text);
    },

    /**
     * Encode a secret message into carrier text using steganography.
     * Returns the stego text only — never the plaintext secret.
     * @param {string} secret - The secret message to hide
     * @param {string} carrier - The carrier text to hide within
     * @param {string} password - Encryption password
     * @returns {Promise<string|null>} The stego text, or null on failure
     */
    async stegoEncode(secret, carrier, password) {
        if (!state.stegoReady) return null;
        try {
            let autoChannels = state.stegoAnalyzer
                ? state.stegoAnalyzer.getAutoChannels(carrier)
                : [];
            if (!_isLetterStegoEnabled()) {
                autoChannels = autoChannels.filter(ch => ch !== 'letter-stego');
            }
            if (autoChannels.length > 0) {
                state.stegoEngine.setActiveChannels(autoChannels);
            }
            return await state.stegoEngine.encodeMessage(secret, carrier, password);
        } catch (e) {
            return null;
        }
    },

    /**
     * Decode a steganographic message. TRUSTED ONLY — for automation use.
     * Returns the decoded message text.
     * @param {string} stegoText - The stego text containing a hidden message
     * @param {string} password - Decryption password
     * @returns {Promise<string|null>} The decoded message, or null on failure
     */
    async stegoDecode(stegoText, password) {
        if (!state.stegoReady) return null;
        try {
            const autoChannels = state.stegoAnalyzer
                ? state.stegoAnalyzer.getAutoChannels(stegoText)
                : [];
            if (autoChannels.length > 0) {
                state.stegoEngine.setActiveChannels(autoChannels);
            }
            return await state.stegoEngine.decodeMessage(stegoText, password);
        } catch (e) {
            return null;
        }
    },

    /**
     * Get the bridge session token (for bridge builder integration).
     * @returns {string|null} The current session token
     */
    bridgeGetToken() {
        return bridge.getToken();
    },

    /**
     * Check if the steganography engine is loaded and ready.
     * @returns {boolean}
     */
    isReady() {
        return state.stegoReady;
    },

    /**
     * Get sanitized app state (safe fields only).
     * Removes sensitive internal references (stegoEngine, stegoAnalyzer).
     */
    getState() {
        const safe = { ...state };
        delete safe.stegoEngine;
        delete safe.stegoAnalyzer;
        return safe;
    },

    /**
     * Show a toast notification
     */
    notify: showToast,

    /**
     * Send text via bridge
     * @param {string} text - encrypted text to send
     * @returns {Promise<boolean>}
     */
    async bridgeSend(text) {
        return bridge.send(text, state.chatId);
    },

    /**
     * Configure bridge
     * @param {Object} opts - { enabled, method, targetOrigin, autoDecode, allowDetection }
     */
    bridgeConfigure(opts) {
        bridge.configure(opts);
    },

    /**
     * Run developer test suite
     * @returns {Promise<Object>} test summary
     */
    async runDevTests() {
        const { runAllTests } = await import('./dev/dev-tester.js');
        return runAllTests(state.stegoEngine);
    },

    /**
     * Toggle developer test panel
     */
    async toggleDevPanel() {
        const { toggleDevPanel } = await import('./dev/dev-tester.js');
        toggleDevPanel(state.stegoEngine);
    },

    // ─── Debug methods — only available if localStorage flag is set ──
    // Set localStorage.setItem('stegonator_debug', 'true') to enable.

    get _debug() {
        try { return JSON.parse(localStorage.getItem('stegonator_debug') || 'false'); } catch { return false; }
    },

    /**
     * Get stego engine instance (debug only).
     * Requires localStorage flag: stegonator_debug = true
     * @returns {StegoEngine|null}
     */
    _debug_getEngine() {
        if (!this._debug) return null;
        return state.stegoEngine;
    },
};

window.CryptoMsgAPI = window.StegonatorAPI; // backward compat

// ─── Start ───────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
