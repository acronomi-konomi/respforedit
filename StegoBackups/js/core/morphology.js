/**
 * Морфологический анализатор на основе Az.js
 * 
 * Работает в двух режимах:
 * 1. Полный (с Az.js): точная лемматизация, склонение, согласование форм
 * 2. Деградированный (без Az.js): простые эвристики, без Az.js
 *    — подходит для Node.js тестов и браузеров без Az.js
 */

export class RussianMorphology {
    constructor() {
        this.Az = null;
        this.loaded = false;
    }

    /**
     * Инициализация Az.js.
     * НЕ бросает исключение если Az.js недоступен — переходит в деградированный режим.
     */
    async init(dictsPath = './lib/dicts') {
        // Проверяем глобальный объект Az
        const azGlobal = typeof Az !== 'undefined' ? Az : null;
        if (!azGlobal || !azGlobal.Morph) {
            console.warn('⚠️  Az.js не найден — морфология работает в упрощённом режиме');
            this.loaded = false;
            return; // Graceful degradation — не бросаем ошибку
        }

        return new Promise((resolve) => {
            try {
                azGlobal.Morph.init(dictsPath, (err) => {
                    if (err) {
                        console.warn('⚠️  Az.Morph init error:', err, '— работаем без морфологии');
                        this.loaded = false;
                    } else {
                        this.Az = azGlobal;
                        this.loaded = true;
                        console.log('✅ Az.Morph инициализирован');
                    }
                    resolve(); // Всегда resolve, никогда reject
                });
            } catch (e) {
                console.warn('⚠️  Az.Morph exception:', e.message, '— работаем без морфологии');
                this.loaded = false;
                resolve();
            }
        });
    }

    /** Доступна ли полная морфология (Az.js) */
    isAvailable() { return this.loaded && this.Az !== null; }

    /** Обратная совместимость */
    isReady() { return this.loaded; }

    /**
     * Морфологический разбор слова
     */
    parse(word, options = {}) {
        if (!this.isAvailable()) return [];
        try {
            return this.Az.Morph(word, { typos: 'auto', stutter: true, ...options });
        } catch(e) { return []; }
    }

    /**
     * Получить тег первого разбора (для проверки именован/нарицательного и т.п.)
     */
    getTag(word) {
        const parses = this.parse(word);
        return parses.length > 0 ? parses[0].tag : null;
    }

    /**
     * Получить лемму (нормальную форму) слова
     */
    normalize(word) {
        if (!this.isAvailable()) return word.toLowerCase();
        const parses = this.parse(word);
        if (parses.length === 0) return word.toLowerCase();
        try { return parses[0].normalize().toString().toLowerCase(); } catch(e) { return word.toLowerCase(); }
    }

    /**
     * Получить все формы слова
     */
    getAllForms(word) {
        if (!this.isAvailable()) return [word];
        const parses = this.parse(word);
        if (parses.length === 0) return [word];
        const forms = [];
        try {
            for (let i = 0; i < parses[0].formCnt; i++) {
                forms.push(parses[0].inflect(i).toString());
            }
        } catch(e) { return [word]; }
        return forms;
    }

    /**
     * Получить грамматическую информацию о слове
     */
    getGrammar(word) {
        if (!this.isAvailable()) return { word, pos: null, tag: null, lemma: word.toLowerCase(), score: 0 };
        const parses = this.parse(word);
        if (parses.length === 0) return { word, pos: null, tag: null, lemma: word.toLowerCase(), score: 0 };
        const best = parses[0];
        return {
            word,
            pos: best.tag.POST,
            case: best.tag.CAse,
            number: best.tag.NMbr,
            gender: best.tag.GNdr,
            tense: best.tag.TEns,
            person: best.tag.PERs,
            tag: best.tag,
            lemma: best.normalize().toString().toLowerCase(),
            score: best.score,
            allParses: parses
        };
    }

