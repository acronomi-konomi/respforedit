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
        this._composing = false; // IME composition state (mobile keyboards)
        this._loadSynonyms();
        this._initOverlay();
        this.textarea.addEventListener('input', (e) => this._onInput(e));
        this.textarea.addEventListener('keydown', (e) => this._onKeyDown(e));
        this.textarea.addEventListener('blur', () => this._hide());
        // Track IME composition on mobile — suppress T9 during composition
        this.textarea.addEventListener('compositionstart', () => { this._composing = true; });
        this.textarea.addEventListener('compositionend',   () => { this._composing = false; });
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
        // Skip during IME composition (mobile keyboards)
        if (e.isComposing || this._composing) return;

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
                e.preventDefault(); // prevent blur on textarea
                this._insert(item.dataset.word, prefix);
            });
            item.addEventListener('mouseenter', () => item.style.background = '#313244');
            item.addEventListener('mouseleave', () => item.style.background = '');
        });

        this.overlay.style.display = 'block';
    }

    /**
     * Insert a T9 suggestion word, replacing the typed prefix.
     * Uses execCommand('insertText') for reliable mobile cursor handling.
     * Falls back to direct .value assignment if execCommand fails.
     */
    _insert(word, prefix) {
        this.textarea.focus();

        const cursor = this.textarea.selectionStart;
        // Select the prefix text so execCommand replaces it
        const selStart = cursor - prefix.length;
        if (selStart < 0) {
            this._hide();
            return;
        }

        // Try execCommand first — preserves native cursor & undo on mobile
        try {
            this.textarea.setSelectionRange(selStart, cursor);
            // execCommand returns false if command is not supported/enabled
            if (document.execCommand('insertText', false, word)) {
                this._hide();
                return;
            }
        } catch (e) {
            // execCommand not available — fall through to manual approach
        }

        // Fallback: direct .value assignment with cursor restoration
        const text   = this.textarea.value;
        const before = text.slice(0, selStart);
        const after  = text.slice(cursor);
        this.textarea.value = before + word + after;
        const newCursor = before.length + word.length;
        this.textarea.setSelectionRange(newCursor, newCursor);

        // Dispatch input event so other listeners (analysis, stats) update
        try {
            this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) { /* ignore */ }

        this._hide();
    }

    _hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

export default StegoT9;
