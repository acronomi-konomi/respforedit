/**
 * CryptoMessenger - Secure Messaging Interface
 * Pure JavaScript implementation
 */

// ============================================
// DOM Elements
// ============================================

const elements = {
    // Main frame
    overlayContainer: document.getElementById('overlayContainer'),
    messengerFrame: document.getElementById('messengerFrame'),
    
    // Header controls
    settingsToggle: document.getElementById('settingsToggle'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    closeBtn: document.getElementById('closeBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    
    // Mode selector
    modeSelector: document.getElementById('modeSelector'),
    modeBtns: document.querySelectorAll('.mode-btn:not(.more-modes)'),
    moreModes: document.getElementById('moreModes'),
    
    // Quick settings
    quickSettingsBtn: document.getElementById('quickSettingsBtn'),
    quickOptions: document.getElementById('quickOptions'),
    autoExpire: document.getElementById('autoExpire'),
    perfectForward: document.getElementById('perfectForward'),
    keyRotation: document.getElementById('keyRotation'),
    strengthPills: document.querySelectorAll('.pill-btn'),
    
    // Input area
    messageInput: document.getElementById('messageInput'),
    encryptionBadge: document.getElementById('encryptionBadge'),
    charCount: document.getElementById('charCount'),
    attachBtn: document.getElementById('attachBtn'),
    sendBtn: document.getElementById('sendBtn'),
    
    // Encryption indicator
    strengthFill: document.getElementById('strengthFill'),
    strengthLabel: document.getElementById('strengthLabel'),
    
    // Settings panel
    settingsPanel: document.getElementById('settingsPanel'),
    closeSettings: document.getElementById('closeSettings'),
    settingsSearch: document.getElementById('settingsSearch'),
    settingsNav: document.getElementById('settingsNav'),
    navItems: document.querySelectorAll('.nav-item'),
    settingsSections: document.querySelectorAll('.settings-section'),
    saveSettings: document.getElementById('saveSettings'),
    resetSettings: document.getElementById('resetSettings'),
    
    // Settings inputs
    kdfIterations: document.getElementById('kdfIterations'),
    kdfIterationsValue: document.getElementById('kdfIterationsValue'),
    
    // Protocol cards
    protocolCards: document.querySelectorAll('.protocol-card'),
    
    // Modes modal
    modesModal: document.getElementById('modesModal'),
    closeModesModal: document.getElementById('closeModesModal'),
    modesSearch: document.getElementById('modesSearch'),
    modeOptions: document.querySelectorAll('.mode-option'),
};

// ============================================
// State Management
// ============================================

const state = {
    currentMode: 'aes256',
    keyStrength: 256,
    isSettingsOpen: false,
    isQuickOptionsVisible: false,
    isModesModalOpen: false,
    isMinimized: false,
    settings: {
        autoExpire: true,
        perfectForward: false,
        keyRotation: false,
        defaultAlgorithm: 'aes256',
        kdf: 'argon2id',
        autoDelete: false,
        expirationTime: 24,
        expirationUnit: 'hours',
        hideTyping: true,
        disableReceipts: false,
        keySize: 256,
        autoKeyRotation: true,
        rotationInterval: '24h',
        pfs: true,
        keyStorage: 'local',
        cipherMode: 'gcm',
        paddingScheme: 'pkcs7',
        ivGeneration: 'random',
        kdfIterations: 100000,
        memoryHardKdf: true,
        sideChannelProtection: true,
        hmacAlgorithm: 'sha256',
        protocol: 'signal',
        tlsVersion: '1.3',
        certPinning: true,
    }
};

// ============================================
// Encryption Mode Configuration
// ============================================

const encryptionModes = {
    aes256: { name: 'AES-256', strength: 95, badge: 'AES-256' },
    aes128: { name: 'AES-128', strength: 85, badge: 'AES-128' },
    chacha20: { name: 'ChaCha20', strength: 95, badge: 'CHACHA20' },
    rsa: { name: 'RSA', strength: 90, badge: 'RSA-4096' },
    pgp: { name: 'PGP', strength: 88, badge: 'PGP' },
    otp: { name: 'OTP', strength: 100, badge: 'OTP' },
    camellia: { name: 'Camellia', strength: 90, badge: 'CAMELLIA' },
    twofish: { name: 'Twofish', strength: 88, badge: 'TWOFISH' },
    serpent: { name: 'Serpent', strength: 92, badge: 'SERPENT' },
    ecdh: { name: 'ECDH', strength: 93, badge: 'ECDH' },
    ecdsa: { name: 'ECDSA', strength: 91, badge: 'ECDSA' },
    ed25519: { name: 'Ed25519', strength: 94, badge: 'ED25519' },
    signal: { name: 'Signal', strength: 97, badge: 'SIGNAL' },
    noise: { name: 'Noise', strength: 95, badge: 'NOISE' },
    kyber: { name: 'Kyber', strength: 98, badge: 'KYBER' },
    dilithium: { name: 'Dilithium', strength: 97, badge: 'DILITHIUM' },
    sphincs: { name: 'SPHINCS+', strength: 96, badge: 'SPHINCS+' },
    vernam: { name: 'Vernam', strength: 100, badge: 'VERNAM' },
};

const strengthLabels = {
    100: 'Perfect',
    95: 'Very Strong',
    90: 'Strong',
    85: 'Good',
    80: 'Moderate',
};

// ============================================
// Utility Functions
// ============================================

function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function getStrengthLabel(strength) {
    const keys = Object.keys(strengthLabels).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
        if (strength >= key) {
            return strengthLabels[key];
        }
    }
    return 'Weak';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// UI Update Functions
// ============================================

function updateEncryptionMode(mode) {
    state.currentMode = mode;
    const modeConfig = encryptionModes[mode];
    
    if (!modeConfig) return;
    
    // Update badge
    elements.encryptionBadge.textContent = modeConfig.badge;
    
    // Update strength indicator
    const strength = modeConfig.strength;
    elements.strengthFill.style.width = `${strength}%`;
    elements.strengthLabel.textContent = getStrengthLabel(strength);
    
    // Update mode buttons in main selector
    elements.modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update mode options in modal
    elements.modeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.mode === mode);
    });
}

