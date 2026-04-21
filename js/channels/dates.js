/**
 * Канал кодирования через формат дат
 * 3 формата: DD.MM.YYYY ↔ D месяца YYYY ↔ YYYY-MM-DD
 */

export class DatesChannel {
    constructor() {
        this.name = 'dates';
        this.months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        this.FORMATS = ['numeric', 'text', 'iso']; // 3 варианта → log2(3)≈1.58 бит на дату
    }

    _findDates(text) {
        const matches = [];
        let m;

        // DD.MM.YYYY
        const numRe = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
        while ((m = numRe.exec(text)) !== null) {
            const [day, month, year] = [+m[1], +m[2], +m[3]];
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
                matches.push({ index: m.index, length: m[0].length, day, month, year, format: 'numeric' });
        }

        // YYYY-MM-DD
        const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
        while ((m = isoRe.exec(text)) !== null) {
            const [year, month, day] = [+m[1], +m[2], +m[3]];
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
                matches.push({ index: m.index, length: m[0].length, day, month, year, format: 'iso' });
        }

        // D месяца YYYY
        const monthPat = this.months.join('|');
        const txtRe = new RegExp(`\\b(\\d{1,2})\\s+(${monthPat})\\s+(\\d{4})\\b`, 'gi');
        while ((m = txtRe.exec(text)) !== null) {
            const day = +m[1], month = this.months.indexOf(m[2].toLowerCase()) + 1, year = +m[3];
            if (month >= 1 && day >= 1 && day <= 31)
                matches.push({ index: m.index, length: m[0].length, day, month, year, format: 'text' });
        }

        // Убираем перекрытия
        matches.sort((a, b) => a.index - b.index);
        const out = []; let lastEnd = -1;
        for (const x of matches) {
            if (x.index >= lastEnd) { out.push(x); lastEnd = x.index + x.length; }
        }
        return out;
    }

    _fmt(day, month, year, format) {
        const d2 = n => String(n).padStart(2, '0');
        switch (format) {
            case 'numeric': return `${d2(day)}.${d2(month)}.${year}`;
            case 'iso':     return `${year}-${d2(month)}-${d2(day)}`;
            case 'text':    return `${day} ${this.months[month - 1]} ${year}`;
            default:        return `${d2(day)}.${d2(month)}.${year}`;
        }
    }

    analyzeCapacity(text) {
        const dates = this._findDates(text);
        const variants = this.FORMATS.length;
        const positions = dates.map(d => ({ index: d.index, variants }));
        return { totalBits: positions.length * Math.log2(variants), positions, bases: positions.map(() => variants) };
    }

    encode(text, indices) {
        if (indices.length === 0) return text;
        const dates = this._findDates(text);
        const toReplace = [];
        for (let i = 0; i < Math.min(dates.length, indices.length); i++) {
            const d = dates[i];
            toReplace.push({ index: d.index, length: d.length, replacement: this._fmt(d.day, d.month, d.year, this.FORMATS[indices[i] % this.FORMATS.length]) });
        }
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace)
            result = result.slice(0, r.index) + r.replacement + result.slice(r.index + r.length);
        return result;
    }

    /** Декодирование только по стего-тексту: какой формат даты стоит → его индекс */
    decode(stegoText) {
        return this._findDates(stegoText).map(d => {
            const idx = this.FORMATS.indexOf(d.format);
            return idx >= 0 ? idx : 0;
        });
    }

    getStats() { return { name: this.name, loaded: true, formats: this.FORMATS.length }; }
}

export default DatesChannel;
