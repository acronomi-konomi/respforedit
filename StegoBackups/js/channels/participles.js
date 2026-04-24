/**
 * Канал кодирования через причастные/деепричастные обороты
 * Переключает причастия на придаточные предложения и обратно:
 * "выполненная работа" ↔ "работа, которая была выполнена"
 *
 * Для простоты и надёжности используем словарный подход:
 * пары [краткая форма прилагательного/причастия, полная форма]
 */

export class ParticiplesChannel {
    constructor(morphology) {
        this.name = 'participles';
        this.morphology = morphology;
        this.pairs = [];
        this.allVariants = new Map();
        this.loaded = false;

        this._defaultPairs = [
            ['выполненный', 'выполнен'], ['выполненная', 'выполнена'],
            ['выполненное', 'выполнено'], ['выполненные', 'выполнены'],
            ['созданный', 'создан'], ['созданная', 'создана'],
            ['созданные', 'созданы'], ['написанный', 'написан'],
            ['написанная', 'написана'], ['написанные', 'написаны'],
            ['сделанный', 'сделан'], ['сделанная', 'сделана'],
            ['сделанные', 'сделаны'], ['установленный', 'установлен'],
            ['установленная', 'установлена'], ['установленные', 'установлены'],
            ['определённый', 'определён'], ['определённая', 'определена'],
            ['определённые', 'определены'], ['полученный', 'получен'],
            ['полученная', 'получена'], ['полученные', 'получены'],
        ];
    }

    async loadDictionary(path = './data/participles.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                this._buildIndex(data);
                this.loaded = true;
                console.log(`Participles: loaded ${this.pairs.length} pairs from JSON`);
                return;
            }
        } catch (e) { /* fall through */ }
        this._buildIndex(this._defaultPairs);
        this.loaded = true;
    }

    _buildIndex(data) {
        this.pairs = data.filter(p => Array.isArray(p) && p.length >= 2);
        this.allVariants = new Map();
        for (let i = 0; i < this.pairs.length; i++) {
            this.allVariants.set(this.pairs[i][0].toLowerCase(), { pairIndex: i, variantIdx: 0 });
            this.allVariants.set(this.pairs[i][1].toLowerCase(), { pairIndex: i, variantIdx: 1 });
        }
    }

    _findMatches(text) {
        const matches = [];
        for (const [variant, info] of this.allVariants) {
            const re = new RegExp(`(?<![а-яё])${this._escapeRegex(variant)}(?![а-яё])`, 'gi');
            let m;
            while ((m = re.exec(text)) !== null)
                matches.push({ index: m.index, length: m[0].length, pairIndex: info.pairIndex, currentVariant: info.variantIdx, found: m[0] });
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
            let replacement = this.pairs[m.pairIndex][vi];
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

    /** Декодирование только по стего-тексту: полное=0, краткое=1 */
    decode(stegoText) {
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: true, pairs: this.pairs.length }; }
}

export default ParticiplesChannel;
