document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Предотвращаем перезагрузку страницы

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    console.log('Отправка запроса на регистрацию:', { username, email, password });

    try {
        // Используем относительный путь, чтобы код не зависел от смены IP-адреса в локалке
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        console.log('Ответ от сервера (регистрация):', data);

        const messageDiv = document.getElementById('message');

        if (response.ok) {
            // Подсвечиваем зелёным (в нашем стиле это будет отлично смотреться)
            if (messageDiv) {
                messageDiv.style.color = '#00ff00';
                messageDiv.textContent = 'Успешно! Входим в профиль...';
            }

            // 1. Сохраняем токен, который нам теперь присылает обновлённый бэкенд
            localStorage.setItem('token', data.token);
            
            // 2. Делаем небольшую задержку в 1.5 секунды, чтобы юзер успел увидеть надпись об успехе, и перекидываем
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1500);

        } else {
            if (messageDiv) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = data.error || 'Произошла ошибка при регистрации.';
            }
        }
    } catch (error) {
        console.error('Ошибка при выполнении запроса регистрации:', error);
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = 'Ошибка подключения к серверу.';
        }
    }
});