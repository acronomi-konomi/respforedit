/**
 * Base64 Encoder
 * Standard Base64 and Base85 (Ascii85) encoding with magic prefixes.
 */

const MAGIC_B64 = '𝐁64:';
const MAGIC_B85 = '𝐁85:';

// URL-safe Base64 alphabet
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_DECODE = new Map();
B64_CHARS.split('').forEach((ch, i) => B64_DECODE.set(ch, i));

// Ascii85 alphabet (printable ASCII 33-117 = '!' to 'u')
const A85_START = 33;
const A85_END = 117;

export default class Base64Encoder {
    static get id()    { return 'base64'; }
    static get label() { return 'Base64'; }
    static get icon()  { return '🔤'; }

    static capacity(textLength) {
        // Base64: 6 bits per visible char
        return Math.floor(textLength * 6);
    }

    /**
     * Encode bytes to Base64url string with magic prefix
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static encode(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC_B64;

        // Try Base85 first (more compact), fall back to Base64
        const b85 = _encodeBase85(bytes);
        const b64 = _encodeBase64(bytes);

        // Use whichever is shorter
        if (b85.length <= b64.length) {
            return MAGIC_B85 + b85;
        }
        return MAGIC_B64 + b64;
    }

    /**
     * Decode Base64/Base85 encoded text back to bytes
     * @param {string} text
     * @returns {Uint8Array|null}
     */
    static decode(text) {
        if (!text) return null;

        if (text.startsWith(MAGIC_B64)) {
            return _decodeBase64(text.slice(MAGIC_B64.length));
        }
        if (text.startsWith(MAGIC_B85)) {
            return _decodeBase85(text.slice(MAGIC_B85.length));
        }

        return null;
    }

    /**
     * Detect Base64/Base85 encoding
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text) return false;
        return text.startsWith(MAGIC_B64) || text.startsWith(MAGIC_B85);
    }
}

// ─── Base64url ──────────────────────────────────────────────

function _encodeBase64(bytes) {
    let binary = '';
    for (const b of bytes) {
        binary += String.fromCharCode(b);
    }
    // Manual base64url encoding
    let result = '';
    let i = 0;
    const len = bytes.length;

    while (i < len) {
        const a = bytes[i++];
        const b = i < len ? bytes[i++] : 0;
        const c = i < len ? bytes[i++] : 0;
        // Note: i may have advanced past len for b and c

        const bits = (a << 16) | (b << 8) | c;

        result += B64_CHARS[(bits >> 18) & 0x3F];
        result += B64_CHARS[(bits >> 12) & 0x3F];
        result += (i - 2 < len) ? B64_CHARS[(bits >> 6) & 0x3F] : '';
        result += (i - 1 < len) ? B64_CHARS[bits & 0x3F] : '';
    }

    return result;
}

function _decodeBase64(str) {
    if (!str) return new Uint8Array(0);

    // Calculate output length
    const padding = str.length % 4;
    const decodedLen = Math.floor(str.length * 3 / 4);
    const bytes = new Uint8Array(decodedLen);
    let byteIdx = 0;

    let i = 0;
    while (i < str.length) {
        const a = B64_DECODE.get(str[i++]) ?? 0;
        const b = i < str.length ? (B64_DECODE.get(str[i++]) ?? 0) : 0;
        const c = i < str.length ? (B64_DECODE.get(str[i++]) ?? 0) : 0;
        const d = i < str.length ? (B64_DECODE.get(str[i++]) ?? 0) : 0;

        const bits = (a << 18) | (b << 12) | (c << 6) | d;

        if (byteIdx < decodedLen) bytes[byteIdx++] = (bits >> 16) & 0xFF;
        if (byteIdx < decodedLen) bytes[byteIdx++] = (bits >> 8) & 0xFF;
        if (byteIdx < decodedLen) bytes[byteIdx++] = bits & 0xFF;
    }

    return bytes.slice(0, byteIdx);
}

// ─── Ascii85 (Base85) ───────────────────────────────────────

function _encodeBase85(bytes) {
    if (bytes.length === 0) return '';

    // Pad to multiple of 4
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    const originalLen = bytes.length;

    let result = '';
    for (let i = 0; i < padded.length; i += 4) {
        const val = (padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3];

        if (val === 0 && (i + 4 <= originalLen)) {
            result += String.fromCharCode(A85_END + 1); // 'v' for zero group
            continue;
        }

        let group = '';
        let v = val >>> 0; // unsigned
        for (let j = 4; j >= 0; j--) {
            group = String.fromCharCode(A85_START + (v % 85)) + group;
            v = Math.floor(v / 85);
        }

        // Trim if this is the last group and original wasn't full
        const bytesInGroup = Math.min(4, originalLen - i);
        result += group.slice(0, bytesInGroup + 1);
    }

    return result;
}

function _decodeBase85(str) {
    if (!str) return new Uint8Array(0);

    const bytes = [];
    let i = 0;

    while (i < str.length) {
        // Handle 'v' as zero group
        if (str.charCodeAt(i) === A85_END + 1) {
            bytes.push(0, 0, 0, 0);
            i++;
            continue;
        }

        // Read up to 5 characters
        const groupLen = Math.min(5, str.length - i);
        let val = 0;
        for (let j = 0; j < 5; j++) {
            const ch = i + j < str.length ? str.charCodeAt(i + j) : A85_END; // pad with 'u'
            val = val * 85 + (ch - A85_START);
        }

        const decodedBytes = [
            (val >> 24) & 0xFF,
            (val >> 16) & 0xFF,
            (val >> 8) & 0xFF,
            val & 0xFF
        ];

        // Output only the meaningful bytes for the last group
        const outputLen = groupLen - 1;
        for (let j = 0; j < outputLen && bytes.length < str.length; j++) {
            bytes.push(decodedBytes[j]);
        }

        i += groupLen;
    }

    return new Uint8Array(bytes);
}
