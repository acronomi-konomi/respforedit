/**
 * Stego Analyzer — Real-time carrier text analysis with auto channel detection
 *
 * ## Core Concept
 * Instead of manually toggling channels, the system auto-detects which channels
 * have capacity in the current carrier text. Both encoder and decoder use the
 * SAME analysis logic, so they stay synchronized and deterministic.
 *
 * ## Features
 * - Auto-detects active channels from carrier text
 * - Highlights modifiable words/positions with per-channel colors
 * - Generates highlighted HTML preview
 * - Provides capacity info per channel and per position
 * - Supports hover tooltips with capacity details
 * - Debounced analysis for real-time use
 */

// Channel color scheme — bright, distinct, readable on dark background
const CHANNEL_COLORS = {
    'letter-stego':  { bg: 'rgba(245,158,11,.25)',  border: '#f59e0b', text: '#fbbf24', label: 'Буквенное стего' },
    'synonyms':      { bg: 'rgba(6,182,212,.25)',    border: '#06b6d4', text: '#22d3ee', label: 'Синонимы' },
    'punctuation':   { bg: 'rgba(236,72,153,.25)',   border: '#ec4899', text: '#f472b6', label: 'Пунктуация' },
    'dates':         { bg: 'rgba(168,85,247,.25)',   border: '#a855f7', text: '#c084fc', label: 'Даты' },
    'typos':         { bg: 'rgba(249,115,22,.25)',   border: '#f97316', text: '#fb923c', label: 'Опечатки' },
    'duplets':       { bg: 'rgba(132,204,22,.25)',   border: '#84cc16', text: '#a3e635', label: 'Дублеты' },
    'abbreviations': { bg: 'rgba(14,165,233,.25)',   border: '#0ea5e9', text: '#38bdf8', label: 'Аббревиатуры' },
    'spaces':        { bg: 'rgba(251,113,133,.25)',  border: '#fb7185', text: '#fda4af', label: 'Пробелы' },
    'phones':        { bg: 'rgba(34,197,94,.25)',    border: '#22c55e', text: '#4ade80', label: 'Телефоны' },
    'urls':          { bg: 'rgba(99,102,241,.25)',   border: '#6366f1', text: '#818cf8', label: 'URL' },
    'emails':        { bg: 'rgba(244,63,94,.25)',    border: '#f43f5e', text: '#fb7185', label: 'Email' },
    'yo':            { bg: 'rgba(52,211,153,.25)',   border: '#34d399', text: '#6ee7b7', label: 'Е/Ё' },
};

// Channels that are always auto-detected (deterministic — both encoder and decoder
// see the same positions from the text). These CANNOT be manually toggled.
// NOTE: Must match StegoEngine._setDefaultChannels() active channel list.
const AUTO_CHANNELS = [
    'punctuation', 'dates',
    'typos', 'duplets', 'abbreviations', 'spaces', 'synonyms',
    'phones', 'urls', 'emails',
    'letter-stego',
];

// Channels that modify existing content (deterministic decode)
// vs channels that INSERT content (non-deterministic — excluded from auto-detect)
const INSERT_CHANNELS = new Set([
    'wordOrder', 'zeroWidth', 'parasites', 'phrases',
    'voice', 'participles', 'numbers', 'case', 'smiles',
]);

export class StegoAnalyzer {
    constructor(stegoEngine) {
        this.engine = stegoEngine;
        this._debounceTimer = null;
        this._debounceDelay = 350; // ms
        this._lastResult = null;
        this._onChange = null; // callback
        this._analyzing = false; // true while analysis is running
        this._analysisVersion = 0; // increment to cancel stale analysis
    }

    /**
     * Set callback for when analysis results change
     * @param {(result: AnalysisResult) => void} callback
     */
    onChange(callback) {
        this._onChange = callback;
    }

