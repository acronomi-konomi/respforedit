# CryptoMsg — Документация проекта

> Лингвистическая стеганография и шифрование текста  
> Чистый JavaScript + HTML + CSS, без сборщиков, без фреймворков

---

## Файловая структура

```
public/
├── index.html                  # Главная точка входа (HTML-страница)
├── logo.svg                    # Логотип приложения
├── robots.txt                  # SEO/краулеры
│
├── css/
│   └── messenger.css           # Стили мессенджера (scoped .crypto-messenger, ~1280 строк)
│
├── js/
│   ├── main.js                 # ⭐ Главный entry point (~1020 строк)
│   │                           #   - Инициализация модулей
│   │                           #   - Обработчики UI (tabs, input, settings)
│   │                           #   - Message bubbles (addBubble)
│   │                           #   - Публичный API: window.CryptoMsgAPI
│   │
│   ├── core/
│   │   ├── engine.js           # ⭐ StegoEngine — движок стеганографии (~440 строк)
│   │   │                       #   - Mixed-radix numeral system
│   │   │                       #   - Управление каналами (register/setActive)
│   │   │                       #   - encodeMessage / decodeMessage
│   │   │                       #   - analyzeCarrier (ёмкость)
│   │   │
│   │   ├── crypto.js           # CryptoEngine — стего-криптография (AES-CTR)
│   │   │                       #   - Компактный алфавит (1 байт/символ кириллицы)
│   │   │                       #   - encrypt / decrypt (AES-256-CTR + PBKDF2)
│   │   │                       #   - stringToBytes / bytesToString
│   │   │
│   │   ├── clean-crypto.js     # ⭐ CleanCrypto — чистое шифрование (AES-256-GCM)
│   │   │                       #   - encrypt / decrypt (Web Crypto API)
│   │   │                       #   - encryptAndEncode / decodeAndDecrypt (pipeline)
│   │   │                       #   - Управление паролями (localStorage)
│   │   │                       #   - Статические методы: savePassword / getSavedPassword / removePassword
│   │   │
│   │   ├── morphology.js       # RussianMorphology — обёртка Az.js
│   │   │                       #   - init(libPath) — загрузка словарей
│   │   │                       #   - getForms(word) / isKnown(word) / parse(word)
│   │   │
│   │   ├── nlp.js              # NLP утилиты (токенизация, сегментация)
│   │   ├── mixed-radix.js      # MixedRadixEncoder — система счисления со смешанными основаниями
│   │   │                       #   - encode(BigInt) → indices[]
│   │   │                       #   - decode(indices[]) → BigInt
│   │   │                       #   - bytesToBigInt / bigIntToBytes
│   │   │
│   │   └── encoders/
│   │       ├── index.js        # ⭐ Реестр энкодеров (getEncoderById, detectEncoder, getEncoderList)
│   │       ├── invisible-spaces.js    # 👻 Невидимые символы (26 Unicode, base-26)
│   │       ├── base64-encoder.js      # 🔤 Base64/Base85 (автовыбор компактного)
│   │       ├── compression-encoder.js # 📦 Deflate + base64url (CompressionStream API)
│   │       ├── emoji-encoder.js       # 😀 Эмодзи (256 emoji → 1 байт/эмодзи)
│   │       ├── chinese-encoder.js     # 🈳 CJK Unified Ideographs (base-20992, ~14.3 бит/символ)
│   │       └── layout-switch-encoder.js # ⌨️ Смена раскладки (ЙЦУКЕН ↔ QWERTY)
│   │
│   ├── channels/               # ⭐ Каналы стеганографии (17 каналов)
│   │   ├── synonyms.js         # Синонимы (статический словарь / backend-режим)
│   │   ├── yo-replacement.js   # Е/Ё замена
│   │   ├── punctuation.js      # Пунктуация (тире, кавычки)
│   │   ├── dates.js            # Форматы дат (01.02.2024 ↔ 1 февраля 2024)
│   │   ├── typos.js            # Опечатки/дефисы (всё-таки ↔ всё таки)
│   │   ├── duplets.js          # Орфографические варианты (блогер ↔ блоггер)
│   │   ├── abbreviations.js    # Аббревиатуры (РФ ↔ Российская Федерация)
│   │   ├── spaces.js           # Пробелы (NBSP ↔ обычный пробел)
│   │   ├── letter-stego.js     # Буквенное стего (детерминированные мутации)
│   │   ├── word-order.js       # Порядок слов (экспериментальный)
│   │   ├── zero-width.js       # Zero-width символы (невидимые)
│   │   ├── parasites.js        # Паразитные слова (вставка)
│   │   ├── phrases.js          # Фразы-вставки
│   │   ├── voice.js            # Залог (активный ↔ пассивный)
│   │   ├── participles.js      # Причастия
│   │   ├── numbers.js          # Числа (цифры ↔ слова)
│   │   ├── case.js             # Регистр
│   │   └── smiles.js           # Смайлики (:) ↔ 😊)
│   │
│   ├── ui/
│   │   ├── interface.js        # InterfaceManager (альтернативный UI-контроллер, legacy)
│   │   └── stego-t9.js         # StegoT9 — предиктивный ввод для стего
│   │
│   ├── utils/
│   │   ├── helpers.js          # Вспомогательные утилиты
│   │   └── recovery.js         # RecoveryEngine — восстановление повреждённых данных
│   │
│   ├── templates/              # Шаблоны генерации текста-носителя
│   │   ├── dictionaries.js     # Словари для генерации
│   │   ├── recipes.js          # Шаблоны рецептов
│   │   ├── generate_pc_parts.js      # Генерация текста о ПК-компонентах
│   │   └── generate_auto_parts_and_devices.js  # Генерация текста об авто/устройствах
│   │
│   └── dev/
│       └── dev-tester.js       # 🧪 Панель тестирования разработчика (Ctrl+Shift+D)
│                               #   - runAllTests(stegoEngine?)
│                               #   - toggleDevPanel(stegoEngine?)
│                               #   - initDevShortcut(stegoEngine?)
│
├── data/                       # Данные для каналов стеганографии
│   ├── synonyms.json           # Словарь синонимов
│   ├── duplets.json            # Орфографические варианты
│   ├── abbreviations.json      # Аббревиатуры
│   ├── parasites.json          # Слова-паразиты
│   ├── phrases.json            # Фразы-вставки
│   ├── voice-forms.json        # Формы залогов
│   ├── participles.json        # Причастия
│   ├── affixes.json            # Аффиксы
│   └── dictionaries/
│       ├── categoriser/        # Категорийные словари (cats, dogs, movies, videogames)
│       └── emailnames.zip      # Словарь имён для email
│
└── lib/                        # Внешние библиотеки
    ├── az.js                   # Az.js — морфологический анализатор русского языка
    ├── az.morph.js             # Морфология
    ├── az.dawg.js              # DAWG (Directed Acyclic Word Graph)
    ├── az.tokens.js            # Токенизатор
    ├── az.syntax.js            # Синтаксис
    └── dicts/                  # Словари Az.js
        ├── words.dawg          # DAWG-словарь слов
        ├── paradigms.array     # Парадигмы склонения
        ├── grammemes.json      # Граммемы
        ├── gramtab-opencorpora-int.json
        ├── gramtab-opencorpora-ext.json
        ├── meta.json
        ├── suffixes.json
        ├── p_t_given_w.intdawg
        └── prediction-suffixes-*.dawg  # N-граммные суффиксы
```

