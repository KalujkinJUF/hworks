document.addEventListener('spa:navigate', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    let failedAttempts = 0;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            const messageDiv = document.getElementById('message');

            if (response.ok) {
                if (messageDiv) {
                    messageDiv.style.color = '#00ff00';
                    messageDiv.textContent = window.t('login_success', 'Успешный вход!');
                }

                setTimeout(() => {
                    // Navigate via hard reload to initialize user state
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                if (messageDiv) {
                    messageDiv.style.color = 'red';
                    messageDiv.textContent = window.tErr(data.error) || window.t('login_failed', 'Неверные учетные данные.');
                }
                // Счётчик неудачных попыток — после 3-х предлагаем сброс пароля
                failedAttempts++;
                if (failedAttempts >= 3) {
                    const prompt = document.getElementById('reset-password-prompt');
                    if (prompt) prompt.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Ошибка при выполнении запроса входа:', error);
            document.getElementById('message').textContent = window.t('error_network', 'Ошибка подключения к серверу.');
        }
    });

    // Клик по «Сбросить пароль»: отправляем код и переходим на страницу сброса
    const resetLink = document.getElementById('reset-password-link');
    if (resetLink) {
        resetLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = (document.getElementById('username').value || '').trim();
            const messageDiv = document.getElementById('message');
            if (!username) {
                if (messageDiv) {
                    messageDiv.style.color = 'red';
                    messageDiv.textContent = window.t('login_reset_need_user', 'Введите логин или email, чтобы сбросить пароль');
                }
                return;
            }
            resetLink.style.pointerEvents = 'none';
            try {
                await fetch('/api/users/reset-password/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username })
                });
            } catch (err) {
                console.error('Ошибка запроса сброса пароля:', err);
            }
            // В любом случае ведём на страницу ввода кода (не раскрываем существование аккаунта)
            window.location.href = 'reset-password.html?u=' + encodeURIComponent(username);
        });
    }
});
