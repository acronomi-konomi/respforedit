/**
 * Clean Encryption Module
 * Provides AES-256-GCM encryption for "clean" (non-steganographic) message encoding.
 * 
 * This is the cryptographic backbone for all clean encoding modes:
 * 1. Text → compress → encrypt (AES-256-GCM) → encode (base64/emoji/chinese/etc.)
 * 
 * The encoding wrapper (invisible spaces, emoji, etc.) handles the final representation,
 * while this module handles the actual encryption.
 *
 * ## Encryption scheme:
 *   key     = PBKDF2(password, salt, 100000) → 256 bits
 *   iv      = random 12 bytes (prepended to ciphertext)
 *   ciphertext = AES-256-GCM(key, iv, plaintext)
 *   output  = iv(12) + ciphertext + tag(16)
 *
 * ## Password per Chat:
 *   Keys are derived per chat-id using: PBKDF2(password + chatId, salt, iterations)
 *   This ensures different chats use different keys even with the same password.
 */

const SALT = new TextEncoder().encode('clean-crypto-v1-aes256gcm');
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag
const ITERATIONS = 100_000;
const MAGIC = new Uint8Array([0x43, 0x52, 0x59]); // "CRY" magic bytes

export default class CleanCrypto {
    constructor() {
        this.ALGO = 'AES-GCM';
        this.KEY_BITS = 256;
    }

    /**
     * Derive encryption key from password + chatId
     * @param {string} password
     * @param {string} chatId - optional chat identifier for per-chat key derivation
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password, chatId = '') {
        const enc = new TextEncoder();
        const material = await crypto.subtle.importKey(
            'raw',
            enc.encode(password + (chatId ? ':' + chatId : '')),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
            material,
            { name: this.ALGO, length: this.KEY_BITS },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt plaintext string
     * @param {string} plaintext
     * @param {string} password
     * @param {string} chatId - optional chat identifier
     * @returns {Promise<Uint8Array>} encrypted bytes: MAGIC(3) + IV(12) + ciphertext+tag
     */
    async encrypt(plaintext, password, chatId = '') {
        const key = await this.deriveKey(password, chatId);
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const encoded = new TextEncoder().encode(plaintext);

        const ciphertext = await crypto.subtle.encrypt(
            { name: this.ALGO, iv },
            key,
            encoded
        );

        // Combine: MAGIC + IV + ciphertext (includes auth tag)
        const result = new Uint8Array(MAGIC.length + IV_LENGTH + ciphertext.byteLength);
        result.set(MAGIC, 0);
        result.set(iv, MAGIC.length);
        result.set(new Uint8Array(ciphertext), MAGIC.length + IV_LENGTH);

        return result;
    }

    /**
     * Decrypt encrypted bytes back to string
     * @param {Uint8Array} data - encrypted bytes
     * @param {string} password
     * @param {string} chatId - optional chat identifier
     * @returns {Promise<string>} decrypted plaintext
     */
    async decrypt(data, password, chatId = '') {
        // Verify magic
        if (data.length < MAGIC.length + IV_LENGTH + TAG_LENGTH) {
            throw new Error('Данные слишком короткие для дешифровки.');
        }

        if (data[0] !== MAGIC[0] || data[1] !== MAGIC[1] || data[2] !== MAGIC[2]) {
            throw new Error('Неверный формат зашифрованных данных.');
        }

        const iv = data.slice(MAGIC.length, MAGIC.length + IV_LENGTH);
        const ciphertext = data.slice(MAGIC.length + IV_LENGTH);

        const key = await this.deriveKey(password, chatId);

        let plaintext;
        try {
            plaintext = await crypto.subtle.decrypt(
                { name: this.ALGO, iv },
                key,
                ciphertext
            );
        } catch (e) {
            throw new Error('Неверный пароль или повреждённые данные.');
        }

        return new TextDecoder().decode(plaintext);
    }

