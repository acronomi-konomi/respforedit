/**
 * Emoji Encoder
 * Encodes bytes as emoji sequences. 1 byte = 1 emoji.
 * Uses 256 carefully chosen UNIQUE, widely-supported emojis.
 *
 * IMPORTANT: All 256 emojis must be unique for correct roundtrip encoding.
 * Previous version had duplicates in the alphabet causing decode failures.
 */

const MAGIC = '😀🔤';

// 256 UNIQUE widely-supported emojis for byte encoding
// Each emoji appears exactly once — no duplicates!
const EMOJI_ALPHABET = [
    // Row 1: Faces (0-19)
    '😀','😁','😂','😃','😄','😅','😆','😇','😈','😉',
    '😊','😋','😌','😍','😎','😏','😐','😑','😒','😓',
    // Row 2: Faces (20-39)
    '😔','😕','😖','😗','😘','😙','😚','😛','😜','😝',
    '😞','😟','😠','😡','😢','😣','😤','😥','😦','😧',
    // Row 3: Faces + Cats (40-59)
    '😨','😩','😪','😫','😬','😭','😮','😯','😰','😱',
    '😲','😳','😴','😵','😶','😷','😸','😹','😺','😻',
    // Row 4: Cats + Symbols (60-79)
    '😼','😽','🙀','😿','😾','❤','🔥','⭐','🌈','🎵',
    '🎶','💡','💎','🔑','🔒','🔓','📝','📌','📎','📏',
    // Row 5: Objects (80-99)
    '📐','📕','📗','📘','📙','📚','📖','🔬','🔭','🎥',
    '📷','💾','📞','📟','📠','🔋','🔌','🔦','💰','💳',
    // Row 6: Money + Mail (100-119)
    '💸','💲','📧','📥','📤','📦','📫','📮','📰','🖥',
    '🖨','🖱','🖲','📀','🎞','🔊','🔉','🔈','🔇','🔔',
    // Row 7: Alerts + Time (120-139)
    '🔕','📢','📣','⏳','⌛','⏰','⌚','🔏','🔐','🗝',
    '🔨','⛏','⚒','🛠','🗡','⚔','🔫','🏹','🛡','🔧',
    // Row 8: Tools + Science (140-159)
    '🔩','⚙','🗜','⚖','🔗','⛓','🧰','🧲','🧪','🧫',
    '🧬','💉','🩸','💊','🩹','🩺','🚪','🛏','🛋','🪑',
    // Row 9: Home + Household (160-179)
    '🚽','🚿','🛁','🪒','🧴','🧷','🧹','🧺','🧻','🧼',
    '🧽','🧯','🛒','🚬','⚰','⚱','🗿','🏧','🚮','🚰',
    // Row 10: Signs (180-199)
    '♿','🚹','🚺','🚻','🚼','🚾','🛂','🛃','🛄','🛅',
    '⚠','🚸','⛔','🚫','🚳','🚭','🚯','🚱','🚷','📵',
    // Row 11: Warning + Arrows (200-219)
    '🔞','☢','☣','⬆','↗','➡','↘','⬇','↙','⬅',
    '↖','↕','↔','↩','↪','⤴','⤵','🔃','🔄','🔙',
    // Row 12: Navigation + Religion (220-239)
    '🔚','🔛','🔜','🔝','🛐','⚛','🕉','✡','☸','☯',
    '✝','☦','☪','☮','🕎','🔯','♈','♉','♊','♋',
    // Row 13: Zodiac + Media controls (240-255)
    '♌','♍','♎','♏','♐','♑','♒','♓','⛎','🔀',
    '🔁','🔂','▶','⏩','⏭','⏯',
];

// Verify uniqueness at load time
const _verifySet = new Set(EMOJI_ALPHABET);
if (_verifySet.size !== 256) {
    console.error(`Emoji alphabet has duplicates: ${256 - _verifySet.size} duplicate entries`);
}

// Build reverse map: emoji → byte value
const _emojiToByte = new Map();
EMOJI_ALPHABET.forEach((emoji, i) => {
    if (_emojiToByte.has(emoji)) {
        console.warn(`Duplicate emoji at index ${i}: ${emoji}`);
    }
    _emojiToByte.set(emoji, i);
});

export default class EmojiEncoder {
    static get id()    { return 'emoji'; }
    static get label() { return 'Эмодзи'; }
    static get icon()  { return '😀'; }

    static capacity(textLength) {
        // 8 bits per emoji character
        return textLength * 8;
    }

    /**
     * Encode bytes as emoji
     * @param {Uint8Array} bytes
     * @returns {string}
     */
    static encode(bytes) {
        if (!bytes || bytes.length === 0) return MAGIC;

        let result = MAGIC;
        for (const b of bytes) {
            if (b >= EMOJI_ALPHABET.length) {
                // Should never happen since b is 0-255 and alphabet has 256 entries
                result += EMOJI_ALPHABET[0];
            } else {
                result += EMOJI_ALPHABET[b];
            }
        }
        return result;
    }

    /**
     * Decode emoji text back to bytes
     * @param {string} text
     * @returns {Uint8Array|null}
     */
    static decode(text) {
        if (!text || !text.startsWith(MAGIC)) return null;

        const data = text.slice(MAGIC.length);
        if (data.length === 0) return new Uint8Array(0);

        const bytes = [];
        // Iterate using codepoint-aware splitting
        // Emojis can be 1-2 UTF-16 code units
        let i = 0;
        while (i < data.length) {
            let matched = false;
            // Try matching longest first (up to 4 UTF-16 code units for complex emojis)
            for (let len = Math.min(4, data.length - i); len >= 1; len--) {
                const candidate = data.substring(i, i + len);
                const byteVal = _emojiToByte.get(candidate);
                if (byteVal !== undefined) {
                    bytes.push(byteVal);
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Skip unknown character (might be variation selector, etc.)
                i++;
            }
        }

        return bytes.length > 0 ? new Uint8Array(bytes) : null;
    }

    /**
     * Detect emoji encoding
     * @param {string} text
     * @returns {boolean}
     */
    static detect(text) {
        if (!text) return false;
        return text.startsWith(MAGIC);
    }
}
