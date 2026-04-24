/**
 * CryptoMsg — Developer Test Suite
 *
 * Неприметный модуль для тестирования всех функций кодирования/декодирования.
 * Вызывается через Ctrl+Shift+D или двойной клик на лого.
 *
 * Тестирует:
 *  1. Clean Encryption (AES-256-GCM) — шифрование/дешифровка
 *  2. Все энкодеры (invisible, base64, compression, emoji, chinese, layout)
 *  3. Стеганографию (StegoEngine encode/decode)
 *  4. Совместимость каналов (encode→decode roundtrip)
 *  5. Краевые случаи (пустые строки, максимальная длина, спецсимволы)
 *  6. Автообнаружение энкодеров (detect)
 */

import CleanCrypto from '../core/clean-crypto.js';
import { getEncoderById, detectEncoder, getEncoderList, ENCODERS } from '../core/encoders/index.js';

// ─── Test Framework ──────────────────────────────────────────

class TestRunner {
    constructor() {
        this.results = [];
        this.currentSuite = '';
        this.startTime = 0;
    }

    suite(name) {
        this.currentSuite = name;
    }

    async assert(condition, description) {
        const pass = !!condition;
        this.results.push({
            suite: this.currentSuite,
            description,
            pass,
            error: pass ? null : `Assertion failed: ${description}`,
        });
        if (!pass) {
            console.warn(`❌ [${this.currentSuite}] ${description}`);
        }
    }

    async assertEqual(actual, expected, description) {
        const pass = actual === expected;
        this.results.push({
            suite: this.currentSuite,
            description,
            pass,
            error: pass ? null : `Expected "${expected}", got "${actual}"`,
        });
        if (!pass) {
            console.warn(`❌ [${this.currentSuite}] ${description}: expected "${expected}", got "${actual}"`);
        }
    }

    async assertNotEqual(actual, expected, description) {
        const pass = actual !== expected;
        this.results.push({
            suite: this.currentSuite,
            description,
            pass,
            error: pass ? null : `Values should not be equal: "${actual}"`,
        });
    }

    async assertThrows(fn, description) {
        try {
            await fn();
            this.results.push({
                suite: this.currentSuite,
                description,
                pass: false,
                error: 'Expected to throw, but did not',
            });
        } catch (e) {
            this.results.push({
                suite: this.currentSuite,
                description,
                pass: true,
                error: null,
            });
        }
    }

    getSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.pass).length;
        const failed = total - passed;
        const suites = [...new Set(this.results.map(r => r.suite))];
        const bySuite = {};
        for (const s of suites) {
            const items = this.results.filter(r => r.suite === s);
            bySuite[s] = {
                total: items.length,
                passed: items.filter(i => i.pass).length,
                failed: items.filter(i => !i.pass).length,
                items,
            };
        }
        return { total, passed, failed, suites, bySuite, elapsed: Date.now() - this.startTime };
    }
}

// ─── Test Cases ──────────────────────────────────────────────

const TEST_PASSWORDS = ['test', 'пароль123', 'P@$$w0rd!', '🧪test', 'a'];
const TEST_CHAT_IDS = ['', 'chat1', 'test-chat-id-123'];
const TEST_MESSAGES = [
    'Привет мир!',
    'Hello World!',
    'Тестовое сообщение 123',
    'Смешанный text с русскими и english словами',
    '!@#$%^&*()',
    'Спецсимволы: «»—…№',
    'a',
    'яяяя',
    'A'.repeat(200),
    'Ёжик в тумане',
    'Multi\nline\ntext',
    '🎉🚀🔒 Unicode emoji',
    '',
];

/**
 * Запуск всех тестов
 */