---

## Главные точки входа

### 1. `index.html` — веб-страница приложения

Подключает стили и скрипты в следующем порядке:
1. `css/messenger.css` — все стили
2. `lib/az.js` + модули Az.js — морфология (глобальные скрипты)
3. `js/main.js` — главный модуль (ES Module)

### 2. `js/main.js` — инициализация и UI

- Создаёт экземпляр `CleanCrypto`
- Инициализирует `StegoEngine` (асинхронно)
- Регистрирует обработчики UI
- Экспортирует глобальный API: `window.CryptoMsgAPI`

### 3. `js/dev/dev-tester.js` — панель разработчика

- **Вызов**: `Ctrl+Shift+D` или двойной клик на лого
- **API**: `CryptoMsgAPI.runDevTests()`, `CryptoMsgAPI.toggleDevPanel()`

---

## API-методы (window.CryptoMsgAPI)

### Управление чатами

| Метод | Описание |
|-------|----------|
| `setChatId(chatId)` | Установить ID текущего чата (автозаполнение пароля) |

### Шифрование

| Метод | Параметры | Возвращает | Описание |
|-------|-----------|------------|----------|
| `encrypt(plaintext, password, mode?)` | `string, string, 'aes256'\|'invisible'\|'base64'\|'compression'\|'emoji'\|'chinese'\|'layout'` | `Promise<string>` | Зашифровать и закодировать сообщение |
| `decrypt(encoded, password)` | `string, string` | `Promise<string>` | Автообнаружение кодировки, декодирование и дешифровка |

