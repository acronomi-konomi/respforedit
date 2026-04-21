/**
 * Канал кодирования через пунктуацию
 */

export class PunctuationChannel {
    constructor() {
        this.name = 'punctuation';
        
        this.variants = {
            dash: ['—', '–', '-'],           // Тире: длинное, среднее, дефис
            ellipsis: ['...', '…'],          // Многоточие
            quotes: ['«»', '""', "''"],      // Кавычки
            exclamation: ['!', '!!', '!!!'], // Восклицательный знак
            question: ['?', '??', '???'],    // Вопросительный знак
            combo: ['!?', '?!', '!', '?']    // Комбинации
        };
    }

    analyzeCapacity(text) {
        const positions = [];
        let totalBits = 0;

        // Поиск тире
        const dashRegex = /[—–-]/g;
        let match;
        while ((match = dashRegex.exec(text)) !== null) {
            positions.push({
                index: match.index,
                type: 'dash',
                variants: this.variants.dash.length
            });
            totalBits += Math.log2(this.variants.dash.length);
        }

        // Поиск многоточий
        const ellipsisRegex = /\.{3}|…/g;
        while ((match = ellipsisRegex.exec(text)) !== null) {
            positions.push({
                index: match.index,
                type: 'ellipsis',
                variants: this.variants.ellipsis.length
            });
            totalBits += Math.log2(this.variants.ellipsis.length);
        }

        // Поиск кавычек
        const quotesRegex = /[«»"']/g;
        let quoteStart = null;
        while ((match = quotesRegex.exec(text)) !== null) {
            if (quoteStart === null) {
                quoteStart = match.index;
            } else {
                positions.push({
                    index: quoteStart,
                    type: 'quotes',
                    variants: this.variants.quotes.length
                });
                totalBits += Math.log2(this.variants.quotes.length);
                quoteStart = null;
            }
        }

        return {
            totalBits,
            positions,
            bases: positions.map(p => p.variants)
        };
    }

    encode(text, indices) {
        let result = text;
        let indexCounter = 0;

        // Заменяем тире
        result = result.replace(/[—–-]/g, () => {
            if (indexCounter < indices.length) {
                const variant = this.variants.dash[indices[indexCounter++]];
                return variant || '—';
            }
            return '—';
        });

        // Заменяем многоточия
        result = result.replace(/\.{3}|…/g, () => {
            if (indexCounter < indices.length) {
                const variant = this.variants.ellipsis[indices[indexCounter++]];
                return variant || '…';
            }
            return '…';
        });

        // Заменяем кавычки (упрощённо)
        let inQuotes = false;
        result = result.replace(/[«»"']/g, () => {
            if (!inQuotes) {
                inQuotes = true;
                if (indexCounter < indices.length) {
                    const variantPair = this.variants.quotes[indices[indexCounter++]];
                    return variantPair ? variantPair[0] : '«';
                }
                return '«';
            } else {
                inQuotes = false;
                return '»';
            }
        });

        return result;
    }

    decode(stegoText, _unused) {
        const encodedText = stegoText;
        const indices = [];
        
        // Извлекаем тире
        const dashMatches = [...encodedText.matchAll(/[—–-]/g)];
        dashMatches.forEach(match => {
            const char = match[0];
            const index = this.variants.dash.indexOf(char);
            if (index !== -1) indices.push(index);
        });

        // Извлекаем многоточия
        const ellipsisMatches = [...encodedText.matchAll(/\.{3}|…/g)];
        ellipsisMatches.forEach(match => {
            const char = match[0];
            const index = this.variants.ellipsis.indexOf(char);
            if (index !== -1) indices.push(index);
        });

        // Извлекаем кавычки
        const quotesMatches = [...encodedText.matchAll(/[«»"']/g)];
        for (let i = 0; i < quotesMatches.length; i += 2) {
            if (i + 1 < quotesMatches.length) {
                const openQuote = quotesMatches[i][0];
                const pair = openQuote === '«' ? '«»' : (openQuote === '"' ? '""' : "''");
                const index = this.variants.quotes.indexOf(pair);
                if (index !== -1) indices.push(index);
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

export default PunctuationChannel;