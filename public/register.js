document.getElementById('register-form').addEventListener('submit', async (e) => {
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
            messageDiv.textContent = 'Пожалуйста, подтвердите, что вы не робот.';
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
                messageDiv.textContent = 'Успешно! Входим в профиль...';
            }

            // Делаем небольшую задержку в 1.5 секунды, чтобы юзер успел увидеть надпись об успехе, и перекидываем
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1500);

        } else {
            if (window.turnstile) window.turnstile.reset();
            if (messageDiv) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = data.error || 'Произошла ошибка при регистрации.';
            }
        }
    } catch (error) {
        if (window.turnstile) window.turnstile.reset();
        console.error('Ошибка при выполнении запроса регистрации:', error);
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = 'Ошибка подключения к серверу.';
        }
    }
});