### Стеганография

| Метод | Описание |
|-------|----------|
| `getStegoEngine()` | Вернуть экземпляр StegoEngine (или null) |

### UI

| Метод | Описание |
|-------|----------|
| `addMessage(text, type?, mode?)` | Добавить пузырь в область сообщений |
| `notify(message, type?)` | Показать toast-уведомление |
| `getState()` | Получить текущее состояние приложения |

### Разработка

| Метод | Описание |
|-------|----------|
| `runDevTests()` | Запустить серию тестов, вернуть summary |
| `toggleDevPanel()` | Открыть/закрыть панель тестирования |

---

## StegoEngine API

### Основные методы

```javascript
const engine = CryptoMsgAPI.getStegoEngine();

// Кодирование: секретное сообщение → стего-текст
const stegoText = await engine.encodeMessage(secret, carrierText, password);

// Декодирование: стего-текст → секретное сообщение
const secret = await engine.decodeMessage(stegoText, password);

// Анализ ёмкости текста-носителя
const analysis = engine.analyzeCarrier(carrierText);
// → { totalBits, capacityBytes, channels: {...}, bases: [...] }

// Информация о каналах
const info = engine.getChannelInfo();
// → [{ name, active, safe, stats }]

// Статистика последней операции
const stats = engine.getStats();
// → { channels, bits, usedBits, efficiency, time }

// Установить активные каналы
engine.setActiveChannels(['synonyms', 'punctuation', 'dates']);

// Морфология
const morph = engine.getMorphology();
```

---

## Энкодеры (чистое шифрование)

Каждый энкодер имеет статические методы:

| Метод | Описание |
|-------|----------|
| `encode(Uint8Array)` → `string` или `Promise<string>` | Закодировать байты |
| `decode(string)` → `Uint8Array\|null` или `Promise<...>` | Декодировать строку |
| `detect(string)` → `boolean` | Определить, использует ли текст данную кодировку |
| `capacity(textLength)` → `number` | Ёмкость в битах для заданной длины текста |

### Реестр энкодеров

| ID | Label | Magic Prefix | Бит/символ | Описание |
|----|-------|--------------|------------|----------|
| `invisible-spaces` | Невидимые символы | `\u200B\u200C` (ZWSP+ZWNJ) | ~2.58 | 6 устойчивых zero-width символов (ZWSP, ZWNJ, ZWJ, Word Joiner, BOM, CGJ) |
| `base64` | Base64 | `𝐁64:` / `𝐁85:` | 6.0 / ~6.4 | Base64url или Base85 (Ascii85) — автовыбор |
| `compression` | Deflate+B64 | `ZH:` | ~4.5 | Deflate + base64url (CompressionStream API) |
| `emoji` | Эмодзи | `😀🔤` | 8.0 | 256 уникальных эмодзи → 1 байт каждое |
| `chinese` | Иероглифы | `之码曰` | ~14.3 | CJK Unified Ideographs (U+4E00..U+9FFF), magic как китайская фраза |
| `layout-switch` | Смена раскладки | `⌨️⇄:` | 8.0 | ЙЦУКЕН ↔ QWERTY (без шифрования!) |

### Функции реестра

