/**
 * Deflate + Base64 Encoder
 * Compresses data using deflate algorithm, then encodes with base64url.
 * Uses browser's CompressionStream API (modern browsers) with fallback.
 *
 * Renamed from "Сжатие" to "Deflate+B64" for clarity.
 */

const MAGIC = 'ZH:';

export default class CompressionEncoder {
    static get id()    { return 'compression'; }
    static get label() { return 'Deflate+B64'; }
    static get icon()  { return '📦'; }

    static capacity(textLength) {
        // After compression + base64, roughly 4.5 bits per visible char
        return Math.floor(textLength * 4.5);
    }

    /**
     * Compress and encode bytes
     * @param {Uint8Array} bytes
     * @returns {Promise<string>}
     */
    static async encode(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC;

        try {
            // Try native CompressionStream
            if (typeof CompressionStream !== 'undefined') {
                const compressed = await _compressNative(bytes);
                return MAGIC + _bytesToBase64url(compressed);
            }
        } catch (e) {
            console.warn('CompressionStream failed, using uncompressed fallback:', e);
        }

        // Fallback: just base64 without compression
        return MAGIC + _bytesToBase64url(bytes);
    }

    /**
     * Synchronous encode (no compression, just base64)
     */
    static encodeSync(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC;
        return MAGIC + _bytesToBase64url(bytes);
    }

    /**
     * Decode and decompress
     * @param {string} text
     * @returns {Promise<Uint8Array|null>}
     */
    static async decode(text) {
        if (!text || !text.startsWith(MAGIC)) return null;

        const b64 = text.slice(MAGIC.length);
        const bytes = _base64urlToBytes(b64);
        if (!bytes || bytes.length === 0) return bytes;

        try {
            // Try native DecompressionStream
            if (typeof DecompressionStream !== 'undefined') {
                const decompressed = await _decompressNative(bytes);
                // Validate: if decompression succeeds, return result
                if (decompressed && decompressed.length > 0) {
                    return decompressed;
                }
            }
        } catch (e) {
            // Data was not compressed (fallback mode), return raw bytes
        }

        // Return raw bytes (uncompressed fallback)
        return bytes;
    }

    /**
     * Synchronous decode (no decompression)
     */
    static decodeSync(text) {
        if (!text || !text.startsWith(MAGIC)) return null;
        const b64 = text.slice(MAGIC.length);
        return _base64urlToBytes(b64);
    }

    /**
     * Detect compression encoding
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text) return false;
        return text.startsWith(MAGIC);
    }
}

// ─── Native Compression ─────────────────────────────────────

async function _compressNative(bytes) {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    writer.write(bytes);
    writer.close();

    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

async function _decompressNative(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(bytes);
    writer.close();

    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

// ─── Base64url helpers (correct implementation) ──────────────

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_DECODE = new Map();
B64_CHARS.split('').forEach((ch, i) => B64_DECODE.set(ch, i));

function _bytesToBase64url(bytes) {
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const bits = (a << 16) | (b << 8) | c;
        result += B64_CHARS[(bits >> 18) & 0x3F];
        result += B64_CHARS[(bits >> 12) & 0x3F];
        result += (i + 1 < bytes.length) ? B64_CHARS[(bits >> 6) & 0x3F] : '';
        result += (i + 2 < bytes.length) ? B64_CHARS[bits & 0x3F] : '';
    }
    return result;
}

function _base64urlToBytes(str) {
    if (!str || str.length === 0) return new Uint8Array(0);

    const len = str.length;
    const remainder = len % 4;
    if (remainder === 1) return null; // invalid

    let outputLen;
    if (remainder === 0) outputLen = Math.floor(len / 4) * 3;
    else if (remainder === 2) outputLen = Math.floor(len / 4) * 3 + 1;
    else outputLen = Math.floor(len / 4) * 3 + 2;

    const bytes = new Uint8Array(outputLen);
    let byteIdx = 0;
    let i = 0;

    while (i + 4 <= len) {
        const a = B64_DECODE.get(str[i++]) ?? 0;
        const b = B64_DECODE.get(str[i++]) ?? 0;
        const c = B64_DECODE.get(str[i++]) ?? 0;
        const d = B64_DECODE.get(str[i++]) ?? 0;
        const bits = (a << 18) | (b << 12) | (c << 6) | d;
        bytes[byteIdx++] = (bits >> 16) & 0xFF;
        bytes[byteIdx++] = (bits >> 8) & 0xFF;
        bytes[byteIdx++] = bits & 0xFF;
    }

    if (remainder === 2) {
        const a = B64_DECODE.get(str[i]) ?? 0;
        const b = B64_DECODE.get(str[i + 1]) ?? 0;
        bytes[byteIdx++] = ((a << 2) | (b >> 4)) & 0xFF;
    } else if (remainder === 3) {
        const a = B64_DECODE.get(str[i]) ?? 0;
        const b = B64_DECODE.get(str[i + 1]) ?? 0;
        const c = B64_DECODE.get(str[i + 2]) ?? 0;
        bytes[byteIdx++] = ((a << 2) | (b >> 4)) & 0xFF;
        bytes[byteIdx++] = ((b << 4) | (c >> 2)) & 0xFF;
    }

    return bytes;
}
