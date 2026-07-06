(function() {
    window.SPA = {
        isNavigating: false,
        
        init() {
            document.addEventListener('click', e => {
                const link = e.target.closest('a');
                if (!link) return;
                
                // Игнорируем внешние ссылки, новые вкладки и якоря
                if (link.hostname !== window.location.hostname || 
                    link.getAttribute('target') === '_blank' || 
                    link.getAttribute('download') !== null ||
                    link.href.includes('#')) {
                    return;
                }
                
                // Игнорируем кнопку выхода и API-запросы
                if (link.id === 'nav-logout' || link.href.includes('/api/')) return;
                
                e.preventDefault();
                this.navigate(link.href);
            });
            
            window.addEventListener('popstate', () => {
                this.navigate(location.href, true);
            });
        },
        
        async navigate(url, isPopState = false) {
            if (this.isNavigating) return;
            this.isNavigating = true;
            
            // Вызываем событие выгрузки (для очистки интервалов)
            document.dispatchEvent(new Event('spa:unload'));
            
            const main = document.querySelector('main');
            if (main) {
                main.classList.add('page-exit');
                // Ждем окончания анимации исчезновения
                await new Promise(r => setTimeout(r, 200));
            }
            
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error('Fetch failed');
                const html = await res.text();
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                document.title = doc.title;
                
                const newMain = doc.querySelector('main');
                if (main && newMain) {
                    main.innerHTML = newMain.innerHTML;
                    main.className = newMain.className;
                    document.body.className = doc.body.className;
                    document.body.id = doc.body.id;
                }
                
                if (!isPopState) {
                    history.pushState({}, '', url);
                }
                
                // Перевод и обновление элементов шапки
                if (window.applyTranslations) window.applyTranslations();
                if (window.updateNavbarNotifications) window.updateNavbarNotifications();
                
                // Сигнал всем скриптам, что страница загружена
                document.dispatchEvent(new Event('spa:navigate'));
                
                // Анимация появления
                if (main) {
                    main.classList.remove('page-exit');
                    main.classList.add('page-enter');
                    
                    // Принудительный reflow
                    void main.offsetWidth;
                    
                    main.classList.remove('page-enter');
                }
            } catch (err) {
                console.error('SPA Navigation Error:', err);
                window.location.href = url; // Fallback
            } finally {
                this.isNavigating = false;
            }
        }
    };
    
    // Инициализация при первой загрузке страницы
    document.addEventListener("DOMContentLoaded", () => {
        window.SPA.init();
        document.dispatchEvent(new Event('spa:navigate'));
    });
})();
