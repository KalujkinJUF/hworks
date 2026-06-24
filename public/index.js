document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    // Определение роли для показа формы поста
    if (token) {
        fetch("/api/users/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.role !== 'banned') {
                document.getElementById("postFormSection").style.display = 'block';
                // Скрыть кнопку "Обновления" для обычных пользователей
                if (data.role !== 'admin' && data.role !== 'moderator') {
                    document.getElementById("postPatchBtn").style.display = 'none';
                }
            }
            // Устанавливаем статус пользователя как онлайн
            fetch("/api/users/status/online", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            }).catch(() => {});
        })
        .catch(() => {});
    }

    // Загрузка постов
    function loadPosts() {
        fetch("/api/users/posts")
            .then(res => res.json())
            .then(posts => {
                const newsFeed = document.getElementById("newsFeed");
                const patchFeed = document.getElementById("patchFeed");

                const news = posts.filter(p => p.type === 'news');
                const patches = posts.filter(p => p.type === 'patch_note');

                newsFeed.innerHTML = news.length
                    ? news.map(post => renderPost(post)).join('')
                    : '<p class="loading-text">Новостей пока нет</p>';

                patchFeed.innerHTML = patches.length
                    ? patches.map(post => renderPost(post)).join('')
                    : '<p class="loading-text">Обновлений пока нет</p>';
            })
            .catch(() => {});
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderPost(post) {
        const roleColors = {
            admin: '#ff4444', moderator: '#ff8c00', user: '#00ccff',
            newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
        };
        const color = roleColors[post.role] || '#ffffff';
        const avatar = post.avatar ? post.avatar : '';
        return `
            <div class="post-card">
                <div class="post-header">
                    ${avatar ? `<img src="${avatar}" class="post-avatar">` : '<div class="post-avatar-placeholder"></div>'}
                    <span class="post-author" style="color: ${color};">${escapeHtml(post.username)}</span>
                    <span class="post-date">${new Date(post.created_at).toLocaleString()}</span>
                </div>
                <div class="post-content">${escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }

    // Загрузка онлайн пользователей
    function loadOnline() {
        fetch("/api/users/online")
            .then(res => res.json())
            .then(users => {
                const list = document.getElementById("onlineList");
                const roleColors = {
                    admin: '#ff4444', moderator: '#ff8c00', user: '#00ccff',
                    newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
                };
                if (users.length === 0) {
                    list.innerHTML = '<p class="loading-text">Никого нет в сети</p>';
                } else {
                    list.innerHTML = users.map(u =>
                        `<a href="profile.html?username=${encodeURIComponent(u.username)}" style="text-decoration: none; color: inherit;">
                            <div class="online-user">
                                <span class="online-dot"></span>
                                <span style="color: ${roleColors[u.role] || '#fff'};">${escapeHtml(u.username)}</span>
                            </div>
                        </a>`
                    ).join('');
                }
            })
            .catch(() => {
                document.getElementById("onlineList").innerHTML = '<p class="loading-text">Ошибка загрузки</p>';
            });
    }

    loadPosts();
    loadOnline();
    setInterval(loadOnline, 30000); // обновлять онлайн каждые 30 сек
    setInterval(loadPosts, 10000); // обновлять посты каждые 10 сек (реальное время)

    // Создание поста
    function createPost(type) {
        if (!token) { alert("Войдите в систему"); return; }
        const content = document.getElementById("postContent").value.trim();
        if (!content) { document.getElementById("postMessage").textContent = "Напишите текст"; return; }

        fetch("/api/users/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ content, type })
        })
        .then(res => res.json())
        .then(data => {
            const msg = document.getElementById("postMessage");
            msg.textContent = data.message || data.error;
            msg.style.color = data.message ? "#00ff00" : "#ff4444";
            if (data.message) {
                document.getElementById("postContent").value = "";
                loadPosts();
            }
        })
        .catch(() => {});
    }

    document.getElementById("postNewsBtn").addEventListener("click", () => createPost('news'));
    document.getElementById("postPatchBtn").addEventListener("click", () => createPost('patch_note'));
});