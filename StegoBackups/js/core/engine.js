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
 *   encode: i0 = M % base0, M = M / base0
 *           i1 = M % base1, M = M / base1  ...
 *
 *   decode: M = i0 + base0*(i1 + base1*(i2 + base2*(i3 + ...)))
 *
 * ## Принцип детерминизма
 *
 * Для корректного decode без оригинала необходимо:
 * 1. analyzeCapacity(stegoText) возвращает ТЕ ЖЕ bases что analyzeCapacity(originalText)
 * 2. Каждый канал decode(stegoText) возвращает ТЕ ЖЕ индексы что были вложены при encode
 *
 * Это достигается через:
 * - Синонимы: canonical synset (алф.сортировка, все члены — ключи) + симуляция decode при encode
 * - Другие каналы: работают с фиксированными паттернами (даты, е↔ё, дефис и т.п.)
 * - letter-stego применяется ПОСЛЕДНИМ (после синонимов), decode — первым
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
import PhonesChannel from '../channels/phones.js';
import UrlsChannel from '../channels/urls.js';
import EmailsChannel from '../channels/emails.js';

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

        // Канал детерминированных буквенных мутаций (letter-stego v4)
        // Использует Az.Morph для поиска "safe" позиций
        // Инициализируется ПОСЛЕ morphology.init() — Az.Morph уже готов
        const letterStego = new LetterStegoChannel();
        await letterStego.loadDictionary(); // Uses Az.Morph directly, no file needed
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

        // Каналы высокой ёмкости: телефоны, URL, email
        const phones = new PhonesChannel();
        this.registerChannel(phones);

        const urls = new UrlsChannel();
        this.registerChannel(urls);

        const emails = new EmailsChannel();
        await emails.loadDictionary(`${dataPath}/dictionaries/email-names-compact.json`);
        this.registerChannel(emails);

        // По умолчанию: только безопасные каналы
        this._setDefaultChannels();

        console.log('✅ Channels:', Object.keys(this.channels).join(', '));
        console.log('✅ Active:', this.activeChannels.map(c => c.name).join(', '));
    }

    _setDefaultChannels() {
        // Порядок каналов ВАЖЕН для детерминизма:
        //
        // letter-stego ПОСЛЕДНИМ при encode → ПЕРВЫМ при decode.
        // Это гарантирует что:
        // 1. letter-stego видит текст ПОСЛЕ синонимов → его bases стабильны
        // 2. При decode: letter-stego restore → текст = carrierText + синонимы + пунктуация
        // 3. analyzeCarrier(textAfterRestore) даст те же bases что при encode
        //
        // Структурные каналы (punctuation, dates, typos, duplets, abbreviations, spaces)
        // не меняют слова → их bases не зависят от синонимов → стабильны.
        //
        // Синонимы используют canonical synset (все члены проиндексированы) →
        // getSynset работает для ЛЮБОГО члена → bases стабильны.
        const safe = [
            'punctuation',    // тире, кавычки (не слова)
            'dates',          // формат дат (числа)
            'typos',          // всё-таки ↔ всё таки (фразы с дефисом)
            'duplets',        // блогер ↔ блоггер (орфографические варианты)
            'abbreviations',  // РФ ↔ Российская Федерация (аббревиатуры)
            'spaces',         // NBSP (невидимые пробелы)
            'synonyms',       // синонимы (canonical synset, все члены — ключи)
            'phones',         // российские номера телефонов (формат)
            'emails',         // адреса электронной почты (имена, домены) — ДО urls!
            'urls',           // URL-адреса (параметры, протокол) — после emails, чтобы не ловить домены email
            // letter-stego ПОСЛЕДНИМ — анализирует текст после синонимов
            'letter-stego',
        ].filter(name => this.channels[name]);
        this.setActiveChannels(safe);
    }

    getMorphology() { return this.morphology; }

    /**
     * Анализ ёмкости текста-носителя.
     *
     * Все каналы анализируют ОДИН И ТОТ ЖЕ текст.
     * Это гарантирует что bases = f(text) — детерминированная функция.
     */
    analyzeCarrier(text) {
        let totalBits = 0;
        const allBases = [];
        const channelStats = {};

        for (const channel of this.activeChannels) {
            try {
                const analysis = channel.analyzeCapacity(text);
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
     * Алгоритм (двухпроходный с корректировкой lsBases):
     * 1. Шифруем → байты E, M = BigInt(E)
     * 2. Анализируем другие каналы на carrierText → otherBases
     * 3. Оцениваем lsBases на carrierText (первое приближение)
     * 4. Кодируем M → indices, применяем другие каналы → intermediate result
     * 5. Пересчитываем lsBases на intermediate result (реальные слова после синонимов)
     * 6. Если lsBases изменились — перекодируем (otherIndices стабильны!)
     * 7. Применяем letter-stego последним
     *
     * КЛЮЧЕВОЕ СВОЙСТВО: otherIndices зависят только от M и otherBases,
     * которые не меняются при изменении lsBases. Поэтому intermediate result
     * стабилен после первой итерации, и алгоритм сходится за 1-2 шага.
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

        // 2. Анализируем другие каналы на carrierText
        const lsCh = this.activeChannels.find(c => c.name === 'letter-stego');
        const otherChannels = this.activeChannels.filter(c => c.name !== 'letter-stego');

        const otherBases = [];
        const otherChannelData = [];
        for (const channel of otherChannels) {
            try {
                const analysis = channel.analyzeCapacity(carrierText);
                otherBases.push(...analysis.bases);
                otherChannelData.push({ channel, analysis });
            } catch (e) {
                console.warn(`Channel ${channel.name} analyzeCapacity error:`, e);
                otherChannelData.push({ channel, analysis: null });
            }
        }

        // 3. Оцениваем lsBases на carrierText (первое приближение)
        let lsBases = [];
        if (lsCh) {
            try {
                lsBases = lsCh.analyzeCapacity(carrierText).bases;
            } catch (e) {
                console.warn('letter-stego analyzeCapacity error:', e);
            }
        }

        // Проверяем минимальную ёмкость
        let allBases = [...otherBases, ...lsBases];
        this.mixedRadix.setBases(allBases);

        if (this.mixedRadix.maxValue === 0n) {
            const channelInfo = this.activeChannels.map(c => {
                try {
                    const a = c.analyzeCapacity(carrierText);
                    return `${c.name}:${a.bases.length}позиций`;
                } catch(e) { return `${c.name}:ошибка`; }
            }).join(', ');
            throw new Error(`Нет ёмкости для кодирования.\nАктивные каналы: ${channelInfo || 'нет'}\nПопробуйте более длинный текст-носитель или включите больше каналов.`);
        }

        // 4. M = BigInt(encrypted)
        const M = this.mixedRadix.bytesToBigInt(encrypted);

        if (M >= this.mixedRadix.maxValue) {
            const needed    = Math.ceil(encrypted.length * 8);
            const available = this.mixedRadix.getCapacityBits();
            throw new Error(
                `Текст-носитель слишком мал.\nНужно: ~${needed} бит, доступно: ${available} бит.\n` +
                `Используйте более длинный текст-носитель.`
            );
        }

        // 5. Кодируем M → indices и применяем другие каналы
        let indices = this.mixedRadix.encode(M);

        let result = carrierText;
        let offset = 0;

        for (const { channel, analysis } of otherChannelData) {
            if (!analysis) continue;
            try {
                const count = analysis.bases.length;
                result = channel.encode(result, indices.slice(offset, offset + count));
                offset += count;
            } catch (e) {
                console.warn(`Channel ${channel.name} encode error:`, e);
                offset += analysis.bases.length;
            }
        }

        // 6. Пересчитываем lsBases на intermediate result (после синонимов!)
        //    Это критически важно: letter-stego видит СИНОНИМЫ, не оригиналы,
        //    и valid mutations зависят от конкретного слова (targetOrigNorm).
        if (lsCh) {
            try {
                const actualLsBases = lsCh.analyzeCapacity(result).bases;

                // Проверяем, изменились ли bases
                const basesChanged = actualLsBases.length !== lsBases.length ||
                    actualLsBases.some((b, i) => b !== lsBases[i]);

                if (basesChanged) {
                    // Перекодируем с актуальными lsBases.
                    // otherIndices НЕ меняются (они зависят только от M и otherBases).
                    allBases = [...otherBases, ...actualLsBases];
                    this.mixedRadix.setBases(allBases);

                    if (M >= this.mixedRadix.maxValue) {
                        // Ёмкость уменьшилась — пробуем с новыми bases
                        const needed    = Math.ceil(encrypted.length * 8);
                        const available = this.mixedRadix.getCapacityBits();
                        throw new Error(
                            `Недостаточно ёмкости после корректировки.\nНужно: ~${needed} бит, доступно: ${available} бит.\n` +
                            `Используйте более длинный текст-носитель.`
                        );
                    }

                    indices = this.mixedRadix.encode(M);

                    // Переприменяем другие каналы (otherIndices те же, но lsIndices изменились)
                    result = carrierText;
                    offset = 0;
                    for (const { channel, analysis } of otherChannelData) {
                        if (!analysis) continue;
                        try {
                            const count = analysis.bases.length;
                            result = channel.encode(result, indices.slice(offset, offset + count));
                            offset += count;
                        } catch (e) {
                            console.warn(`Channel ${channel.name} encode error:`, e);
                            offset += analysis.bases.length;
                        }
                    }
                }
            } catch (e) {
                console.warn('letter-stego re-analysis error:', e);
            }
        }

        // 7. Применяем letter-stego последним (на тексте после других каналов)
        if (lsCh) {
            try {
                result = lsCh.encode(result, indices.slice(offset));
            } catch (e) {
                console.warn('letter-stego encode error:', e);
            }
        }

        const endTime = Date.now();
        const capacity = this.analyzeCarrier(carrierText);
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
     * Порядок: letter-stego ПЕРВЫМ (restore) → остальные каналы
     *
     * Это гарантирует что bases совпадают с encode:
     * - letter-stego анализирует стего-текст (синонимы + мутации)
     *   _getOriginal разрешает мутации → targetOrigNorm = синоним (как при encode)
     *   position-based seed → valid mutations совпадают с encode
     * - restore убирает мутации → textAfterRestore = carrierText + другие_каналы
     * - другие каналы анализируют textAfterRestore (синонимы на месте)
     *   canonical synsets → bases те же что при encode
     */
    async decodeMessage(stegoText, password) {
        const startTime = Date.now();

        // 0. Если синонимы в режиме backend — prefetch синсетов стего-текста
        const synCh = this.channels['synonyms'];
        if (synCh && synCh.mode === 'backend') {
            await synCh.prefetchSynsets(stegoText);
        }

        const lsCh = this.activeChannels.find(c => c.name === 'letter-stego');
        const otherChannels = this.activeChannels.filter(c => c.name !== 'letter-stego');

        // 1. letter-stego декодируется ПЕРВЫМ из стего-текста
        let lsIndices = [];
        let lsBasesFromStego = [];
        let textAfterRestore = stegoText;

        if (lsCh) {
            try {
                // Анализируем стего-текст для letter-stego
                const lsAnalysis = lsCh.analyzeCapacity(stegoText);
                lsBasesFromStego = lsAnalysis.bases;
                // Декодируем индексы
                lsIndices = lsCh.decode(stegoText);
                // Восстанавливаем текст (убираем мутации)
                textAfterRestore = lsCh.restore(stegoText);
            } catch (e) {
                console.warn('letter-stego decode error:', e);
            }
        }

        // 2. Анализируем восстановленный текст для остальных каналов
        const otherBases = [];
        const otherIndices = [];
        for (const channel of otherChannels) {
            try {
                const analysis = channel.analyzeCapacity(textAfterRestore);
                otherBases.push(...analysis.bases);
                otherIndices.push(...channel.decode(textAfterRestore));
            } catch (e) {
                console.warn(`Channel ${channel.name} decode error:`, e);
            }
        }

        // 3. Объединяем bases и indices В ТОМ ЖЕ порядке что при encode:
        //    другие каналы ПЕРВЫЕ, letter-stego ПОСЛЕДНИМ
        const allBases = [...otherBases, ...lsBasesFromStego];
        const allIndices = [...otherIndices, ...lsIndices];

        this.mixedRadix.setBases(allBases);

        // Выравниваем длину
        const expectedLen = this.mixedRadix.bases.length;
        while (allIndices.length < expectedLen) allIndices.push(0);
        if (allIndices.length > expectedLen) allIndices.splice(expectedLen);

        // 4. Mixed-radix decode → BigInt M
        const M = this.mixedRadix.decode(allIndices);

        // 5. BigInt → байты: перебираем размеры пока crypto.decrypt не вернёт валидные данные
        const maxBytes  = Math.ceil(this.mixedRadix.getCapacityBits() / 8);
        const rawBytes  = this.mixedRadix.bigIntToBytes(M);
        let decrypted   = null;

        for (let trySize = Math.max(2, rawBytes.length); trySize <= maxBytes; trySize++) {
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
            safe:   ['synonyms','yo','punctuation','dates','typos','duplets','abbreviations','spaces','phones','emails','urls','letter-stego'].includes(name),
            stats:  channel.getStats ? channel.getStats() : {}
        }));
    }

    getStats() { return this.stats; }
}

export default StegoEngine;
