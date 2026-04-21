/**
 * Канал кодирования через аббревиатуры
 * Заменяет полные формы на аббревиатуры и наоборот
 */

export class AbbreviationsChannel {
    constructor() {
        this.name = 'abbreviations';
        this.abbrToFull = {};
        this.fullToAbbr = {};
        this.pairs = [];
        this.loaded = false;
    }

    async loadDictionary(path = './data/abbreviations.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            this._buildIndex(data);
            this.loaded = true;
            console.log(`Loaded ${this.pairs.length} abbreviation pairs`);
        } catch (e) {
            this._buildIndex({
                'РФ': 'Российская Федерация',
                'т.е.': 'то есть',
                'и т.д.': 'и так далее',
                'и т.п.': 'и тому подобное',
                'т.к.': 'так как',
                'напр.': 'например',
                'г.': 'год',
                'ул.': 'улица',
                'пр.': 'проспект',
                'млн': 'миллионов',
                'млрд': 'миллиардов',
                'кг': 'килограммов',
                'км': 'километров'
            });
            this.loaded = true;
        }
    }

    _buildIndex(data) {
        this.abbrToFull = {};
        this.fullToAbbr = {};
        this.pairs = [];
        for (const [abbr, full] of Object.entries(data)) {
            const a = abbr.trim();
            const f = full.trim().toLowerCase();
            this.abbrToFull[a.toLowerCase()] = f;
            this.fullToAbbr[f] = a;
            this.pairs.push({ abbr: a, full: f });
        }
    }

    _findMatches(text) {
        const matches = [];
        for (const { abbr, full } of this.pairs) {
            // Ищем аббревиатуру
            const abbrRe = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z])${this._escapeRegex(abbr)}(?![а-яёА-ЯЁa-zA-Z])`, 'gi');
            let m;
            while ((m = abbrRe.exec(text)) !== null)
                matches.push({ index: m.index, length: m[0].length, type: 'abbr', abbr, full, found: m[0] });

            // Ищем полную форму
            const fullRe = new RegExp(`(?<![а-яёА-ЯЁ])${this._escapeRegex(full)}(?![а-яёА-ЯЁ])`, 'gi');
            while ((m = fullRe.exec(text)) !== null)
                matches.push({ index: m.index, length: m[0].length, type: 'full', abbr, full, found: m[0] });
        }

        matches.sort((a, b) => a.index - b.index);
        const filtered = [];
        let lastEnd = -1;
        for (const match of matches) {
            if (match.index >= lastEnd) { filtered.push(match); lastEnd = match.index + match.length; }
        }
        return filtered;
    }

    analyzeCapacity(text) {
        if (!this.loaded) return { totalBits: 0, positions: [], bases: [] };
        const matches = this._findMatches(text);
        const positions = matches.map(m => ({ index: m.index, type: m.type, abbr: m.abbr, full: m.full, variants: 2 }));
        return { totalBits: positions.length, positions, bases: positions.map(() => 2) };
    }

    encode(text, indices) {
        if (!this.loaded || indices.length === 0) return text;
        const matches = this._findMatches(text);
        if (matches.length === 0) return text;

        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const useAbbr = indices[i] === 0;
            let replacement = useAbbr ? m.abbr : m.full;
            if (m.found[0] === m.found[0].toUpperCase() && m.found[0] !== m.found[0].toLowerCase())
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            toReplace.push({ index: m.index, length: m.length, replacement });
        }

        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /** Декодирование только по стего-тексту: аббр. стоит → 0, полная форма → 1 */
    decode(stegoText) {
        if (!this.loaded) return [];
        return this._findMatches(stegoText).map(m => m.type === 'abbr' ? 0 : 1);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: this.loaded, pairs: this.pairs.length }; }
}

export default AbbreviationsChannel;
