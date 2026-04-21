/**
 * Канал кодирования через устойчивые фразы/клише
 * Заменяет одну устойчивую фразу на семантически эквивалентную
 */

export class PhrasesChannel {
    constructor() {
        this.name = 'phrases';
        this.groups = []; // [{variants: [фраза0, фраза1, ...]}]
        this.variantMap = new Map(); // фраза_lower → { groupIndex, variantIdx }
        this.loaded = false;
    }

    async loadDictionary(path = './data/phrases.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                this._buildIndex(data);
                this.loaded = true;
                console.log(`Loaded ${this.groups.length} phrase groups`);
                return;
            }
        } catch (e) { /* fall through */ }

        // Встроенный словарь фраз
        this._buildIndex([
            ['в настоящее время', 'в данный момент', 'на сегодняшний день', 'сейчас'],
            ['в связи с этим', 'в связи с вышесказанным', 'в этой связи'],
            ['следует отметить', 'необходимо отметить', 'стоит отметить', 'важно отметить'],
            ['таким образом', 'итак', 'следовательно', 'тем самым'],
            ['в частности', 'например', 'в том числе', 'в особенности'],
            ['с точки зрения', 'с позиции', 'с позиций', 'с позиционирования'],
            ['в результате', 'в итоге', 'как следствие', 'вследствие этого'],
            ['помимо этого', 'кроме того', 'помимо прочего', 'вдобавок'],
            ['тем не менее', 'однако', 'вместе с тем', 'при этом'],
            ['в целом', 'в общем', 'в общем и целом', 'в совокупности'],
            ['на основании', 'на основе', 'исходя из', 'опираясь на'],
            ['с одной стороны', 'с другой стороны'],
            ['прежде всего', 'в первую очередь', 'первоочерёдно'],
            ['как правило', 'как правило', 'по общему правилу', 'обычно'],
            ['в том числе', 'включая', 'в числе которых', 'в числе них'],
            ['при условии', 'при условии что', 'если', 'в случае если'],
            ['как известно', 'как известно всем', 'общеизвестно'],
            ['принимая во внимание', 'учитывая', 'с учётом'],
            ['в конечном счёте', 'в конце концов', 'в итоге', 'под конец'],
            ['в соответствии с', 'согласно', 'в согласии с'],
        ]);
        this.loaded = true;
    }

    _buildIndex(data) {
        this.groups = [];
        this.variantMap = new Map();
        for (const group of data) {
            if (!Array.isArray(group) || group.length < 2) continue;
            const variants = group.map(v => v.trim().toLowerCase()).filter(Boolean);
            if (variants.length < 2) continue;
            const gi = this.groups.length;
            this.groups.push({ variants });
            for (let vi = 0; vi < variants.length; vi++)
                this.variantMap.set(variants[vi], { groupIndex: gi, variantIdx: vi });
        }
    }

    _findMatches(text) {
        const matches = [];
        const lowerText = text.toLowerCase();
        for (const [phrase, info] of this.variantMap) {
            let idx = lowerText.indexOf(phrase);
            while (idx !== -1) {
                // Проверяем границы слова
                const before = idx === 0 || /[^а-яёА-ЯЁa-zA-Z]/.test(text[idx - 1]);
                const after  = idx + phrase.length >= text.length || /[^а-яёА-ЯЁa-zA-Z]/.test(text[idx + phrase.length]);
                if (before && after)
                    matches.push({ index: idx, length: phrase.length, groupIndex: info.groupIndex, currentVariant: info.variantIdx, found: text.slice(idx, idx + phrase.length) });
                idx = lowerText.indexOf(phrase, idx + 1);
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
        if (!this.loaded) return { totalBits: 0, positions: [], bases: [] };
        const matches = this._findMatches(text);
        const positions = matches.map(m => ({
            index: m.index,
            groupIndex: m.groupIndex,
            variants: this.groups[m.groupIndex].variants.length
        }));
        const totalBits = positions.reduce((s, p) => s + Math.log2(p.variants), 0);
        return { totalBits, positions, bases: positions.map(p => p.variants) };
    }

    encode(text, indices) {
        if (!this.loaded || indices.length === 0) return text;
        const matches = this._findMatches(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const group = this.groups[m.groupIndex];
            const vi = indices[i] % group.variants.length;
            let replacement = group.variants[vi];
            // Сохраняем регистр первого слова
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

    /** Декодирование только по стего-тексту: какая именно фраза стоит → её индекс в группе */
    decode(stegoText) {
        if (!this.loaded) return [];
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    getStats() { return { name: this.name, loaded: this.loaded, groups: this.groups.length }; }
}

export default PhrasesChannel;
