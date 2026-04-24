/**
 * LetterStegoChannel v4 — Deterministic reversible letter mutation via Az.Morph
 *
 * ## Core Algorithm (from uploaded stego.js reference)
 *
 * 1. Find "safe" positions in words: positions where only ONE valid dictionary
 *    letter exists. This is determined by testing every letter of the Russian
 *    alphabet at that position and checking if the result is a dictionary word.
 *
 * 2. If exactly one valid letter exists → the position is "safe".
 *    Replacing the valid letter with any other creates an UNAMBIGUOUS encoding:
 *    the decoder can determine the original by finding the single valid letter.
 *
 * 3. The position is selected deterministically based on the PREVIOUS RESTORED
 *    word (seed chain), ensuring encode/decode see the same positions.
 *
 * ## Seed chain consistency (CRITICAL)
 *
 * All methods (analyzeCapacity, encode, decode, restore, extract) iterate
 * over the text using the SAME tokenization: split(/(\s+)/). Every chunk
 * (including short words, punctuation, etc.) updates the prevOriginalWord /
 * prevRestoredWord seed chain. This guarantees the seed for each word is
 * identical regardless of whether the text is the original carrier or the
 * stego text (with LS mutations).
 *
 * ## Info alphabet
 *
 * 31 letters (ё→е, ъ→ь normalized): абвгдежзийклмнопрстуфхцчшщыьэюя
 * Index 31 = EOF marker
 * Each safe position encodes exactly ONE character from the info payload.
 *
 * ## Encode/decode ordering in the stego system
 *
 *   Encode: [other channels] → [letter-stego LAST]
 *   Decode: [letter-stego FIRST, restores text] → [other channels]
 *
 * Letter-stego extracts payload and restores text to pre-encoding state,
 * so other channels can then decode from the restored text.
 *
 * ## Ё handling
 *
 * Az.Morph has built-in е↔ё replacement ({ 'е': 'ё' } in defaults).
 * During encoding, ё in secret info is normalized to е.
 * During extraction, restored text may contain ё where original had е.
 * This is expected and harmless — the restored text is semantically identical.
 *
 * ## Channel interface (mixed-radix compatibility)
 *
 * - analyzeCapacity(text) → { totalBits, positions, bases }
 * - encode(text, indices) → modified text
 * - decode(stegoText) → indices[]
 * - restore(stegoText) → text with typos removed
 * - getStats() → channel stats
 */

//@ts-ignore
const Az = window.Az;

// ─── Constants ──────────────────────────────────────────────────────────────

const RU_ALPHABET = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя".split("");

