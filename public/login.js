document.getElementById('login-form').addEventListener('submit', async (e) => {
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
                messageDiv.textContent = 'Успешный вход!';
            }
            // Токен также сохраняем в localStorage для обратной совместимости
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            if (messageDiv) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = data.error || 'Неверные учетные данные.';
            }
        }
    } catch (error) {
        console.error('Ошибка при выполнении запроса входа:', error);
        document.getElementById('message').textContent = 'Ошибка подключения к серверу.';
    }
});