    /**
     * Склонение слова в нужную форму
     */
    inflect(word, targetGrammemes) {
        if (!this.isAvailable()) return word;
        const parses = this.parse(word);
        if (parses.length === 0) return word;
        const variant = parses[0];
        try {
            for (let i = 0; i < variant.formCnt; i++) {
                const form = variant.inflect(i);
                let matches = true;
                for (const grammeme in targetGrammemes) {
                    if (form.tag[grammeme] !== targetGrammemes[grammeme]) { matches = false; break; }
                }
                if (matches) return form.toString();
            }
        } catch(e) { /* fall through */ }
        return word;
    }

    /**
     * Привести synonym к той же грамматической форме, что и originalWord.
     * Используется каналом синонимов для корректной замены.
     *
     * Логика:
     * 1. Если Az.js доступен — используем морфологический анализ
     * 2. Если части речи разные — возвращаем null (замена невозможна)
     * 3. Для существительных: совпадаем по падежу и числу
     * 4. Для глаголов: совпадаем по времени, числу, лицу/роду
     * 5. Для прилагательных: совпадаем по падежу, числу, роду
     */
    matchForm(originalWord, synonymLemma) {
        if (!this.isAvailable()) {
            const isUpper = originalWord[0] && originalWord[0] !== originalWord[0].toLowerCase();
            return isUpper
                ? synonymLemma.charAt(0).toUpperCase() + synonymLemma.slice(1)
                : synonymLemma;
        }

        const origParses = this.parse(originalWord);
        const synParses  = this.parse(synonymLemma);

        if (origParses.length === 0 || synParses.length === 0) {
            return this._applyCase(synonymLemma, originalWord);
        }

        const origTag = origParses[0].tag;
        const synVar  = synParses[0];

        const origPOS = origTag.POST;
        const synPOS  = synVar.tag.POST;

        // Строгая проверка POS — VERB и INFN считаются несовместимыми
        // (нельзя заменять "была" на "стать")
        if (synPOS !== origPOS) return null;

        // Дополнительно: если оригинал — VERB (спрягаемый), синоним тоже должен быть VERB
        // Если оригинал — INFN (инфинитив), синоним тоже должен быть INFN
        // (Az.js иногда объединяет их в один POS 'VERB')
        if (origPOS === 'VERB' || origPOS === 'INFN') {
            const origIsInfn = origTag.POST === 'INFN' || !origTag.TEns;
            const synIsInfn  = synVar.tag.POST === 'INFN' || !synVar.tag.TEns;
            if (origIsInfn !== synIsInfn) return null;
        }

        try {
            for (let i = 0; i < synVar.formCnt; i++) {
                const form = synVar.inflect(i);
                const ft = form.tag;

                // Для существительных: падеж + число
                if (origPOS === 'NOUN') {
                    if (ft.CAse === origTag.CAse && ft.NMbr === origTag.NMbr) {
                        return this._applyCase(form.toString(), originalWord);
                    }
                }
                // Для глаголов
                else if (origPOS === 'VERB') {
                    // Инфинитив
                    if (!origTag.TEns) {
                        if (!ft.TEns && ft.POST !== 'NOUN') return this._applyCase(form.toString(), originalWord);
                    }
                    // Спрягаемый глагол: время + число + лицо/род
                    else if (ft.TEns === origTag.TEns && ft.NMbr === origTag.NMbr) {
                        if (origTag.TEns === 'past') {
                            if (ft.GNdr === origTag.GNdr) return this._applyCase(form.toString(), originalWord);
                        } else {
                            if (ft.PERs === origTag.PERs) return this._applyCase(form.toString(), originalWord);
                        }
                    }
                }
                // Инфинитив отдельно
                else if (origPOS === 'INFN') {
                    if (ft.POST === 'INFN' || !ft.TEns) return this._applyCase(form.toString(), originalWord);
                }
                // Для прилагательных: падеж + число + род
                else if (origPOS === 'ADJF' || origPOS === 'ADJS') {
                    if (origPOS === 'ADJS') {
                        if (ft.POST === 'ADJS' && ft.NMbr === origTag.NMbr &&
                            (!origTag.GNdr || ft.GNdr === origTag.GNdr)) {
                            return this._applyCase(form.toString(), originalWord);
                        }
                    } else {
                        if (ft.CAse === origTag.CAse && ft.NMbr === origTag.NMbr &&
                            (!origTag.GNdr || ft.GNdr === origTag.GNdr)) {
                            return this._applyCase(form.toString(), originalWord);
                        }
                    }
                }
                // Для наречий — форма не меняется
                else if (origPOS === 'ADVB') {
                    return this._applyCase(synVar.inflect(0).toString(), originalWord);
                }
                // Прочие POS (союзы, частицы и т.д.)
                else {
                    return this._applyCase(synVar.inflect(0).toString(), originalWord);
                }
            }
        } catch(e) { /* fall through */ }

        // Не нашли нужную форму — возвращаем null чтобы пропустить замену
        return null;
    }