function updateKeyStrength(strength) {
    state.keyStrength = strength;
    
    elements.strengthPills.forEach(pill => {
        pill.classList.toggle('active', parseInt(pill.dataset.strength) === strength);
    });
    
    // Adjust strength indicator based on key size
    const baseStrength = encryptionModes[state.currentMode]?.strength || 90;
    let modifier = 0;
    if (strength === 128) modifier = -5;
    if (strength === 512) modifier = 3;
    
    const adjustedStrength = Math.min(100, baseStrength + modifier);
    elements.strengthFill.style.width = `${adjustedStrength}%`;
    elements.strengthLabel.textContent = getStrengthLabel(adjustedStrength);
}

function updateCharCount() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = `${length} / 4096`;
    
    if (length > 3500) {
        elements.charCount.style.color = 'var(--accent-warning)';
    } else if (length > 4000) {
        elements.charCount.style.color = 'var(--accent-danger)';
    } else {
        elements.charCount.style.color = 'var(--text-muted)';
    }
}

function autoResizeTextarea() {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 120) + 'px';
}

// ============================================
// Panel Controls
// ============================================

function toggleSettings(show = null) {
    const shouldShow = show !== null ? show : !state.isSettingsOpen;
    state.isSettingsOpen = shouldShow;
    
    elements.settingsPanel.classList.toggle('open', shouldShow);
    
    if (shouldShow) {
        // Close modes modal if open
        toggleModesModal(false);
    }
}

function toggleQuickOptions(show = null) {
    const shouldShow = show !== null ? show : !state.isQuickOptionsVisible;
    state.isQuickOptionsVisible = shouldShow;
    
    elements.quickOptions.classList.toggle('visible', shouldShow);
    elements.quickSettingsBtn.classList.toggle('expanded', shouldShow);
}

