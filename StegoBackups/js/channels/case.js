/**
 * Канал кодирования через регистр букв
 * Использует слова, которые допустимо писать с большой или маленькой буквы
 * (названия, термины, слова после двоеточия и т.п.)
 */

export class CaseChannel {
    constructor(morphology) {
        this.name = 'case';
        this.morphology = morphology;
    }

    /**
     * Найти слова, регистр которых можно изменить без потери смысла
     * Правила:
     * 1. Слово в начале предложения (обязательно с большой) — пропускаем
     * 2. Слово после двоеточия — можно с большой или маленькой
     * 3. Имена собственные посреди предложения (всегда с большой) — пропускаем
     * 4. Слова-термины, официальные названия (Интернет/интернет, Земля/земля) — кодируем
     */
    _findPositions(text) {
        const positions = [];
        // Слова написанные с заглавной буквы НЕ в начале предложения
        const re = /(?<=[^.!?\n]\s{1,3})[А-ЯЁ][а-яё]{2,}/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            const word = m[0];
            // Морфология: если слово распознаётся как нарицательное — можно кодировать
            if (this.morphology && this.morphology.isAvailable()) {
                const tag = this.morphology.getTag(word);
                // Пропускаем имена собственные (Name, Patr, Surn, Geox, Orgn)
                if (tag && /Name|Patr|Surn|Geox|Orgn/.test(tag)) continue;
            }
            positions.push({ index: m.index, length: word.length, word });
        }
        return positions;
    }

    analyzeCapacity(text) {
        const positions = this._findPositions(text);
        return {
            totalBits: positions.length, // 1 бит на слово
            positions,
            bases: positions.map(() => 2)
        };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const positions = this._findPositions(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(positions.length, indices.length); i++) {
            const p = positions[i];
            const word = p.word;
            const replacement = indices[i] === 0
                ? word.charAt(0).toUpperCase() + word.slice(1)  // с заглавной
                : word.charAt(0).toLowerCase() + word.slice(1); // со строчной
            toReplace.push({ index: p.index, length: p.length, replacement });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    decode(originalText, encodedText) {
        const positions = this._findPositions(originalText);
        return positions.map(p => {
            const ch = encodedText[p.index];
            if (!ch) return 0;
            return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 0 : 1;
        });
    }

    getStats() { return { name: this.name, loaded: true }; }
}

export default CaseChannel;