    /**
     * Применить регистр источника к целевому слову
     */
    _applyCase(target, source) {
        if (!source || !target) return target;
        if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
        if (source[0] !== source[0].toLowerCase()) return target.charAt(0).toUpperCase() + target.slice(1);
        return target.toLowerCase();
    }

    /**
     * Заменить слово в тексте с сохранением формы и регистра
     */
    replaceWord(text, oldWord, newLemma) {
        const replacement = this.matchForm(oldWord, newLemma);
        const regex = new RegExp(`(?<![а-яёА-ЯЁ])${this._escapeRegex(oldWord)}(?![а-яёА-ЯЁ])`, 'g');
        return text.replace(regex, replacement);
    }

    /**
     * Согласование слова с числительным (1 кот, 2 кота, 5 котов)
     */
    pluralize(word, count) {
        if (!this.isAvailable()) return word;
        const parses = this.parse(word);
        if (parses.length === 0) return word;
        try { return parses[0].pluralize(count).toString(); } catch(e) { return word; }
    }

    /**
     * Конвертация числа в слова
     */
    numberToWords(num, gender = 'masc') {
        if (num === 0) return 'ноль';
        if (num < 0)  return 'минус ' + this.numberToWords(-num, gender);

        const ones = {
            masc: ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
            femn: ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
            neut: ['', 'одно', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
        };
        const teens   = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
        const tens    = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
        const hundreds= ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];

        const result = [];
        if (num >= 1000) {
            const th = Math.floor(num / 1000);
            result.push(this.numberToWords(th, 'femn'));
            result.push(this.pluralize('тысяча', th) || 'тысяч');
            num %= 1000;
        }
        if (num >= 100) { result.push(hundreds[Math.floor(num / 100)]); num %= 100; }
        if (num >= 10 && num < 20) { result.push(teens[num - 10]); return result.filter(Boolean).join(' '); }
        if (num >= 20) { result.push(tens[Math.floor(num / 10)]); num %= 10; }
        if (num > 0 && ones[gender]) result.push(ones[gender][num]);
        return result.filter(Boolean).join(' ');
    }

    /**
     * Токенизация через Az.Tokens (если доступен)
     */
    tokenize(text, options = {}) {
        if (!this.isAvailable() || !this.Az.Tokens) return [];
        try {
            return this.Az.Tokens(text, {
                html: options.html || false,
                wiki: options.wiki || false,
                markdown: options.markdown || false
            }).done();
        } catch(e) { return []; }
    }

    /**
     * Получить только слова из текста
     */
    getWords(text) {
        if (!this.isAvailable()) {
            // Без Az.js — простая regex-токенизация
            return (text.match(/[а-яёА-ЯЁ]{2,}/g) || []);
        }
        try {
            const tokens = this.tokenize(text);
            return tokens
                .filter(t => this.Az.Tokens && t.type === this.Az.Tokens.WORD)
                .map(t => t.toString());
        } catch(e) {
            return (text.match(/[а-яёА-ЯЁ]{2,}/g) || []);
        }
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // Обратная совместимость
    escapeRegex(str) { return this._escapeRegex(str); }

    getStats() {
        return { loaded: this.loaded, mode: this.isAvailable() ? 'full (Az.js)' : 'degraded (no Az.js)' };
    }
}

export default RussianMorphology;
