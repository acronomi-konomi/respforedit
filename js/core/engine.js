/**
 * Главный движок системы стеганографии
 *
 * ## Архитектура Mixed-Radix Numeral System
 *
 * Каждая позиция в тексте — это "цифра" в системе счисления с основанием N
 * (N = количество вариантов для данной позиции).
 *
 * Пример:
 *   bases = [3, 2, 5, 4, ...]  ← основания от каждого канала
 *   maxValue = 3 × 2 × 5 × 4 × ...
 *   M = BigInt(encrypted_bytes)  ← число для кодирования (M < maxValue)
 *
 *   encode: i0 = M % 3, M = M / 3
 *           i1 = M % 2, M = M / 2
 *           i2 = M % 5, M = M / 5  ...
 *
 *   decode: M = i0 + 3*(i1 + 2*(i2 + 5*(i3 + ...)))
 *
 * ## Принцип детерминизма
 *
 * Для корректного decode без оригинала необходимо:
 * 1. analyzeCapacity(stegoText) возвращает ТЕ ЖЕ bases что analyzeCapacity(originalText)
 * 2. Каждый канал decode(stegoText) возвращает ТЕ ЖЕ индексы что были вложены при encode
 *
 * Это достигается через:
 * - Синонимы: canonical synset (алф.сортировка) + симуляция decode при encode
 * - Другие каналы: работают с фиксированными паттернами (даты, е↔ё, дефис и т.п.)
 */

import MixedRadixEncoder from './mixed-radix.js';
import CryptoEngine from './crypto.js';
import RussianMorphology from './morphology.js';

import SynonymChannel from '../channels/synonyms.js';
import YoReplacementChannel from '../channels/yo-replacement.js';
import PunctuationChannel from '../channels/punctuation.js';
import WordOrderChannel from '../channels/word-order.js';
import NumbersChannel from '../channels/numbers.js';
import ParasitesChannel from '../channels/parasites.js';
import AbbreviationsChannel from '../channels/abbreviations.js';
import DupletsChannel from '../channels/duplets.js';
import DatesChannel from '../channels/dates.js';
import SpacesChannel from '../channels/spaces.js';
import CaseChannel from '../channels/case.js';
import TyposChannel from '../channels/typos.js';
import SmilesChannel from '../channels/smiles.js';
import VoiceChannel from '../channels/voice.js';
import ParticiplesChannel from '../channels/participles.js';
import PhrasesChannel from '../channels/phrases.js';
import ZeroWidthChannel from '../channels/zero-width.js';
import { LetterStegoChannel } from '../channels/letter-stego.js';

export class StegoEngine {
    constructor() {
        this.mixedRadix  = new MixedRadixEncoder();
        this.crypto      = new CryptoEngine();
        this.morphology  = new RussianMorphology();
        this.zeroWidth   = new ZeroWidthChannel();
        this.channels    = {};
        this.activeChannels = [];
        this.stats       = {};
    }

    registerChannel(channel) {
        this.channels[channel.name] = channel;
    }

    setActiveChannels(channelNames) {
        this.activeChannels = channelNames
            .map(name => this.channels[name])
            .filter(Boolean);
    }

    async loadChannels(basePath = '') {
        const dataPath = basePath ? `${basePath}/data` : './data';
        const libPath  = basePath ? `${basePath}/lib/dicts` : './lib/dicts';

        await this.morphology.init(libPath);

        // Синонимы
        const synonyms = new SynonymChannel(this.morphology);
        await synonyms.loadDictionary(`${dataPath}/synonyms.json`);
        this.registerChannel(synonyms);

        // Структурные каналы (работают с фиксированными паттернами)
        this.registerChannel(new YoReplacementChannel());
        this.registerChannel(new PunctuationChannel());
        this.registerChannel(new DatesChannel());
        this.registerChannel(new TyposChannel());

        // Канал детерминированных буквенных мутаций (letter-stego v3)
        // НЕ требует морфологии — детерминизм через паттерн seed→мутация
        const letterStego = new LetterStegoChannel();
        await letterStego.loadDictionary(`${dataPath}/synonyms.json`);
        this.registerChannel(letterStego);
        this.registerChannel(new SpacesChannel());

        const duplets = new DupletsChannel();
        await duplets.loadDictionary(`${dataPath}/duplets.json`);
        this.registerChannel(duplets);

        const abbreviations = new AbbreviationsChannel();
        await abbreviations.loadDictionary(`${dataPath}/abbreviations.json`);
        this.registerChannel(abbreviations);

        // Остальные каналы (пока отключены — нарушают детерминизм синонимов)
        this.registerChannel(new WordOrderChannel());
        this.registerChannel(this.zeroWidth);
        this.registerChannel(new NumbersChannel(this.morphology));
        this.registerChannel(new CaseChannel(this.morphology));
        this.registerChannel(new SmilesChannel());

        const voice = new VoiceChannel(this.morphology);
        await voice.loadDictionary(`${dataPath}/voice-forms.json`);
        this.registerChannel(voice);

        const participles = new ParticiplesChannel(this.morphology);
        await participles.loadDictionary(`${dataPath}/participles.json`);
        this.registerChannel(participles);

        const parasites = new ParasitesChannel();
        await parasites.loadDictionary(`${dataPath}/parasites.json`);
        this.registerChannel(parasites);

        const phrases = new PhrasesChannel();
        await phrases.loadDictionary(`${dataPath}/phrases.json`);
        this.registerChannel(phrases);

        // По умолчанию: только безопасные каналы
        // Синонимы ПЕРВЫЕ — они анализируют оригинал до любых изменений
        this._setDefaultChannels();

        console.log('✅ Channels:', Object.keys(this.channels).join(', '));
        console.log('✅ Active:', this.activeChannels.map(c => c.name).join(', '));
    }

