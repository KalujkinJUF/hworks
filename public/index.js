document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    let currentUserId = null;
    let currentUserRole = null;

    // ÐžÐ¿Ñ€ÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ðµ Ñ€Ð¾Ð»Ð¸ Ð´Ð»Ñ Ð¿Ð¾ÐºÐ°Ð·Ð° Ñ„Ð¾Ñ€Ð¼Ñ‹ Ð¿Ð¾ÑÑ‚Ð°
    if (token) {
        fetch("/api/users/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                currentUserId = data.id;
                currentUserRole = data.role;
                if (data.role !== 'banned') {
                    document.getElementById("postFormSection").style.display = 'block';
                    // Ð¡ÐºÑ€Ñ‹Ñ‚ÑŒ ÐºÐ½Ð¾Ð¿ÐºÑƒ "ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ" Ð´Ð»Ñ Ð¾Ð±Ñ‹Ñ‡Ð½Ñ‹Ñ… Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹
                    if (data.role !== 'admin' && data.role !== 'moderator') {
                        document.getElementById("postPatchBtn").style.display = 'none';
                    }
                }
                if (data.role === 'admin') {
                    const editBtn = document.getElementById("editAdminPinBtn");
                    if (editBtn) editBtn.style.display = 'block';
                }
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

    // Ð£Ñ‚Ð¸Ð»Ð¸Ñ‚Ð° Ð´Ð»Ñ Ð¿ÐµÑ€ÐµÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ñ Ð²ÐºÐ»Ð°Ð´Ð¾Ðº
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
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ°...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedSubsBtn) {
        feedSubsBtn.addEventListener("click", () => {
            currentFeed = 'subscriptions';
            currentLoadedPage = 1;
            switchFeedTab(feedSubsBtn);
            document.getElementById("newsFeed").innerHTML = '<p class="loading-text">Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ°...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }
    if (feedPatchBtn) {
        feedPatchBtn.addEventListener("click", () => {
            currentFeed = 'patches';
            currentLoadedPage = 1;
            switchFeedTab(feedPatchBtn);
            document.getElementById("patchFeed").innerHTML = '<p class="loading-text">Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ°...</p>';
            isInitialLoadComplete = false;
            loadPosts();
        });
    }

    // Ð“Ð»Ð¾Ð±Ð°Ð»ÑŒÐ½Ñ‹Ð¹ Ñ„Ð»Ð°Ð³ Ð´Ð»Ñ ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»Ñ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸Ð¹ (Ð´Ð¾Ð±Ð°Ð²ÑŒ ÐµÐ³Ð¾ Ð¿ÐµÑ€ÐµÐ´ Ñ„ÑƒÐ½ÐºÑ†Ð¸ÐµÐ¹)
    let isInitialLoadComplete = false;
    let currentLoadedPage = 1;

    // Ð£Ð¼Ð½Ð°Ñ Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¿Ð¾ÑÑ‚Ð¾Ð² Ð‘Ð•Ð— Ð¿ÐµÑ€ÐµÐ·Ð°Ð¿ÑƒÑÐºÐ° Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸Ð¹
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

        // 1. Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð¿Ð¾ÑÑ‚Ñ‹, ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ñ… Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½ÐµÑ‚ Ð² Ð±Ð°Ð·Ðµ
        existingCards.forEach(el => {
            if (!newIds.has(el.dataset.postId)) {
                el.remove();
            }
        });

        // 2. Ð ÐµÐ½Ð´ÐµÑ€Ð¸Ð¼ Ð½Ð¾Ð²Ñ‹Ðµ ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ¸ Ð¸Ð»Ð¸ Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ ÑÑ‚Ð°Ñ€Ñ‹Ðµ Ð´Ð¸Ð½Ð°Ð¼Ð¸Ñ‡ÐµÑÐºÐ¸
        postsList.forEach((post, index) => {
            const postId = String(post.id);
            let card = container.querySelector(`.post-card[data-post-id="${postId}"]`);

            const color = roleColors[post.role] || '#ffffff';
            const avatar = post.avatar ? post.avatar : '';
            const likeText = post.is_liked ? 'â™¥ ÐŸÐ¾Ð½Ñ€Ð°Ð²Ð¸Ð»Ð¾ÑÑŒ' : 'â™¡ ÐœÐ½Ðµ Ð½Ñ€Ð°Ð²Ð¸Ñ‚ÑÑ';
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
                        <button class="read-more-btn" style="background: none; border: 2px solid white; color: white; padding: 4px 10px; cursor: pointer; font-family: inherit; font-size: 10px; font-weight: bold; width: auto; margin: 0 auto;">Ð§Ð¸Ñ‚Ð°Ñ‚ÑŒ Ð´Ð°Ð»ÐµÐµ</button>
                    </div>
                `;
            }

            // Ð•ÑÐ»Ð¸ Ð¿Ð¾ÑÑ‚Ð° ÐµÑ‰Ñ‘ Ð½ÐµÑ‚ Ð½Ð° ÑÐºÑ€Ð°Ð½Ðµ (Ð Ð•ÐÐ›Ð¬ÐÐž ÐÐžÐ’Ð«Ð™ ÐŸÐžÐ¡Ð¢ Ð¸Ð»Ð¸ ÐŸÐ•Ð Ð’Ð«Ð™ Ð—ÐÐŸÐ£Ð¡Ðš)
            if (!card) {
                card = document.createElement("div");
                card.className = "post-card";
                card.dataset.postId = postId;

                // --- Ð£ÐŸÐ ÐÐ’Ð›Ð•ÐÐ˜Ð• ÐÐÐ˜ÐœÐÐ¦Ð˜Ð¯ÐœÐ˜ Ð¢Ð£Ð¢ ---
                if (isInitialLoadComplete) {
                    // Ð•ÑÐ»Ð¸ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ð° ÑƒÐ¶Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ¶ÐµÐ½Ð° Ð¸ ÑÑ‚Ð¾ Ñ„Ð¾Ð½Ð¾Ð²Ñ‹Ð¹ Ð°Ð²Ñ‚Ð¾-Ð°Ð¿Ð´ÐµÐ¹Ñ‚:
                    // ÐžÑ‚ÐºÐ»ÑŽÑ‡Ð°ÐµÐ¼ Ð´ÐµÑ„Ð¾Ð»Ñ‚Ð½ÑƒÑŽ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸ÑŽ Ð¸ Ð²ÐµÑˆÐ°ÐµÐ¼ ÐºÐ»Ð°ÑÑ Ð¢ÐžÐ›Ð¬ÐšÐž Ð´Ð»Ñ Ð½Ð¾Ð²Ð¾Ð³Ð¾ Ð¿Ð¾ÑÑ‚Ð°
                    card.style.animation = "none";
                    card.classList.add("just-created-post");
                } else {
                    // ÐŸÑ€Ð¸ ÑÐ°Ð¼Ð¾Ð¼ Ð¿ÐµÑ€Ð²Ð¾Ð¼ Ð·Ð°Ñ…Ð¾Ð´Ðµ Ð¾ÑÑ‚Ð°Ð²Ð»ÑÐµÐ¼ Ñ‚Ð²Ð¾ÑŽ ÑÑ‚Ð°Ð½Ð´Ð°Ñ€Ñ‚Ð½ÑƒÑŽ ÐºÑ€Ð°ÑÐ¸Ð²ÑƒÑŽ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸ÑŽ Ð¸Ð· CSS
                    // (Ð½Ð¸Ñ‡ÐµÐ³Ð¾ Ð½Ðµ Ð¾Ñ‚ÐºÐ»ÑŽÑ‡Ð°ÐµÐ¼)
                }

                const isPostAuthor = currentUserId && parseInt(post.user_id) === parseInt(currentUserId);
                const isPostAdmin = currentUserRole === 'admin';
                const isPostModerator = currentUserRole === 'moderator' && post.role !== 'admin';
                const canDeletePost = isPostAuthor || isPostAdmin || isPostModerator;
                const deletePostBtnHtml = canDeletePost ? `<button class="delete-btn" style="margin-left: 15px;" onclick="deletePost(${post.id})">Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ</button>` : '';

                card.innerHTML = `
                    <div class="post-header">
                        ${avatar ? `<img src="${avatar}" class="post-avatar" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><div class="post-avatar-placeholder" style="display:none;"></div>` : '<div class="post-avatar-placeholder"></div>'}
                        <a href="profile.html?username=${encodeURIComponent(post.username)}" style="color: ${color}; text-decoration: none; font-weight: bold;" class="post-author">${escapeHtml(post.username)}</a>
                        <span class="post-date">${dateStr}</span>
                        ${deletePostBtnHtml}
                    </div>
                    <div class="post-content">${postContentMarkup}</div>
                    
                    <div class="post-footer" style="display: flex; gap: 15px; margin-top: 12px; border-top: 1px dashed white; padding-top: 8px; font-size: 11px;">
                        <button class="like-btn" style="color: ${likeColor}; cursor: pointer; font-weight: bold; background: none; border: none;" onclick="togglePostLike(${post.id})">${likeText} (${post.likes_count || 0})</button>
                        <button class="comments-toggle-btn" style="color: #00ff00; cursor: pointer; font-weight: bold; background: none; border: none;" onclick="toggleCommentsSection(${post.id})">ðŸ’¬ ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¸ (${post.comments_count || 0})</button>
                    </div>
                    
                    <div id="commentsWrapper-${post.id}" class="comments-wrapper" style="display: none; margin-top: 15px; border: 2px solid white; padding: 15px; background: rgba(255,255,255,0.02);">
                        <div id="commentsList-${post.id}" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;">
                            <p class="loading-text" style="font-size: 10px;">Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸ÐµÐ²...</p>
                        </div>
                        <form onsubmit="submitPostComment(event, ${post.id})" style="display: flex; gap: 8px;">
                            <input type="text" id="commentInput-${post.id}" placeholder="ÐÐ°Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¹..." style="flex: 1; background: black; color: white; border: 2px solid white; padding: 6px; font-family: inherit; font-size: 11px; outline: none;">
                            <button type="submit" class="auth-btn" style="padding: 5px 10px; font-size: 10px; width: auto; margin: 0; cursor: pointer;">ÐžÑ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ</button>
                        </form>
                    </div>
                `;

                // Ð’ÑÑ‚Ð°Ð²Ð»ÑÐµÐ¼ Ð½Ð° ÑÐ²Ð¾Ñ‘ Ð¿Ð¾Ñ€ÑÐ´ÐºÐ¾Ð²Ð¾Ðµ Ð¼ÐµÑÑ‚Ð¾
                const referenceNode = container.children[index];
                if (referenceNode) {
                    container.insertBefore(card, referenceNode);
                } else {
                    container.appendChild(card);
                }

                // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚Ñ‡Ð¸Ðº Ð´Ð»Ñ "Ð§Ð¸Ñ‚Ð°Ñ‚ÑŒ Ð´Ð°Ð»ÐµÐµ"
                const readMoreBtn = card.querySelector(".read-more-btn");
                if (readMoreBtn) {
                    readMoreBtn.addEventListener("click", () => {
                        card.querySelector(".post-content-short").style.display = "none";
                        card.querySelector(".post-content-full").style.display = "inline";
                        readMoreBtn.parentElement.style.display = "none";
                    });
                }
            } else {
                // Ð•ÑÐ»Ð¸ Ð¿Ð¾ÑÑ‚ ÑƒÐ¶Ðµ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÐµÑ‚ â€” Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ñ‚Ð¾Ñ‡ÐµÑ‡Ð½Ð¾ Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ Ð´Ð°Ð½Ð½Ñ‹Ðµ, Ð¡Ð¢Ð ÐžÐ“Ðž Ð·Ð°Ð¿Ñ€ÐµÑ‰Ð°Ñ Ð»ÑŽÐ±Ñ‹Ðµ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸Ð¸
                card.style.animation = "none";

                const likeBtn = card.querySelector(".like-btn");
                if (likeBtn) {
                    const newLikeStr = `${likeText} (${post.likes_count || 0})`;
                    if (likeBtn.textContent !== newLikeStr || likeBtn.style.color !== likeColor) {
                        likeBtn.style.color = likeColor;
                        likeBtn.textContent = newLikeStr;
                    }
                }

                // Ð£Ð±Ñ€Ð°Ð»Ð¸ Ð¿Ñ€Ð¸Ð½ÑƒÐ´Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾Ðµ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ contentEl.innerHTML, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð½Ðµ Ð¿ÐµÑ€ÐµÐ·Ð°Ñ‚Ð¸Ñ€Ð°Ñ‚ÑŒ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ "Ð§Ð¸Ñ‚Ð°Ñ‚ÑŒ Ð´Ð°Ð»ÐµÐµ"

                const commentsBtn = card.querySelector(".comments-toggle-btn");
                if (commentsBtn) {
                    const newCommentsStr = `ðŸ’¬ ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¸ (${post.comments_count || 0})`;
                    if (commentsBtn.textContent !== newCommentsStr) {
                        commentsBtn.textContent = newCommentsStr;
                    }
                }
            }
        });
    }

    // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¿Ð¾ÑÑ‚Ð¾Ð²
    function loadPosts() {
        const headers = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // ÐÐ° Ð²ÐºÐ»Ð°Ð´ÐºÐµ "ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ ÑÐ°Ð¹Ñ‚Ð°" Ð³Ñ€ÑƒÐ·Ð¸Ð¼ Ð²ÑÐµ Ð¿Ð¾ÑÑ‚Ñ‹, Ð½Ð¾ Ñ„Ð¸Ð»ÑŒÑ‚Ñ€ÑƒÐµÐ¼ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð°Ñ‚Ñ‡Ð¸
        const feedParam = currentFeed === 'patches' ? 'global' : currentFeed;
        const limit = 15 * currentLoadedPage;

        fetch(`/api/users/posts?feed=${feedParam}&page=1&limit=${limit}`, { headers })
            .then(res => res.json())
            .then(data => {
                const postsList = data.posts || [];
                const totalPages = data.totalPages || 0;

                if (currentFeed === 'patches') {
                    const patchFeed = document.getElementById("patchFeed");
                    const patches = postsList.filter(p => p.type === 'patch_note');
                    updateFeedInPlace(patchFeed, patches, "ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ð¹ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ‚");
                } else {
                    const newsFeed = document.getElementById("newsFeed");
                    const news = postsList.filter(p => p.type === 'news');
                    updateFeedInPlace(newsFeed, news, "ÐÐ¾Ð²Ð¾ÑÑ‚ÐµÐ¹ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ‚");
                }

                // Ð£Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¾Ñ‚Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸ÐµÐ¼ ÐºÐ½Ð¾Ð¿ÐºÐ¸ "Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ ÐµÑ‰Ñ‘"
                const loadMoreSec = document.getElementById("loadMoreSection");
                if (loadMoreSec) {
                    if (totalPages > 1) {
                        loadMoreSec.style.display = "block";
                    } else {
                        loadMoreSec.style.display = "none";
                    }
                }

                // Ð¡Ð¢Ð ÐžÐ“Ðž Ð¢Ð£Ð¢: ÐºÐ°Ðº Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿ÐµÑ€Ð²Ð°Ñ Ð¿Ð°Ñ‡ÐºÐ° Ð¿Ð¾ÑÑ‚Ð¾Ð² Ð¾Ñ‚Ñ€Ð¸ÑÐ¾Ð²Ð°Ð»Ð°ÑÑŒ â€” Ð±Ð»Ð¾ÐºÐ¸Ñ€ÑƒÐµÐ¼ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ñ‹Ðµ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸Ð¸!
                isInitialLoadComplete = true;
            })
            .catch(() => { });
    }

    // ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚Ñ‡Ð¸Ðº ÐºÐ½Ð¾Ð¿ÐºÐ¸ "Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ ÐµÑ‰Ðµ"
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            currentLoadedPage++;
            loadPosts();
        });
    }

    // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð¾Ð½Ð»Ð°Ð¹Ð½ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹
    function loadOnline() {
        fetch("/api/users/online")
            .then(res => res.json())
            .then(users => {
                const list = document.getElementById("onlineList");
                if (users.length === 0) {
                    list.innerHTML = '<p class="loading-text">ÐÐ¸ÐºÐ¾Ð³Ð¾ Ð½ÐµÑ‚ Ð² ÑÐµÑ‚Ð¸</p>';
                    return;
                }

                if (list.innerHTML.includes("loading-text") || list.innerHTML.includes("ÐÐ¸ÐºÐ¾Ð³Ð¾ Ð½ÐµÑ‚ Ð² ÑÐµÑ‚Ð¸")) {
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
                list.innerHTML = '<p class="loading-text">ÐžÑˆÐ¸Ð±ÐºÐ° Ð·Ð°Ð³Ñ€ÑƒÐ·ÐºÐ¸</p>';
            });
    }

    window.togglePostLike = async function (postId) {
        if (!token) { await window.showCustomAlert("Ð’Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ Ð² ÑÐ¸ÑÑ‚ÐµÐ¼Ñƒ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð»Ð°Ð¹ÐºÐ¸"); return; }
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
        if (!await window.showCustomConfirm("Ð’Ñ‹ ÑƒÐ²ÐµÑ€ÐµÐ½Ñ‹, Ñ‡Ñ‚Ð¾ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÑ‚Ð¾Ñ‚ Ð¿Ð¾ÑÑ‚?")) return;
        
        fetch(`/api/users/posts/${postId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                if (card) card.remove();
            } else {
                await window.showCustomAlert(data.error || "ÐžÑˆÐ¸Ð±ÐºÐ° ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ñ Ð¿Ð¾ÑÑ‚Ð°");
            }
        })
        .catch(async err => {
            console.error("ÐžÑˆÐ¸Ð±ÐºÐ° Ð¿Ñ€Ð¸ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ð¸ Ð¿Ð¾ÑÑ‚Ð°:", err);
            await window.showCustomAlert("ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐµÑ‚Ð¸");
        });
    };

    window.deleteComment = async function(postId, commentId) {
        if (!await window.showCustomConfirm("Ð’Ñ‹ ÑƒÐ²ÐµÑ€ÐµÐ½Ñ‹, Ñ‡Ñ‚Ð¾ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÑ‚Ð¾Ñ‚ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ð¹?")) return;
        
        fetch(`/api/users/comments/${commentId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(async data => {
            if (data.message) {
                loadPostComments(postId);
                loadPosts(); // to update comment counts
            } else {
                await window.showCustomAlert(data.error || "ÐžÑˆÐ¸Ð±ÐºÐ° ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ñ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ñ");
            }
        })
        .catch(async err => {
            console.error("ÐžÑˆÐ¸Ð±ÐºÐ° Ð¿Ñ€Ð¸ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ð¸ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ñ:", err);
            await window.showCustomAlert("ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐµÑ‚Ð¸");
        });
    };

    window.loadPostComments = function (postId) {
        fetch(`/api/users/posts/${postId}/comments`)
            .then(res => res.json())
            .then(comments => {
                const list = document.getElementById(`commentsList-${postId}`);
                if (!list) return;

                if (comments.length === 0) {
                    list.innerHTML = '<p class="loading-text" style="font-size: 10px;">ÐšÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸ÐµÐ² Ð½ÐµÑ‚. Ð‘ÑƒÐ´ÑŒÑ‚Ðµ Ð¿ÐµÑ€Ð²Ñ‹Ð¼Ð¸!</p>';
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
                        const deleteCommentBtnHtml = canDeleteComment ? `<button class="delete-btn" style="margin-left: 8px;" onclick="deleteComment(${postId}, ${comment.id})">Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ</button>` : '';

                        return `
                        <div style="padding-left: 12px; margin-left: ${indent}px; border-left: ${borderLeft}; padding-top: 8px; padding-bottom: 8px; margin-bottom: 8px; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                                <a href="profile.html?username=${encodeURIComponent(comment.username)}" style="color: ${color}; font-weight: bold; text-decoration: none;">${escapeHtml(comment.username)}</a>
                                <span style="font-size: 10px; color: rgba(255,255,255,0.5);">${new Date(comment.created_at).toLocaleString()}</span>
                                ${token ? `<button style="color: yellow; cursor: pointer; font-size: 10px; font-weight: bold; margin-left: 8px; background: none; border: none;" onclick="replyToComment(${postId}, ${comment.id}, '${escapeHtml(comment.username)}')">ÐžÑ‚Ð²ÐµÑ‚Ð¸Ñ‚ÑŒ</button>` : ''}
                                ${deleteCommentBtnHtml}
                            </div>
                            <div style="font-size: 12px; color: #eee; margin-top: 4px; word-break: break-word; line-height: 1.4;">${escapeHtml(comment.content)}</div>
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

    window.submitPostComment = async function (event, postId) {
        event.preventDefault();
        if (!token) { await window.showCustomAlert("Ð’Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ Ð² ÑÐ¸ÑÑ‚ÐµÐ¼Ñƒ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ"); return; }

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
            .then(async data => {
                if (data.commentId) {
                    input.value = "";
                    delete input.dataset.parentId;
                    loadPostComments(postId);
                } else if (data.error) {
                    await window.showCustomAlert(data.error);
                }
            })
            .catch(err => console.error(err));
    };

    // Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ð·Ð°ÐºÑ€ÐµÐ¿Ð° Ð¾Ñ‚ Ð°Ð´Ð¼Ð¸Ð½Ð°
    function loadAdminPin() {
        fetch("/api/users/admin-pin")
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
                    pinContent.textContent = "ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ð·Ð°ÐºÑ€ÐµÐ¿.";
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
                editAdminPinBtn.textContent = "ÐžÑ‚Ð¼ÐµÐ½Ð°";
            } else {
                adminPinEditArea.style.display = "none";
                adminPinContent.style.display = "block";
                editAdminPinBtn.textContent = "Ð ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ";
            }
        });
    }

    if (saveAdminPinBtn) {
        saveAdminPinBtn.addEventListener("click", async () => {
            const content = document.getElementById("adminPinInput").value.trim();
            if (!content) {
                await window.showCustomAlert("Ð¢ÐµÐºÑÑ‚ Ð·Ð°ÐºÑ€ÐµÐ¿Ð° Ð½Ðµ Ð¼Ð¾Ð¶ÐµÑ‚ Ð±Ñ‹Ñ‚ÑŒ Ð¿ÑƒÑÑ‚Ñ‹Ð¼");
                return;
            }

            fetch("/api/users/admin-pin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            })
            .then(res => res.json())
            .then(async data => {
                if (data.message) {
                    adminPinEditArea.style.display = "none";
                    adminPinContent.style.display = "block";
                    editAdminPinBtn.textContent = "Ð ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ";
                    loadAdminPin();
                } else {
                    await window.showCustomAlert(data.error || "ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ñ");
                }
            })
            .catch(async () => await window.showCustomAlert("ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐµÑ‚Ð¸"));
        });
    }

    loadPosts();
    loadOnline();
    setInterval(loadOnline, 30000);

    async function createPost(type) {
        if (!token) { await window.showCustomAlert("Ð’Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ Ð² ÑÐ¸ÑÑ‚ÐµÐ¼Ñƒ"); return; }
        const content = document.getElementById("postContent").value.trim();
        if (!content) { document.getElementById("postMessage").textContent = "ÐÐ°Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ text"; return; }

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
