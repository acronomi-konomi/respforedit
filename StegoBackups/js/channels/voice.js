/**
 * Канал кодирования через залог (активный/пассивный)
 * Переключает конструкции типа:
 * "компания выполнила работу" ↔ "работа была выполнена компанией"
 *
 * Поскольку трансформация залога требует глубокого синтаксического анализа,
 * используем более простой подход: переключение устойчивых пассивных конструкций
 * с кратким страдательным причастием на глагольные и обратно.
 */

export class VoiceChannel {
    constructor(morphology) {
        this.name = 'voice';
        this.morphology = morphology;
        this.pairs = [];
        this.allVariants = new Map();
        this.loaded = false;

        // Встроенные пары — используются только если JSON не загружен
        this._defaultPairs = [
            ['решает', 'решается'], ['решают', 'решаются'],
            ['использует', 'используется'], ['используют', 'используются'],
            ['применяет', 'применяется'], ['применяют', 'применяются'],
            ['выполняет', 'выполняется'], ['выполняют', 'выполняются'],
            ['рассматривает', 'рассматривается'], ['рассматривают', 'рассматриваются'],
            ['разрабатывает', 'разрабатывается'], ['разрабатывают', 'разрабатываются'],
            ['создаёт', 'создаётся'], ['создают', 'создаются'],
            ['определяет', 'определяется'], ['определяют', 'определяются'],
            ['обеспечивает', 'обеспечивается'], ['обеспечивают', 'обеспечиваются'],
            ['включает', 'включается'], ['включают', 'включаются'],
            ['представляет', 'представляется'], ['представляют', 'представляются'],
            ['содержит', 'содержится'], ['содержат', 'содержатся'],
            ['осуществляет', 'осуществляется'], ['осуществляют', 'осуществляются'],
            ['проводит', 'проводится'], ['проводят', 'проводятся'],
            ['устанавливает', 'устанавливается'], ['устанавливают', 'устанавливаются'],
        ];
    }

    async loadDictionary(path = './data/voice-forms.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                this._buildIndex(data);
                this.loaded = true;
                console.log(`Voice: loaded ${this.pairs.length} pairs from JSON`);
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
            while ((m = re.exec(text)) !== null) {
                matches.push({
                    index: m.index,
                    length: m[0].length,
                    pairIndex: info.pairIndex,
                    currentVariant: info.variantIdx,
                    found: m[0]
                });
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
            let replacement = this.pairs[m.pairIndex][vi];
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

    /** Декодирование только по стего-тексту: какой залог стоит → 0 или 1 */
    decode(stegoText) {
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: true, pairs: this.pairs.length }; }
}

export default VoiceChannel;
