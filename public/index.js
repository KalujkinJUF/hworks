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
                }).catch(() => { });
            })
            .catch(() => { });
    }

    let currentFeed = 'global';
    const roleColors = {
        admin: '#ff4444', moderator: '#ff8c00', user: '#00ccff',
        newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
    };

    if (token) {
        const subsBtn = document.getElementById("feedSubsBtn");
        if (subsBtn) subsBtn.style.display = 'inline-block';
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

    const feedGlobalBtn = document.getElementById("feedGlobalBtn");
    const feedSubsBtn = document.getElementById("feedSubsBtn");
    const feedPatchBtn = document.getElementById("feedPatchBtn");

    // Утилита для переключения вкладок
    function switchFeedTab(activeBtn) {
        [feedGlobalBtn, feedSubsBtn, feedPatchBtn].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (activeBtn) activeBtn.classList.add("active");

        const newsFeed = document.getElementById("newsFeed");
        const patchFeed = document.getElementById("patchFeed");
        const postForm = document.getElementById("postFormSection");

        if (currentFeed === 'patches') {
            newsFeed.style.display = 'none';
            patchFeed.style.display = 'block';
        } else {
            newsFeed.style.display = 'block';
            patchFeed.style.display = 'none';
        }
    }

    if (feedGlobalBtn) {
        feedGlobalBtn.addEventListener("click", () => {
            currentFeed = 'global';
            switchFeedTab(feedGlobalBtn);
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedSubsBtn) {
        feedSubsBtn.addEventListener("click", () => {
            currentFeed = 'subscriptions';
            switchFeedTab(feedSubsBtn);
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedPatchBtn) {
        feedPatchBtn.addEventListener("click", () => {
            currentFeed = 'patches';
            switchFeedTab(feedPatchBtn);
            document.getElementById("patchFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }

    // Глобальный флаг для контроля анимаций (добавь его перед функцией)
    let isInitialLoadComplete = false;

    // Умная загрузка постов БЕЗ перезапуска анимаций
    function updateFeedInPlace(container, postsList, emptyMsg) {
        const isFirstLoad = container.innerHTML.includes("loading-text") ||
            container.innerHTML.includes(emptyMsg);

        if (postsList.length === 0) {
            container.innerHTML = `<p class="loading-text">${emptyMsg}</p>`;
            return;
        }

        if (isFirstLoad) {
            container.innerHTML = '';
        }

        const existingCards = Array.from(container.querySelectorAll(".post-card"));
        const existingIds = new Set(existingCards.map(el => el.dataset.postId));
        const newIds = new Set(postsList.map(p => String(p.id)));

        // 1. Удаляем посты, которых больше нет в базе
        existingCards.forEach(el => {
            if (!newIds.has(el.dataset.postId)) {
                el.remove();
            }
        });

        // 2. Рендерим новые карточки или обновляем старые динамически
        postsList.forEach((post, index) => {
            const postId = String(post.id);
            let card = container.querySelector(`.post-card[data-post-id="${postId}"]`);

            const color = roleColors[post.role] || '#ffffff';
            const avatar = post.avatar ? post.avatar : '';
            const likeText = post.is_liked ? '♥ В любимом' : '♡ Мне нравится';
            const likeColor = post.is_liked ? '#ff3333' : '#fff';
            const dateStr = new Date(post.created_at).toLocaleString();
            const contentHtml = escapeHtml(post.content).replace(/\n/g, '<br>');

            // Если поста ещё нет на экране (РЕАЛЬНО НОВЫЙ ПОСТ или ПЕРВЫЙ ЗАПУСК)
            if (!card) {
                card = document.createElement("div");
                card.className = "post-card";
                card.dataset.postId = postId;

                // --- УПРАВЛЕНИЕ АНИМАЦИЯМИ ТУТ ---
                if (isInitialLoadComplete) {
                    // Если страница уже загружена и это фоновый авто-апдейт:
                    // Отключаем дефолтную анимацию и вешаем класс ТОЛЬКО для нового поста
                    card.style.animation = "none";
                    card.classList.add("just-created-post");
                } else {
                    // При самом первом заходе оставляем твою стандартную красивую анимацию из CSS
                    // (ничего не отключаем)
                }

                card.innerHTML = `
                    <div class="post-header">
                        ${avatar ? `<img src="${avatar}" class="post-avatar">` : '<div class="post-avatar-placeholder"></div>'}
                        <a href="profile.html?username=${encodeURIComponent(post.username)}" style="color: ${color}; text-decoration: none; font-weight: bold;" class="post-author">${escapeHtml(post.username)}</a>
                        <span class="post-date">${dateStr}</span>
                    </div>
                    <div class="post-content">${contentHtml}</div>
                    
                    <div class="post-footer" style="display: flex; gap: 15px; margin-top: 12px; border-top: 1px dashed white; padding-top: 8px; font-size: 11px;">
                        <span class="like-btn" style="color: ${likeColor}; cursor: pointer; font-weight: bold;" onclick="togglePostLike(${post.id})">${likeText} (${post.likes_count || 0})</span>
                        <span class="comments-toggle-btn" style="color: #00ff00; cursor: pointer; font-weight: bold;" onclick="toggleCommentsSection(${post.id})">💬 Комментарии</span>
                    </div>
                    
                    <div id="commentsWrapper-${post.id}" class="comments-wrapper" style="display: none; margin-top: 12px; border: 2px solid white; padding: 10px; background: rgba(255,255,255,0.02);">
                        <div id="commentsList-${post.id}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                            <p class="loading-text" style="font-size: 10px;">Загрузка комментариев...</p>
                        </div>
                        <form onsubmit="submitPostComment(event, ${post.id})" style="display: flex; gap: 8px;">
                            <input type="text" id="commentInput-${post.id}" placeholder="Напишите комментарий..." style="flex: 1; background: black; color: white; border: 2px solid white; padding: 6px; font-family: inherit; font-size: 11px; outline: none;">
                            <button type="submit" class="auth-btn" style="padding: 5px 10px; font-size: 10px; width: auto; margin: 0; cursor: pointer;">Отправить</button>
                        </form>
                    </div>
                `;

                // Вставляем на своё порядковое место
                const referenceNode = container.children[index];
                if (referenceNode) {
                    container.insertBefore(card, referenceNode);
                } else {
                    container.appendChild(card);
                }
            } else {
                // Если пост уже существует — просто точечно обновляем данные, СТРОГО запрещая любые анимации
                card.style.animation = "none";

                const likeBtn = card.querySelector(".like-btn");
                if (likeBtn) {
                    const newLikeStr = `${likeText} (${post.likes_count || 0})`;
                    if (likeBtn.textContent !== newLikeStr || likeBtn.style.color !== likeColor) {
                        likeBtn.style.color = likeColor;
                        likeBtn.textContent = newLikeStr;
                    }
                }

                const contentEl = card.querySelector(".post-content");
                if (contentEl && contentEl.innerHTML !== contentHtml) {
                    contentEl.innerHTML = contentHtml;
                }
            }
        });
    }

    // Загрузка постов
    function loadPosts() {
        const headers = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // На вкладке "Обновления сайта" грузим все посты, но фильтруем только патчи
        const feedParam = currentFeed === 'patches' ? 'global' : currentFeed;

        fetch(`/api/users/posts?feed=${feedParam}`, { headers })
            .then(res => res.json())
            .then(posts => {
                if (currentFeed === 'patches') {
                    const patchFeed = document.getElementById("patchFeed");
                    const patches = posts.filter(p => p.type === 'patch_note');
                    updateFeedInPlace(patchFeed, patches, "Обновлений пока нет");
                } else {
                    const newsFeed = document.getElementById("newsFeed");
                    const news = posts.filter(p => p.type === 'news');
                    updateFeedInPlace(newsFeed, news, "Новостей пока нет");
                }

                // СТРОГО ТУТ: как только первая пачка постов отрисовалась — блокируем повторные анимации!
                isInitialLoadComplete = true;
            })
            .catch(() => { });
    }

    // Загрузка онлайн пользователей
    function loadOnline() {
        fetch("/api/users/online")
            .then(res => res.json())
            .then(users => {
                const list = document.getElementById("onlineList");
                if (users.length === 0) {
                    list.innerHTML = '<p class="loading-text">Никого нет в сети</p>';
                    return;
                }

                if (list.innerHTML.includes("loading-text") || list.innerHTML.includes("Никого нет в сети")) {
                    list.innerHTML = '';
                }

                const existingUsers = Array.from(list.querySelectorAll(".online-user-link"));
                const newUsernames = new Set(users.map(u => u.username));

                existingUsers.forEach(el => {
                    if (!newUsernames.has(el.dataset.username)) {
                        el.remove();
                    }
                });

                users.forEach((u, index) => {
                    let userEl = list.querySelector(`.online-user-link[data-username="${u.username}"]`);
                    if (!userEl) {
                        userEl = document.createElement("a");
                        userEl.className = "online-user-link";
                        userEl.dataset.username = u.username;
                        userEl.href = `profile.html?username=${encodeURIComponent(u.username)}`;
                        userEl.style.textDecoration = "none";
                        userEl.style.color = "inherit";
                        userEl.innerHTML = `
                            <div class="online-user">
                                <span class="online-dot"></span>
                                <span style="color: ${roleColors[u.role] || '#fff'};">${escapeHtml(u.username)}</span>
                            </div>
                        `;

                        const referenceNode = list.children[index];
                        if (referenceNode) {
                            list.insertBefore(userEl, referenceNode);
                        } else {
                            list.appendChild(userEl);
                        }
                    } else {
                        const nameSpan = userEl.querySelector(".online-user span:last-child");
                        if (nameSpan) {
                            nameSpan.style.color = roleColors[u.role] || '#fff';
                        }
                    }
                });
            })
            .catch(() => {
                const list = document.getElementById("onlineList");
                list.innerHTML = '<p class="loading-text">Ошибка загрузки</p>';
            });
    }

    window.togglePostLike = function (postId) {
        if (!token) { alert("Войдите в систему, чтобы ставить лайки"); return; }
        fetch(`/api/users/posts/${postId}/like`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    loadPosts();
                }
            })
            .catch(err => console.error(err));
    };

    window.toggleCommentsSection = function (postId) {
        const wrapper = document.getElementById(`commentsWrapper-${postId}`);
        if (wrapper) {
            if (wrapper.style.display === 'none') {
                wrapper.style.display = 'block';
                loadPostComments(postId);
            } else {
                wrapper.style.display = 'none';
            }
        }
    };

    window.loadPostComments = function (postId) {
        fetch(`/api/users/posts/${postId}/comments`)
            .then(res => res.json())
            .then(comments => {
                const list = document.getElementById(`commentsList-${postId}`);
                if (!list) return;

                if (comments.length === 0) {
                    list.innerHTML = '<p class="loading-text" style="font-size: 10px;">Комментариев нет. Будьте первыми!</p>';
                } else {
                    const commentMap = {};
                    comments.forEach(c => {
                        c.replies = [];
                        commentMap[c.id] = c;
                    });

                    const rootComments = [];
                    comments.forEach(c => {
                        if (c.parent_id && commentMap[c.parent_id]) {
                            commentMap[c.parent_id].replies.push(c);
                        } else {
                            rootComments.push(c);
                        }
                    });

                    function renderCommentNode(comment, depth = 0) {
                        const color = roleColors[comment.role] || '#ffffff';
                        const indent = depth * 15;
                        const borderLeft = depth > 0 ? '2px solid rgba(255,255,255,0.2)' : 'none';
                        const repliesHTML = comment.replies.map(r => renderCommentNode(r, depth + 1)).join('');

                        return `
                        <div style="padding-left: 8px; margin-left: ${indent}px; border-left: ${borderLeft}; padding-top: 4px; padding-bottom: 4px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
                                <a href="profile.html?username=${encodeURIComponent(comment.username)}" style="color: ${color}; font-weight: bold; text-decoration: none;">${escapeHtml(comment.username)}</a>
                                <span style="font-size: 8px; color: rgba(255,255,255,0.5);">${new Date(comment.created_at).toLocaleString()}</span>
                                ${token ? `<span style="color: yellow; cursor: pointer; font-size: 8px; font-weight: bold; margin-left: 5px;" onclick="replyToComment(${postId}, ${comment.id}, '${escapeHtml(comment.username)}')">Ответить</span>` : ''}
                            </div>
                            <div style="font-size: 10px; color: #eee; margin-top: 2px; word-break: break-word;">${escapeHtml(comment.content)}</div>
                            ${repliesHTML}
                        </div>
                    `;
                    }

                    list.innerHTML = rootComments.map(c => renderCommentNode(c)).join('');
                }
            })
            .catch(err => console.error(err));
    };

    window.replyToComment = function (postId, commentId, username) {
        const input = document.getElementById(`commentInput-${postId}`);
        if (input) {
            input.value = `@${username}, `;
            input.focus();
            input.dataset.parentId = commentId;
        }
    };

    window.submitPostComment = function (event, postId) {
        event.preventDefault();
        if (!token) { alert("Войдите в систему, чтобы комментировать"); return; }

        const input = document.getElementById(`commentInput-${postId}`);
        if (!input) return;
        const content = input.value.trim();
        if (!content) return;

        const parentId = input.dataset.parentId || null;

        fetch(`/api/users/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ content, parent_id: parentId })
        })
            .then(res => res.json())
            .then(data => {
                if (data.commentId) {
                    input.value = "";
                    delete input.dataset.parentId;
                    loadPostComments(postId);
                } else if (data.error) {
                    alert(data.error);
                }
            })
            .catch(err => console.error(err));
    };

    loadPosts();
    loadOnline();

    setInterval(loadOnline, 30000);

    setInterval(() => {
        const openWrappers = document.querySelectorAll(".comments-wrapper[style*='block']");
        const hasFocusedInput = document.activeElement && document.activeElement.id && document.activeElement.id.startsWith("commentInput-");
        if (openWrappers.length === 0 && !hasFocusedInput) {
            loadPosts();
        }
    }, 10000);

    function createPost(type) {
        if (!token) { alert("Войдите в систему"); return; }
        const content = document.getElementById("postContent").value.trim();
        if (!content) { document.getElementById("postMessage").textContent = "Напишите text"; return; }

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
            .catch(() => { });
    }

    document.getElementById("postNewsBtn").addEventListener("click", () => createPost('news'));
    document.getElementById("postPatchBtn").addEventListener("click", () => createPost('patch_note'));
});