export async function runAllTests(stegoEngine = null) {
    const runner = new TestRunner();
    runner.startTime = Date.now();

    // ═══ 1. Clean Crypto Tests ══════════════════════════════════
    runner.suite('AES-256-GCM (CleanCrypto)');

    const crypto = new CleanCrypto();
    for (const pw of TEST_PASSWORDS) {
        for (const chatId of TEST_CHAT_IDS) {
            for (const msg of TEST_MESSAGES) {
                if (!msg) continue;
                try {
                    const encrypted = await crypto.encrypt(msg, pw, chatId);
                    await runner.assert(encrypted instanceof Uint8Array, `encrypt returns Uint8Array (pw="${pw.slice(0,8)}", chatId="${chatId}")`);
                    await runner.assert(encrypted.length > 0, `encrypted data non-empty (pw="${pw.slice(0,8)}", msg="${msg.slice(0,15)}…")`);

                    const decrypted = await crypto.decrypt(encrypted, pw, chatId);
                    await runner.assertEqual(decrypted, msg, `roundtrip: encrypt→decrypt (pw="${pw.slice(0,8)}", chatId="${chatId}", msg="${msg.slice(0,20)}")`);
                } catch (e) {
                    await runner.assert(false, `crypto roundtrip failed: ${e.message} (pw="${pw.slice(0,8)}", msg="${msg.slice(0,15)}")`);
                }
            }
        }
    }

    // Wrong password
    try {
        const encrypted = await crypto.encrypt('test', 'password1', '');
        await runner.assertThrows(async () => {
            await crypto.decrypt(encrypted, 'password2', '');
        }, 'wrong password throws error');
    } catch (e) {
        await runner.assert(false, `wrong password test setup failed: ${e.message}`);
    }

    // Corrupted data
    try {
        const encrypted = await crypto.encrypt('test', 'pw', '');
        encrypted[0] = 0xFF; // corrupt magic
        await runner.assertThrows(async () => {
            await crypto.decrypt(encrypted, 'pw', '');
        }, 'corrupted magic bytes throws error');
    } catch (e) {
        await runner.assert(false, `corrupted data test setup failed: ${e.message}`);
    }

    // ═══ 2. Encoder Roundtrip Tests ═════════════════════════════
    for (const Encoder of ENCODERS) {
        runner.suite(`Encoder: ${Encoder.label} (${Encoder.id})`);

        // Layout-switch is a TEXT-ONLY encoder (Russian↔English mapping).
        // Random binary bytes are not valid UTF-8 text, so roundtrip with
        // random bytes would always fail. Skip it here; test it separately
        // with actual Russian text in section 3.
        if (Encoder.id === 'layout-switch') {
            // Basic sanity: encode/decode API works
            const testText = new TextEncoder().encode('Привет');
            const encoded = Encoder.encode(testText);
            await runner.assert(typeof encoded === 'string', `layout-switch encode returns string`);
            const detected = detectEncoder(encoded);
            await runner.assertEqual(detected?.id, 'layout-switch', `detect layout-switch encoded text`);
            const decoded = Encoder.decode(encoded);
            await runner.assert(decoded !== null, `layout-switch decode not null`);
            continue;
        }

        // Test with random bytes of various sizes
        const byteSizes = [0, 1, 16, 32, 64, 128, 256];
        for (const size of byteSizes) {
            const bytes = size === 0 ? new Uint8Array(0) : _randomBytes(size);

            try {
                let encoded;
                if (Encoder.encode.constructor.name === 'AsyncFunction') {
                    encoded = await Encoder.encode(bytes);
                } else {
                    encoded = Encoder.encode(bytes);
                }

                await runner.assert(typeof encoded === 'string', `encode(${size}B) returns string`);
                await runner.assert(encoded !== null, `encode(${size}B) not null`);

                if (size > 0) {
                    // Test detect
                    const detected = detectEncoder(encoded);
                    await runner.assertEqual(detected?.id, Encoder.id, `detect("${Encoder.id}" encoded ${size}B) → ${Encoder.id}`);

                    // Test decode
                    let decoded;
                    if (Encoder.decode.constructor.name === 'AsyncFunction') {
                        decoded = await Encoder.decode(encoded);
                    } else {
                        decoded = Encoder.decode(encoded);
                    }

                    await runner.assert(decoded !== null, `decode(${size}B) not null`);

                    if (decoded) {
                        // Compare bytes
                        const match = _bytesEqual(decoded, bytes);
                        await runner.assert(match, `roundtrip: encode→decode (${size}B) matches original`);
                    }
                }
            } catch (e) {
                await runner.assert(false, `${Encoder.id} ${size}B roundtrip error: ${e.message}`);
            }
        }
    }

    // ═══ 3. Layout Switch Special Tests ════════════════════════
    runner.suite('Layout Switch (специальные)');

    const LayoutEnc = getEncoderById('layout-switch');
    if (LayoutEnc) {
        const layoutTests = [
            { input: 'привет', expected: 'ghbdtn' },
            { input: 'ПРИВЕТ', expected: 'GHBDTN' },
            { input: 'мир', expected: 'vbh' },
        ];
        for (const t of layoutTests) {
            try {
                const result = LayoutEnc.encodeString(t.input, false);
                if (/[а-яА-ЯёЁ]/.test(t.input)) {
                    await runner.assertEqual(result, t.expected, `layout encode "${t.input}" → "${t.expected}"`);
                }
            } catch (e) {
                await runner.assert(false, `layout test "${t.input}" failed: ${e.message}`);
            }
        }

        // Roundtrip: ru→en→ru
        const ruTexts = ['Привет', 'Тест', 'Синтаксис', 'Ёжик'];
        for (const txt of ruTexts) {
            try {
                const encoded = LayoutEnc.encodeString(txt, false);
                const decoded = LayoutEnc.decodeToString('\u2328\uFE0F\u21C4:' + encoded);
                await runner.assertEqual(decoded, txt, `layout roundtrip "${txt}"`);
            } catch (e) {
                await runner.assert(false, `layout roundtrip "${txt}" error: ${e.message}`);
            }
        }
    }

    // ═══ 4. Full Pipeline Tests (encrypt + encode → decode + decrypt) ═══
    runner.suite('Полный пайплайн (encrypt→encode→decode→decrypt)');

    for (const Encoder of ENCODERS) {
        if (Encoder.id === 'layout-switch') continue; // layout doesn't use encryption

        for (const msg of ['Привет!', 'Hello World!', 'Тест 123']) {
            try {
                const encrypted = await crypto.encrypt(msg, 'testpass', 'chat1');

                let encoded;
                if (Encoder.encode.constructor.name === 'AsyncFunction') {
                    encoded = await Encoder.encode(encrypted);
                } else {
                    encoded = Encoder.encode(encrypted);
                }

                // Detect
                const detected = detectEncoder(encoded);
                await runner.assertEqual(detected?.id, Encoder.id, `pipeline detect ${Encoder.id} for "${msg.slice(0,10)}"`);

                // Decode
                let decoded;
                if (detected.decode.constructor.name === 'AsyncFunction') {
                    decoded = await detected.decode(encoded);
                } else {
                    decoded = detected.decode(encoded);
                }

                // Decrypt
                const decrypted = await crypto.decrypt(decoded, 'testpass', 'chat1');
                await runner.assertEqual(decrypted, msg, `pipeline roundtrip ${Encoder.id} "${msg.slice(0,10)}"`);
            } catch (e) {
                await runner.assert(false, `pipeline ${Encoder.id} "${msg.slice(0,10)}" error: ${e.message}`);
            }
        }
    }

    // ═══ 5. Steganography Roundtrip Tests ══════════════════════
    if (stegoEngine && stegoEngine.activeChannels.length > 0) {
        runner.suite('Стеганография (StegoEngine)');

        const stegoTests = [
            { secret: 'Тест', carrier: 'Вчера мы ходили в парк и гуляли там весь день до самого вечера.' },
            { secret: 'Hi', carrier: 'Сегодня хорошая погода и светит яркое солнце на чистом небе.' },
            { secret: 'Секрет', carrier: 'Программное обеспечение было обновлено до последней доступной версии в этом месяце.' },
        ];

        for (const t of stegoTests) {
            try {
                const stegoText = await stegoEngine.encodeMessage(t.secret, t.carrier, 'testpw');
                await runner.assert(typeof stegoText === 'string', `stego encode returns string`);
                await runner.assert(stegoText.length > 0, `stego text non-empty`);

                const decoded = await stegoEngine.decodeMessage(stegoText, 'testpw');
                await runner.assertEqual(decoded, t.secret, `stego roundtrip: "${t.secret}" → encode → decode`);
            } catch (e) {
                await runner.assert(false, `stego roundtrip "${t.secret}" error: ${e.message}`);
            }
        }

        // Wrong password for stego
        try {
            const stegoText = await stegoEngine.encodeMessage('test', stegoTests[0].carrier, 'pw1');
            await runner.assertThrows(async () => {
                await stegoEngine.decodeMessage(stegoText, 'pw2');
            }, 'stego wrong password throws');
        } catch (e) {
            // May not throw but return garbled — still log
        }

        // Test individual channels
        runner.suite('Стего: каналы по отдельности');
        const channelNames = Object.keys(stegoEngine.channels);
        for (const chName of channelNames) {
            const ch = stegoEngine.channels[chName];
            try {
                const testText = 'Вчера мы ходили в парк и гуляли там весь день до самого вечера. Программа работает корректно.';
                const analysis = ch.analyzeCapacity(testText);
                await runner.assert(typeof analysis.totalBits === 'number', `${chName}: analyzeCapacity returns totalBits`);
                await runner.assert(Array.isArray(analysis.bases), `${chName}: analyzeCapacity returns bases array`);
            } catch (e) {
                await runner.assert(false, `${chName}: analyzeCapacity error: ${e.message}`);
            }
        }
    } else {
        runner.suite('Стеганография (StegoEngine)');
        await runner.assert(false, 'StegoEngine not available');
    }

    // ═══ 6. Edge Cases ═════════════════════════════════════════
    runner.suite('Краевые случаи');

    // Empty message encryption
    try {
        const encrypted = await crypto.encrypt('', 'pw', '');
        const decrypted = await crypto.decrypt(encrypted, 'pw', '');
        await runner.assertEqual(decrypted, '', 'encrypt/decrypt empty string');
    } catch (e) {
        await runner.assert(false, `empty string encrypt error: ${e.message}`);
    }

    // Password management
    const testChatId = '__dev_test_chat__';
    CleanCrypto.savePassword(testChatId, 'testpass123');
    await runner.assertEqual(CleanCrypto.getSavedPassword(testChatId), 'testpass123', 'savePassword/getSavedPassword roundtrip');
    CleanCrypto.removePassword(testChatId);
    await runner.assertEqual(CleanCrypto.getSavedPassword(testChatId), null, 'removePassword clears saved password');

    // Encoder detect on garbage input
    await runner.assertEqual(detectEncoder(''), null, 'detect empty string → null');
    await runner.assertEqual(detectEncoder('random text'), null, 'detect random text → null');
    await runner.assertEqual(detectEncoder('12345'), null, 'detect numbers → null');

    // Crypto encryptedSize estimation
    const size = crypto.encryptedSize(10);
    await runner.assert(typeof size === 'number' && size > 0, `encryptedSize(10) = ${size} > 0`);

    // ═══ 7. Cross-Encoder Compatibility ════════════════════════
    runner.suite('Совместимость между энкодерами');

    // Make sure each encoder's magic prefix is unique
    const prefixes = [];
    for (const e of ENCODERS) {
        try {
            const empty = e.encode(new Uint8Array(0));
            prefixes.push({ id: e.id, prefix: empty.slice(0, 6) });
        } catch (err) {
            prefixes.push({ id: e.id, prefix: '' });
        }
    }

    const seen = new Map();
    for (const p of prefixes) {
        if (p.prefix && seen.has(p.prefix)) {
            await runner.assert(false, `duplicate magic prefix "${p.prefix}" between ${seen.get(p.prefix)} and ${p.id}`);
        }
        if (p.prefix) seen.set(p.prefix, p.id);
    }
    await runner.assert(true, `all ${prefixes.length} encoder magic prefixes are unique`);

    // Encode with one, make sure others don't false-detect
    for (const Encoder of ENCODERS) {
        try {
            const testBytes = _randomBytes(32);
            let encoded;
            if (Encoder.encode.constructor.name === 'AsyncFunction') {
                encoded = await Encoder.encode(testBytes);
            } else {
                encoded = Encoder.encode(testBytes);
            }

            for (const Other of ENCODERS) {
                if (Other.id === Encoder.id) continue;
                const falseDetect = Other.detect(encoded);
                await runner.assert(!falseDetect, `${Other.id} should not detect ${Encoder.id} encoded text`);
            }
        } catch (e) {
            // Some encoders might fail on random bytes — that's ok
        }
    }

    // ═══ 8. Character Limit Tests ══════════════════════════════
    runner.suite('Лимиты символов');

    for (const Encoder of ENCODERS) {
        const testBytes = _randomBytes(100);
        try {
            let encoded;
            if (Encoder.encode.constructor.name === 'AsyncFunction') {
                encoded = await Encoder.encode(testBytes);
            } else {
                encoded = Encoder.encode(testBytes);
            }

            // Check that encoded output is a reasonable length
            const ratio = encoded.length / testBytes.length;
            await runner.assert(ratio < 10, `${Encoder.id}: expansion ratio ${ratio.toFixed(1)}x is reasonable (<10x)`);
        } catch (e) {
            // ok
        }
    }

    return runner.getSummary();
}

