// Страница сброса пароля: сначала подтверждение кодом (личность), затем новый пароль.
document.addEventListener('spa:navigate', () => {
    const root = document.getElementById('reset-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const username = params.get('u') || '';

    const codeInput = document.getElementById('reset-code');
    const verifyBtn = document.getElementById('reset-verify-btn');
    const passStep = document.getElementById('reset-step-password');
    const newPassInput = document.getElementById('reset-new-password');
    const confirmBtn = document.getElementById('reset-confirm-btn');
    const messageDiv = document.getElementById('reset-message');

    if (!username) {
        // Без имени пользователя сбрасывать нечего — вернём на логин
        if (messageDiv) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = window.t('reset_no_user', 'Начните сброс со страницы входа.');
        }
        return;
    }

    let verifiedCode = null;

    function setMessage(text, ok) {
        if (!messageDiv) return;
        messageDiv.style.color = ok ? '#00ff00' : 'red';
        messageDiv.textContent = text;
    }

    // Шаг 1: подтверждение кода
    verifyBtn.addEventListener('click', async () => {
        const code = (codeInput.value || '').trim();
        if (!code) { setMessage(window.t('reset_enter_code', 'Введите код из письма'), false); return; }
        verifyBtn.disabled = true;
        try {
            const res = await fetch('/api/users/reset-password/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, code })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                verifiedCode = code;
                setMessage(window.t('reset_code_ok', 'Код подтверждён. Введите новый пароль.'), true);
                // Разблокируем шаг 2, блокируем шаг 1
                passStep.style.display = 'block';
                codeInput.disabled = true;
                verifyBtn.style.display = 'none';
                newPassInput.focus();
            } else {
                setMessage(window.tErr(data.error) || window.t('reset_code_bad', 'Неверный или устаревший код'), false);
                verifyBtn.disabled = false;
            }
        } catch (err) {
            setMessage(window.t('error_network', 'Ошибка сети'), false);
            verifyBtn.disabled = false;
        }
    });

    // Шаг 2: установка нового пароля
    confirmBtn.addEventListener('click', async () => {
        if (!verifiedCode) return;
        const newPassword = newPassInput.value;
        if (!newPassword) { setMessage(window.t('reset_enter_password', 'Введите новый пароль'), false); return; }
        confirmBtn.disabled = true;
        try {
            const res = await fetch('/api/users/reset-password/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, code: verifiedCode, newPassword })
            });
            const data = await res.json();
            if (res.ok && data.message) {
                setMessage(window.t('reset_success', 'Пароль изменён! Сейчас перейдём ко входу…'), true);
                setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            } else {
                setMessage(window.tErr(data.error) || window.t('reset_fail', 'Не удалось сменить пароль'), false);
                confirmBtn.disabled = false;
            }
        } catch (err) {
            setMessage(window.t('error_network', 'Ошибка сети'), false);
            confirmBtn.disabled = false;
        }
    });

    // Enter в поле кода/пароля
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyBtn.click(); } });
    newPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); } });
});
