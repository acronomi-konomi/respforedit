/**
 * Управление пользовательским интерфейсом
 */

export class InterfaceManager {
    constructor(engine) {
        this.engine = engine;
        this.currentMode = 'encode';
        this.init();
    }

    init() {
        // Переключение режимов
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });

        // Обработчики каналов
        document.querySelectorAll('.channel-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateActiveChannels();
            });
        });

        // Мониторинг ввода
        const secretMessage = document.getElementById('secret-message');
        const carrierText = document.getElementById('carrier-text');

        secretMessage?.addEventListener('input', () => this.updateStats());
        carrierText?.addEventListener('input', () => this.updateStats());

        // Кнопки действий
        document.getElementById('btn-encode')?.addEventListener('click', () => this.handleEncode());
        document.getElementById('btn-decode')?.addEventListener('click', () => this.handleDecode());
        document.getElementById('btn-recovery')?.addEventListener('click', () => this.handleRecovery());
        document.getElementById('btn-copy')?.addEventListener('click', () => this.copyOutput());

        // ── Настройки синонимизации ──────────────────────────────────────────
        this._initSynonymSettings();

        // Обновляем активные каналы при загрузке
        this.updateActiveChannels();
    }

    _initSynonymSettings() {
        const synChannel = () => this.engine.channels['synonyms'];

        // Переключение режима (static / backend)
        document.querySelectorAll('.syn-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.synmode;
                document.querySelectorAll('.syn-mode-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                const ch = synChannel();
                if (ch) ch.setMode(mode);

                // Показываем/скрываем панели
                const thresholdRow  = document.getElementById('threshold-row');
                const backendUrlRow = document.getElementById('backend-url-row');
                const backendStatus = document.getElementById('backend-status');

                if (mode === 'backend') {
                    thresholdRow?.style && (thresholdRow.style.display = '');
                    backendUrlRow?.style && (backendUrlRow.style.display = '');
                    backendStatus?.style && (backendStatus.style.display = '');
                    this._checkBackend();
                } else {
                    thresholdRow?.style && (thresholdRow.style.display = 'none');
                    backendUrlRow?.style && (backendUrlRow.style.display = 'none');
                    backendStatus?.style && (backendStatus.style.display = 'none');
                }

                this.updateStats();
            });
        });

        // Слайдер порога косинусной близости
        const slider = document.getElementById('syn-threshold');
        const valLabel = document.getElementById('threshold-val');
        if (slider) {
            slider.addEventListener('input', async () => {
                const t = parseFloat(slider.value);
                if (valLabel) valLabel.textContent = t.toFixed(2);
                const ch = synChannel();
                if (ch) {
                    ch.setThreshold(t);
                    // В backend-режиме нужно заново загрузить синсеты для текущего текста
                    if (ch.mode === 'backend') {
                        const carrierText = document.getElementById('carrier-text')?.value || '';
                        if (carrierText) {
                            const statusEl = document.getElementById('backend-status');
                            if (statusEl) { statusEl.textContent = '⏳ Загрузка...'; statusEl.style.display = ''; }
                            await ch.prefetchSynsets(carrierText);
                            if (statusEl) { statusEl.textContent = '✅ Обновлено'; }
                        }
                    }
                }
                this.updateStats();
            });
        }

        // URL бэкенда
        const urlInput = document.getElementById('backend-url');
        if (urlInput) {
            urlInput.addEventListener('change', () => {
                const ch = synChannel();
                if (ch) ch.setBackendUrl(urlInput.value.trim());
            });
        }

        // Кнопка проверки бэкенда
        document.getElementById('btn-check-backend')?.addEventListener('click', () => {
            this._checkBackend();
        });

        // ── Настройки буквенного стего ───────────────────────────────────────
        this._initLetterStegoSettings();
    }

    _initLetterStegoSettings() {
        const letterCh = () => this.engine.channels['letter-stego'];

        const slider   = document.getElementById('letter-density');
        const valLabel = document.getElementById('density-val');

        if (slider) {
            slider.addEventListener('input', () => {
                const density = parseInt(slider.value) / 100;
                if (valLabel) valLabel.textContent = `${slider.value}%`;
                const ch = letterCh();
                if (ch) ch.setDensity(density);
                this.updateStats();
            });
        }
    }

    async _checkBackend() {
        const ch = this.engine.channels['synonyms'];
        const statusEl = document.getElementById('backend-status');
        if (!ch || !statusEl) return;

        // Обновляем URL если изменился
        const urlInput = document.getElementById('backend-url');
        if (urlInput) ch.setBackendUrl(urlInput.value.trim());

        statusEl.style.display = '';
        statusEl.textContent   = '⏳ Проверка...';
        statusEl.className     = 'backend-status checking';

        const ok = await ch.checkBackend();
        if (ok) {
            statusEl.textContent = '✅ Сервер доступен';
            statusEl.className   = 'backend-status ok';
        } else {
            statusEl.textContent = '❌ Сервер недоступен';
            statusEl.className   = 'backend-status error';
        }
    }

    switchMode(mode) {
        this.currentMode = mode;

        // Обновляем кнопки
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        // Показываем нужную панель
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.querySelector(`.${mode}-panel`).classList.add('active');
    }

    updateActiveChannels() {
        // Каналы полностью исключённые из активации:
        // - wordOrder: требует оригинал для decode
        // - zeroWidth: не лингвистический
        // - parasites/phrases/voice/participles/numbers/case: меняют слова из словаря синонимов
        //   → нарушают детерминизм (bases при encode ≠ bases при decode)
        const EXCLUDED = new Set([
            'wordOrder', 'zeroWidth',
            'parasites', 'phrases', 'voice', 'participles', 'numbers', 'case', 'smiles'
        ]);

        const activeChannels = [];
        document.querySelectorAll('.channel-toggle:checked').forEach(checkbox => {
            const name = checkbox.dataset.channel;
            if (!EXCLUDED.has(name)) activeChannels.push(name);
        });

        // Синонимы всегда первыми
        const synIdx = activeChannels.indexOf('synonyms');
        if (synIdx > 0) {
            activeChannels.splice(synIdx, 1);
            activeChannels.unshift('synonyms');
        }

        this.engine.setActiveChannels(activeChannels);
        this.updateStats();
    }

    updateStats() {
        const secretMessage = document.getElementById('secret-message')?.value || '';
        const carrierText   = document.getElementById('carrier-text')?.value || '';

        // Длина сообщения
        const secretBytes = this.engine.crypto
            ? this.engine.crypto.stringToBytes(secretMessage).length
            : new TextEncoder().encode(secretMessage).length;
        document.getElementById('secret-length').textContent = secretMessage.length;
        document.getElementById('secret-bytes').textContent  = secretBytes;

        if (carrierText && this.engine.activeChannels.length > 0) {
            try {
                // Реальная ёмкость через движок (только активные каналы)
                const analysis     = this.engine.analyzeCarrier(carrierText);
                const capacityBits = Math.floor(analysis.totalBits);

                // Требуется: байты шифротекста × 8
                // overhead = magic(2) + len(1) = 3 байта
                const encryptedBytes = secretBytes + 3;
                const requiredBits   = encryptedBytes * 8;

                document.getElementById('carrier-capacity').textContent = capacityBits;
                document.getElementById('required-capacity').textContent = requiredBits;

                const statusElem = document.getElementById('capacity-status');
                if (capacityBits >= requiredBits) {
                    statusElem.textContent = 'Достаточно';
                    statusElem.className   = 'status success';
                } else {
                    statusElem.textContent = 'Недостаточно';
                    statusElem.className   = 'status error';
                }
            } catch (e) {
                console.error('Analysis error:', e);
            }
        }
    }

    async handleEncode() {
        const secretMessage = document.getElementById('secret-message').value;
        const carrierText   = document.getElementById('carrier-text').value;
        const password      = document.getElementById('password-encode').value;

        if (!secretMessage || !carrierText || !password) {
            alert('Заполните все поля!');
            return;
        }

        if (carrierText.length < 20) {
            alert('Текст-носитель слишком короткий. Введите хотя бы 20 символов.');
            return;
        }

        const btn = document.getElementById('btn-encode');
        const origText = btn.textContent;
        btn.textContent = '⏳ Кодирование...';
        btn.disabled = true;

        try {
            const stegoText = await this.engine.encodeMessage(secretMessage, carrierText, password);
            document.getElementById('output-text').value = stegoText;

            // Обновляем статистику
            const stats = this.engine.getStats();
            const statChannels = document.getElementById('stat-channels');
            const statBits     = document.getElementById('stat-bits');
            const statEff      = document.getElementById('stat-efficiency');
            const statTime     = document.getElementById('stat-time');
            if (statChannels) statChannels.textContent = stats.channels;
            if (statBits)     statBits.textContent     = stats.bits.toFixed ? stats.bits.toFixed(0) : stats.bits;
            if (statEff)      statEff.textContent       = stats.efficiency + '%';
            if (statTime)     statTime.textContent      = stats.time + ' мс';
        } catch (e) {
            alert('❌ Ошибка кодирования: ' + e.message);
            console.error(e);
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    }

    async handleDecode() {
        const stegoText = document.getElementById('stego-text').value;
        const password  = document.getElementById('password-decode').value;

        if (!stegoText || !password) {
            alert('Заполните все поля!');
            return;
        }

        const btn = document.getElementById('btn-decode');
        const origBtnText = btn.textContent;
        btn.textContent = '⏳ Декодирование...';
        btn.disabled = true;

        try {
            // Только стего-текст и пароль — оригинал НЕ нужен!
            const message = await this.engine.decodeMessage(stegoText, password);
            document.getElementById('decoded-message').value = message;
        } catch (e) {
            alert('❌ Ошибка декодирования: ' + e.message);
            console.error(e);
        } finally {
            btn.textContent = origBtnText;
            btn.disabled = false;
        }
    }

    async handleRecovery() {
        alert('Функция восстановления в разработке');
    }

    copyOutput() {
        const output = document.getElementById('output-text');
        output.select();
        document.execCommand('copy');
        alert('📋 Текст скопирован в буфер обмена!');
    }
}

export default InterfaceManager;