```javascript
import { getEncoderById, detectEncoder, getEncoderList } from './core/encoders/index.js';

// Получить энкодер по ID
const enc = getEncoderById('emoji');

// Автообнаружение кодировки
const detected = detectEncoder(someText); // → encoder class or null

// Список всех энкодеров
const list = getEncoderList(); // → [{ id, label, icon }]
```

---

## CleanCrypto API (AES-256-GCM)

```javascript
const crypto = new CleanCrypto();

// Шифрование
const encrypted = await crypto.encrypt(plaintext, password, chatId);
// → Uint8Array: MAGIC(3) + IV(12) + ciphertext + tag(16)

// Дешифровка
const decrypted = await crypto.decrypt(encrypted, password, chatId);
// → string

// Полный пайплайн (encrypt → encode)
const encoded = await crypto.encryptAndEncode(plaintext, password, encoderId, chatId);

// Полный пайплайн (detect → decode → decrypt)
const result = await crypto.decodeAndDecrypt(encoded, password, chatId);

// Оценка размера
const size = crypto.encryptedSize(textLength);

// Управление паролями (статические методы)
CleanCrypto.savePassword(chatId, password);
const pw = CleanCrypto.getSavedPassword(chatId); // → string|null
CleanCrypto.removePassword(chatId);
const all = CleanCrypto.getAllPasswords(); // → { chatId: password }
```

### Схема шифрования
- **KDF**: PBKDF2(password + ':' + chatId, SALT, 100000, SHA-256) → 256 бит
- **Алгоритм**: AES-256-GCM
- **IV**: 12 байт (случайный, prepended)
- **Формат**: `MAGIC(0x43 0x52 0x59)` + `IV(12)` + `ciphertext + tag(16)`

---

## Каналы стеганографии

### Безопасные каналы (по умолчанию)

Эти каналы не нарушают детерминизм декодирования — их `bases` при `encode` совпадают с `bases` при `decode`.

| Канал | Описание | Категория |
|-------|----------|-----------|
| `letter-stego` | Детерминированные буквенные мутации | Структурный |
| `punctuation` | Тире/кавычки варианты | Структурный |
| `dates` | Форматы дат | Структурный |
| `typos` | Дефисные варианты (всё-таки ↔ всё таки) | Структурный |
| `duplets` | Орфографические варианты (блогер ↔ блоггер) | Структурный |
| `abbreviations` | Аббревиатуры (РФ ↔ Российская Федерация) | Структурный |
| `spaces` | NBSP ↔ обычный пробел | Невидимый |
| `synonyms` | Синонимы (последний — после всех структурных) | Лингвистический |

### Экспериментальные каналы (отключены по умолчанию)

| Канал | Причина отключения |
|-------|--------------------|
| `yo-replacement` | Белый список пересекается со словарём синонимов |
| `word-order` | Требует оригинал для decode |
| `zero-width` | Не лингвистический метод |
| `parasites` | Вставка слов может изменить позиции синонимов |
| `phrases` | Вставка фраз может изменить позиции синонимов |
| `voice` | Замена слов из словаря синонимов |
| `participles` | Замена слов из словаря синонимов |
| `numbers` | Замена слов из словаря синонимов |
| `case` | Замена слов из словаря синонимов |
| `smiles` | Вставка может изменить позиции |

---

## Dev Tester (Панель разработчика)

### Способы вызова
1. **Клавиатура**: `Ctrl+Shift+D`
2. **Мышь**: Двойной клик на логотип «🔒 CryptoMsg»
3. **API**: `CryptoMsgAPI.toggleDevPanel()` или `CryptoMsgAPI.runDevTests()`

### Тестовые сьюты

| Сьют | Что тестирует |
|------|---------------|
| AES-256-GCM (CleanCrypto) | Шифрование/дешифровка roundtrip, неверный пароль, повреждённые данные |
| Encoder: * | Roundtrip encode→decode, автообнаружение (detect), различные размеры |
| Layout Switch (специальные) | Точные соответствия ru→en, roundtrip ru→en→ru |
| Полный пайплайн | encrypt→encode→decode→decrypt для каждого энкодера |
| Стеганография (StegoEngine) | encode→decode roundtrip, неверный пароль, отдельные каналы |
| Краевые случаи | Пустые строки, управление паролями, detect на мусорных данных |
| Совместимость | Уникальность magic-префиксов, отсутствие ложных срабатываний detect |
| Лимиты символов | Разумный коэффициент расширения (<10x) |