    /**
     * Encrypt and encode using specified encoder
     * Full pipeline: plaintext → encrypt → encode
     * @param {string} plaintext
     * @param {string} password
     * @param {string} encoderId - encoder to use for representation
     * @param {string} chatId - optional chat identifier
     * @returns {Promise<string>} encoded string
     */
    async encryptAndEncode(plaintext, password, encoderId, chatId = '') {
        const encrypted = await this.encrypt(plaintext, password, chatId);
        
        // Import encoder dynamically
        const { getEncoderById } = await import('./encoders/index.js');
        const encoder = getEncoderById(encoderId);
        
        if (!encoder) {
            throw new Error(`Неизвестный кодировщик: ${encoderId}`);
        }

        // Some encoders are async
        if (encoder.encode.constructor.name === 'AsyncFunction' || 
            encoder.encode.toString().includes('async')) {
            return await encoder.encode(encrypted);
        }
        return encoder.encode(encrypted);
    }

    /**
     * Decode and decrypt
     * Full pipeline: encoded string → decode → decrypt
     * @param {string} encoded
     * @param {string} password
     * @param {string} chatId - optional chat identifier
     * @returns {Promise<string>} decrypted plaintext
     */
    async decodeAndDecrypt(encoded, password, chatId = '') {
        // Auto-detect encoder
        const { detectEncoder } = await import('./encoders/index.js');
        const encoder = detectEncoder(encoded);

        if (!encoder) {
            throw new Error('Не удалось определить тип кодировки. Убедитесь, что текст закодирован корректно.');
        }

        // Decode
        let decoded;
        if (encoder.decode.constructor.name === 'AsyncFunction' ||
            encoder.decode.toString().includes('async')) {
            decoded = await encoder.decode(encoded);
        } else {
            decoded = encoder.decode(encoded);
        }

        if (!decoded) {
            throw new Error(`Ошибка декодирования (${encoder.label}).`);
        }

        // Decrypt
        return await this.decrypt(decoded, password, chatId);
    }

    /**
     * Estimate encrypted size for input text
     * @param {number} textLength - plaintext length in characters
     * @returns {number} estimated encrypted byte count
     */
    encryptedSize(textLength) {
        // UTF-8 encoding + AES-GCM overhead
        const utf8Size = textLength * 2; // rough estimate for mixed ru/en
        return MAGIC.length + IV_LENGTH + utf8Size + TAG_LENGTH + 16; // +16 for padding
    }

    /**
     * Check if password is saved for a chat
     * @param {string} chatId
     * @returns {string|null} saved password or null
     */
    static getSavedPassword(chatId) {
        try {
            const saved = JSON.parse(localStorage.getItem('cryptoMsg_passwords') || '{}');
            return saved[chatId] || null;
        } catch {
            return null;
        }
    }

    /**
     * Save password for a chat
     * @param {string} chatId
     * @param {string} password
     */
    static savePassword(chatId, password) {
        try {
            const saved = JSON.parse(localStorage.getItem('cryptoMsg_passwords') || '{}');
            saved[chatId] = password;
            localStorage.setItem('cryptoMsg_passwords', JSON.stringify(saved));
        } catch (e) {
            console.warn('Failed to save password:', e);
        }
    }

    /**
     * Remove saved password for a chat
     * @param {string} chatId
     */
    static removePassword(chatId) {
        try {
            const saved = JSON.parse(localStorage.getItem('cryptoMsg_passwords') || '{}');
            delete saved[chatId];
            localStorage.setItem('cryptoMsg_passwords', JSON.stringify(saved));
        } catch (e) {
            console.warn('Failed to remove password:', e);
        }
    }

    /**
     * Get all saved chat passwords
     * @returns {Object} chatId → password map
     */
    static getAllPasswords() {
        try {
            return JSON.parse(localStorage.getItem('cryptoMsg_passwords') || '{}');
        } catch {
            return {};
        }
    }
}