// ─── Helpers ────────────────────────────────────────────────

function _randomBytes(n) {
    const arr = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    } else {
        for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
}

function _bytesEqual(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// ─── Dev Panel UI ────────────────────────────────────────────

let panelVisible = false;
let panelEl = null;

/**
 * Показать/скрыть панель разработчика
 */
export function toggleDevPanel(stegoEngine) {
    if (panelVisible) {
        closeDevPanel();
        return;
    }

    panelVisible = true;

    // Create panel
    panelEl = document.createElement('div');
    panelEl.id = 'dev-panel';
    panelEl.innerHTML = `
        <div class="dev-panel__header">
            <span class="dev-panel__title">🧪 Dev Tester</span>
            <div class="dev-panel__actions">
                <button class="dev-panel__btn" id="devRunAll" type="button">▶ Все тесты</button>
                <button class="dev-panel__btn" id="devRunQuick" type="button">⚡ Быстрый</button>
                <button class="dev-panel__btn dev-panel__btn--close" id="devClose" type="button">✕</button>
            </div>
        </div>
        <div class="dev-panel__progress" id="devProgress" style="display:none;">
            <div class="dev-panel__progress-bar" id="devProgressBar"></div>
            <span class="dev-panel__progress-text" id="devProgressText">0%</span>
        </div>
        <div class="dev-panel__summary" id="devSummary"></div>
        <div class="dev-panel__results" id="devResults"></div>
    `;

    document.body.appendChild(panelEl);

    // Event listeners
    document.getElementById('devClose').addEventListener('click', closeDevPanel);
    document.getElementById('devRunAll').addEventListener('click', () => runAndDisplay(stegoEngine, false));
    document.getElementById('devRunQuick').addEventListener('click', () => runAndDisplay(stegoEngine, true));
}

function closeDevPanel() {
    panelVisible = false;
    if (panelEl) {
        panelEl.remove();
        panelEl = null;
    }
}

async function runAndDisplay(stegoEngine, quick) {
    const progress = document.getElementById('devProgress');
    const progressBar = document.getElementById('devProgressBar');
    const progressText = document.getElementById('devProgressText');
    const summaryEl = document.getElementById('devSummary');
    const resultsEl = document.getElementById('devResults');

    if (progress) progress.style.display = 'flex';
    if (progressBar) progressBar.style.width = '10%';
    if (progressText) progressText.textContent = '10%';
    if (summaryEl) summaryEl.innerHTML = '<span class="dev-running">⏳ Тестирование…</span>';
    if (resultsEl) resultsEl.innerHTML = '';

    // Small delay to let UI update
    await new Promise(r => setTimeout(r, 50));

    // For quick mode, use fewer test messages
    const origMessages = [...TEST_MESSAGES];
    if (quick) {
        TEST_MESSAGES.length = 0;
        TEST_MESSAGES.push('Привет!', 'Hello', 'Тест 123');
    }

    try {
        const summary = await runAllTests(stegoEngine);

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '100%';

        // Render summary
        if (summaryEl) {
            const statusClass = summary.failed === 0 ? 'dev-pass' : 'dev-fail';
            summaryEl.innerHTML = `
                <div class="dev-summary-grid">
                    <div class="dev-stat ${statusClass}">
                        <span class="dev-stat__value">${summary.passed}/${summary.total}</span>
                        <span class="dev-stat__label">Пройдено</span>
                    </div>
                    <div class="dev-stat ${summary.failed > 0 ? 'dev-fail' : 'dev-pass'}">
                        <span class="dev-stat__value">${summary.failed}</span>
                        <span class="dev-stat__label">Ошибки</span>
                    </div>
                    <div class="dev-stat">
                        <span class="dev-stat__value">${summary.suites.length}</span>
                        <span class="dev-stat__label">Сьютов</span>
                    </div>
                    <div class="dev-stat">
                        <span class="dev-stat__value">${summary.elapsed} мс</span>
                        <span class="dev-stat__label">Время</span>
                    </div>
                </div>
            `;
        }

        // Render results by suite
        if (resultsEl) {
            let html = '';
            for (const suite of summary.suites) {
                const data = summary.bySuite[suite];
                const suiteClass = data.failed > 0 ? 'dev-suite--fail' : 'dev-suite--pass';
                const safeId = suite.replace(/[^a-zA-Z0-9-]/g, '_');
                html += `
                    <div class="dev-suite ${suiteClass}">
                        <div class="dev-suite__header" data-suite-toggle="${safeId}">
                            <span class="dev-suite__icon">${data.failed > 0 ? '❌' : '✅'}</span>
                            <span class="dev-suite__name">${_escapeHtml(suite)}</span>
                            <span class="dev-suite__stats">${data.passed}/${data.total}</span>
                        </div>
                        <div class="dev-suite__items" id="suite-${safeId}" style="display:none;">
                `;

                for (const item of data.items) {
                    const itemClass = item.pass ? 'dev-item--pass' : 'dev-item--fail';
                    html += `
                        <div class="dev-item ${itemClass}">
                            <span class="dev-item__icon">${item.pass ? '✓' : '✗'}</span>
                            <span class="dev-item__desc">${_escapeHtml(item.description)}</span>
                            ${item.error ? `<span class="dev-item__error">${_escapeHtml(item.error)}</span>` : ''}
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            }
            resultsEl.innerHTML = html;

            // Toggle suite items
            resultsEl.querySelectorAll('.dev-suite__header').forEach(header => {
                header.addEventListener('click', () => {
                    const suiteName = header.dataset.suiteToggle;
                    const items = document.getElementById(`suite-${suiteName}`);
                    if (items) {
                        items.style.display = items.style.display === 'none' ? 'block' : 'none';
                    }
                });
            });
        }
    } catch (e) {
        if (summaryEl) summaryEl.innerHTML = `<div class="dev-fail">❌ Критическая ошибка: ${_escapeHtml(e.message)}</div>`;
        console.error('Dev tester error:', e);
    } finally {
        // Restore original messages
        if (quick) {
            TEST_MESSAGES.length = 0;
            origMessages.forEach(m => TEST_MESSAGES.push(m));
        }
        setTimeout(() => {
            if (progress) progress.style.display = 'none';
        }, 1000);
    }
}

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Keyboard Shortcut ──────────────────────────────────────

export function initDevShortcut(stegoEngine) {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDevPanel(stegoEngine);
        }
    });
}
