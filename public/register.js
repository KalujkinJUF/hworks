function loadTurnstileScript() {
    return new Promise((resolve) => {
        if (window.turnstile) return resolve();
        
        window.onloadTurnstileCallback = () => {
            resolve();
        };

        const existing = document.getElementById('cf-turnstile-script');
        if (existing) {
            const iv = setInterval(() => { if (window.turnstile) { clearInterval(iv); resolve(); } }, 100);
            setTimeout(() => { clearInterval(iv); resolve(); }, 5000);
            return;
        }
        const s = document.createElement('script');
        s.id = 'cf-turnstile-script';
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
    });
}

// Рендерим виджет вручную: авто-рендер не срабатывает при innerHTML-вставке в SPA
function renderTurnstile() {
    const tsEl = document.querySelector('.cf-turnstile');
    if (!tsEl || !window.turnstile || tsEl.dataset.rendered) return;
    try {
        window.turnstile.render(tsEl, {
            sitekey: tsEl.getAttribute('data-sitekey'),
            theme: tsEl.getAttribute('data-theme') || 'dark'
        });
        tsEl.dataset.rendered = '1';
    } catch (e) {
        console.error('Turnstile render error:', e);
    }
}

document.addEventListener('spa:navigate', () => {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    // Грузим Turnstile и рендерим капчу (SPA не выполняет head-скрипты страницы)
    loadTurnstileScript().then(renderTurnstile);

    registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Предотвращаем перезагрузку страницы

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
    const turnstileToken = turnstileResponse ? turnstileResponse.value : null;

    if (!turnstileToken) {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = window.t('register_captcha_required', 'Пожалуйста, подтвердите, что вы не робот.');
        }
        return;
    }

    try {
        // Используем относительный путь, чтобы код не зависел от смены IP-адреса в локалке
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, email, password, turnstileToken })
        });

        const data = await response.json();

        const messageDiv = document.getElementById('message');

        if (response.ok) {
            // Подсвечиваем зелёным (в нашем стиле это будет отлично смотреться)
            if (messageDiv) {
                messageDiv.style.color = '#00ff00';
                messageDiv.textContent = window.t('register_success', 'Успешно! Входим в профиль...');
            }

            // Делаем небольшую задержку в 1.5 секунды, чтобы юзер успел увидеть надпись об успехе, и перекидываем
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1500);

        } else {
            if (window.turnstile) window.turnstile.reset();
            if (messageDiv) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = window.tErr(data.error) || window.t('error_network', 'Произошла ошибка при регистрации.');
            }
        }
    } catch (error) {
        if (window.turnstile) window.turnstile.reset();
        console.error('Ошибка при выполнении запроса регистрации:', error);
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = window.t('error_network', 'Ошибка подключения к серверу.');
        }
    }
});
});