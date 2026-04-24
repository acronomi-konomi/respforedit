/**
 * Канал кодирования через символы нулевой ширины (Zero-Width)
 *
 * Использует невидимые Unicode символы для хранения данных:
 * - U+200B (ZWSP, Zero Width Space) = бит 0
 * - U+200C (ZWNJ, Zero Width Non-Joiner) = бит 1
 *
 * Преимущества:
 * - Абсолютно точный roundtrip (нет потерь)
 * - Не требует оригинального текста для decode
 * - Не изменяет видимый текст
 * - Ёмкость = любое количество бит (вставляем сколько нужно)
 *
 * Ограничение:
 * - Invisible symbols могут быть удалены при копировании в некоторых редакторах
 * - Обнаружим статистическим анализом (много невидимых символов)
 *
 * Для маскировки: вставляем символы в разных местах текста (после пробелов),
 * а не все в одном месте.
 */

export class ZeroWidthChannel {
    constructor() {
        this.name = 'zeroWidth';
        // Два невидимых символа = 1 бит каждый
        this.BIT0 = '\u200B'; // Zero Width Space
        this.BIT1 = '\u200C'; // Zero Width Non-Joiner
        // Маркер начала и конца данных (чтобы отличить наши биты от случайных)
        this.MARKER_START = '\u200D\u200B\u200D'; // Zero Width Joiner + ZWSP + ZWJ
        this.MARKER_END   = '\u200D\u200C\u200D';
    }

    /**
     * Анализ ёмкости: канал всегда может принять любое количество бит.
     * Возвращаем заглушку — реальная ёмкость не ограничена.
     * В движке этот канал используется особым образом (см. engine.js).
     */
    analyzeCapacity(text) {
        // Подсчитываем пробелы — туда вставляем биты (по 1 биту на пробел)
        const spaces = (text.match(/ /g) || []).length;
        return {
            totalBits: spaces, // условно — 1 бит на пробел
            positions: [],
            bases: new Array(spaces).fill(2)
        };
    }

    /**
     * Кодирование: вставляем все данные как zero-width символы.
     * @param {string} text - текст-носитель
     * @param {Uint8Array} data - байты для кодирования
     * @returns {string} - текст с вставленными невидимыми символами
     */
    encodeData(text, data) {
        // Преобразуем байты в строку из BIT0/BIT1
        let bits = this.MARKER_START;
        for (const byte of data) {
            for (let i = 7; i >= 0; i--) {
                bits += ((byte >> i) & 1) ? this.BIT1 : this.BIT0;
            }
        }
        bits += this.MARKER_END;

        // Распределяем биты по тексту — вставляем после пробелов
        // для лучшей маскировки
        const spaces = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') spaces.push(i);
        }

        if (spaces.length === 0 || bits.length > spaces.length * 2) {
            // Если мало пробелов — вставляем всё после первого слова
            const firstSpace = text.indexOf(' ');
            if (firstSpace >= 0) {
                return text.slice(0, firstSpace + 1) + bits + text.slice(firstSpace + 1);
            }
            return bits + text;
        }

        // Распределяем биты по пробелам равномерно
        const bitsArr = [...bits];
        const step = Math.max(1, Math.floor(spaces.length / bitsArr.length));
        const insertions = new Map(); // position → bits_to_insert

        for (let i = 0; i < bitsArr.length; i++) {
            const spaceIdx = spaces[Math.min(i * step, spaces.length - 1)];
            const existing = insertions.get(spaceIdx) || '';
            insertions.set(spaceIdx, existing + bitsArr[i]);
        }

        // Применяем вставки с конца
        let result = text;
        const sorted = [...insertions.entries()].sort((a, b) => b[0] - a[0]);
        for (const [pos, ins] of sorted) {
            result = result.slice(0, pos + 1) + ins + result.slice(pos + 1);
        }
        return result;
    }

    /**
     * Декодирование: извлекаем zero-width символы из текста.
     * @param {string} stegoText
     * @returns {Uint8Array} - извлечённые байты
     */
    decodeData(stegoText) {
        // Извлекаем все zero-width символы между маркерами
        const startIdx = stegoText.indexOf(this.MARKER_START);
        const endIdx   = stegoText.indexOf(this.MARKER_END);

        let zwChars;
        if (startIdx >= 0 && endIdx > startIdx) {
            // Есть маркеры — берём только между ними
            const content = stegoText.slice(startIdx + this.MARKER_START.length, endIdx);
            zwChars = [...content].filter(c => c === this.BIT0 || c === this.BIT1);
        } else {
            // Нет маркеров — берём все zero-width символы
            zwChars = [...stegoText].filter(c => c === this.BIT0 || c === this.BIT1);
        }

        if (zwChars.length === 0) return new Uint8Array(0);

        // Преобразуем биты в байты
        const bytes = [];
        for (let i = 0; i + 7 < zwChars.length; i += 8) {
            let byte = 0;
            for (let j = 0; j < 8; j++) {
                byte = (byte << 1) | (zwChars[i + j] === this.BIT1 ? 1 : 0);
            }
            bytes.push(byte);
        }
        return new Uint8Array(bytes);
    }

    /**
     * Убрать все zero-width символы из текста (для отображения чистого текста)
     */
    stripZeroWidth(text) {
        return text.replace(/[\u200B\u200C\u200D]/g, '');
    }

    // Эти методы нужны для совместимости с интерфейсом канала
    encode(text, indices) { return text; } // не используется напрямую
    decode(stegoText)     { return []; }   // не используется напрямую

    getStats() {
        return { name: this.name, loaded: true, type: 'zero-width' };
    }
}

export default ZeroWidthChannel;
