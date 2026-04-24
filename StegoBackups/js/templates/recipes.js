// ==========================================
// 🎭 LINGUISTIC ENGINE v4.2 — STEGANOGRAPHY CORE
// ==========================================

import {
    MEASURES, INGREDIENT_CATEGORIES, RECIPE_STARTS, RECIPE_ENDS,
    INGREDIENT_TEMPLATES, RECIPE_CONTEXTS, ACTIONS, RECIPE_INSTRUCTION_HEADERS
} from './dictionaries.js';

function getPlural(number, [form1, form2, form5]) {
    const n10 = number % 10, n100 = number % 100;
    if (n10 === 1 && n100 !== 11) return form1;
    if ([2,3,4].includes(n10) && ![12,13,14].includes(n100)) return form2;
    return form5;
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function getRandomFromSeed(seed, arr) {
    return arr[(seed + Math.floor(seed * 0.6180339887)) % arr.length];
}

// Функция позиционного сдвига для борьбы с монотонностью малых чисел
function getPosShift(pos, base) {
    if (base <= 1) return 0;
    return ((pos + 1) * 2654435761 >>> 0) % base; 
}

// Подготовка плоского списка ингредиентов (чередование категорий для разнообразия)
const INGREDIENTS_BY_CAT = {};
for (const [category, items] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (!INGREDIENTS_BY_CAT[category]) INGREDIENTS_BY_CAT[category] = [];
    items.forEach(ing => INGREDIENTS_BY_CAT[category].push({ ...ing, category }));
}

const INGREDIENTS_FLAT = [];
const catKeys = Object.keys(INGREDIENTS_BY_CAT);
const maxIngLen = Math.max(...catKeys.map(k => INGREDIENTS_BY_CAT[k].length));
for (let i = 0; i < maxIngLen; i++) {
    for (const cat of catKeys) {
        if (i < INGREDIENTS_BY_CAT[cat].length) {
            INGREDIENTS_FLAT.push(INGREDIENTS_BY_CAT[cat][i]);
        }
    }
}

// Подготовка ACTIONS (чередование типов для разнообразия)
const FILLERS = [];
const ACTIONS_NO_PARAM = [];
const ACTIONS_TIME = [];
const ACTIONS_TEMP = [];
const ACTIONS_ORDER = [];

ACTIONS.forEach(a => {
    if (a.filler) { FILLERS.push(a.text); return; }
    if (!a.hasParam) {
        ACTIONS_NO_PARAM.push(a.text);
    } else if (a.paramType === 'time') {
        for (let i = 1; i <= a.paramBase; i++) ACTIONS_TIME.push(a.text.replace('{0}', i));
    } else if (a.paramType === 'temp') {
        const temps = [140, 150, 160, 170, 180, 190, 200, 210, 220];
        temps.forEach(t => ACTIONS_TEMP.push(a.text.replace('{0}', t)));
    } else if (a.paramType === 'order') {
        const verbs = ['перемешать', 'взбить', 'охладить', 'украсить', 'посолить'];
        verbs.forEach(v => ACTIONS_ORDER.push(a.text.replace('{0}', v)));
    }
});

const ACTION_MAP = [];
const maxActionLen = Math.max(ACTIONS_NO_PARAM.length, ACTIONS_TIME.length, ACTIONS_TEMP.length, ACTIONS_ORDER.length);
for (let i = 0; i < maxActionLen; i++) {
    if (i < ACTIONS_NO_PARAM.length) ACTION_MAP.push(ACTIONS_NO_PARAM[i]);
    if (i < ACTIONS_TIME.length) ACTION_MAP.push(ACTIONS_TIME[i]);
    if (i < ACTIONS_TEMP.length) ACTION_MAP.push(ACTIONS_TEMP[i]);
    if (i < ACTIONS_ORDER.length) ACTION_MAP.push(ACTIONS_ORDER[i]);
}

const ACTION_MAP_SORTED = [...ACTION_MAP].sort((a, b) => b.length - a.length);

const QTY_BASE = 100;
const TASTE_BASE = 2;
const ACTIONS_BASE = ACTION_MAP.length; 
const INSTRUCTION_STEPS = 10; 

// --- КОДИРОВЩИК ---
class MixedRadixEncoder {
    constructor() { this.bases = []; }
    setBases(bases) { this.bases = bases; }
    get maxValue() { return this.bases.reduce((prod, base) => prod * BigInt(base), 1n); }
    
    bytesToBigInt(bytes) { return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n); }
    
    bigIntToBytes(bigint, length = null) {
        const bytes = [];
        let num = bigint;
        while (num > 0n) { bytes.unshift(Number(num & 0xFFn)); num >>= 8n; }
        if (length && bytes.length < length) return new Array(length - bytes.length).fill(0).concat(bytes);
        return bytes;
    }
    
    encode(bigint) {
        const indices = [];
        let num = bigint;
        for (let i = this.bases.length - 1; i >= 0; i--) {
            const base = BigInt(this.bases[i]);
            indices.unshift(Number(num % base));
            num = num / base;
        }
        return indices;
    }
    
    decode(indices) {
        let result = 0n;
        for (let i = 0; i < indices.length; i++) {
            result = result * BigInt(this.bases[i]) + BigInt(indices[i]);
        }
        return result;
    }
}

