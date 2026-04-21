/**
 * Канал кодирования через пробелы
 * Использует невидимые различия в пробельных символах:
 * - обычный пробел (U+0020) vs неразрывный пробел (U+00A0)
 * в определённых грамматически допустимых позициях
 */

export class SpacesChannel {
    constructor() {
        this.name = 'spaces';
        // Позиции где неразрывный пробел допустим: перед числами, инициалами, сокращениями
        this.NBSP = '\u00A0';
        this.SP   = ' ';
    }

    /**
     * Найти позиции, где пробел можно переключить NBSP ↔ SP
     * Грамматически корректные позиции:
     * 1. Перед числом (50 км → [50]sp/nbsp[км])
     * 2. После инициала (А. Пушкин)
     * 3. Перед «»
     * 4. Перед %, °, №
     */
    _findPositions(text) {
        const positions = [];
        // Перед числами после букв/слов
        const re1 = /(?<=[а-яёА-ЯЁa-zA-Z])[ \u00A0](?=\d)/g;
        // Перед процентом, градусом, номером
        const re2 = /(?<=\d)[ \u00A0](?=[%°])/g;
        // После № и перед числом
        const re3 = /(?<=№)[ \u00A0](?=\d)/g;
        // Перед кавычкой «
        const re4 = /(?<=\S)[ \u00A0](?=«)/g;
        // После инициала: "А. " перед фамилией
        const re5 = /(?<=[А-ЯЁ]\.)[ \u00A0](?=[А-ЯЁ])/g;

        for (const re of [re1, re2, re3, re4, re5]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null)
                positions.push({ index: m.index, length: 1 });
        }

        // Убираем дубликаты и сортируем
        const unique = [...new Map(positions.map(p => [p.index, p])).values()];
        unique.sort((a, b) => a.index - b.index);
        return unique;
    }

    analyzeCapacity(text) {
        const positions = this._findPositions(text);
        return {
            totalBits: positions.length, // 1 бит на позицию
            positions,
            bases: positions.map(() => 2)
        };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const positions = this._findPositions(text);
        const chars = text.split('');
        for (let i = 0; i < Math.min(positions.length, indices.length); i++) {
            chars[positions[i].index] = indices[i] === 0 ? this.SP : this.NBSP;
        }
        return chars.join('');
    }

    /** Декодирование только по стего-тексту: NBSP=1, SP=0 */
    decode(stegoText) {
        return this._findPositions(stegoText).map(p =>
            p.index < stegoText.length && stegoText[p.index] === this.NBSP ? 1 : 0
        );
    }

    getStats() { return { name: this.name, loaded: true }; }
}

export default SpacesChannel;
