/**
 * Канал кодирования через числа (цифры ↔ буквы)
 */

export class NumbersChannel {
    constructor(morphology) {
        this.name = 'numbers';
        this.morphology = morphology;
    }

    analyzeCapacity(text) {
        const positions = [];
        let totalBits = 0;

        // Находим все числа в тексте
        const numberRegex = /\b\d+\b/g;
        let match;

        while ((match = numberRegex.exec(text)) !== null) {
            positions.push({
                index: match.index,
                number: match[0],
                variants: 2 // цифровая или буквенная форма
            });
            totalBits += 1;
        }

        return {
            totalBits,
            positions,
            bases: positions.map(() => 2)
        };
    }

    encode(text, indices) {
        let result = text;
        let indexCounter = 0;

        result = result.replace(/\b\d+\b/g, (match) => {
            if (indexCounter < indices.length) {
                const index = indices[indexCounter++];
                
                if (index === 1) {
                    // Конвертируем в буквенную форму
                    const num = parseInt(match);
                    return this.morphology.numberToWords(num);
                }
            }
            return match;
        });

        return result;
    }

    /**
     * Декодирование только по стего-тексту.
     * Числа (цифры) в тексте → 0, числительные-слова → 1.
     * analyzeCapacity находит только цифровые числа → всем им индекс 0.
     * Дополнительно ищем числительные-слова → им индекс 1.
     * Важно: порядок должен совпадать с порядком при encode.
     */
    decode(stegoText) {
        const indices = [];
        // Числа-цифры → 0
        for (const _ of stegoText.matchAll(/\b\d+\b/g)) indices.push(0);
        // Числительные-слова → 1
        for (const _ of this._findWordNumbers(stegoText)) indices.push(1);
        return indices;
    }

    _findWordNumbers(text) {
        const wordNums = [
            'ноль','нуль','один','одна','одно','два','две','три','четыре','пять',
            'шесть','семь','восемь','девять','десять','одиннадцать','двенадцать',
            'тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать',
            'восемнадцать','девятнадцать','двадцать','тридцать','сорок','пятьдесят',
            'шестьдесят','семьдесят','восемьдесят','девяносто','сто','двести',
            'триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот',
            'девятьсот','тысяча','тысячи','тысяч','миллион','миллиона','миллионов'
        ];
        const matches = [];
        for (const w of wordNums) {
            const re = new RegExp(`(?<![а-яё])${w}(?![а-яё])`, 'gi');
            let m;
            while ((m = re.exec(text)) !== null)
                matches.push({ index: m.index, length: m[0].length });
        }
        return matches.sort((a, b) => a.index - b.index);
    }

    getStats() {
        return {
            name: this.name,
            loaded: true
        };
    }
}

export default NumbersChannel;