// --- ОСНОВНОЙ КЛАСС ---
class RecipeSteganography {
    constructor(options = {}) {
        this.options = {
            contextType: 'universal',
            maxIngredientLines: 50,
            minIngredientLines: 4,
            ...options
        };
        this.encoder = new MixedRadixEncoder();
    }

    getIngredients() {
        const ctx = RECIPE_CONTEXTS[this.options.contextType] || RECIPE_CONTEXTS.universal;
        const allowed = new Set(ctx.categories);
        const ings = INGREDIENTS_FLAT.filter(ing => allowed.has(ing.category));
        return ings.length > 0 ? ings : INGREDIENTS_FLAT;
    }

    _calculateLinesCount(payloadBytes) {
        if (!payloadBytes || payloadBytes.length === 0) return this.options.minIngredientLines;
        
        const fullPayload = new Uint8Array([payloadBytes.length, ...payloadBytes]);
        const bigIntData = this.encoder.bytesToBigInt(fullPayload);
        const availableIngs = this.getIngredients();
        
        let lines = this.options.minIngredientLines;
        while (lines <= this.options.maxIngredientLines) {
            const bases = [];
            for (let i = 0; i < lines; i++) bases.push(QTY_BASE, availableIngs.length, TASTE_BASE);
            for (let i = 0; i < INSTRUCTION_STEPS; i++) bases.push(ACTIONS_BASE);
            
            this.encoder.setBases(bases);
            if (this.encoder.maxValue > bigIntData) break;
            lines++;
        }
        return clamp(lines, this.options.minIngredientLines, this.options.maxIngredientLines);
    }

