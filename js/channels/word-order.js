/**
 * Канал кодирования через изменение порядка слов
 */

export class WordOrderChannel {
    constructor() {
        this.name = 'wordOrder';
    }

    /**
     * Проверить, можно ли менять порядок слов в предложении
     */
    isReorderable(sentence) {
        const words = sentence.trim().split(/\s+/);
        
        // Простая эвристика: можно менять порядок в предложениях из 3-6 слов
        if (words.length < 3 || words.length > 6) return false;
        
        // Не трогаем вопросительные предложения
        if (sentence.includes('?')) return false;
        
        return true;
    }

    /**
     * Получить все возможные перестановки (факториал)
     */
    factorial(n) {
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    /**
     * Получить перестановку по индексу (Lehmer code)
     */
    getPermutation(array, index) {
        const n = array.length;
        const result = [...array];
        const factorials = [];
        
        // Вычисляем факториалы
        for (let i = 0; i < n; i++) {
            factorials[i] = this.factorial(i);
        }
        
        // Алгоритм Lehmer
        for (let i = 0; i < n; i++) {
            const factorial = factorials[n - 1 - i];
            const position = Math.floor(index / factorial);
            index %= factorial;
            
            const temp = result[i + position];
            for (let j = i + position; j > i; j--) {
                result[j] = result[j - 1];
            }
            result[i] = temp;
        }
        
        return result;
    }

    /**
     * Получить индекс перестановки через алгоритм Lehmer (factoradic)
     * @param {string[]} original - исходный порядок слов
     * @param {string[]} permuted - переставленный порядок слов
     * @returns {number} - индекс перестановки (0 = исходный порядок)
     */
    getPermutationIndex(original, permuted) {
        const n = original.length;
        // Создаём mapping: слово → позиция в оригинале
        // Важно: работаем с позициями в оригинале, а не со значениями слов
        const origPositions = original.map((w, i) => i);
        // Для permuted: находим позиции в оригинале
        const permPositions = permuted.map(w => {
            const idx = original.indexOf(w);
            return idx >= 0 ? idx : 0;
        });

        // Lehmer code: для каждой позиции считаем, сколько последующих элементов
        // имеют меньший индекс в оригинале
        let index = 0;
        const available = [...Array(n).keys()]; // [0, 1, 2, ..., n-1]

        for (let i = 0; i < n; i++) {
            const pos = available.indexOf(permPositions[i]);
            if (pos === -1) break; // защита от дублей
            index += pos * this.factorial(n - 1 - i);
            available.splice(pos, 1);
        }

        return index;
    }

    analyzeCapacity(text) {
        const sentences = text.split(/[.!;]\s+/);
        const positions = [];
        let totalBits = 0;

        sentences.forEach((sentence, idx) => {
            if (this.isReorderable(sentence)) {
                const words = sentence.trim().split(/\s+/);
                const permutations = this.factorial(words.length);
                
                positions.push({
                    index: idx,
                    sentence: sentence,
                    wordCount: words.length,
                    variants: permutations
                });
                
                totalBits += Math.log2(permutations);
            }
        });

        return {
            totalBits,
            positions,
            bases: positions.map(p => p.variants)
        };
    }

    encode(text, indices) {
        // Разбиваем на пары: [предложение, разделитель]
        // Разделитель включает знак препинания и пробел
        const parts = text.split(/(?<=[.!?;])\s+/);
        let indexCounter = 0;

        const encoded = parts.map(sentence => {
            // Отделяем завершающую пунктуацию от слов
            const trailMatch = sentence.match(/^(.*?)([.!?;,]*)$/s);
            const body = trailMatch ? trailMatch[1].trim() : sentence.trim();
            const trail = trailMatch ? trailMatch[2] : '';

            if (this.isReorderable(body)) {
                const words = body.split(/\s+/);
                if (indexCounter < indices.length) {
                    const permutationIndex = indices[indexCounter++];
                    const permuted = this.getPermutation(words, permutationIndex);
                    // Сохраняем первую букву с заглавной
                    const result = permuted.join(' ');
                    const restored = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase()
                        .replace(/^[а-яёa-z]/i, c => c); // Сохраняем регистр
                    return restored + trail;
                }
            }
            return sentence;
        });

        return encoded.join('. ').replace(/\.\s*\./g, '.').trim();
    }

    decode(originalText, encodedText) {
        const origParts = originalText.split(/(?<=[.!?;])\s+/);
        const encParts  = encodedText.split(/(?<=[.!?;])\s+/);
        const indices = [];

        for (let i = 0; i < origParts.length; i++) {
            const origBody = origParts[i].replace(/[.!?;,]*$/, '').trim();
            const encBody  = i < encParts.length ? encParts[i].replace(/[.!?;,]*$/, '').trim() : origBody;

            if (this.isReorderable(origBody)) {
                const origWords = origBody.split(/\s+/).map(w => w.toLowerCase());
                const encWords  = encBody.split(/\s+/).map(w => w.toLowerCase());

                if (origWords.length === encWords.length) {
                    const permIndex = this.getPermutationIndex(origWords, encWords);
                    indices.push(permIndex);
                } else {
                    indices.push(0); // не удалось сопоставить — считаем исходным порядком
                }
            }
        }

        return indices;
    }

    getStats() {
        return {
            name: this.name,
            loaded: true
        };
    }
}

export default WordOrderChannel;