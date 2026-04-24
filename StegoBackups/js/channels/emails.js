/**
 * Канал кодирования через адреса электронной почты
 *
 * Принцип: находим в тексте email-адреса и заменяем их на закодированные.
 * Формат email несёт информацию в каждом компоненте:
 *
 * Формат: [part1][sep][part2]@[domain][+number]
 *   1. part1: индекс в словаре имён → base = dictSize
 *   2. separator: нет | . | _ | -   → base 4
 *   3. part2: индекс в словаре имён → base = dictSize
 *   4. domain: индекс в списке доменов → base = domains.length
 *   5. trailing_number: нет | число 0-99 → base 101
 *
 * При dictSize=65536: ~16 + 2 + 16 + 3.8 + 6.7 ≈ 44.5 бит на email
 *
 * Словарь имён загружается из JSON (email-names-compact.json, ~750KB).
 * Для binary search словарь отсортирован по алфавиту.
 *
 * ВАЖНО: Email не детектируется внутри номера телефона.
 * Если email пересекается с телефонным номером — email пропускается.
 */

export class EmailsChannel {
    constructor() {
        this.name = 'emails';
        this.loaded = false;

        // Словарь имён (sorted, для binary search)
        this.dictionary = [];

        // Разрешённые домены (популярные российские)
        this.DOMAINS = [
            'mail.ru',      // 0
            'yandex.ru',    // 1
            'inbox.ru',     // 2
            'list.ru',      // 3
            'bk.ru',        // 4
            'internet.ru',  // 5
            'xmail.ru',     // 6
            'ya.ru',        // 7
            'yandex.com',   // 8
            'vk.com',       // 9
            'lenta.ru',     // 10
            'rambler.ru',   // 11
            'ro.ru',        // 12
            'gazeta.ru',    // 13
        ];

        // Разделители для email (между part1 и part2)
        this.SEPARATORS = ['', '.', '_', '-']; // 0=none, 1=dot, 2=underscore, 3=hyphen

        // Regex для поиска email в тексте
        this.EMAIL_REGEX = /[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9.]*/g;

        // Regex для поиска телефонов — чтобы исключить коллизии
        this._phoneRegex = /(?:\+?7|8)[\s\-]*\(?\d{3}\)?[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g;
    }

    async loadDictionary(path = './data/dictionaries/email-names-compact.json') {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.dictionary = await response.json();
            this.loaded = true;
            console.log(`EmailsChannel: loaded ${this.dictionary.length} usernames`);
        } catch (e) {
            console.warn('EmailsChannel: failed to load dictionary, using fallback:', e);
            // Fallback: common Russian translit names
            this.dictionary = [
                'ivanov', 'petrov', 'sidorov', 'kuznetsov', 'popov',
                'vasiliev', 'sokolov', 'mikhailov', 'novikov', 'fedorov',
                'morozov', 'volkov', 'alekseev', 'lebedev', 'semenov',
                'egorov', 'pavlov', 'kozlov', 'stepanov', 'nikolaev',
                'andreev', 'makarov', 'nikitin', 'zakharov', 'zaitsev',
                'soloviev', 'bogdanov', 'vorobev', 'sergeev', 'golubev',
                'anna', 'elena', 'olga', 'tatiana', 'natalia',
                'maria', 'irina', 'svetlana', 'ekaterina', 'marina',
                'admin', 'info', 'support', 'sales', 'contact',
                'office', 'manager', 'director', 'secretary', 'assistant',
            ];
            this.loaded = true;
        }
    }

