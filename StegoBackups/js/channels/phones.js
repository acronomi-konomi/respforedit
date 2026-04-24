/**
 * Канал кодирования через номера телефонов (российские)
 *
 * Принцип: находим в тексте российские номера телефонов и заменяем их
 * на закодированные варианты. Формат номера несёт информацию:
 *
 * Кодируемые компоненты (каждый = позиция в mixed-radix):
 *   1. Префикс: "7" | "+7" | "8"  → base 3
 *   2. Код оператора: 900–999     → base 100
 *   3. Скобки вокруг кода: да/нет  → base 2
 *   4. Стиль разделителей: 5 вариантов → base 5
 *   5–11. 7 цифр номера: каждая 0–9  → base 10 × 7
 *
 * Итого: ~34.8 бит на номер телефона
 *
 * Детерминизм: bases фиксированы для каждого найденного номера.
 * Декодер извлекает те же компоненты из стего-текста.
 *
 * ВАЖНО: Телефон не детектируется внутри URL или email.
 * Если номер телефона пересекается с URL-адресом — он пропускается.
 */

export class PhonesChannel {
    constructor() {
        this.name = 'phones';

        // Российские мобильные коды (900-999), все 100 для максимума ёмкости
        this.OPERATOR_CODES = [];
        for (let i = 900; i <= 999; i++) this.OPERATOR_CODES.push(i);

        // Стили разделителей для 7 цифр после кода оператора
        // Код оператора может быть в скобках или без — это отдельная позиция
        // Формат: (prefix)(opCode)(7digits) с разными разделителями
        this.SEPARATOR_STYLES = [
            'none',         // 79621111111 или +79621111111
            'spaces',       // 7 962 111 11 11
            'spaces_br',    // 7 (962) 111 11 11
            'dash_br',      // 7 (962) 111-11-11
            'dash',         // 7-962-111-11-11
        ];

        // Regex для поиска российских номеров телефонов в тексте
        // Поддерживает: +79621111111, 89621111111, 7 (962) 111-11-11, и т.д.
        this.PHONE_REGEX = /(?:\+?7|8)[\s\-]*\(?\d{3}\)?[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g;

        // Regex для поиска URL и email — чтобы исключить коллизии
        this._urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s<>"']*)?/g;
        this._emailRegex = /[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9.]*/g;
    }

    /**
     * Найти все номера телефонов в тексте, ИСКЛЮЧАЯ совпадения внутри URL и email.
     */
    _findPhones(text) {
        // Находим все URL-спаны
        const urlSpans = [];
        this._urlRegex.lastIndex = 0;
        let m;
        while ((m = this._urlRegex.exec(text)) !== null) {
            if (m[0].includes('.') && m[0].length > 5) {
                urlSpans.push({ start: m.index, end: m.index + m[0].length });
            }
        }

        // Находим все email-спаны
        const emailSpans = [];
        this._emailRegex.lastIndex = 0;
        while ((m = this._emailRegex.exec(text)) !== null) {
            emailSpans.push({ start: m.index, end: m.index + m[0].length });
        }

        const excludedSpans = [...urlSpans, ...emailSpans];

        const matches = [];
        this.PHONE_REGEX.lastIndex = 0;
        while ((m = this.PHONE_REGEX.exec(text)) !== null) {
            const phoneStart = m.index;
            const phoneEnd = m.index + m[0].length;

            // Пропускаем телефон, пересекающийся с URL или email
            const overlaps = excludedSpans.some(es =>
                (phoneStart >= es.start && phoneStart < es.end) ||
                (phoneEnd > es.start && phoneEnd <= es.end) ||
                (phoneStart <= es.start && phoneEnd >= es.end)
            );
            if (overlaps) continue;

            matches.push({
                index: m.index,
                full: m[0],
                length: m[0].length
            });
        }
        return matches;
    }

    /**
     * Разобрать номер телефона на компоненты
     * Возвращает { prefix, opCode, brackets, sepStyle, digits }
     */
    _parsePhone(phoneStr) {
        // Убираем все не-цифры для извлечения цифр
        const digits = phoneStr.replace(/\D/g, '');

        // Префикс
        let prefix;
        if (phoneStr.startsWith('+7')) prefix = 1;      // +7
        else if (phoneStr.startsWith('8')) prefix = 2;   // 8
        else prefix = 0;                                  // 7

        // Код оператора (3 цифры после 7 или 8)
        const opCode = parseInt(digits.substring(1, 4));

        // 7 цифр номера
        const phoneDigits = digits.substring(4).split('').map(Number);

        // Скобки
        const brackets = /\(\d{3}\)/.test(phoneStr) ? 1 : 0;

        // Стиль разделителей (определяем по структуре)
        let sepStyle = 0;
        const hasSpaces = /\s/.test(phoneStr);
        const hasDashes = /-/.test(phoneStr);
        const hasBrackets = /\(\d{3}\)/.test(phoneStr);

        if (!hasSpaces && !hasDashes && !hasBrackets) {
            sepStyle = 0; // none
        } else if (hasSpaces && !hasDashes && !hasBrackets) {
            sepStyle = 1; // spaces
        } else if (hasSpaces && !hasDashes && hasBrackets) {
            sepStyle = 2; // spaces_br
        } else if (hasDashes && hasBrackets) {
            sepStyle = 3; // dash_br
        } else if (hasDashes && !hasBrackets) {
            sepStyle = 4; // dash
        } else {
            sepStyle = 0; // fallback
        }

        return { prefix, opCode, brackets, sepStyle, digits: phoneDigits };
    }

    /**
     * Собрать номер телефона из компонентов
     */
    _buildPhone(prefix, opCode, brackets, sepStyle, digits) {
        const prefixStr = ['7', '+7', '8'][prefix] || '7';
        const opStr = String(opCode).padStart(3, '0');
        const d = digits.map(n => String(n)).join('');

        switch (sepStyle) {
            case 0: // none: 79621111111
                return `${prefixStr}${brackets ? '(' + opStr + ')' : opStr}${d}`;

            case 1: // spaces: 7 962 111 11 11
                if (brackets) {
                    return `${prefixStr} (${opStr}) ${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5)}`;
                }
                return `${prefixStr} ${opStr} ${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5)}`;

            case 2: // spaces_br: 7 (962) 111 11 11
                return `${prefixStr} (${opStr}) ${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5)}`;

            case 3: // dash_br: 7 (962) 111-11-11
                return `${prefixStr} (${opStr}) ${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;

            case 4: // dash: 7-962-111-11-11
                if (brackets) {
                    return `${prefixStr}-(${opStr})-${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
                }
                return `${prefixStr}-${opStr}-${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;

            default:
                return `${prefixStr}${opStr}${d}`;
        }
    }

    analyzeCapacity(text) {
        const phones = this._findPhones(text);
        if (phones.length === 0) {
            return { totalBits: 0, positions: [], bases: [] };
        }

        // Каждый номер = 11 позиций: prefix(3) + opCode(100) + brackets(2) + sepStyle(5) + 7×digits(10)
        const positions = [];
        const bases = [];

        for (const phone of phones) {
            positions.push({
                index: phone.index,
                length: phone.length,
                type: 'phone'
            });
            // Fixed bases per phone number (11 positions)
            bases.push(3, 100, 2, 5, 10, 10, 10, 10, 10, 10, 10);
        }

        const totalBits = bases.reduce((sum, b) => sum + Math.log2(b), 0);

        return { totalBits, positions, bases };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;

        const phones = this._findPhones(text);
        if (phones.length === 0) return text;

        // Process replacements in reverse order to preserve indices
        const replacements = [];
        let idx = 0;

        for (const phone of phones) {
            if (idx + 10 >= indices.length) break;

            const prefix   = indices[idx] % 3;
            const opCode   = 900 + (indices[idx + 1] % 100);
            const brackets = indices[idx + 2] % 2;
            const sepStyle = indices[idx + 3] % 5;
            const d0 = indices[idx + 4] % 10;
            const d1 = indices[idx + 5] % 10;
            const d2 = indices[idx + 6] % 10;
            const d3 = indices[idx + 7] % 10;
            const d4 = indices[idx + 8] % 10;
            const d5 = indices[idx + 9] % 10;
            const d6 = indices[idx + 10] % 10;

            const newPhone = this._buildPhone(prefix, opCode, brackets, sepStyle, [d0, d1, d2, d3, d4, d5, d6]);
            replacements.push({
                index: phone.index,
                length: phone.length,
                replacement: newPhone
            });

            idx += 11;
        }

        // Apply in reverse order
        let result = text;
        for (let i = replacements.length - 1; i >= 0; i--) {
            const r = replacements[i];
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        }

        return result;
    }

    decode(stegoText) {
        const phones = this._findPhones(stegoText);
        const indices = [];

        for (const phone of phones) {
            const p = this._parsePhone(phone.full);

            indices.push(p.prefix);

            // opCode → index in 900-999 range
            const opIdx = this.OPERATOR_CODES.indexOf(p.opCode);
            indices.push(opIdx >= 0 ? opIdx : 0);

            indices.push(p.brackets);
            indices.push(p.sepStyle);

            for (const d of p.digits) {
                indices.push(d);
            }
        }

        return indices;
    }

    getStats() {
        return {
            name: this.name,
            loaded: true,
            operatorCodes: this.OPERATOR_CODES.length,
            separatorStyles: this.SEPARATOR_STYLES.length,
            bitsPerPhone: Math.log2(3) + Math.log2(100) + 1 + Math.log2(5) + 7 * Math.log2(10)
        };
    }
}

export default PhonesChannel;
