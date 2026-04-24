/**
 * Chinese Character Encoder
 * Encodes bytes as CJK Unified Ideographs.
 * CJK block: U+4E00 to U+9FFF = 20,992 characters → ~14.3 bits per character.
 * Very high capacity and compactness.
 *
 * Magic prefix uses only CJK characters (looks like natural Chinese text).
 */

const CJK_START = 0x4E00;
const CJK_END = 0x9FFF;
const CJK_BASE = BigInt(CJK_END - CJK_START + 1); // 20992
const CJK_BASE_BITS = Math.log2(20992); // ~14.35

// Magic prefix: 3 CJK characters that form a natural-looking sequence
// 之码曰 = "the code says" — looks like a normal Chinese phrase
const MAGIC = '之码曰';

export default class ChineseEncoder {
    static get id()    { return 'chinese'; }
    static get label() { return 'Китайские иероглифы'; }
    static get icon()  { return '🈳'; }

    static capacity(textLength) {
        return Math.floor(textLength * CJK_BASE_BITS);
    }

    /**
     * Encode bytes as Chinese characters
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static encode(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC;

        // Convert bytes to BigInt
        let M = 0n;
        for (const b of bytes) {
            M = (M << 8n) | BigInt(b);
        }

        if (M === 0n) {
            return MAGIC + String.fromCharCode(CJK_START);
        }

        // Encode in base-20992
        const chars = [];
        while (M > 0n) {
            const remainder = Number(M % CJK_BASE);
            chars.push(String.fromCharCode(CJK_START + remainder));
            M = M / CJK_BASE;
        }

        // Reverse because we encoded least significant first
        chars.reverse();

        return MAGIC + chars.join('');
    }

    /**
     * Decode Chinese character text back to bytes
     * @param {string} text
     * @returns {Uint8Array|null}
     */
    static decode(text) {
        if (!text || !text.startsWith(MAGIC)) return null;

        const data = text.slice(MAGIC.length);
        if (data.length === 0) return new Uint8Array(0);

        // Decode from base-20992
        let M = 0n;
        for (let i = 0; i < data.length; i++) {
            const code = data.charCodeAt(i);
            if (code < CJK_START || code > CJK_END) return null;
            const value = BigInt(code - CJK_START);
            M = M * CJK_BASE + value;
        }

        // Convert BigInt to bytes
        return _bigIntToBytes(M);
    }

    /**
     * Detect Chinese character encoding
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text) return false;
        return text.startsWith(MAGIC);
    }
}

function _bigIntToBytes(M) {
    if (M === 0n) return new Uint8Array(1);
    const bytes = [];
    while (M > 0n) {
        bytes.unshift(Number(M & 0xFFn));
        M = M >> 8n;
    }
    return new Uint8Array(bytes);
}
