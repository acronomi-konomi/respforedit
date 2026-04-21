/**
 * Stego-T9: умные подсказки при наборе текста-носителя
 * Предлагает слова с высокой ёмкостью (много синонимов) для увеличения пропускной способности
 */

export class StegoT9 {
    constructor(textarea, engine) {
        this.textarea = textarea;
        this.engine   = engine;
        this.synonyms = {}; // будет заполнен из engine после loadChannels
        this.overlay  = null;
        this._loadSynonyms();
        this._initOverlay();
        this.textarea.addEventListener('input', (e) => this._onInput(e));
        this.textarea.addEventListener('keydown', (e) => this._onKeyDown(e));
        this.textarea.addEventListener('blur', () => this._hide());
    }

    _loadSynonyms() {
        // Берём словарь синонимов из канала движка, если он уже загружен
        try {
            const synChannel = this.engine && this.engine.channels && this.engine.channels['synonyms'];
            if (synChannel && synChannel.synonyms) {
                this.synonyms = synChannel.synonyms;
            }
        } catch (e) { /* ignore */ }
    }

    _initOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 't9-overlay';
        this.overlay.style.cssText = [
            'position:absolute', 'z-index:9999', 'background:#1e1e2e',
            'border:1px solid #6c5dd3', 'border-radius:8px', 'padding:4px 0',
            'box-shadow:0 4px 16px rgba(0,0,0,.5)', 'display:none',
            'max-height:200px', 'overflow-y:auto', 'min-width:160px'
        ].join(';');
        document.body.appendChild(this.overlay);
    }

    _onInput(e) {
        const text   = this.textarea.value;
        const cursor = this.textarea.selectionStart;
        // Берём слово перед курсором
        const before = text.slice(0, cursor);
        const match  = before.match(/[а-яёА-ЯЁa-zA-Z]+$/);
        if (!match || match[0].length < 2) { this._hide(); return; }

        const prefix   = match[0].toLowerCase();
        const suggestions = this._getSuggestions(prefix);
        if (suggestions.length > 0) {
            this._show(suggestions, prefix);
        } else {
            this._hide();
        }
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') this._hide();
    }

    /**
     * Найти слова, начинающиеся с prefix, у которых много синонимов (высокая ёмкость)
     */
    _getSuggestions(prefix) {
        const results = [];
        for (const [word, syns] of Object.entries(this.synonyms)) {
            if (!word.startsWith(prefix)) continue;
            if (word.includes(' ')) continue; // только одиночные слова
            const bits = Math.log2(syns.length);
            if (bits >= 1) { // минимум 2 синонима → 1 бит
                results.push({ word, bits: bits.toFixed(1), count: syns.length });
            }
            if (results.length >= 8) break;
        }
        // Сортируем по убыванию ёмкости
        results.sort((a, b) => b.bits - a.bits);
        return results.slice(0, 6);
    }

    _show(suggestions, prefix) {
        const rect = this.textarea.getBoundingClientRect();
        this.overlay.style.left = (rect.left + window.scrollX) + 'px';
        this.overlay.style.top  = (rect.bottom + window.scrollY + 4) + 'px';

        this.overlay.innerHTML = suggestions.map(s => `
            <div class="t9-item" data-word="${s.word}" style="
                padding:6px 12px; cursor:pointer; display:flex;
                justify-content:space-between; gap:16px; font-size:14px;
                color:#cdd6f4; transition:background .15s">
                <span>${s.word}</span>
                <span style="color:#6c5dd3;font-size:12px">+${s.bits} бит</span>
            </div>
        `).join('');

        this.overlay.querySelectorAll('.t9-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._insert(item.dataset.word, prefix);
            });
            item.addEventListener('mouseenter', () => item.style.background = '#313244');
            item.addEventListener('mouseleave', () => item.style.background = '');
        });

        this.overlay.style.display = 'block';
    }

    _insert(word, prefix) {
        const text   = this.textarea.value;
        const cursor = this.textarea.selectionStart;
        const before = text.slice(0, cursor);
        const after  = text.slice(cursor);
        // Заменяем prefix на выбранное слово
        const newBefore = before.slice(0, before.length - prefix.length) + word;
        this.textarea.value = newBefore + after;
        const newCursor = newBefore.length;
        this.textarea.setSelectionRange(newCursor, newCursor);
        this.textarea.focus();
        this._hide();
    }

    _hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

export default StegoT9;
