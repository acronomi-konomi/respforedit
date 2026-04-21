/**
 * Главный файл приложения
 * Az.js подключён глобально через <script> в index.html
 */

import StegoEngine from './core/engine.js';
import InterfaceManager from './ui/interface.js';
import StegoT9 from './ui/stego-t9.js';

// Инициализация приложения
(async function init() {
    console.log('🔐 Стего-Мессенджер загружается...');

    const loadingStatus = document.getElementById('loading-status');
    const loadingOverlay = document.getElementById('loading');

    try {
        // Ждём полной загрузки DOM
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }

        // Проверяем наличие Az.js
        if (typeof Az === 'undefined') {
            throw new Error('Az.js не загружен. Проверьте подключение lib/az.js.');
        }

        loadingStatus.textContent = 'Создание движка...';
        const engine = new StegoEngine();

        loadingStatus.textContent = 'Загрузка морфологических словарей...';
        // Передаём пустой basePath — все пути будут относительными от index.html
        await engine.loadChannels('');

        loadingStatus.textContent = '✅ Готово!';

        // Скрываем индикатор загрузки
        if (loadingOverlay) loadingOverlay.style.display = 'none';

        // Инициализируем интерфейс
        const ui = new InterfaceManager(engine);
        window.__stegoEngine = engine; // для отладки в консоли

        // Инициализируем Стего-Т9
        const carrierTextarea = document.getElementById('carrier-text');
        if (carrierTextarea) {
            const t9 = new StegoT9(carrierTextarea, engine);
        }

        console.log('✅ Приложение готово к работе!');
        console.log('Каналов загружено:', Object.keys(engine.channels).length);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        if (loadingStatus) {
            loadingStatus.textContent = 'Ошибка загрузки: ' + error.message;
            loadingStatus.style.color = '#ef4444';
        }
        // Не скрываем оверлей — показываем ошибку пользователю
    }
})();