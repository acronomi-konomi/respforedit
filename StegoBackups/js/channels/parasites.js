/**
 * Канал кодирования через слова-паразиты
 * Вставляет/убирает необязательные вводные слова и частицы
 */

export class ParasitesChannel {
    constructor() {
        this.name = 'parasites';
        this.parasites = [];
        this.loaded = false;
    }

    async loadDictionary(path = './data/parasites.json') {
        try {
            const response = await fetch(path);
            const data = await response.json();
            this.parasites = Array.isArray(data)
                ? data.map(p => (typeof p === 'string' ? p : p.word)).filter(Boolean)
                : [];
            if (this.parasites.length > 0) {
                this.loaded = true;
                console.log(`Loaded ${this.parasites.length} parasite words`);
                return;
            }
        } catch (e) { /* fall through to defaults */ }

        // Встроенный набор по умолчанию
        this.parasites = [
            'вообще', 'в общем', 'по сути', 'как бы', 'значит',
            'собственно', 'буквально', 'фактически', 'реально',
            'в принципе', 'по факту', 'так сказать', 'знаете ли',
            'надо сказать', 'можно сказать', 'честно говоря',
            'откровенно говоря', 'прямо говоря', 'между прочим',
            'кстати', 'к слову', 'впрочем', 'однако же', 'тем не менее'
        ];
        this.loaded = true;
    }

    /**
     * Разбить текст на предложения
     */
    _splitSentences(text) {
        return text.split(/(?<=[.!?…])\s+/).filter(s => s.trim().length > 10);
    }

    analyzeCapacity(text) {
        if (!this.loaded || this.parasites.length === 0) {
            return { totalBits: 0, positions: [], bases: [] };
        }
        const sentences = this._splitSentences(text);
        const N = this.parasites.length;
        const variants = N + 1; // 0 = нет паразита, 1..N = конкретный паразит
        const bits = Math.log2(variants);
        const positions = sentences.map((s, i) => ({ index: i, sentence: s, variants }));

        return {
            totalBits: positions.length * bits,
            positions,
            bases: positions.map(() => variants)
        };
    }

    encode(text, indices) {
        if (!this.loaded || this.parasites.length === 0 || indices.length === 0) return text;

        const N = this.parasites.length;
        const sentences = this._splitSentences(text);
        if (sentences.length === 0) return text;

        // Найдём разделители между предложениями
        const sepRe = /[.!?…]\s+/g;
        const separators = [];
        let m;
        while ((m = sepRe.exec(text)) !== null) separators.push(m[0]);

        const encoded = sentences.map((sentence, i) => {
            const indexVal = i < indices.length ? indices[i] : 0;
            // Сначала убираем любого паразита, если он уже там есть
            let clean = sentence;
            for (const p of this.parasites) {
                const re = new RegExp(`^(${this._escapeRegex(p)}),\\s*`, 'i');
                if (re.test(clean)) {
                    clean = clean.replace(re, '');
                    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
                    break;
                }
            }
            if (indexVal > 0 && indexVal <= N) {
                const parasite = this.parasites[indexVal - 1];
                // Делаем первую букву строчной у оригинала, паразит — с заглавной
                const p = parasite.charAt(0).toUpperCase() + parasite.slice(1);
                clean = p + ', ' + clean.charAt(0).toLowerCase() + clean.slice(1);
            }
            return clean;
        });

        // Собираем обратно
        let result = '';
        for (let i = 0; i < encoded.length; i++) {
            result += encoded[i];
            if (i < separators.length) result += separators[i];
            else if (i < encoded.length - 1) result += ' ';
        }
        return result;
    }

    /** Декодирование только по стего-тексту: есть паразит → какой → индекс+1, нет → 0 */
    decode(stegoText) {
        if (!this.loaded || this.parasites.length === 0) return [];
        const N = this.parasites.length;
        return this._splitSentences(stegoText).map(sentence => {
            for (let j = 0; j < N; j++) {
                const re = new RegExp(`^${this._escapeRegex(this.parasites[j])},\\s*`, 'i');
                if (re.test(sentence)) return j + 1;
            }
            return 0;
        });
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getStats() {
        return { name: this.name, loaded: this.loaded, count: this.parasites.length };
    }
}

export default ParasitesChannel;
