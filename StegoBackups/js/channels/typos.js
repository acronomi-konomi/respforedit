/**
 * Канал кодирования через опечатки/вариации
 * Использует допустимые орфографические вариации, которые не бросаются в глаза:
 * - дефис vs тире (в составных словах)
 * - слитное/раздельное написание некоторых слов
 * - написание числительных (1-й / 1й / первый)
 */

export class TyposChannel {
    constructor() {
        this.name = 'typos';
        // Пары: [вариант0, вариант1] — оба орфографически допустимы
        this.pairs = [
            // Дефис и его отсутствие в наречиях
            [/\bпо-новому\b/g, 'по-новому', 'по новому'],
            [/\bпо-старому\b/g, 'по-старому', 'по старому'],
            [/\bпо-прежнему\b/g, 'по-прежнему', 'по прежнему'],
            [/\bвсё-таки\b/g, 'всё-таки', 'всё таки'],
            [/\bтак-то\b/g, 'так-то', 'так то'],
            [/\bкак-то\b/g, 'как-то', 'как то'],
            [/\bкое-как\b/g, 'кое-как', 'кое как'],
            [/\bкое-где\b/g, 'кое-где', 'кое где'],
            [/\bкое-что\b/g, 'кое-что', 'кое что'],
            [/\bкое-кто\b/g, 'кое-кто', 'кое кто'],
        ];

        // Более простая структура: {вариант0: вариант1, вариант1: вариант0}
        // для быстрого поиска и замены
        this.swapPairs = [
            ['всё-таки', 'всё таки'],
            ['как-то', 'как то'],
            ['кое-как', 'кое как'],
            ['кое-где', 'кое где'],
            ['кое-что', 'кое что'],
            ['кое-кто', 'кое кто'],
            ['по-новому', 'по новому'],
            ['по-старому', 'по старому'],
            ['по-прежнему', 'по прежнему'],
            ['так-то', 'так то'],
            ['где-то', 'где то'],
            ['когда-то', 'когда то'],
            ['почему-то', 'почему то'],
            ['куда-то', 'куда то'],
            ['кто-то', 'кто то'],
            ['что-то', 'что то'],
            ['кто-нибудь', 'кто нибудь'],
            ['что-нибудь', 'что нибудь'],
            ['где-нибудь', 'где нибудь'],
        ];
    }

    _findMatches(text) {
        const matches = [];
        for (let pi = 0; pi < this.swapPairs.length; pi++) {
            const [v0, v1] = this.swapPairs[pi];
            for (let vi = 0; vi < 2; vi++) {
                const variant = vi === 0 ? v0 : v1;
                const re = new RegExp(`(?<![а-яёА-ЯЁ])${this._escapeRegex(variant)}(?![а-яёА-ЯЁ])`, 'gi');
                let m;
                while ((m = re.exec(text)) !== null)
                    matches.push({ index: m.index, length: m[0].length, pairIndex: pi, currentVariant: vi, found: m[0] });
            }
        }
        matches.sort((a, b) => a.index - b.index);
        const filtered = []; let lastEnd = -1;
        for (const match of matches) {
            if (match.index >= lastEnd) { filtered.push(match); lastEnd = match.index + match.length; }
        }
        return filtered;
    }

    analyzeCapacity(text) {
        const matches = this._findMatches(text);
        const positions = matches.map(m => ({ index: m.index, pairIndex: m.pairIndex, variants: 2 }));
        return { totalBits: positions.length, positions, bases: positions.map(() => 2) };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const matches = this._findMatches(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const vi = indices[i] % 2;
            let replacement = this.swapPairs[m.pairIndex][vi];
            // Сохраняем регистр
            if (m.found[0] !== m.found[0].toLowerCase())
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            toReplace.push({ index: m.index, length: m.length, replacement });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /** Декодирование только по стего-тексту: с дефисом=0, без=1 (или наоборот) */
    decode(stegoText) {
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: true, pairs: this.swapPairs.length }; }
}

export default TyposChannel;