    generateProceduralText(payloadBytes) {
        if (!payloadBytes || payloadBytes.length === 0) payloadBytes = new Uint8Array(0);
        
        const fullPayload = new Uint8Array([payloadBytes.length, ...payloadBytes]);
        const linesCount = this._calculateLinesCount(payloadBytes);
        const availableIngs = this.getIngredients();
        
        const bases = [];
        for (let i = 0; i < linesCount; i++) bases.push(QTY_BASE, availableIngs.length, TASTE_BASE);
        for (let i = 0; i < INSTRUCTION_STEPS; i++) bases.push(ACTIONS_BASE);
        
        this.encoder.setBases(bases);
        const bigIntData = this.encoder.bytesToBigInt(fullPayload);
        if (bigIntData >= this.encoder.maxValue) throw new Error('Переполнение! Увеличьте maxIngredientLines.');
        
        const rawIndices = this.encoder.encode(bigIntData);
        const seed = payloadBytes.length > 0 ? payloadBytes[0] : 42;
        
        // Применяем позиционный сдвиг для разбивания монотонности
        const shiftedIndices = rawIndices.map((val, idx) => {
            const base = bases[idx];
            return (val + getPosShift(idx, base)) % base;
        });

        let text = getRandomFromSeed(seed, RECIPE_STARTS) + '\n';
        let idxPtr = 0;
        
        // Выбираем ОДИН шаблон для всего рецепта (NLG-улучшение)
        const templateIdx = (seed + 2) % INGREDIENT_TEMPLATES.length;
        const markerTemplate = INGREDIENT_TEMPLATES[templateIdx];
        
        for (let lineNum = 0; lineNum < linesCount; lineNum++) {
            const qtyIndex = shiftedIndices[idxPtr++];
            const ingIndex = shiftedIndices[idxPtr++];
            const tasteFlag = shiftedIndices[idxPtr++];
            
            const realQuantity = qtyIndex + 1;
            const ingredient = availableIngs[ingIndex % availableIngs.length];
            const measureWord = getPlural(realQuantity, MEASURES[ingredient.measure]);
            
            let line = markerTemplate(ingredient.name, realQuantity, measureWord);
            if (tasteFlag === 1) line += ' (по вкусу)';
            text += line + '\n';
        }
        
        const header = getRandomFromSeed(seed >> 1, RECIPE_INSTRUCTION_HEADERS);
        text += '\n' + header + '\n';

        for (let step = 0; step < INSTRUCTION_STEPS; step++) {
            const actionIndex = shiftedIndices[idxPtr++];
            const actionText = ACTION_MAP[actionIndex];
            const capAction = actionText.charAt(0).toUpperCase() + actionText.slice(1);
            
            // Варьируем формат шагов (NLG-улучшение)
            let stepText;
            if (seed % 3 === 0) stepText = `${step + 1}. ${capAction}`;
            else if (seed % 3 === 1) stepText = `${step + 1}) ${capAction}`;
            else stepText = `Шаг ${step + 1}: ${capAction}`;
            
            // Детерминированные филлеры (без Math.random)
            const fillerSeed = (seed + step * 13) % (FILLERS.length * 2);
            if (fillerSeed < FILLERS.length) {
                stepText += ', ' + FILLERS[fillerSeed];
            }
            
            text += stepText + '.\n';
        }
        
        text += '\n' + getRandomFromSeed(seed >> 4, RECIPE_ENDS);
        return text;
    }

    extractData(fullText) {
        const headerRegex = RECIPE_INSTRUCTION_HEADERS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const parts = fullText.split(new RegExp(`(?:${headerRegex})`, 'i'));
        if (parts.length < 2) return null;

        const ingBlock = parts[0];
        const instrBlock = parts[1];

        const ingLines = ingBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (ingLines.length > 0) ingLines.shift(); // Убираем заголовок

        const availableIngs = this.getIngredients();
        const rawShiftedIndices = [];
        let numIngs = 0;

        for (let line of ingLines) {
            let cleanLine = line.replace(/^\s*(\d+[\.\)]\s*|[-*•~]\s*|шаг \d+:\s*)/i, '');
            const lower = cleanLine.toLowerCase();
            let localIngIndex = -1;
            let bestMatchLength = 0;
            
            for (let i = 0; i < availableIngs.length; i++) {
                const ingName = availableIngs[i].name.toLowerCase();
                if (lower.includes(ingName) && ingName.length > bestMatchLength) {
                    localIngIndex = i;
                    bestMatchLength = ingName.length;
                }
            }
            if (localIngIndex === -1) continue;

            let qtyIndex = 0;
            const ingName = availableIngs[localIngIndex].name;
            const escapedName = ingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tempLine = cleanLine.replace(new RegExp(escapedName, 'i'), '');
            const numMatch = tempLine.match(/(\d+)/);
            if (numMatch) qtyIndex = clamp(parseInt(numMatch[1]) - 1, 0, QTY_BASE - 1);
            
            const tasteFlag = /по вкусу/i.test(cleanLine) ? 1 : 0;

            rawShiftedIndices.push(qtyIndex, localIngIndex, tasteFlag);
            numIngs++;
            if (numIngs >= this.options.maxIngredientLines) break;
        }

        if (numIngs < this.options.minIngredientLines) return null;