    /**
     * Binary search в отсортированном словаре.
     * Возвращает индекс или -1 если не найден.
     */
    _findInDictionary(name) {
        const lower = name.toLowerCase();
        let lo = 0, hi = this.dictionary.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const cmp = this.dictionary[mid].localeCompare(lower);
            if (cmp === 0) return mid;
            if (cmp < 0) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    /**
     * Найти все email-адреса в тексте, ИСКЛЮЧАЯ совпадения внутри телефонов.
     */
    _findEmails(text) {
        // Находим все phone-спаны
        const phoneSpans = [];
        this._phoneRegex.lastIndex = 0;
        let m;
        while ((m = this._phoneRegex.exec(text)) !== null) {
            phoneSpans.push({ start: m.index, end: m.index + m[0].length });
        }

        const matches = [];
        this.EMAIL_REGEX.lastIndex = 0;
        while ((m = this.EMAIL_REGEX.exec(text)) !== null) {
            const emailStart = m.index;
            const emailEnd = m.index + m[0].length;

            // Пропускаем email, пересекающийся с телефоном
            const overlaps = phoneSpans.some(ps =>
                (emailStart >= ps.start && emailStart < ps.end) ||
                (emailEnd > ps.start && emailEnd <= ps.end) ||
                (emailStart <= ps.start && emailEnd >= ps.end)
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
     * Разобрать email на компоненты
     * Возвращает { part1, separator, part2, domain, trailingNumber }
     */
    _parseEmail(emailStr) {
        const atIdx = emailStr.indexOf('@');
        if (atIdx < 0) return null;

        const localPart = emailStr.slice(0, atIdx);
        const domainPart = emailStr.slice(atIdx + 1);

        // Find domain index
        let domainIdx = this.DOMAINS.indexOf(domainPart.toLowerCase());

        // If domain not in our list, try to find it by the main part
        if (domainIdx < 0) {
            // Check if it's a subdomain we know
            for (let i = 0; i < this.DOMAINS.length; i++) {
                if (domainPart.toLowerCase().endsWith(this.DOMAINS[i])) {
                    domainIdx = i;
                    break;
                }
            }
        }

        // Parse local part: find separator
        let part1, separator, part2;
        let sepIdx = 0; // default: no separator

        // Try separators in order: . _ -
        for (let s = 1; s < this.SEPARATORS.length; s++) {
            const sep = this.SEPARATORS[s];
            const pos = localPart.lastIndexOf(sep);
            if (pos > 0 && pos < localPart.length - 1) {
                part1 = localPart.slice(0, pos);
                part2 = localPart.slice(pos + 1);
                separator = s;
                sepIdx = s;
                break;
            }
        }

        if (!part1) {
            // No separator found — whole local part is part1, no part2
            part1 = localPart;
            part2 = null;
            separator = 0;
        }

        // Extract trailing number from part2 (or part1 if no part2)
        let trailingNumber = 0; // 0 = absent
        const target = part2 || part1;
        const numMatch = target.match(/(\d+)$/);
        if (numMatch) {
            const num = parseInt(numMatch[1]);
            if (num <= 99) {
                trailingNumber = num + 1; // shift: 0=absent, 1-100 = number 0-99
                // Remove trailing number from the part
                const base = target.slice(0, target.length - numMatch[1].length);
                if (part2) part2 = base || null;
                else part1 = base;
            }
        }

        // Find dictionary indices
        const part1Idx = this._findInDictionary(part1);
        const part2Idx = part2 ? this._findInDictionary(part2) : -1;

        return {
            part1,
            part1Idx,
            separator: sepIdx,
            part2,
            part2Idx,
            domainIdx: domainIdx >= 0 ? domainIdx : 0,
            trailingNumber
        };
    }

    /**
     * Собрать email из компонентов
     */
    _buildEmail(part1Idx, separator, part2Idx, domainIdx, trailingNumber) {
        const part1 = part1Idx >= 0 && part1Idx < this.dictionary.length
            ? this.dictionary[part1Idx]
            : 'user';

        const sep = this.SEPARATORS[separator] || '';

        const part2 = part2Idx >= 0 && part2Idx < this.dictionary.length
            ? this.dictionary[part2Idx]
            : null;

        const domain = this.DOMAINS[domainIdx] || this.DOMAINS[0];

        // Trailing number: 0=absent, 1-100 = number 0-99
        const trailingStr = trailingNumber > 0 ? String(trailingNumber - 1) : '';

        let localPart;
        if (part2) {
            localPart = part1 + sep + part2 + trailingStr;
        } else {
            localPart = part1 + trailingStr;
        }

        return localPart + '@' + domain;
    }

    analyzeCapacity(text) {
        if (!this.loaded) return { totalBits: 0, positions: [], bases: [] };

        const emails = this._findEmails(text);
        if (emails.length === 0) {
            return { totalBits: 0, positions: [], bases: [] };
        }

        const dictSize = this.dictionary.length;
        const positions = [];
        const bases = [];

        for (const email of emails) {
            positions.push({ index: email.index, length: email.length, type: 'email' });
            bases.push(dictSize);         // part1 index
            bases.push(4);                // separator (none, dot, underscore, hyphen)
            bases.push(dictSize);         // part2 index
            bases.push(this.DOMAINS.length); // domain
            bases.push(101);              // trailing number (0=absent, 1-100=0-99)
        }

        const totalBits = bases.reduce((sum, b) => sum + Math.log2(b), 0);

        return { totalBits, positions, bases };
    }

    encode(text, indices) {
        if (!this.loaded || indices.length === 0) return text;

        const emails = this._findEmails(text);
        if (emails.length === 0) return text;

        const dictSize = this.dictionary.length;
        const POS_PER_EMAIL = 5;
        const replacements = [];
        let idx = 0;

        for (const email of emails) {
            if (idx + POS_PER_EMAIL > indices.length) break;

            const part1Idx = indices[idx] % dictSize;
            const separator = indices[idx + 1] % 4;
            const part2Idx = indices[idx + 2] % dictSize;
            const domainIdx = indices[idx + 3] % this.DOMAINS.length;
            const trailingNumber = indices[idx + 4] % 101;

            const newEmail = this._buildEmail(part1Idx, separator, part2Idx, domainIdx, trailingNumber);
            replacements.push({
                index: email.index,
                length: email.length,
                replacement: newEmail
            });

            idx += POS_PER_EMAIL;
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
        if (!this.loaded) return [];

        const emails = this._findEmails(stegoText);
        const indices = [];

        for (const email of emails) {
            const p = this._parseEmail(email.full);
            if (!p) continue;

            indices.push(p.part1Idx >= 0 ? p.part1Idx : 0);
            indices.push(p.separator);
            indices.push(p.part2Idx >= 0 ? p.part2Idx : 0);
            indices.push(p.domainIdx);
            indices.push(p.trailingNumber);
        }

        return indices;
    }

    getStats() {
        return {
            name: this.name,
            loaded: this.loaded,
            dictionarySize: this.dictionary.length,
            domains: this.DOMAINS.length,
            bitsPerEmail: this.loaded
                ? Math.log2(this.dictionary.length) * 2 + 2 + Math.log2(this.DOMAINS.length) + Math.log2(101)
                : 0
        };
    }
}

export default EmailsChannel;
