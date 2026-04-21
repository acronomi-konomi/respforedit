/**
 * Канал кодирования через синонимы — детерминированная версия
 *
 * ## Режимы работы
 *
 * 1. СТАТИЧЕСКИЙ (по умолчанию): синсеты из data/synonyms.json
 *    - Работает без интернета/сервера
 *    - Синсеты фиксированы (собраны при сборке через build_synonyms.py)
 *
 * 2. ДИНАМИЧЕСКИЙ (через Python-бэкенд):
 *    - Синсеты запрашиваются у synonyms_server.py (navec + pymorphy3)
 *    - Настраиваемый порог косинусной близости (threshold)
 *    - Больший порог → меньше синонимов, лучше качество текста
 *    - Меньший порог → больше синонимов, больше ёмкость
 *
 * ## Гарантия детерминизма
 *
 * В обоих режимах синсеты ВСЕГДА отсортированы алфавитно и нормализованы (ё→е).
 * При одинаковом threshold → одинаковые синсеты → корректное декодирование.
 *
 * encode: слово W → синсет → взять synset[index] → вставить
 * decode: слово W → синсет → найти позицию W → это и есть index
 */

export class SynonymChannel {
    constructor(morphology) {
        this.name       = 'synonyms';
        this.synonyms   = {};   // lemma_без_ё → sorted_synset_без_ё (статический режим)
        this.morphology = morphology;
        this.loaded     = false;

        // Настройки режима
        this.mode      = 'static';   // 'static' | 'backend'
        this.backendUrl = 'http://127.0.0.1:5000';
        this.threshold = 0.50;       // косинусная близость (только для backend)
        this.topn      = 20;         // максимум кандидатов

        // Кэш динамических синсетов (для детерминизма в рамках сессии)
        this._dynamicCache = {};  // нормализованное_слово → synset
        this._backendOk    = null; // null=не проверяли, true/false
    }

    // ─── Конфигурация ─────────────────────────────────────────────────────────

    setMode(mode) {
        if (mode !== 'static' && mode !== 'backend') {
            throw new Error('mode должен быть "static" или "backend"');
        }
        this.mode = mode;
        // При смене режима сбрасываем кэш (синсеты могут отличаться)
        this._dynamicCache = {};
        console.log(`SynonymChannel: режим = ${mode}`);
    }

    setThreshold(threshold) {
        const t = Math.max(0.0, Math.min(1.0, parseFloat(threshold)));
        if (t !== this.threshold) {
            this.threshold = t;
            this._dynamicCache = {}; // сбрасываем кэш — порог изменился
            console.log(`SynonymChannel: порог = ${t}`);
        }
    }

    setBackendUrl(url) {
        this.backendUrl = url.replace(/\/$/, '');
        this._dynamicCache = {};
        this._backendOk = null;
    }

    // ─── Загрузка статического словаря ────────────────────────────────────────

    async loadDictionary(path = './data/synonyms.json') {
        try {
            const response = await fetch(path);
            const raw      = await response.json();
            const n = s => s.replace(/ё/g, 'е');

            // Шаг 1: нормализуем все синсеты
            const normalized = {};
            for (const [key, synset] of Object.entries(raw)) {
                const normSynset = [...new Set(synset.map(n))].sort();
                if (normSynset.length < 2) continue;
                normalized[n(key)] = normSynset;
            }

            // Шаг 2: проверяем консистентность — каждое слово должно быть в одном синсете
            // Если слово W в синсете S1, но само имеет синсет S2 ≠ S1 → конфликт → исключаем
            const conflicts = new Set();
            for (const [key, synset] of Object.entries(normalized)) {
                for (const member of synset) {
                    if (member in normalized && normalized[member].join(',') !== synset.join(',')) {
                        conflicts.add(key);
                        conflicts.add(member);
                    }
                }
            }

            this.synonyms = {};
            let conflictCount = 0;
            for (const [key, synset] of Object.entries(normalized)) {
                if (conflicts.has(key)) { conflictCount++; continue; }
                this.synonyms[key] = synset;
            }

            this.loaded = true;
            if (conflictCount > 0) {
                console.warn(`Synonyms: исключено ${conflictCount} конфликтных слов (в нескольких синсетах)`);
            }
            console.log(`Synonyms static: ${Object.keys(raw).length} raw → ${Object.keys(this.synonyms).length} clean`);
        } catch (e) {
            console.error('Failed to load synonyms:', e);
        }
    }

    // ─── Проверка бэкенда ─────────────────────────────────────────────────────

