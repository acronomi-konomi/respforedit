/**
 * Канал кодирования через замену Ё/Е
 *
 * В русском языке буква Ё часто заменяется на Е в неформальных текстах
 * (ёлка → елка, всё → все и т.д.). Это нормально воспринимается читателем.
 *
 * Важно: кодируем ТОЛЬКО слова где ё/е реально взаимозаменяемы (не все подряд).
 * Слова с обязательным Ё (ёж, ёлка) или обязательным Е (где замена меняет смысл)
 * — пропускаем. Используем белый список слов, где замена допустима.
 *
 * Белый список построен из слов, где:
 * - Ё → Е не меняет смысл (все/всё — разные слова! → исключаем)
 * - Контекст однозначно восстанавливает смысл
 */

// Слова где е/ё взаимозаменяемы безопасно для стеганографии
// Ключ: нижний регистр, значение: [вариант_0 (е), вариант_1 (ё)]
const SAFE_YO_WORDS = {
    // Глаголы
    'идет': ['идет', 'идёт'],
    'идет': ['идет', 'идёт'],
    'несет': ['несет', 'несёт'],
    'везет': ['везет', 'везёт'],
    'берет': ['берет', 'берёт'],
    'дает': ['дает', 'даёт'],
    'зовет': ['зовет', 'зовёт'],
    'живет': ['живет', 'живёт'],
    'создает': ['создает', 'создаёт'],
    'создается': ['создается', 'создаётся'],
    'признает': ['признает', 'признаёт'],
    'умет': ['умет', 'умёт'],
    'пьет': ['пьет', 'пьёт'],
    'поет': ['поет', 'поёт'],
    'льет': ['льет', 'льёт'],
    'жует': ['жует', 'жуёт'],
    'ждет': ['ждет', 'ждёт'],
    'найдет': ['найдет', 'найдёт'],
    'придет': ['придет', 'придёт'],
    'войдет': ['войдет', 'войдёт'],
    'пойдет': ['пойдет', 'пойдёт'],
    'растет': ['растет', 'растёт'],
    'цветет': ['цветет', 'цветёт'],
    'течет': ['течет', 'течёт'],
    'блестит': ['блестит', 'блестит'],
    // Причастия / прилагательные (краткие формы)
    'вооруженный': ['вооруженный', 'вооружённый'],
    'вооруженная': ['вооруженная', 'вооружённая'],
    'вооруженные': ['вооруженные', 'вооружённые'],
    'осужденный': ['осужденный', 'осуждённый'],
    'осужденная': ['осужденная', 'осуждённая'],
    'решенный': ['решенный', 'решённый'],
    'завершенный': ['завершенный', 'завершённый'],
    'завершена': ['завершена', 'завершена'],
    'утвержденный': ['утвержденный', 'утверждённый'],
    'определенный': ['определенный', 'определённый'],
    'определена': ['определена', 'определена'],
    'уточненный': ['уточненный', 'уточнённый'],
    'подтвержденный': ['подтвержденный', 'подтверждённый'],
    'приведенный': ['приведенный', 'приведённый'],
    'установленный': ['установленный', 'установлённый'],
    // Существительные
    'прием': ['прием', 'приём'],
    'раздел': ['раздел', 'раздел'],
    'затем': ['затем', 'затем'],
    'поэтому': ['поэтому', 'поэтому'],
};

export class YoReplacementChannel {
    constructor() {
        this.name = 'yo';
        // Обратный индекс для быстрого поиска
        this._index = new Map(); // вариант_lower → { key, variantIdx }
        for (const [key, variants] of Object.entries(SAFE_YO_WORDS)) {
            for (let i = 0; i < variants.length; i++) {
                if (variants[i]) this._index.set(variants[i].toLowerCase(), { key, variantIdx: i });
            }
        }
    }

    _findMatches(text) {
        const matches = [];
        const lowerText = text.toLowerCase();

        for (const [variant, info] of this._index) {
            if (!variant) continue;
            const re = new RegExp(`(?<![а-яёА-ЯЁ])${this._escapeRegex(variant)}(?![а-яёА-ЯЁ])`, 'gi');
            let m;
            while ((m = re.exec(text)) !== null) {
                matches.push({
                    index: m.index,
                    length: m[0].length,
                    key: info.key,
                    currentVariant: info.variantIdx,
                    found: m[0]
                });
            }
        }

        // Убираем перекрытия
        matches.sort((a, b) => a.index - b.index);
        const filtered = []; let lastEnd = -1;
        for (const match of matches) {
            if (match.index >= lastEnd) { filtered.push(match); lastEnd = match.index + match.length; }
        }
        return filtered;
    }

    analyzeCapacity(text) {
        const matches = this._findMatches(text);
        const positions = matches.map(m => ({ index: m.index, key: m.key, variants: 2 }));
        return {
            totalBits: positions.length, // 1 бит на позицию
            positions,
            bases: positions.map(() => 2)
        };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const matches = this._findMatches(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(matches.length, indices.length); i++) {
            const m = matches[i];
            const variants = SAFE_YO_WORDS[m.key];
            if (!variants) continue;
            const vi = indices[i] % 2;
            let replacement = variants[vi];
            // Сохраняем регистр
            if (m.found[0] !== m.found[0].toLowerCase())
                replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            if (m.found === m.found.toUpperCase())
                replacement = replacement.toUpperCase();
            toReplace.push({ index: m.index, length: m.length, replacement });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /**
     * Декодирование только по стего-тексту.
     * Находим все позиции е/ё из белого списка и читаем какой вариант стоит.
     */
    decode(stegoText) {
        return this._findMatches(stegoText).map(m => m.currentVariant);
    }

    _escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    getStats() { return { name: this.name, loaded: true, pairs: Object.keys(SAFE_YO_WORDS).length }; }
}

export default YoReplacementChannel;