    _setDefaultChannels() {
        // Безопасные каналы: не меняют слова из словаря синонимов
        // → analyzeCapacity(stego).bases === analyzeCapacity(original).bases
        // Безопасные каналы = работают с позициями которые синонимы не затрагивают:
        // - punctuation: тире/кавычки (не слова)
        // - dates: форматы дат (числа)
        // - typos: всё-таки (фразы с дефисом, не в словаре синонимов)
        // - duplets: блогер/блоггер (орфографические варианты, не синонимы)
        // - abbreviations: РФ (аббревиатуры, не обычные слова)
        // - spaces: NBSP (невидимые символы)
        // - synonyms: ПОСЛЕДНИЙ (после всех структурных)
        //
        // НЕ включаем yo: белый список пересекается со словарём синонимов
        // (создаётся/создаётся и т.д. могут быть заменены синонимами)
        const safe = [
            // letter-stego ПЕРВЫМ — encode: мутации до синонимов; decode: restore до синонимов
            'letter-stego',
            'punctuation',    // тире, кавычки (не слова)
            'dates',          // формат дат (числа)
            'typos',          // всё-таки ↔ всё таки (фразы с дефисом)
            'duplets',        // блогер ↔ блоггер (орфографические варианты)
            'abbreviations',  // РФ ↔ Российская Федерация (аббревиатуры)
            'spaces',         // NBSP (невидимые пробелы)
            'synonyms',       // ПОСЛЕДНИМ (зависит от слов текста)
        ].filter(name => this.channels[name]);
        this.setActiveChannels(safe);
    }

    getMorphology() { return this.morphology; }

    /**
     * Анализ ёмкости текста-носителя.
     *
     * Важно: синонимы должны анализировать ОРИГИНАЛЬНЫЙ текст.
     * Поэтому analyzeCarrier всегда вызывается на одном тексте.
     */
    analyzeCarrier(text, letterStegoText = null) {
        /**
         * Анализ ёмкости текста-носителя.
         *
         * letterStegoText: если задан, то bases для letter-stego канала
         * вычисляются от этого текста (финальный стего при encode,
         * или stegoText при decode). Остальные каналы используют text.
         */
        let totalBits = 0;
        const allBases = [];
        const channelStats = {};

        for (const channel of this.activeChannels) {
            try {
                // letter-stego работает с другим текстом (финальным стего)
                const analysisText = (channel.name === 'letter-stego' && letterStegoText !== null)
                    ? letterStegoText
                    : text;
                const analysis = channel.analyzeCapacity(analysisText);
                totalBits += analysis.totalBits;
                allBases.push(...analysis.bases);
                channelStats[channel.name] = {
                    bits:      analysis.totalBits,
                    positions: analysis.positions ? analysis.positions.length : analysis.bases.length
                };
            } catch (e) {
                console.warn(`Channel ${channel.name} analyzeCapacity error:`, e);
            }
        }

        this.mixedRadix.setBases(allBases);
        return { totalBits, capacityBytes: Math.floor(totalBits / 8), channels: channelStats, bases: allBases };
    }

