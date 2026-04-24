/**
 * Канал кодирования через орфографические дублеты
 * Использует слова с двумя допустимыми написаниями (блоггер/блогер и т.п.)
 */

export class DupletsChannel {
    constructor() {
        this.name = 'duplets';
        this.duplets = {};      // { ключ: [вариант0, вариант1, ...] }
        this.variantMap = {};   // { вариантLower: { key, index } }
        this.loaded = false;
    }

    async loadDictionary(path = './data/duplets.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            this._buildIndex(data);
            this.loaded = true;
            console.log(`Loaded ${Object.keys(this.duplets).length} duplet groups`);
        } catch (e) {
            this._buildIndex({
                'офлайн': ['офлайн', 'оффлайн'],
                'блогер': ['блогер', 'блоггер'],
                'риелтор': ['риелтор', 'риэлтор'],
                'шопинг': ['шопинг', 'шоппинг'],
                'матрас': ['матрас', 'матрац'],
                'ноль': ['ноль', 'нуль'],
                'туннель': ['туннель', 'тоннель'],
                'калоша': ['калоша', 'галоша'],
                'обусловливать': ['обусловливать', 'обуславливать'],
                'сосредоточивать': ['сосредоточивать', 'сосредотачивать']
            });
            this.loaded = true;
        }
    }

    _buildIndex(data) {
        this.duplets = {};
        this.variantMap = {};
        for (const [key, variants] of Object.entries(data)) {
            if (!Array.isArray(variants) || variants.length < 2) continue;
            const k = key.toLowerCase();
            this.duplets[k] = variants.map(v => v.toLowerCase());
            for (let i = 0; i < variants.length; i++)
                this.variantMap[variants[i].toLowerCase()] = { key: k, index: i };
        }
    }

    _findMatches(text) {
        const matches = [];
        for (const [key, variants] of Object.entries(this.duplets)) {
            for (let vi = 0; vi < variants.length; vi++) {
                const re = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z])${this._escapeRegex(variants[vi])}(?![а-яёА-ЯЁa-zA-Z])`, 'gi');
                let m;
                while ((m = re.exec(text)) !== null)
                    matches.push({ index: m.index, length: m[0].length, key, variantCount: variants.length, currentVariant: vi, found: m[0] });
            }
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
        const positions = matches.map(m => ({ index: m.index, key: m.key, variants: m.variantCount }));
        const totalBits = positions.reduce((s, p) => s + Math.log2(p.variants), 0);
        return { totalBits, positions, bases: positions.map(p => p.variants) };
    }

    encode(text, indices) {
        if (!this.loaded || indices.length === 0) return text;
        const matches = this._findMatches(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const variantIdx = indices[i] % m.variantCount;
            let replacement = this.duplets[m.key][variantIdx];
            // Сохраняем регистр
            if (m.found[0] !== m.found[0].toLowerCase())
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            if (m.found === m.found.toUpperCase())
                replacement = replacement.toUpperCase();
            toReplace.push({ index: m.index, length: m.length, replacement });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /** Декодирование только по стего-тексту: какой вариант дублета стоит → его индекс */
    decode(stegoText) {
        if (!this.loaded) return [];
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: this.loaded, groups: Object.keys(this.duplets).length }; }
}

export default DupletsChannel;