    async checkBackend() {
        try {
            const resp = await fetch(`${this.backendUrl}/status`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            const data = await resp.json();
            this._backendOk = data.ok === true;
            return this._backendOk;
        } catch (e) {
            this._backendOk = false;
            return false;
        }
    }

    // ─── Нормализация ─────────────────────────────────────────────────────────

    _n(s) { return s ? s.replace(/ё/g, 'е') : s; }

    // ─── Получение синсета (основной метод) ───────────────────────────────────

    /**
     * Получить синсет для слова.
     * В статическом режиме — синхронно из this.synonyms.
     * В динамическом — из кэша (если есть) или планирует запрос к бэкенду.
     *
     * ВАЖНО: getSynset синхронный — для детерминизма analyzeCapacity не может
     * быть async. Динамические синсеты получаются через prefetchSynsets().
     */
    getSynset(word) {
        if (!word) return null;
        const lo = this._n(word.toLowerCase());

        if (this.mode === 'backend') {
            // Пробуем нормализованное слово
            if (this._dynamicCache[lo]) return this._dynamicCache[lo];
            // Пробуем Az.js лемму
            if (this.morphology && this.morphology.isAvailable()) {
                try {
                    const lemma = this._n(this.morphology.normalize(word));
                    if (lemma && this._dynamicCache[lemma]) return this._dynamicCache[lemma];
                } catch(e) {}
            }
            // Фоллбэк: статический словарь
            return this.synonyms[lo] || null;
        }

        // Статический режим: прямой поиск
        if (this.synonyms[lo])              return this.synonyms[lo];
        if (this.synonyms[word.toLowerCase()]) return this.synonyms[word.toLowerCase()];

        // Az.js: нормализуем к лемме
        if (this.morphology && this.morphology.isAvailable()) {
            try {
                const lemma = this._n(this.morphology.normalize(word));
                if (lemma && this.synonyms[lemma]) return this.synonyms[lemma];
            } catch(e) {}
        }

        // Стеммер как последний вариант
        const st = this._n(this._stem(lo));
        if (st !== lo && this.synonyms[st]) return this.synonyms[st];

        return null;
    }

    /**
     * Предварительная загрузка синсетов для всех слов текста (только backend режим).
     * Вызывать ПЕРЕД analyzeCapacity/encode/decode в динамическом режиме.
     */
    async prefetchSynsets(text) {
        if (this.mode !== 'backend') return;

        const tokens = this._getTokens(text);

        // Собираем и словоформы, и их Az.js леммы (если доступны)
        const wordSet = new Set();
        for (const t of tokens) {
            const lo = this._n(t.word.toLowerCase());
            wordSet.add(lo);
            if (this.morphology && this.morphology.isAvailable()) {
                try {
                    const lemma = this._n(this.morphology.normalize(t.word));
                    if (lemma) wordSet.add(lemma);
                } catch(e) {}
            }
        }

        const words  = [...wordSet];
        const needed = words.filter(w => !this._dynamicCache[w]);
        if (needed.length === 0) return;

        try {
            const resp = await fetch(`${this.backendUrl}/synset_batch`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    words:     needed,
                    threshold: this.threshold,
                    topn:      this.topn
                }),
                signal: AbortSignal.timeout(10000)
            });
            const data = await resp.json();
            for (const [word, info] of Object.entries(data.synsets || {})) {
                if (info && info.synset && info.synset.length >= 2) {
                    const norm = [...new Set(info.synset.map(w => this._n(w)))].sort();
                    // Кэшируем синсет для самого слова И для всех его членов
                    this._dynamicCache[this._n(word)] = norm;
                    for (const member of norm) {
                        this._dynamicCache[member] = norm;
                    }
                }
            }
            console.log(`prefetchSynsets: загружено ${Object.keys(data.synsets || {}).length} синсетов`);
        } catch (e) {
            console.warn('prefetchSynsets error:', e.message);
            // Фоллбэк на статический словарь
        }
    }

    // ─── getLemma ─────────────────────────────────────────────────────────────

    getLemma(word) {
        if (!word) return null;
        const lo = word.toLowerCase();
        const ne = this._n(lo);

        // Az.js лемма (вычисляем один раз для переиспользования)
        let azLemma = null;
        if (this.morphology && this.morphology.isAvailable()) {
            try {
                const az = this.morphology.normalize(word);
                if (az) azLemma = this._n(az);
            } catch(e) {}
        }

        if (this.mode === 'backend') {
            if (this._dynamicCache[ne]) return ne;
            if (this._dynamicCache[lo]) return lo;
            if (azLemma && this._dynamicCache[azLemma]) return azLemma;
            // Фоллбэк: статический словарь
            if (this.synonyms[ne]) return ne;
            if (azLemma && this.synonyms[azLemma]) return azLemma;
            return null;
        }

        // Статический режим
        if (this.synonyms[lo])              return lo;
        if (ne !== lo && this.synonyms[ne]) return ne;
        if (azLemma && this.synonyms[azLemma]) return azLemma;
        const st = this._stem(lo);
        const stn = this._n(st);
        if (st !== lo && this.synonyms[st])   return st;
        if (stn !== st && this.synonyms[stn]) return stn;
        return null;
    }

    // ─── Токенизация ──────────────────────────────────────────────────────────

    _getTokens(text) {
        const tokens = [];
        let wordIdx = 0, charPos = 0;
        for (const part of text.split(/([^а-яёА-ЯЁ]+)/)) {
            if (/^[а-яёА-ЯЁ]{3,}$/.test(part)) {
                tokens.push({ word: part, wordIndex: wordIdx++, charIndex: charPos, length: part.length });
            } else if (/[а-яёА-ЯЁ]/.test(part)) {
                wordIdx++;
            }
            charPos += part.length;
        }
        return tokens;
    }

    // ─── Симуляция ────────────────────────────────────────────────────────────

    _simulatePosition(token) {
        const synset = this.getSynset(token.word);
        if (!synset || synset.length < 2) return null;

        const result = new Map();

        for (let idx = 0; idx < synset.length; idx++) {
            const targetLemma = synset[idx];

            if (targetLemma.includes('-') || targetLemma.includes(' ') || /\d/.test(targetLemma)) {
                result.set(idx, null);
                continue;
            }

            if (this.morphology && this.morphology.isAvailable()) {
                // matchForm возвращает null если POS несовместимы
                const form = this.morphology.matchForm(token.word, targetLemma);
                if (!form || form.includes('-')) {
                    result.set(idx, null);
                    continue;
                }
                // Проверяем детерминизм декодирования:
                // форма должна иметь лемму которая находится в том же синсете на той же позиции
                const candLemma = this.getLemma(form);
                if (!candLemma) { result.set(idx, null); continue; }
                const candSynset = this.getSynset(form);
                if (!candSynset) { result.set(idx, null); continue; }
                const n = s => s.replace(/ё/g, 'е');
                const candIdx = candSynset.indexOf(n(candLemma));
                if (candIdx === idx) {
                    result.set(idx, form);
                } else {
                    result.set(idx, null);
                }
            } else {
                // Без морфологии — используем лемму как есть и проверяем индекс
                const candLemma = this.getLemma(targetLemma);
                if (!candLemma) { result.set(idx, null); continue; }
                const candSynset = this.getSynset(targetLemma);
                if (!candSynset) { result.set(idx, null); continue; }
                const n = s => s.replace(/ё/g, 'е');
                const candIdx = candSynset.indexOf(n(candLemma));
                result.set(idx, candIdx === idx ? targetLemma : null);
            }
        }

        return result;
    }

    // ─── Анализ ёмкости ───────────────────────────────────────────────────────

    analyzeCapacity(text) {
        const tokens    = this._getTokens(text);
        const positions = [];
        let totalBits   = 0;
        const n         = s => s.replace(/ё/g, 'е');

        for (const token of tokens) {
            const synset = this.getSynset(token.word);
            if (!synset || synset.length < 2) continue;

            const origLemma = this.getLemma(token.word);
            const origIdx   = origLemma !== null ? synset.indexOf(n(origLemma)) : -1;

            // Морфологическая симуляция — строгая проверка детерминизма
            // Позиция включается только если ВСЕ варианты (кроме origIdx) доступны через matchForm
            let sim = null;
            if (this.morphology && this.morphology.isAvailable()) {
                sim = this._simulatePosition(token);
                // Проверяем: все варианты кроме origIdx должны иметь валидную форму
                let hasInvalidNonOrig = false;
                for (const [k, v] of sim) {
                    if (v === null && k !== origIdx) {
                        hasInvalidNonOrig = true;
                        break;
                    }
                }
                if (hasInvalidNonOrig) continue;
                // Также нужно чтобы сам origIdx был в sim (текущее слово декодируется)
                if (origIdx >= 0 && sim.get(origIdx) === null) continue;
            }

            const variants = synset.length;
            const bits      = Math.log2(variants);
            totalBits      += bits;
            positions.push({
                index:    token.charIndex,
                length:   token.length,
                word:     token.word,
                synset,
                origIdx,
                sim,
                variants,
                bits
            });
        }

        return { totalBits, positions, bases: positions.map(p => p.variants) };
    }

    // ─── Кодирование (sync) ───────────────────────────────────────────────────

    encode(text, indices) {
        if (!indices || indices.length === 0) return text;

        const positions = this.analyzeCapacity(text).positions;
        const toReplace = [];

        for (let i = 0; i < Math.min(positions.length, indices.length); i++) {
            const pos = positions[i];
            const idx = indices[i] % pos.variants;

            if (idx === pos.origIdx) continue;

            const targetLemma = pos.synset[idx];
            if (!targetLemma || targetLemma.includes('-') || targetLemma.includes(' ') || /\d/.test(targetLemma)) continue;

            let replacement = null;

            // 1. Пробуем через sim (предрассчитанная морфологическая форма)
            if (pos.sim && pos.sim.has(idx)) {
                replacement = pos.sim.get(idx) || null;
            }

            // 2. Если sim не дал результат — пробуем matchForm напрямую
            if (!replacement && this.morphology && this.morphology.isAvailable()) {
                const form = this.morphology.matchForm(pos.word, targetLemma);
                if (form && !form.includes('-')) replacement = form;
            }

            // 3. Если морфология недоступна — используем лемму как есть
            // Если морфология доступна но matchForm=null — пропускаем (несовместимые POS)
            if (!replacement && !(this.morphology && this.morphology.isAvailable())) {
                replacement = targetLemma;
            }

            // Пропускаем замену если не нашли корректную форму
            if (!replacement) continue;

            // Сохраняем регистр первой буквы оригинала
            if (pos.word[0] && pos.word[0] !== pos.word[0].toLowerCase()) {
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }

            toReplace.push({ index: pos.index, length: pos.length, replacement });
        }

        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace) {
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        }
        return result;
    }

    // ─── Декодирование ───────────────────────────────────────────────────────

    decode(stegoText) {
        const positions = this.analyzeCapacity(stegoText).positions;
        const n         = s => s.replace(/ё/g, 'е');
        return positions.map(pos => {
            const lemma = this.getLemma(pos.word);
            if (lemma === null) return pos.origIdx >= 0 ? pos.origIdx : 0;
            const idx = pos.synset.indexOf(n(lemma));
            return idx >= 0 ? idx : (pos.origIdx >= 0 ? pos.origIdx : 0);
        });
    }

    // ─── Стеммер (без Az.js) ─────────────────────────────────────────────────

    _stem(word) {
        if (word.length < 4) return word;
        const sfx = [
            'ующего','ующему','ующими','ующих','ующим','ующей','ующее','ующие','ующий','ующая',
            'ованного','ованному','ованных','ованным','ованной','ованное','ованные','ованный','ованная',
            'ывается','ивается','овается','евается','ываться','иваться','оваться','еваться',
            'ывают','ивают','овают','евают',
            'ывал','ивал','овал','евал','ывали','ивали','овали','евали',
            'ться','ется','ится','ются','ятся','утся',
            'ался','ился','елся','ались','ились','елись',
            'ывать','ивать','овать','евать',
            'ать','ять','ить','еть','уть',
            'ает','яет','ует','ает','яет',
            'али','яли','или','ели','ули',
            'ала','яла','ила','ела',
            'ал','ял','ил','ел','ул',
            'ет','ит','ют',
            'ого','его','ому','ему',
            'ами','ями','ах','ях',
            'ам','ям','ов','ев',
            'ый','ий','ой','ей',
            'ая','яя','ую','юю',
            'ые','ие','ых','их','ым','им',
            'ен','ён','ью',
            'е','и','а','у','я','о','ь',
        ];
        for (const s of sfx) {
            if (word.endsWith(s) && word.length - s.length >= 3) return word.slice(0, word.length - s.length);
        }
        return word;
    }

    getStats() {
        const staticCount  = Object.keys(this.synonyms).length;
        const dynamicCount = Object.keys(this._dynamicCache).length;
        return {
            name:    this.name,
            loaded:  this.loaded,
            mode:    this.mode,
            threshold: this.threshold,
            entries: this.mode === 'backend' ? dynamicCount : staticCount,
            staticEntries:  staticCount,
            dynamicEntries: dynamicCount,
        };
    }
}

export default SynonymChannel;