---

## Список изменений

### [Текущая версия] — 2025-03-05

#### Добавлено
- 🧪 **Панель разработчика** (`js/dev/dev-tester.js`)
  - Тестирование всех функций шифрования и кодирования
  - 8 тестовых сьютов: AES-256-GCM, энкодеры, layout switch, полный пайплайн, стеганография, краевые случаи, совместимость, лимиты
  - UI-панель с результатами по сьютам
  - Активация: `Ctrl+Shift+D`, двойной клик на лого, `CryptoMsgAPI.toggleDevPanel()`
  - Два режима: полный тест и быстрый (уменьшенный набор сообщений)
  - API-методы: `CryptoMsgAPI.runDevTests()`, `CryptoMsgAPI.toggleDevPanel()`
- 📄 **Документация** (`public/PROJECT.md`) — данный файл

#### Исправлено (критические баги)
- 🐛 **AES-256 декодирование**: исправлена функция `_base64urlToBytes()` — неверная обработка padding (условия `i > 0` всегда true → лишние нулевые байты → ошибка AES-GCM). Переписана с корректным расчётом output length.
- 🐛 **Emoji декодирование**: удалены дубликаты из `EMOJI_ALPHABET` (📱💻💿🎥📡 и др. встречались 2-4 раза), что ломало reverse map и roundtrip. Алфавит теперь строго 256 уникальных эмодзи.
- 🐛 **Невидимые символы**: убраны проблемные символы, которые превращаются в кружочки при копировании или удаляются мессенджерами:
  - Удалены: `\u180E` (Mongolian Vowel Separator → кружок), `\u2028`/`\u2029` (Line/Paragraph Separator → перенос строки), `\u2000`-`\u200A` (width spaces → нормализация), `\u3000` (Ideographic Space → видимый), `\u2061`-`\u2064` (Invisible Operators → могут удаляться)
  - Оставлены 6 устойчивых: ZWSP, ZWNJ, ZWJ, Word Joiner, BOM, CGJ → base-6 (~2.58 бит/символ)
- 🐛 **Сжатие (Compression)**: переименовано в "Deflate+B64", magic изменён с `📦Z:` на `ZH:` (без эмодзи в маркерах). Исправлен fallback на корректный base64url decode.
- 🐛 **Китайские иероглифы**: magic изменён с `🈳CJK:` на `之码曰` (3 иероглифа, выглядит как естественный китайский текст, не выдаёт шифр).
- 🐛 Импорт `layout-switch.js` → `layout-switch-encoder.js` в `main.js` (убрано 404)

#### Исправлено (UI/мобильные)
- 📱 **Белая рамка**: убрана белая рамка вокруг iframe, фон body = `#0b0d13`, iframe position:fixed
- 📱 **Мобильная адаптация**: полная переработка responsive-стилей для экранов <600px
  - Компактные заголовки, табы, текстовые поля
  - Панель настроек: `transform: translateX(100%)` вместо `right: -360px` (не пролезает на мобильных)
  - `100dvh` вместо `100vh` для мобильных браузеров
  - `env(safe-area-inset-*)` для телефонов с вырезом
  - Настройки на мобильных раскрываются на всю ширину экрана

#### Переименования в UI
- "Сжатие" → "Deflate+B64" (подтаб и настройки)
- "Китайские" → "Иероглифы" (подтаб и настройки)

#### Архитектура
- Чистый JavaScript (ES Modules), без сборщиков
- Все файлы в `public/` — обслуживаются как статика
- Стили scoped под `.crypto-messenger` — безопасное встраивание
- Глобальный API `window.CryptoMsgAPI` — для интеграции (Tampermonkey, расширения, PyWebView)