    /**
     * Кодирование сообщения через Mixed-Radix Numeral System.
     *
     * Алгоритм:
     * 1. Шифруем → получаем байты E
     * 2. M = BigInt(E)
     * 3. Для каждой позиции: index = M % base; M = M / base
     * 4. Каждый канал получает свои индексы и применяет замены
     *
     * Синонимы работают первыми и анализируют оригинальный текст.
     * Это гарантирует что их bases при encode == bases при decode.
     */
    async encodeMessage(secretMessage, carrierText, password) {
        const startTime = Date.now();

        // 0. Если синонимы в режиме backend — prefetch синсетов
        const synCh = this.channels['synonyms'];
        if (synCh && synCh.mode === 'backend') {
            await synCh.prefetchSynsets(carrierText);
        }

        // 1. Шифруем
        const msgBytes  = this.crypto.stringToBytes(secretMessage);
        const encrypted = await this.crypto.encrypt(msgBytes, password);

        // 2. Анализируем носитель (оригинальный текст)
        const capacity = this.analyzeCarrier(carrierText);

        if (this.mixedRadix.maxValue === 0n) {
            const channelInfo = this.activeChannels.map(c => {
                try {
                    const a = c.analyzeCapacity(carrierText);
                    return `${c.name}:${a.bases.length}позиций`;
                } catch(e) { return `${c.name}:ошибка`; }
            }).join(', ');
            throw new Error(`Нет ёмкости для кодирования.\nАктивные каналы: ${channelInfo || 'нет'}\nПопробуйте более длинный текст-носитель или включите больше каналов.`);
        }

        // 3. M = BigInt(encrypted)
        const M = this.mixedRadix.bytesToBigInt(encrypted);

        if (M >= this.mixedRadix.maxValue) {
            const needed    = Math.ceil(encrypted.length * 8);
            const available = this.mixedRadix.getCapacityBits();
            throw new Error(
                `Текст-носитель слишком мал.\nНужно: ~${needed} бит, доступно: ${available} бит.\n` +
                `Используйте более длинный текст-носитель.`
            );
        }

        // 4. Mixed-radix encode: i_k = M_k % base_k, M_{k+1} = M_k / base_k
        const indices = this.mixedRadix.encode(M);

        // 5. Применяем каналы в два прохода:
        //
        // ПРОХОД 1: структурные каналы (yo, dates, typos и т.д.) на ОРИГИНАЛЕ
        //   → они видят оригинальный текст, их позиции детерминированы
        //   → decode этих каналов тоже будет на стего-тексте где синонимы применены
        //   → ПРОБЛЕМА: синонимы могут изменить слова где есть е/ё и т.д.
        //
        // ПРАВИЛЬНЫЙ ПОРЯДОК: структурные ПЕРВЫМИ, синонимы ПОСЛЕДНИМИ
        //   encode: structural(original) → structural_text → synonyms(structural_text) → stego
        //   decode: synonyms.decode(stego) [читают свои позиции]
        //           structural.decode(stego) [читают свои позиции в структурном слое]
        //
        // Но structural.decode(stego) видит уже изменённые синонимами слова!
        // Поэтому нужно читать structural позиции из ОРИГИНАЛЬНОГО слоя стего-текста
        // (т.е. из текста до синонимных замен).
        //
        // Решение: сначала structural, потом synonyms. При decode — аналогично.
        // structural каналы не затрагивают синонимные слова (е↔ё, даты, дефисы).

        // Порядок encode: структурные → синонимы
        // Порядок decode: структурные → синонимы (тот же!)
        //
        // Ключевое: каждый канал анализирует ОРИГИНАЛЬНЫЙ текст (carrierText)
        // чтобы определить свои позиции. Это гарантирует что при decode
        // analyzeCapacity(stegoText) даст те же позиции (синонимы не трогают
        // позиции структурных каналов — даты, пунктуацию, дефисы и т.д.)
        // Encode: letter-stego идёт ПЕРВЫМ (до синонимов) чтобы seed-слова не были изменены синонимами.
        // Остальные каналы идут после.
        const lsChEnc = this.activeChannels.find(c => c.name === 'letter-stego');
        const otherChannels = this.activeChannels.filter(c => c.name !== 'letter-stego');

        let result = carrierText;
        let offset = 0;

        // Шаг 1: letter-stego первым (на оригинальном тексте)
        if (lsChEnc) {
            try {
                // Смещение letter-stego в bases — он первый → offset=0
                // (но в analyzeCarrier он мог быть в другом порядке — нужно согласовать)
                // Мы добавим letter-stego ПЕРВЫМ в bases при analyzeCarrier через setActiveChannels
                const lsAnalysis = lsChEnc.analyzeCapacity(carrierText);
                const lsCount    = lsAnalysis.bases.length;
                result = lsChEnc.encode(result, indices.slice(0, lsCount));
                offset = lsCount;
            } catch (e) {
                console.warn('letter-stego encode error:', e);
            }
        }

        // Шаг 2: остальные каналы на тексте (после letter-stego мутаций)
        for (const channel of otherChannels) {
            try {
                // analyzeCapacity на оригинальном тексте (детерминизм decode)
                const analysis = channel.analyzeCapacity(carrierText);
                const count    = analysis.bases.length;
                result = channel.encode(result, indices.slice(offset, offset + count));
                offset += count;
            } catch (e) {
                console.warn(`Channel ${channel.name} encode error:`, e);
            }
        }

        const endTime = Date.now();
        this.stats = {
            channels:   this.activeChannels.length,
            bits:       capacity.totalBits,
            usedBits:   encrypted.length * 8,
            efficiency: capacity.totalBits > 0
                ? (encrypted.length * 8 / capacity.totalBits * 100).toFixed(1) : 0,
            time: Math.round(endTime - startTime)
        };

        return result;
    }

