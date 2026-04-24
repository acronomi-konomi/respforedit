/**
 * Invisible Spaces Encoder
 * Encodes data using safe, copy-stable Unicode characters.
 * The encoded text appears as blank/spaces but contains data.
 *
 * Only uses characters that are:
 * 1. Invisible or space-like (won't attract attention)
 * 2. Preserved across copy-paste in all major messengers
 * 3. Not stripped or converted by text processing
 * 4. NOT string control characters (no newlines, tabs, etc.)
 * 5. NOT in Unicode Zs category (would be destroyed by .trim())
 *
 * 8 safe characters → base-8 encoding (3 bits/char)
 * Byte length is preserved via marker byte + 2-byte length prefix
 */

// Safe, copy-stable invisible/space characters
// IMPORTANT: None of these are in Unicode category Zs (Space Separator)
// because String.prototype.trim() strips all Zs characters.
// All chars below survive .trim() and copy-paste in messengers.
const INVISIBLE_CHARS = [
    '\u3164', // Hangul Filler — Lo category, invisible, very stable across all platforms
    '\u115F', // Hangul Choseong Filler — Lo category, invisible, stable (replaces Braille Blank)
    '\u00A0', // Non-Breaking Space — Zs, BUT kept for messenger compatibility; survive clipboard
    '\u2002', // En Space — Zs, space variant, stable in copy-paste
    '\u2003', // Em Space — Zs, space variant, stable in copy-paste
    '\u2005', // Four-Per-Em Space — Zs, space variant, stable in copy-paste
    '\u202F', // Narrow No-Break Space — Zs, stable, not normalized
    '\u205F', // Medium Mathematical Space — Zs, stable
];

const BASE = BigInt(INVISIBLE_CHARS.length); // 8
// MAGIC_PREFIX uses ONLY non-Zs characters (Lo category) so .trim() never strips it
const MAGIC_PREFIX = '\u3164\u115F'; // Hangul Filler + Hangul Choseong Filler

// Build reverse map
const _charToIndex = new Map();
INVISIBLE_CHARS.forEach((ch, i) => _charToIndex.set(ch, i));

// Marker byte: ensures BigInt never starts with zero, so byte count is preserved
const MARKER = 0xFE;

export default class InvisibleSpacesEncoder {
    static get id()    { return 'invisible-spaces'; }
    static get label() { return 'Невидимые символы'; }
    static get icon()  { return '👻'; }

    static capacity(textLength) {
        // 3 bits per invisible char (base-8)
        return textLength * 3;
    }

    /**
     * Encode bytes into invisible characters
     * Format: MAGIC_PREFIX + base8(BigInt([MARKER, lenHi, lenLo, ...bytes]))
     * The MARKER byte ensures the BigInt has no leading zeros, preserving exact byte count.
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static encode(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC_PREFIX;

        // Build combined: [MARKER, lenHi, lenLo, ...bytes]
        const lenHi = (bytes.length >> 8) & 0xFF;
        const lenLo = bytes.length & 0xFF;

        const combined = new Uint8Array(3 + bytes.length);
        combined[0] = MARKER;
        combined[1] = lenHi;
        combined[2] = lenLo;
        combined.set(bytes, 3);

        // Convert to BigInt
        let M = 0n;
        for (const b of combined) {
            M = (M << 8n) | BigInt(b);
        }

        // Encode in base-8
        const chars = [];
        while (M > 0n) {
            const remainder = M % BASE;
            chars.push(INVISIBLE_CHARS[Number(remainder)]);
            M = M / BASE;
        }

        // Reverse: we encoded least significant digit first
        chars.reverse();

        return MAGIC_PREFIX + chars.join('');
    }

    /**
     * Decode invisible character text back to bytes
     * @param {string} text
     * @returns {Uint8Array|null}
     */
    static decode(text) {
        if (!text || !text.startsWith(MAGIC_PREFIX)) return null;

        const data = text.slice(MAGIC_PREFIX.length);
        if (data.length === 0) return new Uint8Array(0);

        // Decode from base-8 (most significant digit first)
        let M = 0n;
        for (const ch of data) {
            const idx = _charToIndex.get(ch);
            if (idx === undefined) return null;
            M = M * BASE + BigInt(idx);
        }

        // Convert BigInt to bytes
        const allBytes = _bigIntToBytes(M);

        // Verify marker byte
        if (allBytes.length < 3 || allBytes[0] !== MARKER) return null;

        // Extract byte length
        const byteLength = (allBytes[1] << 8) | allBytes[2];

        // Extract data bytes
        const dataBytes = allBytes.slice(3);

        // Verify length matches
        if (dataBytes.length < byteLength) return null;

        // If dataBytes is longer (from BigInt conversion edge cases), trim to expected length
        return dataBytes.slice(0, byteLength);
    }

    /**
     * Detect if text uses invisible encoding
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text || text.length < MAGIC_PREFIX.length) return false;
        return text.startsWith(MAGIC_PREFIX);
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
