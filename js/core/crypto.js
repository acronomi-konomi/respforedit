/**
 * Криптографический модуль с компактным алфавитным кодированием
 *
 * ## Схема шифрования
 *   key     = PBKDF2(password, фикс.соль, 100000) → 256 бит
 *   counter = SHA256("stego-ctr:" + password)[0:16]
 *   ciphertext = AES-CTR(key, counter, compressedPlaintext)
 *
 * ## Компактный алфавит (7 бит на символ → экономия ~2x vs UTF-8 для кириллицы)
 *
 * Алфавит из 128 символов (7 бит на символ):
 *   - а-я  (33 буквы: а б в г д е ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я)
 *   - ё    (1 буква)
 *   - А-Я  (33 буквы) + Ё
 *   - a-z  (26 букв)
 *   - A-Z  (26 букв)
 *   - 0-9  (10 цифр)
 *   - пробел, . , ! ? : ; - ( ) " ' / @ # % + = _ \n и др.
 *
 * Итого: 68 + 52 + 10 + ~20 знаков = ~150 символов
 * Кодируем каждый в 8 бит (256 позиций — достаточно для 150 символов).
 *
 * Реальная экономия: кириллица UTF-8 = 2 байта/символ, наш алфавит = 1 байт/символ.
 * Шифротекст "Привет!" = 7 байт + 2 magic = 9 байт = 72 бита (было 120 бит).
 *
 * ## Верификация пароля
 * Первые 2 байта plaintext = magic bytes [0x53, 0x74] ("St").
 * Если после расшифровки они не совпадают → неверный пароль.
 */

export class CryptoEngine {
    constructor() {
        this.ALGO     = 'AES-CTR';
        this.KEY_BITS = 256;
        this.CTR_LEN  = 16;
        this.ITER     = 100_000;
        this.MAGIC    = new Uint8Array([0x53, 0x74]); // "St"

        // Кастомный алфавит: индекс → символ
        this._buildAlphabet();
    }

    _buildAlphabet() {
        const chars = [];

        // Строчные кириллица (а-я + ё)
        for (let c = 'а'.codePointAt(0); c <= 'я'.codePointAt(0); c++) chars.push(String.fromCodePoint(c));
        chars.push('ё');

        // Прописные кириллица (А-Я + Ё)
        for (let c = 'А'.codePointAt(0); c <= 'Я'.codePointAt(0); c++) chars.push(String.fromCodePoint(c));
        chars.push('Ё');

        // Латиница строчная a-z
        for (let c = 97; c <= 122; c++) chars.push(String.fromCharCode(c));
        // Латиница прописная A-Z
        for (let c = 65; c <= 90; c++) chars.push(String.fromCharCode(c));

        // Цифры 0-9
        for (let c = 48; c <= 57; c++) chars.push(String.fromCharCode(c));

        // Знаки препинания и спецсимволы
        const specials = ' .,!?:;-()[]{}"\'/\\@#$%^&*+=_~`|<>\n\t\r«»—…№';
        for (const ch of specials) chars.push(ch);

        // Индексы
        this._charToIdx = new Map(chars.map((c, i) => [c, i]));
        this._idxToChar = chars;

        // Если символ не в алфавите — заменяем на '?'
        this._fallback = this._charToIdx.get('?') ?? 0;
    }

    /**
     * Компактное кодирование строки → Uint8Array (1 байт на символ из алфавита)
     * Символы вне алфавита кодируются как '?' (fallback).
     */
    _encodeString(str) {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            bytes[i] = this._charToIdx.has(str[i])
                ? this._charToIdx.get(str[i])
                : this._fallback;
        }
        return bytes;
    }

    /**
     * Декодирование Uint8Array → строка
     */
    _decodeBytes(bytes) {
        let str = '';
        for (const b of bytes) {
            str += b < this._idxToChar.length ? this._idxToChar[b] : '?';
        }
        return str;
    }

    async _deriveKey(password) {
        const enc      = new TextEncoder();
        const salt     = enc.encode('linguistic-stego-v1');
        const material = await crypto.subtle.importKey(
            'raw', enc.encode(password),
            { name: 'PBKDF2' }, false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: this.ITER, hash: 'SHA-256' },
            material,
            { name: this.ALGO, length: this.KEY_BITS },
            false, ['encrypt', 'decrypt']
        );
    }

    async _deriveCtr(password) {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode('stego-ctr:' + password));
        return new Uint8Array(buf, 0, this.CTR_LEN);
    }

    /**
     * Зашифровать строку.
     * @param {Uint8Array} data - данные (результат stringToBytes)
     * @param {string} password
     * @returns {Uint8Array} - шифротекст (data.length + 2 magic байта)
     */
    async encrypt(data, password) {
        const [key, counter] = await Promise.all([
            this._deriveKey(password),
            this._deriveCtr(password)
        ]);

        // plaintext = magic(2) + len(1) + data
        // len = длина data в байтах (для восстановления при decode без ведущих нулей)
        const plaintext = new Uint8Array(this.MAGIC.length + 1 + data.length);
        plaintext.set(this.MAGIC, 0);
        plaintext[this.MAGIC.length] = data.length & 0xFF; // 1 байт длины (max 255 символов)
        plaintext.set(data, this.MAGIC.length + 1);

        const buf = await crypto.subtle.encrypt(
            { name: this.ALGO, counter, length: 64 },
            key, plaintext
        );
        return new Uint8Array(buf);
    }

    async decrypt(data, password) {
        const [key, counter] = await Promise.all([
            this._deriveKey(password),
            this._deriveCtr(password)
        ]);

        let buf;
        try {
            buf = await crypto.subtle.decrypt(
                { name: this.ALGO, counter, length: 64 },
                key, data
            );
        } catch {
            throw new Error('Неверный пароль или повреждённые данные.');
        }

        const plaintext = new Uint8Array(buf);
        if (plaintext[0] !== this.MAGIC[0] || plaintext[1] !== this.MAGIC[1]) {
            throw new Error('Неверный пароль или повреждённые данные.');
        }

        // Читаем длину данных из третьего байта
        const dataLen = plaintext[this.MAGIC.length];
        return plaintext.slice(this.MAGIC.length + 1, this.MAGIC.length + 1 + dataLen);
    }

    /**
     * Строка → компактные байты (1 байт/символ для кириллицы/латиницы)
     * Вместо стандартного UTF-8 (2 байта для кириллицы)
     */
    stringToBytes(str) {
        return this._encodeString(str);
    }

    /**
     * Компактные байты → строка
     */
    bytesToString(bytes) {
        return this._decodeBytes(bytes);
    }

    /** Размер шифротекста для строки (в байтах) */
    encryptedSize(str) {
        return str.length + this.MAGIC.length; // 1 байт/символ + 2 magic
    }
}

export default CryptoEngine;