// 31 letter info alphabet (ё→е, ъ→ь removed; 31 values + EOF at index 31)
const INFO_ALPHABET = "абвгдежзийклмнопрстуфхцчшщыьэюя".split("");
const INFO_MAP = {};
INFO_ALPHABET.forEach((c, i) => { INFO_MAP[c] = i; });

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWordSeed(word) {
    const clean = word.toLowerCase().replace(/[^а-яё]/g, "");
    if (!clean) return 0;
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        hash = (hash << 5) - hash + clean.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function isDictWord(word) {
    if (!Az || !Az.Morph) return false;
    const parsed = Az.Morph(word.toLowerCase());
    return parsed && parsed.some(p => p.parser === 'Dictionary');
}

/**
 * Find a "safe" word info — a position where only ONE valid dictionary letter exists.
 * Returns null if the word has no safe position.
 *
 * @param {string} chunk - The word (may include punctuation)
 * @param {string} prevOriginalWord - Previous original word (for deterministic position)
 * @returns {{targetIdx: number, originalChar: string, invalidLetters: string[]} | null}
 */
function getSafeWordInfo(chunk, prevOriginalWord) {
    const letters = chunk.toLowerCase().split('');
    const cyrillicIndices = [];
    for (let i = 0; i < letters.length; i++) {
        if (RU_ALPHABET.includes(letters[i])) cyrillicIndices.push(i);
    }
    if (cyrillicIndices.length <= 3) return null;

    const seed = getWordSeed(prevOriginalWord);
    const targetIdx = cyrillicIndices[seed % cyrillicIndices.length];

    const validLetters = [];
    const invalidLetters = [];

    for (const char of RU_ALPHABET) {
        const testWord = chunk.substring(0, targetIdx) + char + chunk.substring(targetIdx + 1);
        const cleanTestWord = testWord.replace(/[^а-яё]/gi, "");
        if (isDictWord(cleanTestWord)) {
            validLetters.push(char);
        } else {
            invalidLetters.push(char);
        }
    }

    // Only "safe" if exactly ONE valid letter at this position.
    // The current letter may or may not be the valid one — during decode,
    // the letter at targetIdx could be an LS-mutated invalid letter.
    // In both cases (original or mutated), the position is still "safe"
    // because there's only one valid letter → unambiguous decoding.
    if (validLetters.length === 1) {
        return {
            targetIdx,
            originalChar: validLetters[0],
            invalidLetters: invalidLetters.sort(),
            isMutated: validLetters[0] !== letters[targetIdx]
        };
    }

    return null;
}

// ─── Channel ────────────────────────────────────────────────────────────────

export class LetterStegoChannel {
    constructor() {
        this.name     = 'letter-stego';
        this.loaded   = false;

        this.MIN_WORD_LEN = 4;     // minimum word length (cyrillic chars)
        this.MIN_BASE     = 3;     // minimum base (invalidLetters.length + 1) for a position to be usable
        this.density      = 1.0;   // fraction of mutable words (0.05–1.0)
    }

    setDensity(d) { this.density = Math.max(0.05, Math.min(1.0, parseFloat(d))); }
    setMinLen(l)  { this.MIN_WORD_LEN = Math.max(4, parseInt(l)); }

    // ─── Initialization ─────────────────────────────────────────────────────

    /**
     * Initialize the channel. Az.Morph must already be loaded and initialized.
     * This channel uses Az.Morph directly (not synonyms.json) for dictionary lookup.
     *
     * @param {string} _path - Ignored (kept for API compatibility)
     */
    async loadDictionary(_path = '') {
        // Verify Az.Morph is available
        if (!Az || !Az.Morph) {
            console.warn('LetterStego v4: Az.Morph not available');
            this.loaded = false;
            return;
        }

        // Quick test: check if Az.Morph is initialized
        try {
            Az.Morph('тест');
            this.loaded = true;
            console.log(`LetterStego v4: ready (Az.Morph dictionary, INFO_ALPHABET=${INFO_ALPHABET.length}+EOF)`);
        } catch (e) {
            console.warn('LetterStego v4: Az.Morph not initialized yet:', e.message);
            this.loaded = false;
        }
    }

    // ─── Tokenization ──────────────────────────────────────────────────────

    /**
     * Split text into chunks (words and whitespace), tracking character positions.
     * This is the SAME tokenization used by restore() and extract(), ensuring
     * the seed chain is consistent across all methods.
     *
     * @returns {Array<{chunk: string, charIndex: number, isWord: boolean}>}
     */
    _getChunks(text) {
        const chunks = [];
        const parts = text.split(/(\s+)/);
        let charIndex = 0;
        for (const part of parts) {
            if (part.length === 0) continue;
            const isWord = !/^\s+$/.test(part);
            chunks.push({ chunk: part, charIndex, isWord });
            charIndex += part.length;
        }
        return chunks;
    }

    // ─── Analyze safe positions ────────────────────────────────────────────

    /**
     * Find all words in the text that have "safe" positions (only one valid
     * dictionary letter). Each such position can carry one info character.
     *
     * ## Seed chain consistency
     *
     * Uses the SAME iteration as restore()/extract() — split by whitespace,
     * process ALL chunks — so the prevOriginalWord seed chain is identical
     * whether the text is the original carrier or the stego text.
     *
     * For each chunk, the word is "restored" (find single valid letter) before
     * being used as the seed for the next word. This ensures that LS mutations
     * don't affect the seed chain, so encode and decode find the same positions.
     *
     * Returns { totalBits, positions, bases }
     */
    analyzeCapacity(text) {
        if (!this.loaded) return { totalBits: 0, positions: [], bases: [] };

        const chunks = this._getChunks(text);
        const positions = [];
        let prevOriginalWord = "начало";
        let wordIdx = 0;  // only counts 4+ cyrillic letter words (for density filter)

        for (const { chunk, charIndex } of chunks) {
            if (/^\s+$/.test(chunk)) continue;  // skip whitespace

            const cleanLen = chunk.replace(/[^а-яё]/gi, "").length;
            if (cleanLen === 0) {
                // Non-word chunk (punctuation, numbers) — just track for seed chain
                prevOriginalWord = chunk;
                continue;
            }

            const letters = chunk.toLowerCase().split('');
            const cyrillicIndices = [];
            for (let i = 0; i < letters.length; i++) {
                if (RU_ALPHABET.includes(letters[i])) cyrillicIndices.push(i);
            }

            if (cyrillicIndices.length <= 3) {
                // Too short for a safe position, but still part of seed chain
                prevOriginalWord = chunk;
                continue;
            }

            // Compute safe position using the RESTORED previous word as seed
            const safeInfo = getSafeWordInfo(chunk, prevOriginalWord);

            if (safeInfo) {
                const base = safeInfo.invalidLetters.length + 1; // +1 for "no change" (idx=0)
                if (base >= this.MIN_BASE) {
                    // Apply density filter
                    if (this.density >= 1.0 || this._shouldInclude(wordIdx)) {
                        positions.push({
                            index:       charIndex,
                            length:      chunk.length,
                            word:        chunk,
                            wordNorm:    chunk.toLowerCase(),
                            targetIdx:   safeInfo.targetIdx,
                            originalChar: safeInfo.originalChar,
                            invalidLetters: safeInfo.invalidLetters,
                            base,
                            bits:        Math.log2(base)
                        });
                    }
                }
                // RESTORE word for seed chain (even if position was skipped by density filter)
                const isUp = chunk[safeInfo.targetIdx] !== chunk[safeInfo.targetIdx].toLowerCase();
                const restoredWord = chunk.substring(0, safeInfo.targetIdx)
                    + (isUp ? safeInfo.originalChar.toUpperCase() : safeInfo.originalChar)
                    + chunk.substring(safeInfo.targetIdx + 1);
                prevOriginalWord = restoredWord;
            } else {
                // No safe position — try to restore via _restoreWord for seed chain
                prevOriginalWord = this._restoreWord(chunk, prevOriginalWord);
            }
            wordIdx++;
        }

        const totalBits = positions.reduce((s, p) => s + p.bits, 0);
        return {
            totalBits,
            positions,
            bases: positions.map(p => p.base)
        };
    }

    /**
     * Restore a single word by finding its safe position and the single valid letter.
     * Used internally by analyzeCapacity for seed chain consistency.
     *
     * @param {string} word - The word (may include punctuation)
     * @param {string} prevOriginalWord - Previous restored word (for seed)
     * @returns {string} Restored word (with mutation reversed, or unchanged)
     */
    _restoreWord(word, prevOriginalWord) {
        const letters = word.toLowerCase().split('');
        const cyrillicIndices = [];
        for (let i = 0; i < letters.length; i++) {
            if (RU_ALPHABET.includes(letters[i])) cyrillicIndices.push(i);
        }
        if (cyrillicIndices.length <= 3) return word;

        const seed = getWordSeed(prevOriginalWord);
        const targetIdx = cyrillicIndices[seed % cyrillicIndices.length];

        const validLetters = [];
        for (const char of RU_ALPHABET) {
            const testWord = word.substring(0, targetIdx) + char + word.substring(targetIdx + 1);
            const cleanTestWord = testWord.replace(/[^а-яё]/gi, "");
            if (isDictWord(cleanTestWord)) {
                validLetters.push(char);
            }
        }

        if (validLetters.length === 1) {
            const originalCharL = validLetters[0];
            const isUp = word[targetIdx] === word[targetIdx].toUpperCase();
            return word.substring(0, targetIdx)
                + (isUp ? originalCharL.toUpperCase() : originalCharL)
                + word.substring(targetIdx + 1);
        }
        return word;
    }

    _shouldInclude(wordIdx) {
        // Deterministic density filter based on word index
        // Uses a simple hash to decide which words to include
        const hash = ((wordIdx * 2654435761) >>> 0) % 100;
        return hash < (this.density * 100);
    }

    // ─── Encoding ──────────────────────────────────────────────────────────

    /**
     * Encode indices into the text by replacing safe-position letters.
     *
     * @param {string} text - Text to encode into
     * @param {number[]} indices - Array of indices (one per position)
     * @returns {string} Text with typos
     */
    encode(text, indices) {
        if (!this.loaded || !indices || indices.length === 0) return text;

        const { positions } = this.analyzeCapacity(text);
        const toReplace = [];

        for (let i = 0; i < Math.min(positions.length, indices.length); i++) {
            const pos = positions[i];
            const idx = indices[i] % pos.base;
            if (idx === 0) continue; // 0 = no change

            // idx=1 → invalidLetters[0], idx=2 → invalidLetters[1], etc.
            const typoChar = pos.invalidLetters[idx - 1];
            if (!typoChar) continue;

            // Preserve capitalization
            let replacement = typoChar;
            if (pos.word[pos.targetIdx] !== pos.word[pos.targetIdx].toLowerCase()) {
                replacement = typoChar.toUpperCase();
            }

            toReplace.push({
                index:      pos.index,
                length:     pos.length,
                targetIdx:  pos.targetIdx,
                originalWord: pos.word,
                replacement
            });
        }

        // Apply replacements (in reverse order to preserve indices)
        toReplace.sort((a, b) => b.index - a.index);
        let result = text;
        for (const r of toReplace) {
            const word = result.substring(r.index, r.index + r.length);
            const newWord = word.substring(0, r.targetIdx) + r.replacement + word.substring(r.targetIdx + 1);
            result = result.substring(0, r.index) + newWord + result.substring(r.index + r.length);
        }
        return result;
    }

    // ─── Decoding ──────────────────────────────────────────────────────────

    /**
     * Decode indices from stego-text.
     * For each safe position, determines the index based on the current letter.
     *
     * The decoder sees the same safe positions as the encoder because:
     * 1. Seed chain uses previous RESTORED word (same iteration as analyzeCapacity)
     * 2. Safe positions are computed fresh from the stego-text
     *
     * @param {string} stegoText - Text with encoded typos
     * @returns {number[]} Array of indices
     */
    decode(stegoText) {
        if (!this.loaded) return [];

        const { positions } = this.analyzeCapacity(stegoText);
        return positions.map(pos => {
            const currentLetter = pos.wordNorm[pos.targetIdx];
            if (currentLetter === pos.originalChar) return 0; // no change
            // Find the index in invalidLetters
            const idx = pos.invalidLetters.indexOf(currentLetter);
            if (idx === -1) return 0; // not found → treat as no change
            return idx + 1;
        });
    }

    /**
     * Restore the original text by replacing mutated letters back.
     * This is the key function for the broader stego system:
     * letter-stego restores text FIRST during decode, then other channels
     * decode from the restored text.
     *
     * @param {string} stegoText - Text with encoded typos
     * @returns {string} Text with typos removed (restored to pre-encoding state)
     */
    restore(stegoText) {
        if (!this.loaded) return stegoText;

        const words = stegoText.split(/(\s+)/);
        let prevRestoredWord = "начало";

        const restoredWords = words.map(chunk => {
            if (/^\s+$/.test(chunk)) return chunk;

            const cleanLen = chunk.replace(/[^а-яё]/gi, "").length;
            if (cleanLen === 0 || cleanLen <= 3) {
                prevRestoredWord = chunk;
                return chunk;
            }

            const letters = chunk.toLowerCase().split('');
            const cyrillicIndices = [];
            for (let i = 0; i < letters.length; i++) {
                if (RU_ALPHABET.includes(letters[i])) cyrillicIndices.push(i);
            }

            if (cyrillicIndices.length <= 3) {
                prevRestoredWord = chunk;
                return chunk;
            }

            const seed = getWordSeed(prevRestoredWord);
            const targetIdx = cyrillicIndices[seed % cyrillicIndices.length];

            const validLetters = [];
            const invalidLetters = [];

            for (const char of RU_ALPHABET) {
                const testWord = chunk.substring(0, targetIdx) + char + chunk.substring(targetIdx + 1);
                const cleanTestWord = testWord.replace(/[^а-яё]/gi, "");
                if (isDictWord(cleanTestWord)) {
                    validLetters.push(char);
                } else {
                    invalidLetters.push(char);
                }
            }

            if (validLetters.length === 1) {
                const originalCharL = validLetters[0];
                const isUp = chunk[targetIdx] === chunk[targetIdx].toUpperCase();
                const originalWord = chunk.substring(0, targetIdx)
                    + (isUp ? originalCharL.toUpperCase() : originalCharL)
                    + chunk.substring(targetIdx + 1);

                prevRestoredWord = originalWord;
                return originalWord;
            } else {
                prevRestoredWord = chunk;
                return chunk;
            }
        });

        return restoredWords.join("");
    }

    /**
     * Extract hidden info from stego-text (standalone, not via mixed-radix).
     * This is the public API for direct use without the mixed-radix system.
     *
     * @param {string} encodedText - Text with encoded typos
     * @returns {{ text: string, info: string }} Restored text and extracted info
     */
    extract(encodedText) {
        if (!this.loaded) throw new Error("Словарь еще загружается. Пожалуйста, подождите.");

        const words = encodedText.split(/(\s+)/);
        const extractedInfo = [];
        let prevRestoredWord = "начало";
        let isExtractionComplete = false;

        const restoredWords = words.map(chunk => {
            if (/^\s+$/.test(chunk)) return chunk;

            const cleanLen = chunk.replace(/[^а-яё]/gi, "").length;
            if (cleanLen === 0) return chunk;

            if (isExtractionComplete || cleanLen <= 3) {
                prevRestoredWord = chunk;
                return chunk;
            }

            const letters = chunk.toLowerCase().split('');
            const cyrillicIndices = [];
            for (let i = 0; i < letters.length; i++) {
                if (RU_ALPHABET.includes(letters[i])) cyrillicIndices.push(i);
            }

            if (cyrillicIndices.length <= 3) {
                prevRestoredWord = chunk;
                return chunk;
            }

            const seed = getWordSeed(prevRestoredWord);
            const targetIdx = cyrillicIndices[seed % cyrillicIndices.length];

            const validLetters = [];
            const invalidLetters = [];

            for (const char of RU_ALPHABET) {
                const testWord = chunk.substring(0, targetIdx) + char + chunk.substring(targetIdx + 1);
                const cleanTestWord = testWord.replace(/[^а-яё]/gi, "");
                if (isDictWord(cleanTestWord)) {
                    validLetters.push(char);
                } else {
                    invalidLetters.push(char);
                }
            }

            if (validLetters.length === 1) {
                const originalCharL = validLetters[0];
                const sortedInvalid = invalidLetters.sort();
                const currentLetterL = letters[targetIdx];

                const isUp = chunk[targetIdx] === chunk[targetIdx].toUpperCase();
                const originalWord = chunk.substring(0, targetIdx)
                    + (isUp ? originalCharL.toUpperCase() : originalCharL)
                    + chunk.substring(targetIdx + 1);

                if (currentLetterL !== originalCharL) {
                    const val = sortedInvalid.indexOf(currentLetterL);
                    if (val === 31) {
                        isExtractionComplete = true; // EOF
                    } else if (val !== -1) {
                        extractedInfo.push(INFO_ALPHABET[val]);
                    }
                }

                prevRestoredWord = originalWord;
                return originalWord;
            } else {
                prevRestoredWord = chunk;
                return chunk;
            }
        });

        return {
            text: restoredWords.join(""),
            info: extractedInfo.join("")
        };
    }

    /**
     * Encode info directly into text (standalone, not via mixed-radix).
     * This is the public API for direct use without the mixed-radix system.
     *
     * @param {string} text - Carrier text
     * @param {string} info - Secret information to hide
     * @returns {string} Text with typos encoding the info
     */
    encodeInfo(text, info) {
        if (!this.loaded) throw new Error("Словарь еще загружается. Пожалуйста, подождите.");

        const words = text.split(/(\s+)/);

        // Normalize info: ё→е, ъ→ь, keep only Cyrillic
        const infoPayload = [];
        const infoClean = info.toLowerCase().replace(/ё/g, 'е').replace(/ъ/g, 'ь').replace(/[^а-я]/g, "");

        for (const char of infoClean) {
            if (INFO_MAP[char] !== undefined) {
                infoPayload.push(INFO_MAP[char]);
            }
        }
        infoPayload.push(31); // EOF marker

        let infoIdx = 0;
        let prevOriginalWord = "начало";

        const result = words.map(chunk => {
            if (/^\s+$/.test(chunk)) return chunk;

            const cleanLen = chunk.replace(/[^а-яё]/gi, "").length;
            if (cleanLen === 0) {
                prevOriginalWord = chunk;
                return chunk;
            }

            let processedWord = chunk;

            if (infoIdx < infoPayload.length && cleanLen > 3) {
                const safeInfo = getSafeWordInfo(chunk, prevOriginalWord);
                if (safeInfo) {
                    const val = infoPayload[infoIdx];
                    const typoChar = safeInfo.invalidLetters[val];

                    if (typoChar !== undefined) {
                        const isUp = chunk[safeInfo.targetIdx] === chunk[safeInfo.targetIdx].toUpperCase();
                        processedWord = chunk.substring(0, safeInfo.targetIdx)
                            + (isUp ? typoChar.toUpperCase() : typoChar)
                            + chunk.substring(safeInfo.targetIdx + 1);
                        infoIdx++;
                    }
                    // Restore for seed chain
                    const isUp2 = processedWord[safeInfo.targetIdx] !== processedWord[safeInfo.targetIdx].toLowerCase();
                    prevOriginalWord = processedWord.substring(0, safeInfo.targetIdx)
                        + (isUp2 ? safeInfo.originalChar.toUpperCase() : safeInfo.originalChar)
                        + processedWord.substring(safeInfo.targetIdx + 1);
                } else {
                    prevOriginalWord = chunk;
                }
            } else {
                // Short word or info complete — still try restoration for seed chain
                if (cleanLen > 3) {
                    prevOriginalWord = this._restoreWord(chunk, prevOriginalWord);
                } else {
                    prevOriginalWord = chunk;
                }
            }

            return processedWord;
        });

        return result.join("");
    }

    getStats() {
        return {
            name:      this.name,
            loaded:    this.loaded,
            alphabet:  INFO_ALPHABET.length + 1, // +1 for EOF
            density:   this.density,
            minLen:    this.MIN_WORD_LEN,
            minBase:   this.MIN_BASE
        };
    }
}

export default LetterStegoChannel;