    /**
     * Trigger analysis with debounce (runs async to avoid UI blocking)
     * @param {string} text - carrier text
     */
    analyzeDebounced(text) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._runAnalysisAsync(text);
        }, this._debounceDelay);
    }

    /**
     * Returns true if analysis is currently running
     */
    isAnalyzing() {
        return this._analyzing;
    }

    /**
     * Trigger analysis immediately (no debounce)
     * @param {string} text
     * @returns {AnalysisResult}
     */
    analyzeSync(text) {
        clearTimeout(this._debounceTimer);
        this._runAnalysis(text);
        return this._lastResult;
    }

    /**
     * Get last analysis result
     * @returns {AnalysisResult|null}
     */
    getLastResult() {
        return this._lastResult;
    }

    /**
     * Get the list of auto-detected channel names that have capacity
     * This is used by both encoder and decoder to stay synchronized.
     * @param {string} text
     * @returns {string[]} channel names in deterministic order
     */
    getAutoChannels(text) {
        if (!text || !this.engine) return [];

        const result = this._computeAnalysis(text);
        // Return in FIXED AUTO_CHANNELS order (deterministic), not sorted by bits
        const activeChannelNames = new Set(
            result.channels.filter(ch => ch.bits > 0).map(ch => ch.name)
        );
        return AUTO_CHANNELS.filter(name => activeChannelNames.has(name));
    }

    // ─── Internal ────────────────────────────────────────────

    /**
     * Run analysis asynchronously, processing one channel at a time
     * with yields to the event loop between channels.
     * This prevents UI freezing on large texts.
     */
    async _runAnalysisAsync(text) {
        const version = ++this._analysisVersion;
        this._analyzing = true;
        if (this._onProgress) this._onProgress(true);

        try {
            // Initial yield so the browser can paint the progress indicator
            await this._yield();
            if (version !== this._analysisVersion) return;

            const result = await this._computeAnalysisChunked(text, version);

            // Cancelled by a newer analysis?
            if (version !== this._analysisVersion) return;
            this._lastResult = result;
            if (this._onChange) {
                this._onChange(result);
            }
        } finally {
            if (version === this._analysisVersion) {
                this._analyzing = false;
                if (this._onProgress) this._onProgress(false);
            }
        }
    }

    /**
     * Yield to the event loop so the browser can process UI events and paint.
     */
    _yield() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Compute analysis one channel at a time, yielding between channels.
     * This keeps the UI responsive even on large texts.
     */
    async _computeAnalysisChunked(text, version) {
        if (!text || !this.engine) {
            return this._emptyResult();
        }

        const channels = [];
        const allPositions = [];
        let totalBits = 0;

        // Analyze each auto-detectable channel, yielding between them
        for (const chName of AUTO_CHANNELS) {
            // Yield before each channel so the browser can process UI events
            await this._yield();
            // Cancelled by a newer analysis?
            if (version !== this._analysisVersion) return this._emptyResult();

            const channel = this.engine.channels[chName];
            if (!channel || !channel.loaded && channel.loaded !== undefined && !channel.loaded) continue;

            try {
                const analysis = channel.analyzeCapacity(text);
                if (!analysis || analysis.totalBits <= 0) continue;

                const color = CHANNEL_COLORS[chName] || { bg: 'rgba(255,255,255,.1)', border: '#888', text: '#aaa', label: chName };

                channels.push({
                    name: chName,
                    label: color.label,
                    color: color,
                    bits: Math.round(analysis.totalBits * 100) / 100,
                    positions: analysis.positions ? analysis.positions.length : 0,
                    bases: analysis.bases,
                });

                totalBits += analysis.totalBits;

                // Collect positions for highlighting
                if (analysis.positions) {
                    for (const pos of analysis.positions) {
                        const start = pos.index;
                        let end, word;

                        if (pos.length) {
                            end = start + pos.length;
                            word = text.slice(start, end);
                        } else if (pos.word) {
                            word = pos.word;
                            end = start + word.length;
                        } else {
                            end = start + 1;
                            word = text.slice(start, end);
                        }

                        const bitsThis = pos.bits !== undefined
                            ? pos.bits
                            : (pos.variants ? Math.log2(pos.variants) : 1);
                        const tooltip = this._buildTooltip(chName, color.label, word, bitsThis, pos);

                        allPositions.push({
                            start,
                            end,
                            channel: chName,
                            bits: bitsThis,
                            tooltip,
                            priority: chName === 'letter-stego' ? 10 : (chName === 'synonyms' ? 5 : 1),
                            word,
                        });
                    }
                }
            } catch (e) {
                // Channel analysis failed — skip
            }
        }

        // Sort channels by bits descending
        channels.sort((a, b) => b.bits - a.bits);

        // Resolve overlaps: higher priority wins
        const resolvedPositions = this._resolveOverlaps(allPositions);

        // Generate highlighted HTML
        const highlightedHTML = this._generateHighlightedHTML(text, resolvedPositions);

        return {
            channels,
            totalBits: Math.round(totalBits * 100) / 100,
            capacityBytes: Math.floor(totalBits / 8),
            positions: resolvedPositions,
            highlightedHTML,
            text,
        };
    }

    /**
     * Set callback for analysis progress state
     * @param {(analyzing: boolean) => void} callback
     */
    onProgress(callback) {
        this._onProgress = callback;
    }

    _runAnalysis(text) {
        const result = this._computeAnalysis(text);
        this._lastResult = result;
        if (this._onChange) {
            this._onChange(result);
        }
    }

    _computeAnalysis(text) {
        if (!text || !this.engine) {
            return this._emptyResult();
        }

        const channels = [];
        const allPositions = []; // {start, end, channel, bits, tooltip, priority}
        let totalBits = 0;

        // Analyze each auto-detectable channel
        for (const chName of AUTO_CHANNELS) {
            const channel = this.engine.channels[chName];
            if (!channel || !channel.loaded && channel.loaded !== undefined && !channel.loaded) continue;

            try {
                const analysis = channel.analyzeCapacity(text);
                if (!analysis || analysis.totalBits <= 0) continue;

                const color = CHANNEL_COLORS[chName] || { bg: 'rgba(255,255,255,.1)', border: '#888', text: '#aaa', label: chName };

                channels.push({
                    name: chName,
                    label: color.label,
                    color: color,
                    bits: Math.round(analysis.totalBits * 100) / 100,
                    positions: analysis.positions ? analysis.positions.length : 0,
                    bases: analysis.bases,
                });

                totalBits += analysis.totalBits;

                // Collect positions for highlighting
                if (analysis.positions) {
                    for (const pos of analysis.positions) {
                        const start = pos.index;
                        // Determine length/endpoint
                        let end, word;

                        if (pos.length) {
                            end = start + pos.length;
                            word = text.slice(start, end);
                        } else if (pos.word) {
                            word = pos.word;
                            end = start + word.length;
                        } else {
                            // For channels like 'spaces' where the position is a single char
                            end = start + 1;
                            word = text.slice(start, end);
                        }

                        // Build tooltip
                        const bitsThis = pos.bits !== undefined
                            ? pos.bits
                            : (pos.variants ? Math.log2(pos.variants) : 1);
                        const tooltip = this._buildTooltip(chName, color.label, word, bitsThis, pos);

                        allPositions.push({
                            start,
                            end,
                            channel: chName,
                            bits: bitsThis,
                            tooltip,
                            priority: chName === 'letter-stego' ? 10 : (chName === 'synonyms' ? 5 : 1),
                            word,
                        });
                    }
                }
            } catch (e) {
                // Channel analysis failed — skip
            }
        }

        // Sort channels by bits descending
        channels.sort((a, b) => b.bits - a.bits);

        // Resolve overlaps: higher priority wins; for same position, keep both if they're the same span
        const resolvedPositions = this._resolveOverlaps(allPositions);

        // Generate highlighted HTML
        const highlightedHTML = this._generateHighlightedHTML(text, resolvedPositions);

        return {
            channels,
            totalBits: Math.round(totalBits * 100) / 100,
            capacityBytes: Math.floor(totalBits / 8),
            positions: resolvedPositions,
            highlightedHTML,
            text,
        };
    }

    _emptyResult() {
        return {
            channels: [],
            totalBits: 0,
            capacityBytes: 0,
            positions: [],
            highlightedHTML: '',
            text: '',
        };
    }

    _buildTooltip(chName, label, word, bits, pos) {
        const parts = [`📍 ${label}`, `💬 "${word}"`, `📊 ${bits.toFixed(1)} бит`];

        if (pos.variants) {
            parts.push(`🔀 ${pos.variants} вариантов`);
        }
        if (pos.synset && pos.synset.length > 1) {
            parts.push(`📋 Синонимы: ${pos.synset.slice(0, 5).join(', ')}${pos.synset.length > 5 ? '…' : ''}`);
        }
        if (chName === 'letter-stego' && pos.valid) {
            parts.push(`✏️ ${pos.valid.length} мутаций`);
        }

        return parts.join('\n');
    }

    /**
     * Resolve overlapping positions. Higher priority channel wins.
     * For positions that are the same span but different channels, keep the higher priority one.
     */
    _resolveOverlaps(positions) {
        if (positions.length === 0) return [];

        // Sort by start position, then by priority (higher first)
        const sorted = [...positions].sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return b.priority - a.priority;
        });

        const result = [];
        let lastEnd = -1;

        for (const pos of sorted) {
            if (pos.start >= lastEnd) {
                // No overlap
                result.push(pos);
                lastEnd = pos.end;
            } else if (pos.priority > (result[result.length - 1]?.priority || 0)) {
                // Higher priority — replace previous
                result[result.length - 1] = pos;
                lastEnd = pos.end;
            }
            // Otherwise skip (lower priority overlap)
        }

        return result;
    }

    /**
     * Generate highlighted HTML from text and resolved positions.
     * Each position gets a <span> with channel-specific styling and data-tooltip.
     */
    _generateHighlightedHTML(text, positions) {
        if (positions.length === 0) {
            return this._escapeHtml(text);
        }

        let html = '';
        let lastEnd = 0;

        for (const pos of positions) {
            // Text before this position
            if (pos.start > lastEnd) {
                html += this._escapeHtml(text.slice(lastEnd, pos.start));
            }

            // The highlighted span — use data-tooltip instead of title (for JS tooltip)
            const color = CHANNEL_COLORS[pos.channel] || { bg: 'rgba(255,255,255,.1)', border: '#888' };
            const word = this._escapeHtml(text.slice(pos.start, pos.end));
            const tooltipAttr = this._escapeHtml(pos.tooltip).replace(/\n/g, '&#10;');

            html += `<span class="stego-hl stego-hl--${pos.channel}" `
                + `style="background:${color.bg};box-shadow:inset 0 -2px 0 0 ${color.border};" `
                + `data-channel="${pos.channel}" `
                + `data-bits="${pos.bits.toFixed(1)}" `
                + `data-tooltip="${tooltipAttr}"`
                + `>${word}</span>`;

            lastEnd = pos.end;
        }

        // Remaining text after last position
        if (lastEnd < text.length) {
            html += this._escapeHtml(text.slice(lastEnd));
        }

        return html;
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export default StegoAnalyzer;