    /**
     * Декодирование сообщения только по стего-тексту (без оригинала).
     *
     * Работает потому что:
     * - analyzeCapacity(stegoText) даёт те же bases что analyzeCapacity(originalText)
     *   (гарантируется выбором безопасных каналов)
     * - channel.decode(stegoText) возвращает те же индексы что были вложены
     */
    async decodeMessage(stegoText, password) {
        const startTime = Date.now();

        // 0. Если синонимы в режиме backend — prefetch синсетов стего-текста
        const synCh = this.channels['synonyms'];
        if (synCh && synCh.mode === 'backend') {
            await synCh.prefetchSynsets(stegoText);
        }

        // 1. letter-stego декодируется ПЕРВЫМ из стего-текста
        //    затем restore убирает мутации → получаем текст для остальных каналов
        const lsChDec = this.activeChannels.find(c => c.name === 'letter-stego');
        let lsIndices = [];
        let textAfterRestore = stegoText;

        if (lsChDec) {
            try {
                lsIndices = lsChDec.decode(stegoText);
                textAfterRestore = lsChDec.restore(stegoText);
            } catch (e) {
                console.warn('letter-stego decode error:', e);
            }
        }

        // 2. Анализируем текст (после restore) для восстановления bases.
        // Порядок bases должен совпасть с encode:
        // - letter-stego: bases от carrierText = bases от textAfterRestore (seed-слова не тронуты)
        //   т.к. при encode letter-stego применялся первым → синонимы не изменили seed-слова
        // - другие каналы: analyzeCapacity(stego_без_мутаций) должно совпасть
        this.analyzeCarrier(textAfterRestore);

        // 3. Извлекаем все индексы в правильном порядке (как при encode)
        const allIndices = [];

        // letter-stego первым (как в activeChannels и как в encode)
        if (lsChDec) allIndices.push(...lsIndices);

        // Затем остальные каналы
        for (const channel of this.activeChannels) {
            if (channel.name === 'letter-stego') continue;
            try {
                allIndices.push(...channel.decode(textAfterRestore));
            } catch (e) {
                console.warn(`Channel ${channel.name} decode error:`, e);
            }
        }

        // 3. Выравниваем длину
        const expectedLen = this.mixedRadix.bases.length;
        while (allIndices.length < expectedLen) allIndices.push(0);
        if (allIndices.length > expectedLen) allIndices.splice(expectedLen);

        // 4. Mixed-radix decode → BigInt M
        const M = this.mixedRadix.decode(allIndices);

        // 5. BigInt → байты: перебираем размеры пока crypto.decrypt не вернёт валидные данные
        // (нужно из-за возможных ведущих нулей в M)
        const maxBytes  = Math.ceil(this.mixedRadix.getCapacityBits() / 8);
        const rawBytes  = this.mixedRadix.bigIntToBytes(M);
        let decrypted   = null;

        for (let trySize = 3; trySize <= maxBytes; trySize++) {
            const padded = new Uint8Array(trySize);
            // Вставляем rawBytes в конец (ведущие нули слева)
            const srcStart = rawBytes.length > trySize ? rawBytes.length - trySize : 0;
            const dstStart = trySize > rawBytes.length ? trySize - rawBytes.length : 0;
            padded.set(rawBytes.slice(srcStart), dstStart);
            try {
                decrypted = await this.crypto.decrypt(padded, password);
                break;
            } catch(e) { /* попробуем следующий размер */ }
        }

        if (!decrypted) throw new Error('Неверный пароль или повреждённые данные.');
        const message = this.crypto.bytesToString(decrypted);

        const endTime = Date.now();
        this.stats = {
            channels: this.activeChannels.length,
            bits:     this.mixedRadix.getCapacityBits(),
            time:     Math.round(endTime - startTime)
        };

        return message;
    }

    getChannelInfo() {
        return Object.entries(this.channels).map(([name, channel]) => ({
            name,
            active: this.activeChannels.includes(channel),
            safe:   ['synonyms','yo','punctuation','dates','typos','duplets','abbreviations','spaces'].includes(name),
            stats:  channel.getStats ? channel.getStats() : {}
        }));
    }

    getStats() { return this.stats; }
}

export default StegoEngine;
