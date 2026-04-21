/**
 * Letter-Stego v3: паттерн seed→мутация→seed→мутация
 *
 * ## Ключевые принципы
 *
 * 1. ДЕТЕРМИНИЗМ ЧЕРЕЗ ПАТТЕРН:
 *    Слова в тексте чередуются: seed-слово, мутируемое слово, seed-слово, ...
 *    Seed-слова НИКОГДА не изменяются — они источник энтропии для следующей мутации.
 *
 *    Текст: [S0] [M0] [S1] [M1] [S2] [M2] ...
 *    где S = seed-слово (не трогается), M = мутируемое слово
 *
 * 2. НЕЗАВИСИМОСТЬ ОТ NLP:
 *    Мутация — замена одной буквы. Декодер НЕ использует морфологию для
 *    восстановления оригинала. Вместо этого он знает оригинальное слово из
 *    СЛОВАРЯ (wordMap: мутация → оригинал) + проверяет через seed/CRC.
 *
 * 3. ПОРЯДОК КАНАЛОВ:
 *    Encode: [другие каналы] → [letter-stego последним]
 *    Decode: [letter-stego первым, восстанавливает текст] → [другие каналы]
 *
 *    Это значит letter-stego работает с уже синонимизированным текстом.
 *    Seed-слова берутся из финального стего-текста (после синонимов).
 *
 * 4. АЛГОРИТМ ОТБОРА СЛОВ:
 *    Из всех слов >= MIN_WORD_LEN чётные (0,2,4,...) = seed, нечётные (1,3,5,...) = мутация.
 *    "Чётность" по счётчику подходящих слов, не по позиции в тексте.
 *
 * 5. ВЕРИФИКАЦИЯ ENCODE:
 *    Перед применением мутации encoder проверяет что decode вернёт правильный индекс.
 *    Если нет → encode оставляет слово нетронутым (idx=0), детерминизм не нарушается.
 *
 * ## Формула seed и мутации
 *
 *   seed_value = djb2(seed_word_norm)
 *   target     = seed_value % MOD
 *
 *   validMutations(M, target) = все (pos, letter) такие что:
 *       djb2(apply(M, pos, letter)) % MOD === target
 *
 *   base = validMutations.length + 1  (0 = без мутации)
 *
 * ## Ёмкость
 *
 *   MOD=16: ~1/16 мутаций валидны → для слова 7 букв × 31 буква ≈ 14 валидных
 *   base ≈ 15 → log2(15) ≈ 3.9 бит/слово
 *
 *   При density=0.5 (только мутируемые слова, не все) ёмкость делится на 2.
 */

const ALPHABET  = 'абвгдежзийклмнопрстуфхцчшщъыьэюя'; // 32 буквы (без ё)
const ALPHA_LEN = ALPHABET.length; // 32

// ─── Хэш-функция djb2 ────────────────────────────────────────────────────────

function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++)
        h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h;
}

// ─── Нормализация ─────────────────────────────────────────────────────────────

function n(s) { return s ? s.toLowerCase().replace(/ё/g, 'е') : ''; }

// ─── Мутации ─────────────────────────────────────────────────────────────────

function getValidMutations(wordNorm, seedWord, MOD) {
    const target = djb2(seedWord) % MOD;
    const valid  = [];
    for (let pos = 0; pos < wordNorm.length; pos++) {
        for (let li = 0; li < ALPHA_LEN; li++) {
            const letter = ALPHABET[li];
            if (letter === wordNorm[pos]) continue;
            const mutated = wordNorm.slice(0, pos) + letter + wordNorm.slice(pos + 1);
            if (djb2(mutated) % MOD === target) {
                valid.push({ pos, letter, mutated });
            }
        }
    }
    return valid;
}

// ─── Канал ───────────────────────────────────────────────────────────────────

export class LetterStegoChannel {
    constructor() {
        this.name        = 'letter-stego';
        this.loaded      = false;
        this.wordSet     = new Set();  // нормализованные слова из словаря
        this.mutToOrig   = new Map();  // мутация → оригинальное слово (для decode)

        this.MOD          = 16;    // 1/MOD мутаций валидны
        this.MIN_WORD_LEN = 5;     // минимальная длина слова
        this.MIN_BASE     = 3;     // минимум вариантов (включая idx=0)
        this.density      = 1.0;   // доля мутируемых слов (0.05–1.0)
    }

