let _spaInterval_0 = null;
document.addEventListener('spa:unload', () => {
    if (_spaInterval_0) clearInterval(_spaInterval_0);
});
document.addEventListener('spa:navigate', () => {
    if (!document.querySelector('.newsFeed') && !document.getElementById('newsFeed')) return;

    let currentUserId = null;
    let currentUserRole = null;
    let csrfToken = null;

    // Получаем CSRF токен при загрузке страницы
    fetch('/api/csrf-token', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            csrfToken = data.csrfToken;
        })
        .catch(() => {});

    // Определение роли для показа формы поста
    fetch("/api/users/profile", {
        credentials: 'include'
    })
            .then(res => {
                if (!res.ok) throw new Error('Not authorized');
                return res.json();
            })
            .then(data => {
                currentUserId = data.id;
                currentUserRole = data.role;
                if (data.role !== 'banned') {
                    document.getElementById("postFormSection").style.display = 'block';
                    // Скрыть кнопку "Обновления" для обычных пользователей
                    if (data.role !== 'admin' && data.role !== 'moderator') {
                        document.getElementById("postPatchBtn").style.display = 'none';
                    }
                }
                if (data.role === 'admin') {
                    const editBtn = document.getElementById("editAdminPinBtn");
                    if (editBtn) editBtn.style.display = 'block';
                }
                // Показываем кнопку "Мои подписки" только авторизованным
                const feedSubsBtn = document.getElementById("feedSubsBtn");
                if (feedSubsBtn) feedSubsBtn.style.display = 'inline-block';
            })
            .catch(() => {
                // Неавторизованный пользователь: скрываем форму поста и подписки
                const postFormSection = document.getElementById("postFormSection");
                if (postFormSection) postFormSection.style.display = 'none';
                const feedSubsBtn = document.getElementById("feedSubsBtn");
                if (feedSubsBtn) feedSubsBtn.style.display = 'none';
            })
            .finally(() => {
                loadPosts();
            });

    let currentFeed = 'global';
    const roleColors = {
        admin: '#ff4444', moderator: '#3498db', user: '#2ecc71',
        newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
    };

    // Кнопка "Мои подписки" управляется после проверки авторизации выше

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const a = '&';
        return String(text)
            .replace(/&/g, a + 'amp;')
            .replace(/</g, a + 'lt;')
            .replace(/>/g, a + 'gt;')
            .replace(/"/g, a + 'quot;')
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
            patchFeed.style.display = 'flex';
        } else {
            newsFeed.style.display = 'flex';
            patchFeed.style.display = 'none';
        }
    }

    if (feedGlobalBtn) {
        feedGlobalBtn.addEventListener("click", () => {
            currentFeed = 'global';
            currentLoadedPage = 1;
            switchFeedTab(feedGlobalBtn);
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedSubsBtn) {
        feedSubsBtn.addEventListener("click", () => {
            currentFeed = 'subscriptions';
            currentLoadedPage = 1;
            switchFeedTab(feedSubsBtn);
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedPatchBtn) {
        feedPatchBtn.addEventListener("click", () => {
            currentFeed = 'patches';
            currentLoadedPage = 1;
            switchFeedTab(feedPatchBtn);
            document.getElementById("patchFeed").innerHTML = '<p class="loading-text">Загрузка...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }

    // Глобальный флаг для контроля анимаций
    let isInitialLoadComplete = false;
    let currentLoadedPage = 1;

    // Умная загрузка постов БЕЗ перезапуска анимаций
    function updateFeedInPlace(container, postsList, emptyMsg) {
        if (!container) return;
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
            const avatar = post.avatar ? escapeHtml(post.avatar) : '';
            const likeText = post.is_liked ? `♥ ${window.t('liked_btn', 'Понравилось')}` : `♡ ${window.t('like_btn', 'Мне нравится')}`;
            const likeColor = post.is_liked ? '#ff3333' : '#fff';
            const dateStr = new Date(post.created_at).toLocaleString();
            const contentHtml = escapeHtml(post.content).replace(/\n/g, '<br>');

            let postContentMarkup = contentHtml;
            if (post.content && post.content.length > 300) {
                const truncatedText = escapeHtml(post.content.slice(0, 280)).replace(/\n/g, '<br>') + '...';
                postContentMarkup = `
                    <span class="post-content-short">${truncatedText}</span>
                    <span class="post-content-full" style="display: none;">${contentHtml}</span>
                    <div style="text-align: center; margin-top: 10px;">
                        <button class="read-more-btn" style="background: none; border: 2px solid white; color: white; padding: 4px 10px; cursor: pointer; font-family: inherit; font-size: 10px; font-weight: bold; width: auto; margin: 0 auto;">${window.t('read_more', 'Читать далее')}</button>
                    </div>
                `;
            }

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
                    // При самом первом заходе оставляем твою стандартную красивую анимацию
                    // (ничего не отключаем)
                }

                const isPostAuthor = currentUserId && parseInt(post.user_id) === parseInt(currentUserId);
                const isPostAdmin = currentUserRole === 'admin';
                const isPostModerator = currentUserRole === 'moderator' && post.role !== 'admin';
                const canDeletePost = isPostAuthor || isPostAdmin || isPostModerator;
                card.dataset.canDelete = canDeletePost ? '1' : '0';

                card.innerHTML = `
                    <div class="post-header">
                        ${avatar ? `<img src="${avatar}" class="post-avatar"><div class="post-avatar-placeholder" style="display:none;"></div>` : '<div class="post-avatar-placeholder"></div>'}
                        <a href="profile.html?username=${encodeURIComponent(post.username)}" style="color: ${color}; text-decoration: none; font-weight: bold;" class="post-author">${escapeHtml(post.username)}</a>
                        <span class="post-date">${dateStr}</span>
                    </div>
                    <div class="post-content">${postContentMarkup}</div>
                    ${window.mediaListHtml(post.media, post.image_url, 380, 'post-media-box')}
                    
                    <div class="post-footer" style="display: flex; gap: 15px; margin-top: 12px; border-top: 1px dashed white; padding-top: 8px; font-size: 11px;">
                        <button class="like-btn" style="color: ${likeColor}; cursor: pointer; font-weight: bold; background: none; border: none;" onclick="togglePostLike(${post.id})">${likeText} (${post.likes_count || 0})</button>
                        <button class="comments-toggle-btn" style="color: #00ff00; cursor: pointer; font-weight: bold; background: none; border: none;" onclick="toggleCommentsSection(${post.id})">💬 ${window.t('comments_title', 'Комментарии')} (${post.comments_count || 0})</button>
                    </div>
                    
                    <div id="commentsWrapper-${post.id}" class="comments-wrapper" style="display: none; margin-top: 15px; border: 2px solid white; padding: 15px; background: rgba(255,255,255,0.02);">
                        <div id="commentsList-${post.id}" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;">
                            <p class="loading-text" style="font-size: 10px;">${window.t('loading', 'Загрузка...')}</p>
                        </div>
                        <form onsubmit="submitPostComment(event, ${post.id})" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <input type="text" id="commentInput-${post.id}" placeholder="${window.t('write_comment_placeholder', 'Напишите комментарий...')}" style="flex: 1; background: black; color: white; border: 2px solid white; padding: 6px; font-family: inherit; font-size: 11px; outline: none;" maxlength="1000">
                                <button type="submit" class="auth-btn" style="padding: 5px 10px; font-size: 10px; width: auto; margin: 0; cursor: pointer;">${window.t('send', 'Отправить')}</button>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-start; width: 100%; margin-top: 2px;">
                                <input type="file" id="commentFileInput-${post.id}" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none;" onchange="commentFileChanged(${post.id})">
                                <button type="button" class="user-btn" style="width: auto; padding: 4px 8px; font-size: 9px; margin: 0; cursor: pointer; border-color: #aaa; color: #aaa;" onclick="document.getElementById('commentFileInput-${post.id}').click()">${window.t('attach_file', 'Прикрепить файл')}</button>
                                <span id="commentAttachedFileName-${post.id}" style="font-size: 10px; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;"></span>
                                <button type="button" id="commentClearAttachBtn-${post.id}" class="user-btn" style="display: none; width: auto; padding: 4px 8px; font-size: 9px; border-color: red; color: red; margin: 0; cursor: pointer;" onclick="clearCommentAttachment(${post.id})">${window.t('delete', 'Удалить')}</button>
                            </div>
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

                // Добавляем обработчик для "Читать далее"
                const readMoreBtn = card.querySelector(".read-more-btn");
                if (readMoreBtn) {
                    readMoreBtn.addEventListener("click", () => {
                        card.querySelector(".post-content-short").style.display = "none";
                        card.querySelector(".post-content-full").style.display = "inline";
                        readMoreBtn.parentElement.style.display = "none";
                    });
                }
            } else {
                // Если пост уже существует — просто точечно обновляем данные, СТРОГО запрещая любые анимации!
                card.style.animation = "none";

                const likeBtn = card.querySelector(".like-btn");
                if (likeBtn) {
                    const newLikeStr = `${likeText} (${post.likes_count || 0})`;
                    if (likeBtn.textContent !== newLikeStr || likeBtn.style.color !== likeColor) {
                        likeBtn.style.color = likeColor;
                        likeBtn.textContent = newLikeStr;
                    }
                }

                // Убрали принудительное обновление contentEl.innerHTML, чтобы не перезатирать открытый "Читать далее"

                const commentsBtn = card.querySelector(".comments-toggle-btn");
                if (commentsBtn) {
                    const newCommentsStr = `💬 ${window.t('comments_title', 'Комментарии')} (${post.comments_count || 0})`;
                    if (commentsBtn.textContent !== newCommentsStr) {
                        commentsBtn.textContent = newCommentsStr;
                    }
                }
            }
        });
    }

    // Загрузка постов
    function loadPosts() {
        // На вкладке "Обновления сайта" грузим все посты, но фильтруем только патчи
        const feedParam = currentFeed === 'patches' ? 'global' : currentFeed;
        const limit = 15 * currentLoadedPage;

        fetch(`/api/users/posts?feed=${feedParam}&page=1&limit=${limit}`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                const postsList = data.posts || [];
                const totalPages = data.totalPages || 0;

                if (currentFeed === 'patches') {
                    const patchFeed = document.getElementById("patchFeed");
                    const patches = postsList.filter(p => p.type === 'patch_note');
                    updateFeedInPlace(patchFeed, patches, "Обновлений пока нет");
                } else {
                    const newsFeed = document.getElementById("newsFeed");
                    const news = postsList.filter(p => p.type === 'news');
                    updateFeedInPlace(newsFeed, news, "Новостей пока нет");
                }

                // Управление отображением кнопки "Загрузить ещё"
                const loadMoreSec = document.getElementById("loadMoreSection");
                if (loadMoreSec) {
                    if (totalPages > 1) {
                        loadMoreSec.style.display = "block";
                    } else {
                        loadMoreSec.style.display = "none";
                    }
                }

                // СТРОГО ТУТ: как только первая пачка постов отрисовалась — блокируем повторные анимации!
                isInitialLoadComplete = true;
            })
            .catch((err) => {
                console.error('Ошибка загрузки постов:', err);
                const container = currentFeed === 'patches'
                    ? document.getElementById("patchFeed")
                    : document.getElementById("newsFeed");
                if (container) {
                    container.innerHTML = `<p class="loading-text">${window.t('error_load', 'Ошибка загрузки постов')}</p>`;
                }
            });
    }

    // Обработчик кнопки "Загрузить ещё"
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            currentLoadedPage++;
            loadPosts();
        });
    }

    // Загрузка онлайн пользователей
    function loadOnline() {
        fetch("/api/users/online", {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(users => {
                const list = document.getElementById("onlineList");
                if (!list) return;
                if (users.length === 0) {
                    list.innerHTML = `<p class="loading-text">${window.t('nobody_online', 'Никого нет в сети')}</p>`;
                    return;
                }

                if (list.innerHTML.includes("loading-text") || list.innerHTML.includes("Никого нет в сети") || list.innerHTML.includes("Nobody is online") || list.innerHTML.includes("Нікого немає в мережі")) {
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
                                <span class="online-dot status-${u.user_status || 'online'}"></span>
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
                        const dotSpan = userEl.querySelector(".online-dot");
                        if (dotSpan) {
                            dotSpan.className = `online-dot status-${u.user_status || 'online'}`;
                        }
                    }
                });
            })
            .catch(() => {
                const list = document.getElementById("onlineList");
                list.innerHTML = `<p class="loading-text">${window.t('error_load', 'Ошибка загрузки')}</p>`;
            });
    }

    window.togglePostLike = async function (postId) {
        fetch(`/api/users/posts/${postId}/like`, {
            method: "POST",
            credentials: 'include'
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
            if (wrapper.classList.contains('open')) {
                wrapper.classList.remove('open');
                setTimeout(() => {
                    if (!wrapper.classList.contains('open')) {
                        wrapper.style.display = 'none';
                    }
                }, 300);
            } else {
                wrapper.style.display = 'block';
                setTimeout(() => {
                    wrapper.classList.add('open');
                }, 10);
                loadPostComments(postId);
            }
        }
    };

    window.deletePost = async function(postId) {
        if (!await window.showCustomConfirm(window.t('confirm_post_delete', 'Вы уверены, что хотите удалить этот пост?'))) return;
        
        fetch(`/api/users/posts/${postId}`, {
            method: "DELETE",
            credentials: 'include'
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                if (card) card.remove();
            } else {
                await window.showCustomAlert(data.error || window.t('error_delete_post', 'Ошибка удаления поста'));
            }
        })
        .catch(async err => {
            console.error("Ошибка при удалении поста:", err);
            await window.showCustomAlert(window.t('error_network', 'Ошибка сети'));
        });
    };

    window.deleteComment = async function(postId, commentId) {
        if (!await window.showCustomConfirm(window.t('confirm_comment_delete', 'Вы уверены, что хотите удалить этот комментарий?'))) return;
        
        fetch(`/api/users/comments/${commentId}`, {
            method: "DELETE",
            credentials: 'include'
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                loadPostComments(postId);
                loadPosts(); // to update comment counts
            } else {
                await window.showCustomAlert(data.error || window.t('error_delete_comment', 'Ошибка удаления комментария'));
            }
        })
        .catch(async err => {
            console.error("Ошибка при удалении комментария:", err);
            await window.showCustomAlert(window.t('error_network', 'Ошибка сети'));
        });
    };

    window.loadPostComments = function (postId) {
        fetch(`/api/users/posts/${postId}/comments`, {
            credentials: 'include'
        })
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

                        const isCommentAuthor = currentUserId && parseInt(comment.user_id) === parseInt(currentUserId);
                        const isCommentAdmin = currentUserRole === 'admin';
                        const isCommentModerator = currentUserRole === 'moderator' && comment.role !== 'admin';
                        const canDeleteComment = isCommentAuthor || isCommentAdmin || isCommentModerator;

                        return `
                        <div data-ctx="comment" data-comment-id="${comment.id}" data-post-id="${postId}" data-username="${escapeHtml(comment.username)}" data-reply="${currentUserId ? '1' : '0'}" data-can-delete="${canDeleteComment ? '1' : '0'}" style="padding-left: 12px; margin-left: ${indent}px; border-left: ${borderLeft}; padding-top: 8px; padding-bottom: 8px; margin-bottom: 8px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                                ${comment.avatar ? `<img src="${escapeHtml(comment.avatar)}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.4); object-fit: cover; flex-shrink: 0;"><div style="display:none; width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%; flex-shrink: 0;"></div>` : '<div style="width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%; flex-shrink: 0;"></div>'}
                                <a href="profile.html?username=${encodeURIComponent(comment.username)}" style="color: ${color}; font-weight: bold; text-decoration: none;">${escapeHtml(comment.username)}</a>
                                <span class="wall-comment-date" style="font-size: 10px; color: rgba(255,255,255,0.5);">${new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <div style="font-size: 12px; color: #eee; margin-top: 4px; word-break: break-word; line-height: 1.4;">${escapeHtml(comment.content)}</div>
                            ${window.mediaListHtml ? window.mediaListHtml(comment.media, comment.image_url, 200, 'comment-media-box') : ''}
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

    window.commentFileChanged = function(postId) {
        const fileInput = document.getElementById(`commentFileInput-${postId}`);
        const fileNameSpan = document.getElementById(`commentAttachedFileName-${postId}`);
        const clearBtn = document.getElementById(`commentClearAttachBtn-${postId}`);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            fileNameSpan.textContent = fileInput.files[0].name;
            clearBtn.style.display = 'inline-block';
        }
    };

    window.clearCommentAttachment = function(postId) {
        const fileInput = document.getElementById(`commentFileInput-${postId}`);
        const fileNameSpan = document.getElementById(`commentAttachedFileName-${postId}`);
        const clearBtn = document.getElementById(`commentClearAttachBtn-${postId}`);
        if (fileInput) fileInput.value = '';
        if (fileNameSpan) fileNameSpan.textContent = '';
        if (clearBtn) clearBtn.style.display = 'none';
    };

    window.submitPostComment = async function (event, postId) {
        event.preventDefault();

        const input = document.getElementById(`commentInput-${postId}`);
        if (!input) return;
        const content = input.value.trim();
        
        const fileInput = document.getElementById(`commentFileInput-${postId}`);
        const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

        if (!content && !hasFile) return;

        const parentId = input.dataset.parentId || null;

        let mediaUrls = [];
        if (hasFile) {
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);
            try {
                const uploadRes = await fetch("/api/users/upload-media", {
                    method: "POST",
                    credentials: 'include',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.error) {
                    await window.showCustomAlert(uploadData.error);
                    return;
                }
                mediaUrls.push(uploadData.url);
            } catch (err) {
                await window.showCustomAlert(window.t ? window.t('error_network', 'Ошибка загрузки медиа') : 'Ошибка загрузки медиа');
                return;
            }
        }

        fetch(`/api/users/posts/${postId}/comments`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify({ content, parent_id: parentId, media: mediaUrls })
        })
            .then(res => res.json())
            .then(async data => {
                if (data.commentId) {
                    input.value = "";
                    delete input.dataset.parentId;
                    window.clearCommentAttachment(postId);
                    loadPostComments(postId);
                } else if (data.error) {
                    await window.showCustomAlert(data.error);
                }
            })
            .catch(err => console.error(err));
    };

    // Загрузка закрепа от админа
    function loadAdminPin() {
        fetch("/api/users/admin-pin", {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                const pinContent = document.getElementById("adminPinContent");
                if (pinContent) {
                    pinContent.innerHTML = escapeHtml(data.content).replace(/\n/g, '<br>');
                }
                const pinInput = document.getElementById("adminPinInput");
                if (pinInput) {
                    pinInput.value = data.content;
                }
            })
            .catch(() => {
                const pinContent = document.getElementById("adminPinContent");
                if (pinContent) {
                    pinContent.textContent = window.t('error_load', 'Не удалось загрузить закреп.');
                }
            });
    }

    loadAdminPin();

    const editAdminPinBtn = document.getElementById("editAdminPinBtn");
    const saveAdminPinBtn = document.getElementById("saveAdminPinBtn");
    const adminPinEditArea = document.getElementById("adminPinEditArea");
    const adminPinContent = document.getElementById("adminPinContent");

    if (editAdminPinBtn) {
        editAdminPinBtn.addEventListener("click", () => {
            if (adminPinEditArea.style.display === "none") {
                adminPinEditArea.style.display = "block";
                adminPinContent.style.display = "none";
                editAdminPinBtn.textContent = window.t('cancel', 'Отмена');
            } else {
                adminPinEditArea.style.display = "none";
                adminPinContent.style.display = "block";
                editAdminPinBtn.textContent = window.t('edit', 'Редактировать');
            }
        });
    }

    if (saveAdminPinBtn) {
        saveAdminPinBtn.addEventListener("click", async () => {
            const content = document.getElementById("adminPinInput").value.trim();
            if (!content) {
                await window.showCustomAlert(window.t('chat_message_empty', 'Текст не может быть пустым'));
                return;
            }

            fetch("/api/users/admin-pin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({ content })
            })
            .then(res => res.json())
            .then(async data => {
                if (data.message) {
                    adminPinEditArea.style.display = "none";
                    adminPinContent.style.display = "block";
                    editAdminPinBtn.textContent = window.t('edit', 'Редактировать');
                    loadAdminPin();
                } else {
                    await window.showCustomAlert(data.error || window.t('error_network', 'Ошибка сохранения'));
                }
            })
            .catch(async () => await window.showCustomAlert(window.t('error_network', 'Ошибка сети')));
        });
    }

    loadOnline();
    _spaInterval_0 = setInterval(loadOnline, 30000);

    // Логика прикрепления файлов к посту
    const postAttachBtn = document.getElementById("postAttachBtn");
    const postFileInput = document.getElementById("postFileInput");
    const postAttachedFileName = document.getElementById("postAttachedFileName");
    const postClearAttachBtn = document.getElementById("postClearAttachBtn");

    if (postAttachBtn && postFileInput) {
        postAttachBtn.addEventListener("click", () => window.attachMediaMenu(postAttachBtn, postFileInput));
        postFileInput.addEventListener("change", () => {
            if (postFileInput.files && postFileInput.files[0]) {
                postAttachedFileName.textContent = postFileInput.files.length > 1 ? (postFileInput.files.length + ' 📎') : postFileInput.files[0].name;
                postClearAttachBtn.style.display = "inline-block";
            }
        });
        postClearAttachBtn.addEventListener("click", () => {
            postFileInput.value = "";
            postAttachedFileName.textContent = "";
            postClearAttachBtn.style.display = "none";
        });
    }

    async function createPost(type) {
        const content = document.getElementById("postContent").value.trim();
        const hasFile = postFileInput && postFileInput.files && postFileInput.files[0];
        if (!content && !hasFile) { document.getElementById("postMessage").textContent = window.t('write_post_placeholder', 'Напишите текст'); return; }

        const newsBtn = document.getElementById("postNewsBtn");
        const patchBtn = document.getElementById("postPatchBtn");
        if (newsBtn) newsBtn.disabled = true;
        if (patchBtn) patchBtn.disabled = true;

        const msg = document.getElementById("postMessage");
        msg.textContent = window.t('loading', 'Публикация...');
        msg.style.color = "#aaa";

        let mediaUrls = [];

        // #19 Загружаем все прикреплённые файлы
        if (postFileInput && postFileInput.files && postFileInput.files.length) {
            for (const f of postFileInput.files) {
                const formData = new FormData();
                formData.append("file", f);
                try {
                    const uploadRes = await fetch("/api/users/upload-media", {
                        method: "POST",
                        credentials: 'include',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.error) {
                        if (newsBtn) newsBtn.disabled = false;
                        if (patchBtn) patchBtn.disabled = false;
                        msg.textContent = uploadData.error;
                        msg.style.color = "#ff4444";
                        return;
                    }
                    mediaUrls.push(uploadData.url);
                } catch (err) {
                    if (newsBtn) newsBtn.disabled = false;
                    if (patchBtn) patchBtn.disabled = false;
                    msg.textContent = window.t('error_network', 'Ошибка загрузки медиа');
                    msg.style.color = "#ff4444";
                    return;
                }
            }
        }

        fetch("/api/users/posts", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify({ content, type, media: mediaUrls })
        })
            .then(res => res.json())
            .then(data => {
                if (newsBtn) newsBtn.disabled = false;
                if (patchBtn) patchBtn.disabled = false;
                msg.textContent = data.message || data.error;
                msg.style.color = data.message ? "#00ff00" : "#ff4444";
                if (data.message) {
                    document.getElementById("postContent").value = "";
                    if (postFileInput) postFileInput.value = "";
                    if (postAttachedFileName) postAttachedFileName.textContent = "";
                    if (postClearAttachBtn) postClearAttachBtn.style.display = "none";
                    loadPosts();
                }
            })
            .catch(() => {
                if (newsBtn) newsBtn.disabled = false;
                if (patchBtn) patchBtn.disabled = false;
            });
    }

    document.getElementById("postNewsBtn").addEventListener("click", () => createPost('news'));
    document.getElementById("postPatchBtn").addEventListener("click", () => createPost('patch_note'));
});
