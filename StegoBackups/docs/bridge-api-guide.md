# 🔒 Стегонатор — Руководство по Bridge API

## Безопасная интеграция шифрования и стеганографии в веб-мессенджерах

---

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Модель угроз](#2-модель-угроз)
3. [Поверхность API](#3-поверхность-api)
4. [Платформа 1: Python (PyWebView / PySide6)](#4-платформа-1-python-pywebview--pyside6)
5. [Платформа 2: Android (двойной WebView)](#5-платформа-2-android-двойной-webview)
6. [Платформа 3: Расширение браузера](#6-платформа-3-расширение-браузера)
7. [Управление токенами сессии](#7-управление-токенами-сессии)
8. [Управление паролями](#8-управление-паролями)
9. [Поток данных при шифровании](#9-поток-данных-при-шифровании)
10. [Поток данных при дешифровании](#10-поток-данных-при-дешифровании)
11. [Автоматическая детекция шифрования](#11-автоматическая-детекция-шифрования)
12. [Чек-лист безопасности](#12-чек-лист-безопасности)
13. [Типичные ошибки](#13-типичные-ошибки)

---

## 1. Обзор архитектуры

Стегонатор работает как **изолированный модуль шифрования/дешифрования**, который обменивается данными с небезопасным веб-мессенджером через **мост (Bridge API)**. Мост — единственный канал связи между двумя контекстами.

```
┌──────────────────────────────────────────────────────┐
│                 Контекст приложения                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           Стегонатор (изолирован)             │   │
│  │                                              │   │
│  │  ┌─────────────┐  ┌───────────────────┐     │   │
│  │  │ StegoEngine  │  │ CleanCrypto       │     │   │
│  │  │ (стего)      │  │ (AES-256-GCM)     │     │   │
│  │  └─────────────┘  └───────────────────┘     │   │
│  │  ┌─────────────────────────────────────┐     │   │
│  │  │ Пароли (только в памяти JS!)        │     │   │
│  │  └─────────────────────────────────────┘     │   │
│  └──────────────────┬───────────────────────┘   │
│                     │ Bridge API                  │
│                     │ (контролируемый канал)       │
│  ┌──────────────────▼───────────────────────┐   │
│  │       Веб-мессенджер (небезопасный)       │   │
│  │                                           │   │
│  │  - Отправляет зашифрованный текст          │   │
│  │  - Получает текст для проверки/дешифровки  │   │
│  │  - НЕ имеет доступа к паролям              │   │
│  │  - НЕ может расшифровать самостоятельно    │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Ключевой принцип

> **Мост передаёт только зашифрованный текст и метаданные. Пароли и открытый текст НИКОГДА не покидают контекст Стегонатора.**

---

## 2. Модель угроз

| Угроза | Описание | Уровень риска | Защита в Стегонаторе |
|--------|----------|---------------|---------------------|
| **Админ сайта мессенджера** | Может внедрить JS-код на страницу мессенджера, попытаться вызвать API Стегонатора | 🔴 Высокий | API доступен только в контексте своего окна; postMessage требует токен + origin |
| **XSS в мессенджере** | Злонамеренный скрипт на странице мессенджера пытается перехватить данные | 🔴 Высокий | Пароли не передаются через мост; API не возвращает plaintext |
| **Другая вкладка браузера** | Случайный доступ к API из другого контекста | 🟡 Средний | Токен сессии уникален; origin validation для postMessage |
| **MitM на уровне моста** | Перехват данных при передаче между WebView/окнами | 🟢 Низкий | Все данные зашифрованы до передачи; мост передаёт только ciphertext |
| **Утечка паролей через localStorage** | Доступ к сохранённым паролям через DevTools | 🟡 Средний | Сохранение паролей — опционально (по умолчанию выключено) |

---

## 3. Поверхность API

### 3.1. Методы, безопасные для вызова через мост

| Метод | Описание | Возвращает | Безопасность |
|-------|----------|------------|--------------|
| `bridge.send(encryptedText, chatId, timestamp)` | Отправить зашифрованный текст в мессенджер | `boolean` | Только ciphertext уходит |
| `window.StegonatorBridge.onIncoming(jsonStr)` | Получить текст из мессенджера для дешифровки | `void` | Текст + chatId приходят, обработка внутри |
| `window.StegonatorBridge.detect(jsonStr)` | Проверить, содержит ли текст шифрование | Метаданные JSON | Только `{isEncrypted, algorithm, isStego}`, НИКОГО plaintext |

### 3.2. Методы, доступные только внутри контекста Стегонатора

| Метод | Описание | Возвращает | Примечание |
|-------|----------|------------|------------|
| `StegonatorAPI.encrypt(plaintext, password, mode)` | Зашифровать текст | Зашифрованную строку | Требует пароль — вызывайте через `evaluate_js` |
| `StegonatorAPI.stegoEncode(secret, carrier, password)` | Скрыть сообщение в тексте-носителе | Стего-текст | Требует пароль |
| `StegonatorAPI.stegoDecode(stegoText, password)` | Извлечь скрытое сообщение | ⚠️ Открытый текст | **ТОЛЬКО для доверенных автоматизаций!** |
| `StegonatorAPI.detect(text)` | Детекция шифрования | Метаданные | Безопасно — не возвращает текст |
| `StegonatorAPI.setChatId(chatId)` | Установить текущий chat ID | `void` | Безопасно |
| `StegonatorAPI.bridgeGetToken()` | Получить токен сессии моста | `string\|null` | Для настройки моста |
| `StegonatorAPI.isReady()` | Проверить готовность движка | `boolean` | Безопасно |
| `StegonatorAPI.getState()` | Получить состояние (санитизированное) | `object` | Движок и анализатор удалены |
| `StegonatorAPI.bridgeSend(text)` | Отправить текст через мост | `Promise<boolean>` | Делегирует bridge.send |
| `StegonatorAPI.bridgeConfigure(opts)` | Настроить мост | `void` | Безопасно |

### 3.3. Удалённые методы (НЕБЕЗОПАСНЫЕ)

| Метод | Почему удалён |
|-------|---------------|
| ~~`decrypt()`~~ | Возвращал plaintext — любой вызвавший мог получить расшифровку |
| ~~`autoDecode()`~~ | Возвращал plaintext — небезопасен для автоматизации |
| ~~`getStegoEngine()`~~ | Открывал доступ к internals движка — позволял обойти все ограничения |

> ⚠️ Отладочные методы (`_debug_getEngine()`) доступны только если установлен флаг `localStorage.setItem('stegonator_debug', 'true')`. Используйте их только для разработки.

---

## 4. Платформа 1: Python (PyWebView / PySide6)

### Архитектура

```
┌─────────────────────────────────────────────────┐
│  Python Process                                  │
│                                                  │
│  ┌──────────────────┐    ┌───────────────────┐  │
│  │  Window A        │    │  Window B          │  │
│  │  (Messenger)     │    │  (Стегонатор)      │  │
│  │                  │    │                    │  │
│  │  JS context:     │    │  JS context:       │  │
│  │  - injects text  │    │  - StegoEngine     │  │
│  │  - reads output  │    │  - CleanCrypto     │  │
│  │                  │    │  - passwords        │  │
│  └────────┬─────────┘    └────────┬──────────┘  │
│           │                       │              │
│           │   Python Bridge       │              │
│           │   (evaluate_js)       │              │
│           └───────────┬───────────┘              │
│                       │                          │
│            ┌──────────▼──────────┐               │
│            │  Python Controller  │               │
│            │  (ваш код)          │               │
│            └─────────────────────┘               │
└─────────────────────────────────────────────────┘
```

### Рекомендуемый метод связи: `evaluate_js()`

**Почему `evaluate_js()`, а не `postMessage`:**
- `evaluate_js()` выполняет код **напрямую в контексте нужного окна** — нет риска перехвата другим окном
- `postMessage` требует токен + origin validation — дополнительная поверхность атаки
- В PyWebView окна изолированы на уровне движка — `evaluate_js()` не может быть вызван из другого окна

### Полный пример Python-интеграции

```python
import json
import webview
import time

class StegonatorBridge:
    """Мост между мессенджером и Стегонатором в Python."""

    def __init__(self):
        self.stego_window = None
        self.messenger_window = None
        self.session_token = None
        self._stego_ready = False

    # ─── Инициализация ──────────────────────────────────────

    def on_stego_loaded(self, window):
        """Вызывается после загрузки Стегонатора."""
        self.stego_window = window
        # Инициализируем токен сессии и получаем его
        self.session_token = window.evaluate_js(
            'bridge.initSessionToken(); bridge.getToken()'
        )
        self._stego_ready = True
        print(f"[Bridge] Стегонатор загружен, токен: {self.session_token[:8]}...")

    def set_messenger_window(self, window):
        """Установить окно мессенджера."""
        self.messenger_window = window

    # ─── Безопасные методы ──────────────────────────────────

    def detect_encryption(self, text):
        """
        Проверить, содержит ли текст шифрование.
        Возвращает ТОЛЬКО метаданные — без расшифровки.

        Returns:
            dict: { isEncrypted: bool, algorithm: str|null,
                    isStego: bool, stegoCapacity: int }
        """
        if not self._stego_ready:
            return {'isEncrypted': False, 'algorithm': None, 'isStego': False}

        escaped = json.dumps(text)  # Безопасное экранирование для JS
        result_js = self.stego_window.evaluate_js(
            f'JSON.stringify(window.StegonatorAPI.detect({escaped}))'
        )
        return json.loads(result_js)

    def encrypt_message(self, plaintext, password, mode='aes256'):
        """
        Зашифровать сообщение.

        Args:
            plaintext: Открытый текст
            password: Пароль шифрования
            mode: 'aes256', 'invisible', 'base64', 'emoji', 'chinese', 'layout'

        Returns:
            str: Зашифрованная строка или None при ошибке
        """
        if not self._stego_ready:
            return None

        escaped_text = json.dumps(plaintext)
        escaped_pw = json.dumps(password)
        result = self.stego_window.evaluate_js(
            f'await window.StegonatorAPI.encrypt({escaped_text}, {escaped_pw}, "{mode}")'
        )
        return result

    def stego_encode(self, secret, carrier, password):
        """
        Скрыть секретное сообщение в тексте-носителе.

        Args:
            secret: Секретное сообщение
            carrier: Текст-носитель (видимый текст)
            password: Пароль шифрования

        Returns:
            str: Стего-текст (с обычным текстом + скрытым сообщением)
        """
        if not self._stego_ready:
            return None

        escaped_secret = json.dumps(secret)
        escaped_carrier = json.dumps(carrier)
        escaped_pw = json.dumps(password)
        result = self.stego_window.evaluate_js(
            f'await window.StegonatorAPI.stegoEncode({escaped_secret}, {escaped_carrier}, {escaped_pw})'
        )
        return result

    def stego_decode(self, stego_text, password):
        """
        Извлечь скрытое сообщение из стего-текста.
        ⚠️ Возвращает ОТКРЫТЫЙ ТЕКСТ — используйте только в доверенном контексте!

        Args:
            stego_text: Текст со скрытым сообщением
            password: Пароль дешифровки

        Returns:
            str: Расшифрованное сообщение или None при ошибке
        """
        if not self._stego_ready:
            return None

        escaped_text = json.dumps(stego_text)
        escaped_pw = json.dumps(password)
        result = self.stego_window.evaluate_js(
            f'await window.StegonatorAPI.stegoDecode({escaped_text}, {escaped_pw})'
        )
        return result

    def send_to_stego(self, text, chat_id):
        """
        Передать текст из мессенджера в Стегонатор для дешифровки.
        Текст обрабатывается внутри Стегонатора — plaintext не возвращается
        через этот метод.

        Args:
            text: Полученный зашифрованный текст
            chat_id: ID чата
        """
        if not self._stego_ready:
            return

        payload = json.dumps({'text': text, 'chatId': chat_id, 'timestamp': int(time.time() * 1000)})
        self.stego_window.evaluate_js(
            f'window.StegonatorBridge.onIncoming(\'{payload}\')'
        )

    def send_to_messenger(self, encrypted_text, chat_id):
        """
        Отправить зашифрованный текст из Стегонатора в мессенджер.

        Args:
            encrypted_text: Зашифрованный/стего-текст
            chat_id: ID чата
        """
        if not self.messenger_window:
            return

        escaped = json.dumps(encrypted_text)
        self.messenger_window.evaluate_js(
            f'insertEncryptedText({escaped}, "{chat_id}")'
        )

    # ─── Автоматизация ──────────────────────────────────────

    def auto_process_incoming(self, text, chat_id, password=None):
        """
        Полный цикл обработки входящего сообщения:
        1. Детекция шифрования
        2. Если зашифровано — попытка дешифровки

        ⚠️ Пароль должен быть предоставлен доверенным кодом (не мессенджером!)

        Args:
            text: Текст сообщения
            chat_id: ID чата
            password: Пароль для дешифровки (если None — только детекция)

        Returns:
            dict: { detected: dict, decoded: str|null }
        """
        detected = self.detect_encryption(text)

        if not detected.get('isEncrypted'):
            return {'detected': detected, 'decoded': None}

        if not password:
            return {'detected': detected, 'decoded': None}

        # Попытка дешифровки
        decoded = None
        if detected.get('isStego'):
            decoded = self.stego_decode(text, password)
        else:
            decoded = self.encrypt_message(text, password)  # Will try decrypt

        return {'detected': detected, 'decoded': decoded}


# ─── Запуск приложения ──────────────────────────────────────

def main():
    bridge = StegonatorBridge()

    # Создаём окна
    stego_window = webview.create_window(
        'Стегонатор',
        'stegonator.html',  # или URL
        width=480, height=720,
        js_api=bridge
    )

    messenger_window = webview.create_window(
        'Мессенджер',
        'https://web.telegram.org',
        width=800, height=720
    )

    bridge.set_messenger_window(messenger_window)

    # Событие загрузки Стегонатора
    def on_stego_loaded():
        bridge.on_stego_loaded(stego_window)

    webview.start()

if __name__ == '__main__':
    main()
```

### Правила безопасности для Python

| ✅ Делайте | ❌ Не делайте |
|-----------|-------------|
| Используйте `evaluate_js()` для вызова методов Стегонатора | Используйте `postMessage` между окнами PyWebView |
| Экранируйте строки через `json.dumps()` перед передачей в JS | Передавайте строки напрямую в `evaluate_js()` без экранирования |
| Храните пароли в Python только в памяти | Храните пароли в файлах конфигурации |
| Проверяйте `isReady()` перед вызовами | Вызывайте API до загрузки движка |
| Вызывайте `window.StegonatorBridge.onIncoming()` для передачи текста | Внедряйте JS-код мессенджера для прямого вызова API |

---

## 5. Платформа 2: Android (двойной WebView)

### Архитектура

```
┌─────────────────────────────────────────────────┐
│  Android App                                     │
│                                                  │
│  ┌──────────────────┐    ┌───────────────────┐  │
│  │  WebView A       │    │  WebView B         │  │
│  │  (Messenger)     │    │  (Стегонатор)      │  │
│  │                  │    │                    │  │
│  │  @JavascriptInt. │    │  @JavascriptInt.   │  │
│  │  MessengerBridge │    │  StegoBridge       │  │
│  └────────┬─────────┘    └────────┬──────────┘  │
│           │                       │              │
│           │   Kotlin/Java Bridge  │              │
│           └───────────┬───────────┘              │
│                       │                          │
│            ┌──────────▼──────────┐               │
│            │  BridgeController   │               │
│            └─────────────────────┘               │
└─────────────────────────────────────────────────┘
```

### Ключевой принцип: РАЗДЕЛЬНЫЕ интерфейсы

Каждый WebView получает **свой собственный** `@JavascriptInterface`. Мессенджер НЕ может вызвать методы Стегонатора напрямую — только через нативный мост.

### Полный пример Kotlin-интеграции

```kotlin
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Мост для WebView Стегонатора.
 * Добавляется ТОЛЬКО к WebView Стегонатора.
 */
class StegoBridge(private val controller: BridgeController) {

    @JavascriptInterface
    fun sendToMessenger(encryptedText: String, chatId: String) {
        // Стегонатор просит отправить зашифрованный текст в мессенджер
        controller.onEncryptedTextReady(encryptedText, chatId)
    }

    @JavascriptInterface
    fun getToken(): String {
        // Возвращаем токен сессии (для инициализации)
        return controller.sessionToken
    }
}

/**
 * Мост для WebView мессенджера.
 * Добавляется ТОЛЬКО к WebView мессенджера.
 * Содержит МИНИМАЛЬНЫЙ набор методов.
 */
class MessengerBridge(private val controller: BridgeController) {

    @JavascriptInterface
    fun sendTextToStego(text: String, chatId: String) {
        // Мессенджер передаёт текст для обработки Стегонатором
        controller.onIncomingText(text, chatId)
    }
}

/**
 * Контроллер моста — координирует обмен между WebView.
 */
class BridgeController(
    private val stegoWebView: WebView,
    private val messengerWebView: WebView
) {
    var sessionToken: String = ""
        private set

    private var stegoReady = false

    /**
     * Инициализация — вызывать после загрузки Стегонатора.
     */
    fun initBridge() {
        stegoWebView.post {
            // Генерируем токен сессии
            stegoWebView.evaluateJavascript(
                "bridge.initSessionToken(); bridge.getToken()"
            ) { token ->
                sessionToken = token?.trim('"') ?: ""
                stegoReady = true
            }
        }
    }

    /**
     * Мессенджер получил текст → передаём в Стегонатор.
     */
    fun onIncomingText(text: String, chatId: String) {
        if (!stegoReady) return

        val payload = JSONObject().apply {
            put("text", text)
            put("chatId", chatId)
            put("timestamp", System.currentTimeMillis())
        }

        stegoWebView.post {
            stegoWebView.evaluateJavascript(
                "window.StegonatorBridge.onIncoming('${payload.toString().replace("'", "\\'")}')",
                null
            )
        }
    }

    /**
     * Детекция шифрования — возвращает ТОЛЬКО метаданные.
     */
    fun detectEncryption(text: String, callback: (DetectionResult) -> Unit) {
        if (!stegoReady) {
            callback(DetectionResult())
            return
        }

        val escaped = JSONObject().put("text", text).toString()
        stegoWebView.post {
            stegoWebView.evaluateJavascript(
                "JSON.stringify(window.StegonatorBridge.detect('$escaped'))"
            ) { result ->
                try {
                    val json = JSONObject(result ?: "{}")
                    callback(DetectionResult(
                        isEncrypted = json.optBoolean("isEncrypted", false),
                        algorithm = json.optString("algorithm", null),
                        isStego = json.optBoolean("isStego", false),
                        stegoCapacity = json.optInt("stegoCapacity", 0)
                    ))
                } catch (e: Exception) {
                    callback(DetectionResult())
                }
            }
        }
    }

    /**
     * Стегонатор готов отправить зашифрованный текст → вставляем в мессенджер.
     */
    fun onEncryptedTextReady(encryptedText: String, chatId: String) {
        messengerWebView.post {
            messengerWebView.evaluateJavascript(
                "insertEncryptedText('${encryptedText.replace("'", "\\'")}', '$chatId')",
                null
            )
        }
    }
}

data class DetectionResult(
    val isEncrypted: Boolean = false,
    val algorithm: String? = null,
    val isStego: Boolean = false,
    val stegoCapacity: Int = 0
)
```

### Настройка WebView

```kotlin
class MainActivity : AppCompatActivity() {

    private lateinit var stegoWebView: WebView
    private lateinit var messengerWebView: WebView
    private lateinit var bridgeController: BridgeController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        stegoWebView = findViewById(R.id.stegoWebView)
        messengerWebView = findViewById(R.id.messengerWebView)

        // Настройка WebView Стегонатора
        stegoWebView.settings.javaScriptEnabled = true
        stegoWebView.settings.domStorageEnabled = true

        // Настройка WebView мессенджера
        messengerWebView.settings.javaScriptEnabled = true
        messengerWebView.settings.domStorageEnabled = true

        // Создаём контроллер моста
        bridgeController = BridgeController(stegoWebView, messengerWebView)

        // ⚠️ ВАЖНО: Каждый WebView получает СВОЙ интерфейс!
        // Стегонатор может отправлять текст в мессенджер
        stegoWebView.addJavascriptInterface(
            StegoBridge(bridgeController), "AndroidBridge"
        )

        // Мессенджер может передавать текст в Стегонатор
        // и ТОЛЬКО это — никаких методов дешифровки!
        messengerWebView.addJavascriptInterface(
            MessengerBridge(bridgeController), "MessengerNative"
        )

        // Загрузка
        stegoWebView.loadUrl("file:///android_asset/stegonator/index.html")
        messengerWebView.loadUrl("https://web.telegram.org")

        // Инициализация моста после загрузки Стегонатора
        stegoWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                bridgeController.initBridge()
            }
        }
    }
}
```

### Инъекция JS в мессенджер (для автоматизации)

```javascript
// Этот скрипт инъецируется в WebView мессенджера через evaluateJavascript
// Он следит за новыми сообщениями и передаёт их в нативный мост

(function() {
    // Метод для вставки зашифрованного текста в поле ввода
    window.insertEncryptedText = function(text, chatId) {
        const input = document.querySelector('div.input-message-container');
        if (input) {
            input.textContent = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    // Наблюдение за новыми сообщениями (если allowDetection включён)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.textContent && node.textContent.length > 10) {
                    // Передаём текст в нативный мост для детекции
                    if (window.MessengerNative) {
                        window.MessengerNative.sendTextToStego(
                            node.textContent,
                            getCurrentChatId()
                        );
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
```

### Правила безопасности для Android

| ✅ Делайте | ❌ Не делайте |
|-----------|-------------|
| Разделяйте `@JavascriptInterface` для каждого WebView | Добавляйте методы Стегонатора в `MessengerBridge` |
| Используйте `webView.post { }` для вызовов из фоновых потоков | Вызывайте `evaluateJavascript` из фонового потока |
| Передавайте текст через `onIncoming()` | Вызывайте `decrypt()` напрямую из мессенджера |
| Храните пароли в памяти Kotlin (SharedPreferences — только с encryption) | Храните пароли в открытом виде в SharedPreferences |
| Включайте `allowDetection` только по запросу пользователя | Оставляйте детекцию включённой всегда без уведомления |

---

## 6. Платформа 3: Расширение браузера

### Архитектура

```
┌─────────────────────────────────────────────────┐
│  Browser Extension                               │
│                                                  │
│  ┌──────────────────┐    ┌───────────────────┐  │
│  │  Content Script   │    │  Popup/Options     │  │
│  │  (Messenger page) │    │  (Стегонатор UI)   │  │
│  │                  │    │                    │  │
│  │  - detects text  │    │  - StegoEngine     │  │
│  │  - sends to bg   │    │  - CleanCrypto     │  │
│  │                  │    │  - passwords        │  │
│  └────────┬─────────┘    └────────┬──────────┘  │
│           │                       │              │
│           │   chrome.runtime      │              │
│           │   (message passing)   │              │
│           └───────────┬───────────┘              │
│                       │                          │
│            ┌──────────▼──────────┐               │
│            │  Background Script  │               │
│            │  (координатор)      │               │
│            └─────────────────────┘               │
└─────────────────────────────────────────────────┘
```

### Почему content script НЕ должен содержать Стегонатор

Content script разделяет DOM со страницей мессенджера. Любой XSS на странице может:
- Читать переменные content script
- Перехватывать `window.postMessage`
- Модифицировать DOM

Поэтому Стегонатор должен работать **только в popup или background script**, где у него изолированный контекст.

### Полный пример расширения

#### manifest.json

```json
{
    "manifest_version": 3,
    "name": "Стегонатор Bridge",
    "version": "1.0",
    "description": "Шифрование и стеганография для веб-мессенджеров",
    "permissions": ["activeTab", "storage"],
    "action": {
        "default_popup": "popup.html",
        "default_icon": "icon.png"
    },
    "content_scripts": [
        {
            "matches": ["https://web.telegram.org/*"],
            "js": ["content.js"],
            "run_at": "document_idle"
        }
    ],
    "background": {
        "service_worker": "background.js"
    }
}
```

#### content.js — работает на странице мессенджера

```javascript
/**
 * Content Script — работает на странице мессенджера.
 *
 * ⚠️ БЕЗОПАСНОСТЬ: Этот скрипт НЕ имеет доступа к StegoEngine,
 * CleanCrypto или паролям. Он только наблюдает за сообщениями
 * и отправляет их в background script для анализа.
 */

// Наблюдение за новыми сообщениями
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const text = node.textContent;
            if (text && text.length > 10) {
                // Отправляем текст в background для проверки
                chrome.runtime.sendMessage({
                    type: 'check-text',
                    text: text,
                    chatId: getChatId()
                });
            }
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Получаем зашифрованный текст для вставки из background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'insert-encrypted') {
        insertTextIntoInput(msg.encryptedText);
        sendResponse({ success: true });
    }
});

// Вспомогательные функции
function getChatId() {
    // Извлекаем ID чата из URL или DOM мессенджера
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('chat') || window.location.hash.slice(1) || 'default';
}

function insertTextIntoInput(text) {
    // Находим поле ввода и вставляем текст
    const input = document.querySelector('[contenteditable="true"]');
    if (input) {
        input.textContent = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
```

#### background.js — координатор

```javascript
/**
 * Background Script — координирует обмен между
 * content script (мессенджер) и popup (Стегонатор).
 *
 * НЕ содержит StegoEngine — только пересылает сообщения.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'check-text') {
        // Content script нашёл новый текст в мессенджере.
        // Пересылаем в popup для анализа (если открыт).
        chrome.runtime.sendMessage({
            type: 'detect-request',
            text: msg.text,
            chatId: msg.chatId
        }).catch(() => {
            // Popup закрыт — игнорируем
        });
        sendResponse({ received: true });
    }

    if (msg.type === 'send-to-messenger') {
        // Popup просит вставить зашифрованный текст в мессенджер.
        // Пересылаем в content script активной вкладки.
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'insert-encrypted',
                    encryptedText: msg.encryptedText
                });
            }
        });
        sendResponse({ sent: true });
    }
});
```

#### popup.js — Стегонатор UI

```javascript
/**
 * Popup Script — Стегонатор загружен здесь.
 * StegoEngine, CleanCrypto и пароли доступны
 * только в этом изолированном контексте.
 */

// Стегонатор загружен как обычно...
// После загрузки:

// Слушаем запросы от content script (через background)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'detect-request') {
        // Безопасная детекция — только метаданные
        const result = window.StegonatorAPI.detect(msg.text);
        sendResponse(result);
    }
});

// Кнопка «Отправить через мост»
document.getElementById('bridgeSend').addEventListener('click', () => {
    const encrypted = getEncryptedText(); // Ваш метод получения зашифрованного текста
    if (encrypted) {
        chrome.runtime.sendMessage({
            type: 'send-to-messenger',
            encryptedText: encrypted
        });
    }
});
```

### Правила безопасности для расширения

| ✅ Делайте | ❌ Не делайте |
|-----------|-------------|
| Используйте `chrome.runtime.sendMessage` для обмена | Используйте `window.postMessage` между content script и страницей |
| Загружайте Стегонатор в popup или отдельную вкладку | Внедряйте Стегонатор на страницу через content script |
| Content script отправляет только сырой текст | Content script запрашивает расшифровку или пароли |
| Детекция возвращает только метаданные | Возвращайте plaintext через `chrome.runtime.sendMessage` |

---

## 7. Управление токенами сессии

### Когда нужен токен

| Платформа | Токен нужен? | Причина |
|-----------|-------------|---------|
| **Python (PyWebView)** | ❌ Нет | `evaluate_js()` уже выполняется в контексте конкретного окна |
| **Android (JSI)** | ❌ Нет | `@JavascriptInterface` доступен только из нативного кода |
| **Расширение (chrome.runtime)** | ❌ Нет | Сообщения изолированы API расширения |
| **iframe (postMessage)** | ✅ ДА | `postMessage` доступен всем окнам — нужен токен + origin |

### Жизненный цикл токена (для iframe/postMessage)

```
1. Стегонатор загружается в iframe
2. Родительское окно запрашивает токен:
   iframe.contentWindow.postMessage(
       { type: 'stegonator-request-token' },
       targetOrigin
   )
3. Стегонатор инициализирует токен и отвечает:
   event.source.postMessage(
       { type: 'stegonator-token', token: 'uuid...' },
       event.origin
   )
4. Все последующие сообщения включают токен:
   iframe.contentWindow.postMessage(
       { type: 'stegonator-incoming', text: '...', token: 'uuid...' },
       targetOrigin
   )
5. Стегонатор отклоняет сообщения без правильного токена
6. Токен обновляется при каждой перезагрузке Стегонатора
```

### Генерация токена

```javascript
// В Стегонаторе (bridge.initSessionToken):
this._sessionToken = crypto.randomUUID(); // UUID v4 — 128 бит энтропии
```

---

## 8. Управление паролями

### Принцип: пароль — только в памяти JS-контекста Стегонатора

```
┌─────────────────────────────────────────────────┐
│  Стегонатор (JS context)                        │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  Пароли существуют ЗДЕСЬ и ТОЛЬКО ЗДЕСЬ │    │
│  │                                          │    │
│  │  Источники:                              │    │
│  │  1. Поле ввода пароля (DOM)              │    │
│  │  2. localStorage (если пользователь      │    │
│  │     разрешил сохранение)                  │    │
│  │  3. bridge._tryAutoDecode (внутренний)   │    │
│  │                                          │    │
│  │  Пароль НИКОГДА не покидает этот блок!   │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ╳ bridge.send() — пароль НЕ передаётся          │
│  ╳ StegonatorAPI.* — пароль НЕ возвращается      │
│  ╳ postMessage — пароль НЕ включён               │
└─────────────────────────────────────────────────┘
```

### Сохранение паролей (опционально)

По умолчанию пароли **не сохраняются** между сессиями. Если пользователь включает опцию «Сохранять пароль для чата»:

```javascript
// CleanCrypto.savePassword(chatId, password)
// Сохраняет в localStorage как:
// cryptoMsg_passwords = { "chat_123": "mypassword", ... }

// ⚠️ localStorage доступен через DevTools любого расширения!
// Рекомендуйте пользователям:
// 1. Не сохранять пароли на общих/недоверенных устройствах
// 2. Использовать мастер-пароль браузера (если доступен)
// 3. Очищать сохранённые пароли после использования
```

### Рекомендации по паролям для каждой платформы

| Платформа | Хранение пароля | Рекомендация |
|-----------|----------------|--------------|
| **Python** | В памяти Python-процесса | Используйте `getpass()` или переменные окружения |
| **Android** | В памяти Activity/ViewModel | Не используйте SharedPreferences без encryption |
| **Расширение** | `chrome.storage.local` (encrypted) | Используйте `chrome.storage.session` (memory-only) |

---

## 9. Поток данных при шифровании

### Полный цикл: пользователь хочет отправить зашифрованное сообщение

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Польз-ль │     │  Стегонатор  │     │  Bridge API  │     │  Мессенджер  │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                     │                     │
     │ Вводит секрет   │                     │                     │
     │ + текст-носитель│                     │                     │
     │ + пароль        │                     │                     │
     │─────────────────>│                     │                     │
     │                  │                     │                     │
     │                  │ 1. AES-256-GCM      │                     │
     │                  │    шифрование       │                     │
     │                  │                     │                     │
     │                  │ 2. Стего-кодирование │                     │
     │                  │    (если стего)      │                     │
     │                  │                     │                     │
     │                  │ 3. bridge.send()     │                     │
     │                  │────────────────────>│                     │
     │                  │   Только ciphertext! │                     │
     │                  │                     │                     │
     │                  │                     │ 4. Вставка текста    │
     │                  │                     │────────────────────>│
     │                  │                     │                     │
     │                  │                     │      5. Отправка    │
     │                  │                     │      пользователем  │
     │                  │                     │                     │
```

### Что передаётся через мост при шифровании

```json
{
    "type": "stegonator-outgoing",
    "text": "Привет, как дела? Что нового сегодня?",
    "chatId": "chat_123",
    "timestamp": 1700000000000,
    "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

> **Примечание:** Поле `text` содержит только зашифрованный/стего-текст. Пароль и открытый текст **отсутствуют**.

---

## 10. Поток данных при дешифровании

### Полный цикл: мессенджер получает зашифрованное сообщение

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Польз-ль │     │  Мессенджер  │     │  Bridge API  │     │  Стегонатор  │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                     │                     │
     │  Получает        │                     │                     │
     │  сообщение       │                     │                     │
     │<─────────────────│                     │                     │
     │                  │                     │                     │
     │  Передаёт текст  │                     │                     │
     │  в Стегонатор    │                     │                     │
     │─────────────────────────────────────────────────────────────>│
     │                  │                     │                     │
     │                  │                     │      1. Детекция     │
     │                  │                     │         алгоритма    │
     │                  │                     │                     │
     │                  │                     │      2. Дешифровка   │
     │                  │                     │      (пароль из     │
     │                  │                     │       UI/хранилища) │
     │                  │                     │                     │
     │  Видит результат │                     │                     │
     │  в UI Стегонатора│                     │                     │
     │<─────────────────────────────────────────────────────────────│
     │                  │                     │                     │
```

### Что передаётся через мост при дешифровании

**Входящий запрос (мессенджер → Стегонатор):**
```json
{
    "type": "stegonator-incoming",
    "text": "Привет, как дела? Что нового сегодня?",
    "chatId": "chat_123",
    "timestamp": 1700000000000,
    "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

> **Важно:** Результат дешифровки отображается **только в UI Стегонатора** — он НЕ отправляется обратно через мост. Это гарантирует, что мессенджер никогда не получит открытый текст.

---

## 11. Автоматическая детекция шифрования

### Как работает детекция

Стегонатор может автоматически определять, содержит ли текст шифрование или стеганографию. Это позволяет мосту маршрутизировать сообщения без участия пользователя.

```
Текст → detectEncryption()
           │
           ├── 1. CRY magic bytes? → AES-256-GCM
           │
           ├── 2. Encoder signatures? → base64/invisible/emoji/chinese/compression/layout
           │
           ├── 3. Layout switch? → Раскладка
           │
           └── 4. Stego capacity? → Стего
                                   │
                                   └── { isEncrypted, algorithm, isStego, stegoCapacity }
```

### Результат детекции

```json
{
    "isEncrypted": true,
    "algorithm": "Стего",
    "isStego": true,
    "stegoCapacity": 128,
    "stegoChannels": 4
}
```

### Ограничения детекции

1. **Детекция стеганографии — эвристическая**: нельзя точно определить, содержит ли текст стего, без пароля
2. **Rate limiting**: максимум 30 запросов на детекцию в минуту (защита от DoS)
3. **По умолчанию включена**, но можно отключить в настройках (`allowDetection = false`)

### Когда использовать детекцию

| Сценарий | Использовать детекцию? |
|----------|----------------------|
| Автоматическая маршрутизация входящих сообщений | ✅ Да |
| Подсветка зашифрованных сообщений в мессенджере | ✅ Да |
| Проверка перед попыткой дешифровки | ✅ Да |
| Массовый сканирование всех сообщений | ❌ Нет — ресурсоёмко |
| Передача результатов детекции третьим лицам | ❌ Нет — это метаданные |

---

## 12. Чек-лист безопасности

### Перед деплоем проверьте:

- [ ] Мост включён только в доверенном контексте (своё окно/WebView)
- [ ] `allowDetection` включён осознанно (по умолчанию true, но пользователь предупреждён)
- [ ] Пароли не сохраняются без явного согласия пользователя
- [ ] `decrypt()`, `autoDecode()`, `getStegoEngine()` удалены из публичного API
- [ ] Rate limiting на детекции активен (30/мин)
- [ ] Origin validation для postMessage (не `*`)
- [ ] Токен сессии для postMessage (уникальный UUID v4)
- [ ] Длина входящего текста ограничена (100KB)
- [ ] Длина chatId ограничена (256 символов)
- [ ] В PyWebView/Android используется `evaluate_js()`, не postMessage
- [ ] В расширении используется `chrome.runtime.sendMessage`, не `window.postMessage`
- [ ] Content script не имеет доступа к StegoEngine или паролям
- [ ] Результат дешифровки не отправляется обратно через мост

### При настройке моста:

- [ ] Указан конкретный `targetOrigin` (не `*`)
- [ ] Метод моста соответствует платформе (`jsi` для Android, `pywebview` для Python)
- [ ] Пароли вводятся только в UI Стегонатора
- [ ] Автодекодирование включено только если пользователь понимает риски

---

## 13. Типичные ошибки

### ❌ Ошибка 1: Передача пароля через мост

```python
# НЕВЕРНО!
messenger_window.evaluate_js(
    f'window.StegonatorAPI.stegoDecode("{text}", "{password}")'
)
```

```python
# ПРАВИЛЬНО: пароль вводится в UI Стегонатора
# или передаётся через evaluate_js в контекст Стегонатора
stego_window.evaluate_js(
    f'dom.passwordDecode.value = "{password}"'
)
```

### ❌ Ошибка 2: Использование postMessage без origin

```javascript
// НЕВЕРНО!
window.postMessage({ type: 'stegonator-incoming', text: msg }, '*');
```

```javascript
// ПРАВИЛЬНО: конкретный origin + токен
iframe.contentWindow.postMessage(
    { type: 'stegonator-incoming', text: msg, token: sessionToken },
    'https://trusted-origin.com'
);
```

### ❌ Ошибка 3: Внедрение Стегонатора на страницу мессенджера

```javascript
// НЕВЕРНО! XSS на странице мессенджера получит доступ к StegoEngine.
const script = document.createElement('script');
script.src = chrome.runtime.getURL('stegonator.js');
document.head.appendChild(script);
```

```javascript
// ПРАВИЛЬНО: Стегонатор работает в popup или background script.
// Content script только отправляет текст через chrome.runtime.sendMessage.
```

### ❌ Ошибка 4: Возврат plaintext через мост

```javascript
// НЕВЕРНО! Расшифрованный текст не должен покидать Стегонатор.
bridge._incomingCallback = (data) => {
    const decrypted = decrypt(data.text, password);
    sendBackToMessenger(decrypted); // ОШИБКА!
};
```

```javascript
// ПРАВИЛЬНО: Расшифровка показывается только в UI Стегонатора.
bridge._incomingCallback = (data) => {
    _tryAutoDecode(data.text, password, data.chatId).then(result => {
        if (result) {
            showDecodedInUI(result.text); // Только в UI!
        }
    });
};
```

### ❌ Ошибка 5: Отсутствие rate limiting на детекции

```javascript
// НЕВЕРНО! Злоумышленник может вызвать detect() 1000 раз/сек.
window.StegonatorBridge.detect = (jsonStr) => {
    return JSON.stringify(bridge.detectEncryption(text));
};
```

```javascript
// ПРАВИЛЬНО: Rate limiting встроен в detectEncryption().
// Максимум 30 вызовов в минуту. При превышении — rateLimited: true.
```

---

## Приложение A: Формат сообщений моста

### Исходящее сообщение (Стегонатор → Мессенджер)

```json
{
    "type": "stegonator-outgoing",
    "text": "<зашифрованный/стего текст>",
    "chatId": "<ID чата>",
    "timestamp": 1700000000000,
    "token": "<session token UUID>"
}
```

### Входящее сообщение (Мессенджер → Стегонатор)

```json
{
    "type": "stegonator-incoming",
    "text": "<полученный текст>",
    "chatId": "<ID чата>",
    "timestamp": 1700000000000,
    "token": "<session token UUID>"
}
```

### Запрос токена

```json
{
    "type": "stegonator-request-token"
}
```

### Ответ с токеном

```json
{
    "type": "stegonator-token",
    "token": "<UUID v4>"
}
```

### Результат детекции

```json
{
    "isEncrypted": true,
    "algorithm": "AES-256-GCM",
    "isStego": false,
    "stegoCapacity": 0
}
```

Или для стего:

```json
{
    "isEncrypted": true,
    "algorithm": "Стего",
    "isStego": true,
    "stegoCapacity": 128,
    "stegoChannels": 4
}
```

---

## Приложение B: Быстрый старт

### Python (PyWebView) — минимум кода

```python
import webview, json

bridge = webview.create_window('Стегонатор', 'index.html')
messenger = webview.create_window('Мессенджер', 'https://web.telegram.org')

def send_text_to_stego(text, chat_id):
    payload = json.dumps({'text': text, 'chatId': chat_id})
    bridge.evaluate_js(f"window.StegonatorBridge.onIncoming('{payload}')")

def get_detection(text):
    escaped = json.dumps(text)
    result = bridge.evaluate_js(f"JSON.stringify(window.StegonatorAPI.detect({escaped}))")
    return json.loads(result)

webview.start()
```

### Android — минимум кода

```kotlin
// В Activity:
stegoWebView.evaluateJavascript(
    "window.StegonatorBridge.onIncoming('$payload')", null
)

// Для детекции:
stegoWebView.evaluateJavascript(
    "JSON.stringify(window.StegonatorAPI.detect('$escapedText'))"
) { result -> /* обработка метаданных */ }
```

### Расширение — минимум кода

```javascript
// Content script:
chrome.runtime.sendMessage({ type: 'check-text', text: node.textContent });

// Background:
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'check-text') {
        // Переслать в popup для анализа
    }
});
```

---

*Документация Стегонатор v1.0 — Bridge API Security Guide*
