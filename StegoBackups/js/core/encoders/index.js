/**
 * Encoders Index
 * Exports all clean encryption encoders and provides detection/lookup utilities.
 */

import InvisibleSpacesEncoder from './invisible-spaces.js';
import Base64Encoder from './base64-encoder.js';
import CompressionEncoder from './compression-encoder.js';
import EmojiEncoder from './emoji-encoder.js';
import ChineseEncoder from './chinese-encoder.js';
import LayoutSwitchEncoder from './layout-switch-encoder.js';

export const ENCODERS = [
    InvisibleSpacesEncoder,
    Base64Encoder,
    CompressionEncoder,
    EmojiEncoder,
    ChineseEncoder,
    LayoutSwitchEncoder,
];

/**
 * Get encoder by its ID
 * @param {string} id
 * @returns {Object|null}
 */
export function getEncoderById(id) {
    return ENCODERS.find(e => e.id === id) || null;
}

/**
 * Auto-detect which encoder was used for a given text
 * Tries each encoder's detect() method in order.
 * @param {string} text
 * @returns {Object|null} The encoder class, or null if no match
 */
export function detectEncoder(text) {
    if (!text) return null;

    // Priority order: check magic prefixes first (most reliable)
    for (const encoder of ENCODERS) {
        try {
            if (encoder.detect(text)) return encoder;
        } catch (e) {
            console.warn(`Encoder ${encoder.id} detect error:`, e);
        }
    }

    return null;
}

/**
 * Get all encoder metadata (for UI display)
 * @returns {Array<{id: string, label: string, icon: string}>}
 */
export function getEncoderList() {
    return ENCODERS.map(e => ({
        id: e.id,
        label: e.label,
        icon: e.icon,
    }));
}

export default ENCODERS;
