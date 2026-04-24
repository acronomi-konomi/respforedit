/**
 * Канал кодирования через смайлики/эмодзи
 * Выбирает один из нескольких семантически близких вариантов
 */

export class SmilesChannel {
    constructor() {
        this.name = 'smiles';
        // Группы взаимозаменяемых смайлов (каждая группа = позиция)
        this.groups = [
            ['😊', '🙂', '😀', '😄'],   // радость
            ['😔', '😞', '🙁', '😢'],   // грусть
            ['👍', '✅', '👌', '💯'],    // одобрение
            ['❤️', '💙', '💚', '💛'],   // сердечки
            ['🎉', '🎊', '✨', '🌟'],   // праздник
            ['🔥', '⚡', '💥', '🌪️'],  // энергия
            ['😂', '🤣', '😹', '😆'],   // смех
            ['🤔', '🧐', '💭', '❓'],   // раздумье
        ];
        // Паттерн для поиска любого эмодзи из наших групп
        this._buildPattern();
    }

    _buildPattern() {
        const allSmiles = this.groups.flat();
        // Эскейпим каждый эмодзи для regex
        this.allSmilesSet = new Set(allSmiles);
    }

    _findMatches(text) {
        const matches = [];
        // Ищем все эмодзи из наших групп
        const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
            ? new Intl.Segmenter('ru', { granularity: 'grapheme' })
            : null;

        if (segmenter) {
            let offset = 0;
            for (const { segment } of segmenter.segment(text)) {
                if (this.allSmilesSet.has(segment)) {
                    // Найти группу
                    for (let gi = 0; gi < this.groups.length; gi++) {
                        if (this.groups[gi].includes(segment)) {
                            matches.push({ index: offset, length: segment.length, groupIndex: gi, currentVariant: this.groups[gi].indexOf(segment) });
                            break;
                        }
                    }
                }
                offset += segment.length;
            }
        } else {
            // Фоллбек: простой перебор
            for (let gi = 0; gi < this.groups.length; gi++) {
                for (let vi = 0; vi < this.groups[gi].length; vi++) {
                    const smile = this.groups[gi][vi];
                    let idx = text.indexOf(smile);
                    while (idx !== -1) {
                        matches.push({ index: idx, length: smile.length, groupIndex: gi, currentVariant: vi });
                        idx = text.indexOf(smile, idx + smile.length);
                    }
                }
            }
            matches.sort((a, b) => a.index - b.index);
        }

        // Убираем перекрытия
        const filtered = []; let lastEnd = -1;
        for (const m of matches) {
            if (m.index >= lastEnd) { filtered.push(m); lastEnd = m.index + m.length; }
        }
        return filtered;
    }

    analyzeCapacity(text) {
        const matches = this._findMatches(text);
        const positions = matches.map(m => ({ index: m.index, groupIndex: m.groupIndex, variants: this.groups[m.groupIndex].length }));
        const totalBits = positions.reduce((s, p) => s + Math.log2(p.variants), 0);
        return { totalBits, positions, bases: positions.map(p => p.variants) };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const matches = this._findMatches(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const vi = indices[i] % this.groups[m.groupIndex].length;
            toReplace.push({ index: m.index, length: m.length, replacement: this.groups[m.groupIndex][vi] });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /** Декодирование только по стего-тексту: какой смайл из группы стоит → его индекс */
    decode(stegoText) {
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    getStats() { return { name: this.name, loaded: true, groups: this.groups.length }; }
}

export default SmilesChannel;
