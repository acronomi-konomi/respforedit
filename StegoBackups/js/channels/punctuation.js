/**
 * Канал кодирования через пунктуацию
 *
 * ВАЖНО: Пунктуация НИКОГДА не применяется внутри защищённых зон:
 *   - номера телефонов (там дефисы — часть формата)
 *   - URL-адреса (там дефисы в домене, кавычки в query)
 *   - email-адреса (там дефисы и точки в локальной части)
 *
 * Это гарантирует, что пунктуация не ломает кодирование других каналов.
 * Защитные зоны вычисляются по тем же regex, что используют каналы
 * phones/urls/emails — поэтому детекция консистентна между encode и decode.
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

        // Regex для поиска защищённых зон (те же, что в каналах phones/urls/emails)
        this._phoneRegex = /(?:\+?7|8)[\s\-]*\(?\d{3}\)?[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g;
        this._urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s<>"']*)?/g;
        this._emailRegex = /[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9.]*/g;
    }

    /**
     * Найти все защищённые зоны в тексте (телефоны, URL, email).
     * Возвращает массив { start, end } — сортированный по start.
     */
    _findProtectedSpans(text) {
        const spans = [];

        // Телефоны
        this._phoneRegex.lastIndex = 0;
        let m;
        while ((m = this._phoneRegex.exec(text)) !== null) {
            spans.push({ start: m.index, end: m.index + m[0].length });
        }

        // URL — пропускаем совпадения внутри email
        this._urlRegex.lastIndex = 0;
        const emailSpans = [];
        this._emailRegex.lastIndex = 0;
        while ((m = this._emailRegex.exec(text)) !== null) {
            emailSpans.push({ start: m.index, end: m.index + m[0].length });
        }

        this._urlRegex.lastIndex = 0;
        while ((m = this._urlRegex.exec(text)) !== null) {
            if (!m[0].includes('.') || m[0].length <= 5) continue;
            const urlStart = m.index;
            const urlEnd = m.index + m[0].length;
            // Пропускаем URL, если он внутри email или предшествуется @
            const preceded = urlStart > 0 && text[urlStart - 1] === '@';
            const overlapsEmail = emailSpans.some(es =>
                (urlStart >= es.start && urlStart < es.end) ||
                (urlEnd > es.start && urlEnd <= es.end) ||
                (urlStart <= es.start && urlEnd >= es.end)
            );
            if (!preceded && !overlapsEmail) {
                spans.push({ start: urlStart, end: urlEnd });
            }
        }

        // Email
        for (const es of emailSpans) {
            spans.push(es);
        }

        // Сортируем по start
        spans.sort((a, b) => a.start - b.start);
        return spans;
    }

    /**
     * Проверить, попадает ли позиция в защищённую зону.
     * Защищённая зона — это весь спан от start до end (включительно start, исключительно end).
     * Для кавычек: защищаем весь диапазон от открывающей до закрывающей.
     */
    _isProtected(index, protectedSpans) {
        for (const span of protectedSpans) {
            if (index >= span.start && index < span.end) return true;
        }
        return false;
    }

    /**
     * Проверить, попадает ли диапазон [start, end) в защищённую зону.
     */
    _isRangeProtected(start, end, protectedSpans) {
        for (const span of protectedSpans) {
            // Диапазон пересекается с защищённой зоной?
            if (start < span.end && end > span.start) return true;
        }
        return false;
    }

    analyzeCapacity(text) {
        const protectedSpans = this._findProtectedSpans(text);
        const positions = [];
        let totalBits = 0;

        // Поиск тире — пропускаем защищённые зоны
        const dashRegex = /[—–-]/g;
        let match;
        while ((match = dashRegex.exec(text)) !== null) {
            if (this._isProtected(match.index, protectedSpans)) continue;
            positions.push({
                index: match.index,
                type: 'dash',
                variants: this.variants.dash.length
            });
            totalBits += Math.log2(this.variants.dash.length);
        }

        // Поиск многоточий — пропускаем защищённые зоны
        const ellipsisRegex = /\.{3}|…/g;
        while ((match = ellipsisRegex.exec(text)) !== null) {
            if (this._isProtected(match.index, protectedSpans)) continue;
            positions.push({
                index: match.index,
                type: 'ellipsis',
                variants: this.variants.ellipsis.length
            });
            totalBits += Math.log2(this.variants.ellipsis.length);
        }

        // Поиск кавычек — только парные (открывающая + закрывающая)
        // Пропускаем пары, если ЛИБО открывающая, ЛИБО закрывающая в защищённой зоне
        const OPEN_QUOTES = ['«', '"', "'"];
        const CLOSE_QUOTES = ['»', '"', "'"];
        const quotesRegex = /[«»"']/g;
        let quoteStart = null;
        let quoteStartChar = null;
        while ((match = quotesRegex.exec(text)) !== null) {
            const ch = match[0];
            if (quoteStart === null) {
                // Looking for opening quote
                const openIdx = OPEN_QUOTES.indexOf(ch);
                if (openIdx !== -1) {
                    // Если открывающая кавычка в защищённой зоне — пропускаем
                    if (this._isProtected(match.index, protectedSpans)) continue;
                    quoteStart = match.index;
                    quoteStartChar = ch;
                }
            } else {
                // Looking for closing quote that matches the opening type
                const openIdx = OPEN_QUOTES.indexOf(quoteStartChar);
                if (openIdx !== -1 && ch === CLOSE_QUOTES[openIdx]) {
                    // Если закрывающая кавычка в защищённой зоне — пропускаем всю пару
                    if (this._isProtected(match.index, protectedSpans)) {
                        quoteStart = null;
                        quoteStartChar = null;
                        continue;
                    }
                    positions.push({
                        index: quoteStart,
                        endIndex: match.index + 1,
                        type: 'quotes',
                        variants: this.variants.quotes.length
                    });
                    totalBits += Math.log2(this.variants.quotes.length);
                    quoteStart = null;
                    quoteStartChar = null;
                }
            }
        }

        return {
            totalBits,
            positions,
            bases: positions.map(p => p.variants)
        };
    }

    encode(text, indices) {
        const protectedSpans = this._findProtectedSpans(text);
        let result = text;
        let indexCounter = 0;

        // Заменяем тире — пропускаем защищённые зоны
        result = result.replace(/[—–-]/g, (match, offset) => {
            if (this._isProtected(offset, protectedSpans)) return match;
            if (indexCounter < indices.length) {
                const variant = this.variants.dash[indices[indexCounter++]];
                return variant || '—';
            }
            return '—';
        });

        // Пересчитываем защищённые зоны (текст изменился — позиции сдвинулись!)
        // На самом деле, заменяем тире на тире (варианты той же длины),
        // поэтому позиции НЕ сдвигаются. Защищённые зоны актуальны.

        // Заменяем многоточия — пропускаем защищённые зоны
        result = result.replace(/\.{3}|…/g, (match, offset) => {
            if (this._isProtected(offset, protectedSpans)) return match;
            if (indexCounter < indices.length) {
                const variant = this.variants.ellipsis[indices[indexCounter++]];
                return variant || '…';
            }
            return '…';
        });

        // Заменяем кавычки ПАРАМИ — пропускаем защищённые зоны
        // Важно: если открывающая или закрывающая кавычка в защищённой зоне —
        // оставляем обе как есть (не кодируем пару)
        let inQuotes = false;
        let selectedPairIdx = 0;
        let openQuoteProtected = false;

        result = result.replace(/[«»"']/g, (match, offset) => {
            const isProtected = this._isProtected(offset, protectedSpans);

            if (!inQuotes) {
                // Открывающая кавычка
                inQuotes = true;
                openQuoteProtected = isProtected;

                if (isProtected) return match; // не кодируем

                if (indexCounter < indices.length) {
                    selectedPairIdx = indices[indexCounter++];
                    const variantPair = this.variants.quotes[selectedPairIdx];
                    return variantPair ? variantPair[0] : '«';
                }
                selectedPairIdx = 0;
                return '«';
            } else {
                // Закрывающая кавычка
                inQuotes = false;

                if (openQuoteProtected || isProtected) {
                    openQuoteProtected = false;
                    return match; // не кодируем (вся пара пропущена)
                }
                openQuoteProtected = false;

                const variantPair = this.variants.quotes[selectedPairIdx] || this.variants.quotes[0];
                return variantPair[1] || '»';
            }
        });

        return result;
    }

    decode(stegoText, _unused) {
        const protectedSpans = this._findProtectedSpans(stegoText);
        const indices = [];

        // Извлекаем тире — пропускаем защищённые зоны
        const dashMatches = [...stegoText.matchAll(/[—–-]/g)];
        dashMatches.forEach(match => {
            if (this._isProtected(match.index, protectedSpans)) return;
            const char = match[0];
            const index = this.variants.dash.indexOf(char);
            if (index !== -1) indices.push(index);
        });

        // Извлекаем многоточия — пропускаем защищённые зоны
        const ellipsisMatches = [...stegoText.matchAll(/\.{3}|…/g)];
        ellipsisMatches.forEach(match => {
            if (this._isProtected(match.index, protectedSpans)) return;
            const char = match[0];
            const index = this.variants.ellipsis.indexOf(char);
            if (index !== -1) indices.push(index);
        });

        // Извлекаем кавычки — по парам, пропускаем защищённые зоны
        const quotesMatches = [...stegoText.matchAll(/[«»"']/g)];
        // Фильтруем совпадения в защищённых зонах
        const filteredQuotes = quotesMatches.filter(m => !this._isProtected(m.index, protectedSpans));

        for (let i = 0; i < filteredQuotes.length; i += 2) {
            if (i + 1 < filteredQuotes.length) {
                const openQuote = filteredQuotes[i][0];
                const closeQuote = filteredQuotes[i + 1][0];
                // Determine which pair variant this is
                let pairIndex = -1;
                for (let vi = 0; vi < this.variants.quotes.length; vi++) {
                    if (this.variants.quotes[vi][0] === openQuote && this.variants.quotes[vi][1] === closeQuote) {
                        pairIndex = vi;
                        break;
                    }
                }
                if (pairIndex !== -1) indices.push(pairIndex);
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