    setMOD(mod)     { this.MOD = Math.max(2, Math.min(256, parseInt(mod))); }
    setDensity(d)   { this.density = Math.max(0.05, Math.min(1.0, parseFloat(d))); }
    setMinLen(l)    { this.MIN_WORD_LEN = Math.max(4, parseInt(l)); }

    // ─── Загрузка ─────────────────────────────────────────────────────────────

    async loadDictionary(path = './data/synonyms.json') {
        try {
            const resp = await fetch(path);
            const data = await resp.json();
            this.wordSet.clear();
            this.mutToOrig.clear();

            // Шаг 1: собираем слова
            for (const key of Object.keys(data)) {
                const k = n(key);
                if (k.length >= this.MIN_WORD_LEN) this.wordSet.add(k);
            }

            // Шаг 2: строим mutToOrig — все одно-буквенные мутации для каждого слова.
            // Это даёт O(1) lookup при decode: мутированное слово → оригинал.
            // Коллизии (мутация совпадает с другим словом словаря) — пропускаем:
            // decoder увидит такое слово как "оригинальное" (idx=0).
            for (const w of this.wordSet) {
                for (let pos = 0; pos < w.length; pos++) {
                    for (let li = 0; li < ALPHA_LEN; li++) {
                        const letter = ALPHABET[li];
                        if (letter === w[pos]) continue;
                        const mutated = w.slice(0, pos) + letter + w.slice(pos + 1);
                        // Пропускаем если мутация — другое слово из словаря (коллизия)
                        if (this.wordSet.has(mutated)) continue;
                        // Пропускаем если мутация уже зарегистрирована для другого оригинала
                        if (!this.mutToOrig.has(mutated)) {
                            this.mutToOrig.set(mutated, w);
                        }
                    }
                }
            }

            this.loaded = true;
            console.log(`LetterStego v3: ${this.wordSet.size} слов, ${this.mutToOrig.size} мутаций, MOD=${this.MOD}`);
        } catch (e) {
            console.warn('LetterStego: ошибка загрузки:', e.message);
        }
    }

    // ─── Токенизация ──────────────────────────────────────────────────────────

    _getTokens(text) {
        const tokens = [];
        const re = new RegExp(`[а-яёА-ЯЁ]{${this.MIN_WORD_LEN},}`, 'g');
        let m;
        while ((m = re.exec(text)) !== null)
            tokens.push({ word: m[0], norm: n(m[0]), index: m.index, length: m[0].length });
        return tokens;
    }

    // ─── Определение оригинального слова (для токена) ─────────────────────────

    /**
     * Возвращает {origNorm, isMutated} для токена.
     * origNorm — нормализованное оригинальное слово (до мутации).
     * isMutated — true если слово является мутацией.
     */
    _getOriginal(tokenNorm) {
        if (this.wordSet.has(tokenNorm)) {
            return { origNorm: tokenNorm, isMutated: false };
        }
        const orig = this.mutToOrig.get(tokenNorm);
        if (orig) {
            return { origNorm: orig, isMutated: true };
        }
        return null; // слово не в словаре и не мутация
    }

    // ─── Анализ структуры текста ─────────────────────────────────────────────

    /**
     * Разбирает текст на пары (seed, мутируемое).
     * Возвращает массив позиций — только мутируемые слова (нечётные в паре).
     *
     * Паттерн: из подходящих слов чётные (idx=0,2,4) = seed, нечётные (idx=1,3,5) = target.
     * Если количество нечётное — последнее слово становится seed без пары.
     *
     * ДЕТЕРМИНИЗМ: decode использует ту же функцию и видит те же seed-слова
     * (они не мутируются → всегда стабильны).
     */
    _getPairs(text) {
        const tokens  = this._getTokens(text);
        const pairs   = []; // {seedWord, targetToken, valid, base}
        let wordIdx   = 0;  // счётчик подходящих слов
        let seedToken = null;

        for (const token of tokens) {
            const orig = this._getOriginal(token.norm);
            if (!orig) continue; // слово не в словаре и не мутация → пропускаем

            if (wordIdx % 2 === 0) {
                // Чётное → seed (не трогаем)
                seedToken = { token, origNorm: orig.origNorm };
            } else {
                // Нечётное → мутируемое (используем предыдущий seed)
                if (seedToken) {
                    const seedNorm = seedToken.origNorm; // оригинал seed-слова
                    const targetOrigNorm = orig.origNorm; // оригинал мутируемого слова
                    const valid = getValidMutations(targetOrigNorm, seedNorm, this.MOD);
                    const base  = valid.length + 1;

                    if (base >= this.MIN_BASE) {
                        pairs.push({
                            seedToken:       seedToken.token,
                            seedNorm,
                            targetToken:     token,
                            targetOrigNorm,
                            targetNorm:      token.norm, // текущее значение (может быть мутацией)
                            valid,
                            base
                        });
                    }
                }
                seedToken = null; // сбрасываем — следующее слово будет seed
            }
            wordIdx++;
        }

        return pairs;
    }