function toggleModesModal(show = null) {
    const shouldShow = show !== null ? show : !state.isModesModalOpen;
    state.isModesModalOpen = shouldShow;
    
    elements.modesModal.classList.toggle('open', shouldShow);
    
    if (shouldShow) {
        elements.modesSearch.focus();
    }
}

function switchSettingsCategory(category) {
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.category === category);
    });
    
    elements.settingsSections.forEach(section => {
        section.classList.toggle('active', section.dataset.section === category);
    });
}

// ============================================
// Search Functionality
// ============================================

function filterModes(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    document.querySelectorAll('.mode-category').forEach(category => {
        const options = category.querySelectorAll('.mode-option');
        let visibleCount = 0;
        
        options.forEach(option => {
            const modeName = option.textContent.toLowerCase();
            const isVisible = modeName.includes(term);
            option.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) visibleCount++;
        });
        
        category.style.display = visibleCount > 0 ? 'block' : 'none';
    });
}

function filterSettings(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    document.querySelectorAll('.setting-item').forEach(item => {
        const label = item.querySelector('.setting-label')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.setting-desc')?.textContent.toLowerCase() || '';
        const isVisible = label.includes(term) || desc.includes(term);
        item.style.display = isVisible ? 'flex' : 'none';
    });
    
    document.querySelectorAll('.setting-group').forEach(group => {
        const hasVisibleItems = group.querySelectorAll('.setting-item[style*="flex"]').length > 0;
        group.style.display = hasVisibleItems ? 'block' : 'none';
    });
}

// ============================================
// Message Handling
// ============================================

function sendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message) return;
    
    // Simulate encryption and sending
    console.log(`[CryptoMessenger] Encrypting with ${state.currentMode}...`);
    console.log(`[CryptoMessenger] Key strength: ${state.keyStrength}-bit`);
    console.log(`[CryptoMessenger] Message: ${message.substring(0, 50)}...`);
    
    // Visual feedback
    elements.sendBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        elements.sendBtn.style.transform = '';
        elements.messageInput.value = '';
        updateCharCount();
        autoResizeTextarea();
    }, 150);
    
    // Show notification
    showNotification('Message encrypted and sent securely');
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        background: var(--bg-elevated);
        border: 1px solid var(--accent-primary);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: 0.875rem;
        z-index: 10003;
        animation: notificationIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'notificationOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes notificationIn {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes notificationOut {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, 20px); }
    }
