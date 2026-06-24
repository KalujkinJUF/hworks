document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    // Определяем текущую страницу
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Скрываем "сейчас онлайн" на всех страницах кроме главной
    if (currentPage !== 'index.html') {
        const onlineBox = document.querySelector('.online-box');
        if (onlineBox) {
            onlineBox.style.display = 'none';
        }
    }

    const btnRegister = document.getElementById("nav-register");
    const btnLogin = document.getElementById("nav-login");
    const btnProfile = document.getElementById("nav-profile");
    const btnSearch = document.getElementById("nav-search");
    const btnFriends = document.getElementById("nav-friends");
    const btnChat = document.getElementById("nav-chat");
    const btnAdmin = document.getElementById("nav-admin");
    const btnLogout = document.getElementById("nav-logout");

    // Сначала скрываем текущую страницу (для всех случаев)
    if (btnRegister && currentPage === 'register.html') btnRegister.style.display = "none";
    if (btnLogin && currentPage === 'login.html') btnLogin.style.display = "none";
    if (btnProfile && currentPage === 'profile.html') btnProfile.style.display = "none";
    if (btnSearch && currentPage === 'search.html') btnSearch.style.display = "none";
    if (btnFriends && currentPage === 'friends.html') btnFriends.style.display = "none";
    if (btnChat && currentPage === 'chat.html') btnChat.style.display = "none";
    if (btnAdmin && currentPage === 'admin.html') btnAdmin.style.display = "none";

    function updateNavbarNotifications() {
        if (!token) return;

        // Получаем непрочитанные сообщения
        fetch("/api/messages/unread/count", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const btnChat = document.getElementById("nav-chat");
            if (btnChat) {
                btnChat.textContent = count > 0 ? `Чат (+${count})` : "Чат";
            }
        })
        .catch(err => console.error("Ошибка при получении непрочитанных сообщений:", err));

        // Получаем входящие запросы в друзья
        fetch("/api/friends/requests/incoming", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(requests => {
            const count = requests.length || 0;
            const btnFriends = document.getElementById("nav-friends");
            if (btnFriends) {
                btnFriends.textContent = count > 0 ? `Друзья (+${count})` : "Друзья";
            }
        })
        .catch(err => console.error("Ошибка при получении запросов в друзья:", err));
    }

    if (token) {
        // Если пользователь ЗАЛОГИНИЛСЯ:
        if (btnRegister) btnRegister.style.display = "none";
        if (btnLogin) btnLogin.style.display = "none";
        if (btnProfile && currentPage !== 'profile.html') btnProfile.style.display = "inline-block";
        if (btnFriends && currentPage !== 'friends.html') btnFriends.style.display = "inline-block";
        if (btnChat && currentPage !== 'chat.html') btnChat.style.display = "inline-block";
        if (btnSearch && currentPage !== 'search.html' && currentPage !== 'profile.html') btnSearch.style.display = "inline-block";
        if (btnLogout) btnLogout.style.display = "inline-block";

        updateNavbarNotifications();
        setInterval(updateNavbarNotifications, 5000);

        // Проверяем роль через профиль, чтобы показать кнопку админки или скрыть функции забаненного
        fetch("/api/users/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.role === 'banned') {
                if (btnFriends) btnFriends.style.display = "none";
                if (btnChat) btnChat.style.display = "none";
                
                // Перенаправление забаненных пользователей
                if (currentPage === 'friends.html' || currentPage === 'chat.html') {
                    alert("Ваш аккаунт заблокирован. Доступ к друзьям и чату ограничен.");
                    window.location.href = "profile.html";
                }
            }
            if ((data.role === 'admin' || data.role === 'moderator') && btnAdmin && currentPage !== 'admin.html') {
                btnAdmin.style.display = "inline-block";
            }
        })
        .catch(() => {});
    } else {
        // Если пользователь НЕ залогинился:
        if (btnRegister && currentPage !== 'register.html') btnRegister.style.display = "inline-block";
        if (btnLogin && currentPage !== 'login.html') btnLogin.style.display = "inline-block";
        if (btnProfile) btnProfile.style.display = "none";
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        if (btnSearch && currentPage !== 'search.html' && currentPage !== 'profile.html') btnSearch.style.display = "inline-block";
        if (btnAdmin) btnAdmin.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
    }

    // Логика для кнопки "Выйти"
    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }
});