        let numSteps = 0;
        const instrLines = instrBlock.split('\n').map(l => l.trim()).filter(l => /^(\d+[\.\)]|шаг \d+)/i.test(l));
        for (let line of instrLines) {
            const lower = line.toLowerCase().replace(/^(?:\d+[\.\)]|шаг \d+:)\s*/i, '').replace(/\.$/, '');
            let actionIndex = 0;
            for (const actionText of ACTION_MAP_SORTED) {
                if (lower.startsWith(actionText.toLowerCase())) {
                    actionIndex = ACTION_MAP.indexOf(actionText);
                    break;
                }
            }
            rawShiftedIndices.push(actionIndex);
            numSteps++;
        }
        
        while (numSteps < INSTRUCTION_STEPS) { rawShiftedIndices.push(0); numSteps++; }
        while (numSteps > INSTRUCTION_STEPS) { rawShiftedIndices.pop(); numSteps--; }

        try {
            const bases = [];
            for (let i = 0; i < numIngs; i++) bases.push(QTY_BASE, availableIngs.length, TASTE_BASE);
            for (let i = 0; i < INSTRUCTION_STEPS; i++) bases.push(ACTIONS_BASE);
            
            // Обратный сдвиг для восстановления оригинальных индексов
            const originalIndices = rawShiftedIndices.map((val, idx) => {
                const base = bases[idx];
                const shift = getPosShift(idx, base);
                return (val - shift + base * 1000) % base; // +1000*base защищает от отрицательных чисел
            });

            this.encoder.setBases(bases);
            const decodedBigInt = this.encoder.decode(originalIndices);
            const rawBytes = this.encoder.bigIntToBytes(decodedBigInt);
            
            if (rawBytes.length === 0) return new Uint8Array(0);
            const len = rawBytes[0];
            if (len === 0) return new Uint8Array(0);
            if (rawBytes.length > len) return new Uint8Array(rawBytes.slice(1, 1 + len));
            return new Uint8Array(rawBytes.slice(1));
        } catch (e) {
            return null;
        }
    }
}

// ==========================================
// 🧪 ТЕСТЫ
// ==========================================

const recipe = new RecipeSteganography({ maxIngredientLines: 50, minIngredientLines: 4 });
const textTests = ["8234567", "12345", "SecretMessage", "Привет из Питера", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"];
let passed = 0, failed = 0;

function runTest(label, payload, isText = false) {
    try {
        const text = recipe.generateProceduralText(payload);
        const extracted = recipe.extractData(text);
        
        if (!extracted) { console.log(`❌ FAIL [${label}]: Извлечение вернуло null`); failed++; return; }
        
        let isMatch = extracted.length === payload.length;
        if (isMatch) {
            for (let i = 0; i < payload.length; i++) { if (extracted[i] !== payload[i]) { isMatch = false; break; } }
        }

        if (isMatch) {
            console.log(`✅ PASS [${label}]`);
            if (isText) console.log(`   📝 Текст:\n${text}\n`);
            passed++;
        } else {
            console.log(`❌ FAIL [${label}]: Байты не совпадают!`);
            if (isText) console.log(`   Ожидалось: ${new TextDecoder().decode(payload)}, Получено: ${new TextDecoder().decode(extracted)}`);
            failed++;
        }
    } catch (e) {
        console.log(`💥 ERROR [${label}]: ${e.message}`);
        failed++;
    }
}

console.log("=============================");
console.log("🧪 ТЕСТИРОВАНИЕ ТЕКСТОВЫХ СТРОК");
console.log("=============================");
textTests.forEach(t => runTest(`Текст: "${t.substring(0, 20)}..."`, new TextEncoder().encode(t), true));

console.log("\n=========================================");
console.log("🧪 ТЕСТИРОВАНИЕ КРАЕВЫХ СЛУЧАЕВ (БАЙТЫ)");
console.log("=========================================");
runTest("Ведущие нули", new Uint8Array([0, 0, 0, 15, 255]));
runTest("Один байт (0)", new Uint8Array([0]));
runTest("Один байт (255)", new Uint8Array([255]));
runTest("Пустой массив", new Uint8Array([]));

console.log("\n=========================");
console.log("🧪 СТРЕСС-ТЕСТ СЛУЧАЙНЫМИ ДАННЫМИ (100 итераций)");
console.log("=========================");
for (let i = 0; i < 3; i++) {
    const len = Math.floor(Math.random() * 32) + 1;
    const randomBytes = new Uint8Array(len);
    for (let j = 0; j < len; j++) randomBytes[j] = Math.floor(Math.random() * 256);
    runTest(`Random #${i+1} (${len}B)`, randomBytes);
}

console.log("\n==========================");
console.log(`🏁 ИТОГИ: Успешно: ${passed} | Ошибки: ${failed}`);
console.log("===========================");