`;
document.head.appendChild(style);

// ============================================
// Settings Management
// ============================================

function saveAllSettings() {
    // Collect all setting values
    state.settings.defaultAlgorithm = document.getElementById('defaultAlgorithm')?.value || state.settings.defaultAlgorithm;
    state.settings.kdf = document.getElementById('kdfSelect')?.value || state.settings.kdf;
    state.settings.autoDelete = document.getElementById('autoDelete')?.checked || false;
    state.settings.expirationTime = parseInt(document.getElementById('expirationTime')?.value) || 24;
    state.settings.expirationUnit = document.getElementById('expirationUnit')?.value || 'hours';
    state.settings.hideTyping = document.getElementById('hideTyping')?.checked || false;
    state.settings.disableReceipts = document.getElementById('disableReceipts')?.checked || false;
    
    // Save to localStorage
    localStorage.setItem('cryptoMessengerSettings', JSON.stringify(state.settings));
    
    showNotification('Settings saved successfully');
    toggleSettings(false);
}

function resetAllSettings() {
    if (confirm('Reset all settings to default values?')) {
        localStorage.removeItem('cryptoMessengerSettings');
        location.reload();
    }
}

function loadSettings() {
    const saved = localStorage.getItem('cryptoMessengerSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(state.settings, parsed);
            applySettings();
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

function applySettings() {
    // Apply loaded settings to UI elements
    const settingsMap = {
        'defaultAlgorithm': state.settings.defaultAlgorithm,
        'kdfSelect': state.settings.kdf,
        'autoDelete': state.settings.autoDelete,
        'expirationTime': state.settings.expirationTime,
        'expirationUnit': state.settings.expirationUnit,
        'hideTyping': state.settings.hideTyping,
        'disableReceipts': state.settings.disableReceipts,
    };
    
    Object.entries(settingsMap).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (!element) return;
        
        if (element.type === 'checkbox') {
            element.checked = value;
        } else {
            element.value = value;
        }
    });
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
    // Header controls
    elements.settingsToggle?.addEventListener('click', () => toggleSettings());
    elements.closeSettings?.addEventListener('click', () => toggleSettings(false));
    elements.minimizeBtn?.addEventListener('click', () => {
        state.isMinimized = !state.isMinimized;
        if (state.isMinimized) {
            elements.messengerFrame.style.transform = 'translateY(calc(100% - 60px))';
            elements.minimizeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>';
        } else {
            elements.messengerFrame.style.transform = '';
            elements.minimizeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
        }
    });
    elements.closeBtn?.addEventListener('click', () => {
        elements.overlayContainer.style.display = 'none';
    });
    
    // Mode selection
    elements.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            updateEncryptionMode(btn.dataset.mode);
        });
    });
    
    elements.moreModes?.addEventListener('click', () => toggleModesModal(true));
    elements.closeModesModal?.addEventListener('click', () => toggleModesModal(false));
    
    elements.modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            updateEncryptionMode(option.dataset.mode);
            toggleModesModal(false);
        });
    });
    
    // Modal overlay click to close
    elements.modesModal?.addEventListener('click', (e) => {
        if (e.target === elements.modesModal) {
            toggleModesModal(false);
        }
    });
    
    // Quick settings
    elements.quickSettingsBtn?.addEventListener('click', () => toggleQuickOptions());
    
    elements.strengthPills.forEach(pill => {
        pill.addEventListener('click', () => {
            updateKeyStrength(parseInt(pill.dataset.strength));
        });
    });
    
    // Input handling
    elements.messageInput?.addEventListener('input', () => {
        updateCharCount();
        autoResizeTextarea();
    });
    
    elements.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    elements.sendBtn?.addEventListener('click', sendMessage);
    
    // Settings navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchSettingsCategory(item.dataset.category);
        });
    });
    
    // Settings actions
    elements.saveSettings?.addEventListener('click', saveAllSettings);
    elements.resetSettings?.addEventListener('click', resetAllSettings);
    
    // Protocol cards
    elements.protocolCards.forEach(card => {
        card.addEventListener('click', () => {
            elements.protocolCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            state.settings.protocol = card.dataset.protocol;
        });
    });
    
    // KDF iterations slider
    elements.kdfIterations?.addEventListener('input', () => {
        const value = parseInt(elements.kdfIterations.value);
        elements.kdfIterationsValue.textContent = formatNumber(value);
        state.settings.kdfIterations = value;
    });
    
    // Search functionality
    elements.modesSearch?.addEventListener('input', debounce((e) => {
        filterModes(e.target.value);
    }, 150));
    
    elements.settingsSearch?.addEventListener('input', debounce((e) => {
        filterSettings(e.target.value);
    }, 150));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close panels
        if (e.key === 'Escape') {
            if (state.isModesModalOpen) {
                toggleModesModal(false);
            } else if (state.isSettingsOpen) {
                toggleSettings(false);
            }
        }
        
        // Ctrl/Cmd + K to open modes
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleModesModal();
        }
        
        // Ctrl/Cmd + , to open settings
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            toggleSettings();
        }
    });
    
    // Click outside settings panel to close
    elements.overlayContainer?.addEventListener('click', (e) => {
        if (state.isSettingsOpen && !elements.settingsPanel.contains(e.target) && !elements.settingsToggle.contains(e.target)) {
            toggleSettings(false);
        }
    });
}

// ============================================
// Initialization
// ============================================

function init() {
    console.log('[CryptoMessenger] Initializing secure messaging interface...');
    
    // Load saved settings
    loadSettings();
    
    // Initialize event listeners
    initEventListeners();
    
    // Set initial state
    updateEncryptionMode(state.currentMode);
    updateKeyStrength(state.keyStrength);
    updateCharCount();
    
    // Focus input
    setTimeout(() => {
        elements.messageInput?.focus();
    }, 300);
    
    console.log('[CryptoMessenger] Ready.');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
