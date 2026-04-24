export class NLPWrapper {
    constructor() {
        this.ready = false;
    }

    async init() {
        return new Promise((resolve) => {
            // Предполагается, что Az.js подключен в HTML
            Az.Morph.init('lib/dicts', () => {
                this.ready = true;
                resolve();
            });
        });
    }

    tokenize(text) {
        return Az.Tokens(text).done();
    }

    getNormalForm(word) {
        const parses = Az.Morph(word);
        return parses.length ? parses[0].normalize().toLowerCase() : word.toLowerCase();
    }

    // Умная замена с сохранением граммем исходного слова
    inflectToMatch(targetWord, originalWord) {
        const origParses = Az.Morph(originalWord);
        if (!origParses.length) return targetWord;

        const origTag = origParses[0].tag;
        const targetParses = Az.Morph(targetWord);
        
        if (!targetParses.length) return targetWord;

        // Извлекаем нужные граммемы (падеж, число, род)
        let requiredGrammemes =[];
        if (origTag.CAse) requiredGrammemes.push(origTag.CAse);
        if (origTag.NMbr) requiredGrammemes.push(origTag.NMbr);
        if (origTag.GNdr) requiredGrammemes.push(origTag.GNdr);
        if (origTag.TEns) requiredGrammemes.push(origTag.TEns); // Для глаголов

        try {
            // Пытаемся просклонять целевое слово
            let inflected = targetParses[0].inflect(requiredGrammemes);
            if (inflected) {
                // Сохраняем оригинальный регистр
                let result = inflected.word;
                if (originalWord[0] === originalWord[0].toUpperCase()) {
                    result = result.charAt(0).toUpperCase() + result.slice(1);
                }
                return result;
            }
        } catch(e) {}
        
        return targetWord;
    }
}