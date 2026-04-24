/**
 * Layout Switch Encoder
 * Simulates typing with the wrong keyboard layout (Russian ↔ English).
 * Like a simplified Punto Switcher.
 *
 * Can work WITHOUT encryption (just obfuscation).
 * With encryption: first encrypt, then layout-switch the result.
 */

// Russian ЙЦУКЕН → English QWERTY mapping (lowercase)
const RU_TO_EN = {
    'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p','х':'[','ъ':']',
    'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l','ж':';','э':"'",
    'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m','б':',','ю':'.',
    'ё':'`',
    // Uppercase
    'Й':'Q','Ц':'W','У':'E','К':'R','Е':'T','Н':'Y','Г':'U','Ш':'I','Щ':'O','З':'P','Х':'{','Ъ':'}',
    'Ф':'A','Ы':'S','В':'D','А':'F','П':'G','Р':'H','О':'J','Л':'K','Д':'L','Ж':':','Э':'"',
    'Я':'Z','Ч':'X','С':'C','М':'V','И':'B','Т':'N','Ь':'M','Б':'<','Ю':'>',
    'Ё':'~',
    // Numbers row (same in both layouts, but some symbols differ)
    '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','0':'0',
    '-':'-','=':'=',
    '!':'!','@':'@','#':'#','$':'$','%':'%','^':'^','&':'&','*':'*','(':'(',')':')',
    '_':'_','+':'+',
    ' ':' ','\n':'\n','\r':'\r','\t':'\t',
};

// Reverse: English QWERTY → Russian ЙЦУКЕН
const EN_TO_RU = {};
for (const [ru, en] of Object.entries(RU_TO_EN)) {
    if (!EN_TO_RU[en] || ru === ru.toLowerCase()) {
        // Prefer lowercase for reverse mapping, unless it's uppercase
        EN_TO_RU[en] = ru;
    }
}
// Ensure uppercase mappings too
for (const [ru, en] of Object.entries(RU_TO_EN)) {
    if (ru === ru.toUpperCase() && ru !== ru.toLowerCase()) {
        EN_TO_RU[en] = ru;
    }
}

// Russian letter detection pattern
const RU_PATTERN = /[а-яА-ЯёЁ]/;
const EN_PATTERN = /[a-zA-Z]/;

const MAGIC = '⌨️⇄:';

export default class LayoutSwitchEncoder {
    static get id()    { return 'layout-switch'; }
    static get label() { return 'Смена раскладки'; }
    static get icon()  { return '⌨️'; }

    static capacity(textLength) {
        // Same length as input (1:1 character mapping)
        return textLength * 8; // assuming UTF-8 bytes
    }

    /**
     * Encode: convert Russian text to English QWERTY equivalent
     * (as if user forgot to switch keyboard layout)
     * @param {Uint8Array} bytes - text data to encode
     * @returns {string}
     */
    static encode(bytes) {
        const text = new TextDecoder().decode(bytes);
        if (!text) return MAGIC;

        const encoded = _switchLayout(text, 'ru-to-en');
        return MAGIC + encoded;
    }

    /**
     * Encode string directly (no bytes conversion needed)
     * @param {string} text - Russian text
     * @param {boolean} withMagic - add magic prefix
     * @returns {string}
     */
    static encodeString(text, withMagic = true) {
        if (!text) return withMagic ? MAGIC : '';
        const encoded = _switchLayout(text, 'ru-to-en');
        return withMagic ? MAGIC + encoded : encoded;
    }

    /**
     * Decode: convert English QWERTY-typed text back to Russian
     * @param {string} text
     * @returns {Uint8Array|null}
     */
    static decode(text) {
        const decoded = LayoutSwitchEncoder.decodeToString(text);
        if (decoded === null) return null;
        return new TextEncoder().encode(decoded);
    }

    /**
     * Decode to string
     * @param {string} text
     * @returns {string|null}
     */
    static decodeToString(text) {
        if (!text) return null;

        let data = text;
        if (data.startsWith(MAGIC)) {
            data = data.slice(MAGIC.length);
        }

        // Auto-detect direction
        const hasEn = EN_PATTERN.test(data);
        const hasRu = RU_PATTERN.test(data);

        if (hasRu && !hasEn) {
            // Text is Russian, switch to English
            return _switchLayout(data, 'ru-to-en');
        } else if (hasEn && !hasRu) {
            // Text is English (typed with Russian layout), switch back
            return _switchLayout(data, 'en-to-ru');
        }

        // Try en-to-ru as default decode direction
        return _switchLayout(data, 'en-to-ru');
    }

    /**
     * Detect layout switch encoding
     * ONLY detects by magic prefix — auto-detection by content
     * is too unreliable (normal English text, base64, etc. would false-positive).
     * Content-based direction detection is used only during decode.
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text) return false;
        return text.startsWith(MAGIC);
    }

    /**
     * Switch layout without magic prefix (for non-encrypted mode)
     * @param {string} text
     * @returns {string}
     */
    static quickSwitch(text) {
        if (!text) return '';
        const hasEn = EN_PATTERN.test(text);
        const hasRu = RU_PATTERN.test(text);

        if (hasRu) return _switchLayout(text, 'ru-to-en');
        if (hasEn) return _switchLayout(text, 'en-to-ru');
        return text;
    }
}

// ─── Internal ───────────────────────────────────────────────

function _switchLayout(text, direction) {
    const map = direction === 'ru-to-en' ? RU_TO_EN : EN_TO_RU;
    let result = '';
    for (const ch of text) {
        result += map[ch] ?? ch;
    }
    return result;
}