    // ─── Анализ ёмкости ───────────────────────────────────────────────────────

    analyzeCapacity(text) {
        const pairs     = this._getPairs(text);
        const positions = pairs.map(p => ({
            index:    p.targetToken.index,
            length:   p.targetToken.length,
            word:     p.targetToken.word,
            wordNorm: p.targetToken.norm,
            origNorm: p.targetOrigNorm,
            seedNorm: p.seedNorm,
            valid:    p.valid,
            base:     p.base,
            bits:     Math.log2(p.base)
        }));

        const totalBits = positions.reduce((s, p) => s + p.bits, 0);
        return { totalBits, positions, bases: positions.map(p => p.base) };
    }

    // ─── Кодирование ─────────────────────────────────────────────────────────

    encode(text, indices) {
        if (!indices || indices.length === 0) return text;

        const { positions } = this.analyzeCapacity(text);
        const toReplace = [];

        // Density: выбираем позиции с наибольшей ёмкостью
        let activeSet = null;
        if (this.density < 1.0) {
            const count  = Math.max(1, Math.round(positions.length * this.density));
            const byBits = positions
                .map((p, i) => ({ i, bits: p.bits }))
                .sort((a, b) => b.bits - a.bits)
                .slice(0, count)
                .map(x => x.i);
            activeSet = new Set(byBits);
        }

        for (let i = 0; i < Math.min(positions.length, indices.length); i++) {
            if (activeSet && !activeSet.has(i)) continue;

            const pos = positions[i];
            const idx = indices[i] % pos.base;
            if (idx === 0) continue;

            const mutation = pos.valid[idx - 1];
            if (!mutation) continue;

            // Верификация: мутированное слово должно быть в mutToOrig с тем же оригиналом
            // (иначе decode не восстановит правильно)
            const mutOrig = this.mutToOrig.get(mutation.mutated);
            if (mutOrig !== pos.origNorm) continue; // коллизия или не зарегистрировано

            let replacement = mutation.mutated;
            if (pos.word[0] !== pos.word[0].toLowerCase()) {
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            toReplace.push({ index: pos.index, length: pos.length, replacement });
        }

        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    // ─── Декодирование ────────────────────────────────────────────────────────

    /**
     * Декодирует letter-stego из стего-текста.
     * Seed-слова не изменены → _getPairs даёт те же пары.
     * Для каждой пары: ищем targetNorm в valid → индекс.
     */
    decode(stegoText) {
        const { positions } = this.analyzeCapacity(stegoText);
        return positions.map(pos => {
            // Слово не изменено
            if (pos.wordNorm === pos.origNorm) return 0;
            // Ищем мутацию в valid
            for (let vi = 0; vi < pos.valid.length; vi++) {
                if (pos.valid[vi].mutated === pos.wordNorm) return vi + 1;
            }
            return 0; // не найдено → считаем idx=0
        });
    }

    /**
     * Восстанавливает текст: заменяет мутированные слова обратно на оригиналы.
     * Используется при decode в engine: сначала снимаем опечатки, затем
     * декодируем остальные каналы (синонимы и др.).
     */
    restore(stegoText) {
        const tokens    = this._getTokens(stegoText);
        const toReplace = [];

        for (const token of tokens) {
            if (this.wordSet.has(token.norm)) continue; // не мутировано
            const orig = this.mutToOrig.get(token.norm);
            if (!orig) continue; // не в словаре мутаций
            let replacement = orig;
            if (token.word[0] !== token.word[0].toLowerCase()) {
                replacement = orig.charAt(0).toUpperCase() + orig.slice(1);
            }
            toReplace.push({ index: token.index, length: token.length, replacement });
        }

        toReplace.sort((a, b) => b.index - a.index);
        let result = stegoText;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    getStats() {
        return {
            name:     this.name,
            loaded:   this.loaded,
            words:    this.wordSet.size,
            mutations: this.mutToOrig.size,
            MOD:      this.MOD,
            density:  this.density
        };
    }
}

export default LetterStegoChannel;
