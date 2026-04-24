/**
 * Система счисления со смешанным основанием (Mixed-Radix)
 * Позволяет максимально эффективно кодировать данные
 */

export class MixedRadixEncoder {
    constructor() {
        this.bases = [];
        this.maxValue = 0n;
    }

    /**
     * Установить основания системы счисления
     * @param {Array<number>} bases - массив оснований для каждой позиции
     */
    setBases(bases) {
        this.bases = bases.map(b => BigInt(b));
        this.maxValue = this.calculateMaxValue();
    }

    /**
     * Вычислить максимальное значение, которое можно закодировать
     */
    calculateMaxValue() {
        if (this.bases.length === 0) return 0n;
        
        let max = 1n;
        for (let base of this.bases) {
            max *= base;
        }
        return max;
    }

    /**
     * Получить ёмкость в битах
     */
    getCapacityBits() {
        if (this.maxValue === 0n) return 0;
        
        // log2(maxValue)
        let bits = 0;
        let value = this.maxValue;
        while (value > 1n) {
            value /= 2n;
            bits++;
        }
        return bits;
    }

    /**
     * Закодировать число в mixed-radix представление
     * @param {BigInt} number - число для кодирования
     * @returns {Array<number>} - массив индексов
     *
     * Кодируем СЛЕВА НАПРАВО (от наименее значимых к наиболее значимым).
     * Это гарантирует что первые позиции (letter-stego) получают
     * наименее значащие разряды и используются первыми для малых M.
     *
     * indices[0] = M % base[0]  (наименее значимый)
     * indices[1] = (M / base[0]) % base[1]
     * indices[N-1] = наиболее значимый
     */
    encode(number) {
        if (number >= this.maxValue) {
            throw new Error(`Number ${number} exceeds maximum value ${this.maxValue}`);
        }

        const indices = [];
        let remaining = BigInt(number);

        // Кодируем слева направо — indices[0] наименее значимый
        for (let i = 0; i < this.bases.length; i++) {
            const base = this.bases[i];
            const index = remaining % base;
            indices.push(Number(index));
            remaining = remaining / base;
        }

        return indices;
    }

    /**
     * Декодировать mixed-radix представление в число
     * @param {Array<number>} indices - массив индексов
     * @returns {BigInt} - декодированное число
     *
     * Декодируем СЛЕВА НАПРАВО (от наименее значимых к наиболее значимым).
     * M = indices[0] + base[0] * (indices[1] + base[1] * (indices[2] + ...))
     */
    decode(indices) {
        if (indices.length !== this.bases.length) {
            throw new Error(`Indices length ${indices.length} doesn't match bases length ${this.bases.length}`);
        }

        let number = 0n;
        let multiplier = 1n;

        // Декодируем слева направо — indices[0] наименее значимый
        for (let i = 0; i < this.bases.length; i++) {
            const index = BigInt(indices[i]);
            const base = this.bases[i];

            if (index >= base) {
                throw new Error(`Index ${index} exceeds base ${base} at position ${i}`);
            }

            number += index * multiplier;
            multiplier *= base;
        }

        return number;
    }

    /**
     * Конвертировать байты в BigInt
     */
    bytesToBigInt(bytes) {
        let result = 0n;
        for (let byte of bytes) {
            result = (result << 8n) | BigInt(byte);
        }
        return result;
    }

    /**
     * Конвертировать BigInt в байты с сохранением точного размера.
     * @param {BigInt} bigint
     * @param {number} [size] - ожидаемый размер массива (если известен)
     */
    bigIntToBytes(bigint, size) {
        const bytes = [];
        let value = bigint;

        while (value > 0n) {
            bytes.unshift(Number(value & 0xFFn));
            value >>= 8n;
        }

        // Если размер задан — дополняем ведущими нулями или обрезаем
        if (size !== undefined) {
            while (bytes.length < size) bytes.unshift(0);
            if (bytes.length > size) bytes.splice(0, bytes.length - size);
        }

        return new Uint8Array(bytes.length > 0 ? bytes : [0]);
    }

    /**
     * Конвертировать байты в BigInt (обратная операция)
     */
    bytesToBigInt(bytes) {
        let result = 0n;
        for (const byte of bytes) {
            result = (result << 8n) | BigInt(byte);
        }
        return result;
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            positions: this.bases.length,
            maxValue: this.maxValue.toString(),
            capacityBits: this.getCapacityBits(),
            capacityBytes: Math.floor(this.getCapacityBits() / 8),
            bases: this.bases.map(b => Number(b))
        };
    }
}

export default MixedRadixEncoder;