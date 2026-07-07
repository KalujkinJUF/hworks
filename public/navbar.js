// Глобальный перехват ошибок загрузки изображений (для соответствия CSP без unsafe-inline)
document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        img.style.display = 'none';
        const placeholder = img.nextElementSibling;
        if (placeholder) {
            placeholder.style.display = ''; // Сбрасываем display: none
        }
    }
}, true);

// #15 Просмотрщик фото (lightbox) для изображений в постах и чате
(function() {
    const style = document.createElement('style');
    style.textContent = '.message-media-box img, .post-media-box img, .comment-media-box img, .media-gallery img { cursor: zoom-in; }';
    document.head.appendChild(style);

    function openLightbox(src, mediaElements, initialIndex) {
        let currentIndex = initialIndex;
        
        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100000;padding:20px;box-sizing:border-box;opacity:0;transition:opacity 0.25s ease-out;';
        
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;position:relative;';
        
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:95vw;max-height:85vh;object-fit:contain;box-shadow:0 0 30px rgba(0,0,0,0.8);transform:scale(0.9);opacity:0;transition:transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15), opacity 0.25s ease-out;user-select:none;pointer-events:auto;cursor:grab;';
        
        imgContainer.appendChild(img);
        overlay.appendChild(imgContainer);
        
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;z-index:100001;background:rgba(0,0,0,0.75);padding:8px 16px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);margin-top:15px;box-shadow:0 4px 15px rgba(0,0,0,0.5);user-select:none;pointer-events:auto;';
        
        overlay.appendChild(controls);
        
        let zoomLevel = 1;
        let isDragging = false;
        let startX = 0, startY = 0;
        let translateX = 0, translateY = 0;
        
        function updateTransform() {
            img.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
        }
        
        const zoomIn = () => {
            zoomLevel = Math.min(zoomLevel + 0.5, 4);
            img.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
            updateTransform();
        };
        
        const zoomOut = () => {
            zoomLevel = Math.max(zoomLevel - 0.5, 1);
            if (zoomLevel === 1) {
                translateX = 0;
                translateY = 0;
            }
            img.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
            updateTransform();
        };
        
        const resetZoom = () => {
            zoomLevel = 1;
            translateX = 0;
            translateY = 0;
            img.style.cursor = 'grab';
            updateTransform();
        };
        
        img.addEventListener('mousedown', (e) => {
            if (zoomLevel > 1) {
                isDragging = true;
                startX = e.clientX - translateX * zoomLevel;
                startY = e.clientY - translateY * zoomLevel;
                img.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                translateX = (e.clientX - startX) / zoomLevel;
                translateY = (e.clientY - startY) / zoomLevel;
                updateTransform();
            }
        });
        
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = 'grab';
            }
        });
        
        overlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.25 : -0.25;
            zoomLevel = Math.max(1, Math.min(zoomLevel + delta, 4));
            if (zoomLevel === 1) {
                translateX = 0;
                translateY = 0;
            }
            updateTransform();
        }, { passive: false });
        
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '◀';
        prevBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:18px;padding:5px 8px;outline:none;line-height:1;transition:opacity 0.2s;';
        
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.textContent = '➖';
        zoomOutBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:5px 8px;outline:none;line-height:1;';
        
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '1:1';
        resetBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:13px;padding:5px 8px;outline:none;font-family:inherit;font-weight:bold;line-height:1;';
        
        const zoomInBtn = document.createElement('button');
        zoomInBtn.textContent = '➕';
        zoomInBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:5px 8px;outline:none;line-height:1;';
        
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '▶';
        nextBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;font-size:18px;padding:5px 8px;outline:none;line-height:1;transition:opacity 0.2s;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:none;border:none;color:#ff5555;cursor:pointer;font-size:18px;padding:5px 8px;outline:none;font-weight:bold;line-height:1;';
        
        controls.appendChild(prevBtn);
        controls.appendChild(zoomOutBtn);
        controls.appendChild(resetBtn);
        controls.appendChild(zoomInBtn);
        controls.appendChild(nextBtn);
        controls.appendChild(closeBtn);
        
        function updatePaging() {
            if (mediaElements.length <= 1) {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            } else {
                prevBtn.style.display = '';
                nextBtn.style.display = '';
                prevBtn.style.opacity = currentIndex === 0 ? '0.3' : '1';
                prevBtn.style.cursor = currentIndex === 0 ? 'default' : 'pointer';
                nextBtn.style.opacity = currentIndex === mediaElements.length - 1 ? '0.3' : '1';
                nextBtn.style.cursor = currentIndex === mediaElements.length - 1 ? 'default' : 'pointer';
            }
        }
        
        function showImage(idx) {
            if (idx < 0 || idx >= mediaElements.length) return;
            currentIndex = idx;
            const targetUrl = mediaElements[currentIndex].getAttribute('src');
            
            img.style.opacity = '0';
            img.style.transform = 'scale(0.95)';
            setTimeout(() => {
                img.src = targetUrl;
                resetZoom();
                img.style.opacity = '1';
                img.style.transform = 'scale(1)';
                updatePaging();
            }, 120);
        }
        
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex > 0) showImage(currentIndex - 1);
        });
        
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex < mediaElements.length - 1) showImage(currentIndex + 1);
        });
        
        zoomInBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomIn(); });
        zoomOutBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomOut(); });
        resetBtn.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });
        
        const close = () => {
            overlay.style.opacity = '0';
            img.style.transform = 'scale(0.9)';
            img.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
            }, 250);
        };
        
        const onKey = (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft' && currentIndex > 0) showImage(currentIndex - 1);
            else if (e.key === 'ArrowRight' && currentIndex < mediaElements.length - 1) showImage(currentIndex + 1);
        };
        
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === imgContainer) {
                close();
            }
        });
        
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        });
        
        updatePaging();
    }

    document.addEventListener('click', (e) => {
        const img = e.target.closest('.message-media-box img, .post-media-box img, .comment-media-box img, .media-gallery img');
        if (img && img.getAttribute('src')) {
            e.preventDefault();
            e.stopPropagation();
            
            const parent = img.closest('.media-gallery') || img.closest('.post-card') || img.closest('[data-ctx="comment"]') || img.closest('.chat-message') || img.parentElement;
            const mediaElements = Array.from(parent.querySelectorAll('.message-media-box img, .post-media-box img, .comment-media-box img, .media-gallery img'));
            
            const src = img.getAttribute('src');
            const index = mediaElements.indexOf(img);
            
            openLightbox(src, mediaElements, index >= 0 ? index : 0);
        }
    });
})();

// #16 Рендер медиа (img/video/audio) по расширению
window.mediaTag = function(url, maxHeight) {
    if (!url) return '';
    const esc = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ext = (String(url).split('.').pop() || '').toLowerCase();
    const mh = maxHeight || 380;
    if (ext === 'mp4' || ext === 'webm') {
        return `<video src="${esc}" controls preload="metadata" style="max-width:100%; max-height:${mh}px; display:block;"></video>`;
    }
    if (ext === 'mp3') {
        return `<audio src="${esc}" controls preload="metadata" style="width:100%; min-width:220px;"></audio>`;
    }
    return `<img src="${esc}" style="max-width:100%; max-height:${mh}px; display:block; object-fit:contain;">`;
};

// #19 Рендер нескольких медиа (JSON-массив URL, с фолбэком на image_url)
window.mediaListHtml = function(mediaField, imageUrl, maxHeight, boxClass) {
    let urls = [];
    if (mediaField) {
        try {
            const arr = typeof mediaField === 'string' ? JSON.parse(mediaField) : mediaField;
            if (Array.isArray(arr)) urls = arr.filter(Boolean);
        } catch (e) {}
    }
    if (!urls.length && imageUrl) urls = [imageUrl];
    if (!urls.length) return '';

    const visualUrls = [];
    const audioUrls = [];
    urls.forEach(u => {
        const ext = (String(u).split('.').pop() || '').toLowerCase();
        if (ext === 'mp3') {
            audioUrls.push(u);
        } else {
            visualUrls.push(u);
        }
    });

    let html = '';
    const cls = boxClass || 'post-media-box';

    if (visualUrls.length > 0) {
        if (visualUrls.length === 1) {
            const u = visualUrls[0];
            html += `<div class="${cls}" style="margin-top:8px; margin-right:6px; border:2px solid white; padding:2px; max-width:100%; display:inline-block; background:black; vertical-align:top;">${window.mediaTag(u, maxHeight)}</div>`;
        } else {
            html += `<div class="media-gallery" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; margin-top: 8px; max-width: 100%;">`;
            visualUrls.forEach(u => {
                const esc = String(u).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const ext = (String(u).split('.').pop() || '').toLowerCase();
                const isVideo = ext === 'mp4' || ext === 'webm';
                html += `
                    <div class="${cls}" style="border:2px solid white; padding:2px; background:black; overflow:hidden; display:flex; justify-content:center; align-items:center; aspect-ratio: 4/3;">
                        ${isVideo ? 
                            `<video src="${esc}" controls preload="metadata" style="width:100%; height:100%; object-fit:cover; display:block;"></video>` : 
                            `<img src="${esc}" style="width:100%; height:100%; object-fit:cover; display:block;" />`
                        }
                    </div>
                `;
            });
            html += `</div>`;
        }
    }

    audioUrls.forEach(u => {
        html += `<div style="margin-top:8px; width: 100%; max-width: 400px; display: block;">${window.mediaTag(u)}</div>`;
    });

    return html;
};

// #16 Меню выбора типа вложения (фото/видео/аудио) рядом с кнопкой прикрепления
window.attachMediaMenu = function(anchorBtn, fileInput) {
    document.querySelectorAll('.attach-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'attach-menu';
    menu.style.cssText = 'position:absolute; z-index:100001; background:#141414; border:1px solid #888; border-radius:6px; padding:4px; display:flex; flex-direction:column; min-width:150px; box-shadow:0 6px 18px rgba(0,0,0,0.6);';
    const opts = [
        { label: window.t('attach_photo', 'Фото'), accept: 'image/jpeg,image/png,image/gif,image/webp' },
        { label: window.t('attach_video', 'Видео'), accept: 'video/mp4,video/webm' },
        { label: window.t('attach_audio', 'Аудио'), accept: 'audio/mpeg' }
    ];
    opts.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.style.cssText = 'background:none; border:none; color:#eee; text-align:left; padding:8px 10px; cursor:pointer; font-family:inherit; font-size:13px; border-radius:4px;';
        b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.12)'; });
        b.addEventListener('mouseleave', () => { b.style.background = 'none'; });
        b.addEventListener('click', () => { fileInput.accept = o.accept; fileInput.multiple = true; menu.remove(); fileInput.click(); });
        menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchorBtn.getBoundingClientRect();
    menu.style.left = (window.scrollX + r.left) + 'px';
    menu.style.top = (window.scrollY + r.bottom + 4) + 'px';
    setTimeout(() => {
        const close = (e) => { if (!menu.contains(e.target) && e.target !== anchorBtn) { menu.remove(); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
    }, 0);
};

// #21/#23 Кастомное контекстное меню (заменяет нативное): действия + сохранить/копировать
(function() {
    let menuEl = null;
    function closeMenu() {
        if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('click', onDocClick, true); }
    }
    function onDocClick(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }

    function showContextMenu(x, y, items) {
        closeMenu();
        if (!items.length) return;
        menuEl = document.createElement('div');
        menuEl.className = 'ctx-menu';
        
        const isAero = (localStorage.getItem('app_theme') === 'aero');
        if (isAero) {
            menuEl.style.cssText = 'position:fixed; z-index:100002; background: linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(220, 240, 255, 0.5) 100%); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.7); border-radius: 12px; padding: 6px; display:flex; flex-direction:column; min-width:180px; box-shadow: 0 10px 30px rgba(0, 100, 200, 0.15); gap: 4px;';
        } else {
            menuEl.style.cssText = 'position:fixed; z-index:100002; background:black; border:3px double white; border-radius:0px; padding:4px; display:flex; flex-direction:column; min-width:170px; box-shadow:0 6px 20px rgba(0,0,0,0.6);';
        }
        
        items.forEach(it => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = it.label;
            
            if (isAero) {
                b.style.cssText = 'background: linear-gradient(180deg, #ffffff 0%, #d0e8ff 45%, #a8d4ff 50%, #cce4ff 100%); border: 1px solid #4a90d9; color:' + (it.danger ? '#cc0000' : '#004488') + '; text-align:left; padding:8px 12px; cursor:pointer; font-family:inherit; font-size:13px; border-radius:8px; white-space:nowrap;';
                if (it.danger) {
                    b.style.background = 'linear-gradient(180deg, #ffffff 0%, #ffdbdb 45%, #ffb3b3 50%, #ffcccc 100%)';
                    b.style.borderColor = '#ff6666';
                }
                b.addEventListener('mouseenter', () => {
                    if (it.danger) {
                        b.style.background = 'linear-gradient(180deg, #ffffff 0%, #ffe6e6 45%, #ffcccc 50%, #ffe0e0 100%)';
                        b.style.borderColor = '#ff3333';
                    } else {
                        b.style.background = 'linear-gradient(180deg, #ffffff 0%, #e6f2ff 45%, #cce4ff 50%, #e0efff 100%)';
                        b.style.borderColor = '#2f80ed';
                    }
                });
                b.addEventListener('mouseleave', () => {
                    if (it.danger) {
                        b.style.background = 'linear-gradient(180deg, #ffffff 0%, #ffdbdb 45%, #ffb3b3 50%, #ffcccc 100%)';
                        b.style.borderColor = '#ff6666';
                    } else {
                        b.style.background = 'linear-gradient(180deg, #ffffff 0%, #d0e8ff 45%, #a8d4ff 50%, #cce4ff 100%)';
                        b.style.borderColor = '#4a90d9';
                    }
                });
            } else {
                b.style.cssText = 'background:none; border:none; color:' + (it.danger ? '#ff5555' : '#ffffff') + '; text-align:left; padding:8px 12px; cursor:pointer; font-family:inherit; font-size:13px; border-radius:0px; white-space:nowrap;';
                b.addEventListener('mouseenter', () => {
                    b.style.background = 'white';
                    b.style.color = it.danger ? 'red' : 'black';
                });
                b.addEventListener('mouseleave', () => {
                    b.style.background = 'none';
                    b.style.color = it.danger ? '#ff5555' : '#ffffff';
                });
            }
            
            b.addEventListener('click', () => { closeMenu(); try { it.action(); } catch (err) { console.error(err); } });
            menuEl.appendChild(b);
        });
        document.body.appendChild(menuEl);
        const r = menuEl.getBoundingClientRect();
        menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
        menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    }
    window.showContextMenu = showContextMenu;

    function downloadFile(url) {
        const abs = url.startsWith('http') ? url : (window.location.origin + url);
        if (window.__TAURI__) {
            window.__TAURI__.core.invoke('save_file_to_disk', { url: abs })
                .then(msg => {
                    console.log(msg);
                })
                .catch(err => {
                    if (err !== 'Отменено пользователем') {
                        window.showCustomAlert(err);
                    }
                });
        } else {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = (String(url).split('/').pop() || 'file');
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (e) { console.error(e); }
        }
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        } else {
            const t = document.createElement('textarea');
            t.value = text; document.body.appendChild(t); t.select();
            try { document.execCommand('copy'); } catch (e) {}
            t.remove();
        }
    }

    document.addEventListener('contextmenu', (e) => {
        // В полях ввода оставляем нативное меню (вставить/копировать/выделить)
        if (e.target.closest('input, textarea')) return;
        // Полностью подавляем нативное меню (выбор пользователя)
        e.preventDefault();
        const items = [];
        const sel = (window.getSelection && window.getSelection().toString()) || '';

        const mediaBox = e.target.closest('.post-media-box, .message-media-box');
        const mediaEl = mediaBox && mediaBox.querySelector('img, video, audio');
        const message = e.target.closest('.message[data-msg-id]');
        const comment = e.target.closest('[data-ctx="comment"]');
        const post = e.target.closest('.post-card[data-post-id]');

        if (sel.trim()) {
            items.push({ label: window.t('ctx_copy', 'Копировать'), action: () => copyText(sel) });
        }
        if (comment) {
            if (comment.dataset.reply === '1' && window.replyToComment) {
                items.push({ label: window.t('ctx_reply', 'Ответить'), action: () => window.replyToComment(comment.dataset.postId, comment.dataset.commentId, comment.dataset.username) });
            }
            if (comment.dataset.canDelete === '1') {
                items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => {
                    if (comment.dataset.postId && window.deleteComment) window.deleteComment(comment.dataset.postId, comment.dataset.commentId);
                    else if (window.deleteWallComment) window.deleteWallComment(comment.dataset.commentId);
                }});
            }
        } else if (message) {
            if (window.setChatReply) {
                items.push({ label: window.t('ctx_reply', 'Ответить'), action: () => window.setChatReply(message.dataset.msgId) });
            }
            if (message.dataset.canDelete === '1' && window.deleteMessage) {
                items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => window.deleteMessage(message.dataset.msgId, { stopPropagation() {} }) });
            }
        } else if (post && post.dataset.canDelete === '1' && window.deletePost) {
            items.push({ label: window.t('delete', 'Удалить'), danger: true, action: () => window.deletePost(post.dataset.postId) });
        }

        if (mediaEl && mediaEl.getAttribute('src')) {
            const url = mediaEl.getAttribute('src');
            const abs = url.startsWith('http') ? url : (window.location.origin + url);
            items.push({ label: window.t('ctx_save', 'Сохранить'), action: () => downloadFile(url) });
            items.push({ label: window.t('ctx_copy_link', 'Копировать ссылку'), action: () => copyText(abs) });
        }

        if (items.length) showContextMenu(e.clientX, e.clientY, items);
    });
})();

// Обработка clear_session от Tauri-клиента (при обновлении версии)
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clear_session') === 'true') {
        // Вызываем серверный logout (удаляет httpOnly cookie)
        fetch('/api/users/logout', {
            method: 'POST',
            credentials: 'include'
        }).finally(() => {
            window.location.href = 'login.html';
        });
        return;
    }
})();

// #25 Версия сервиса в нижнем колонтитуле
(function() {
    function setFooterVersion() {
        const footer = document.querySelector('footer');
        if (!footer || footer.querySelector('.app-version')) return;
        const apply = (ver) => {
            if (!ver || footer.querySelector('.app-version')) return;
            const span = document.createElement('span');
            span.className = 'app-version';
            span.style.display = 'block';
            span.style.marginTop = '4px';
            span.style.fontSize = '10px';
            const label = (window.t ? window.t('version_label', 'Версия') : 'Версия');
            span.textContent = `${label}: ${ver}`;
            footer.appendChild(span);
        };
        if (window.__appVersion) return apply(window.__appVersion);
        fetch('/api/version').then(r => r.json()).then(d => {
            window.__appVersion = d.version || '';
            apply(window.__appVersion);
        }).catch(() => {});
    }
    document.addEventListener('DOMContentLoaded', setFooterVersion);
    document.addEventListener('spa:navigate', setFooterVersion);
})();

// Воспроизведение мягкого 8-битного ретро-звука уведомления (chiptune blip)
// Постоянный аудиоконтекст (создаём один раз) + разблокировка по первому взаимодействию,
// чтобы звук приходил даже когда окно свёрнуто / не в фокусе (#6).
function getNotifCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window.__notifCtx) {
        try { window.__notifCtx = new AudioCtx(); } catch (e) { return null; }
    }
    return window.__notifCtx;
}
['pointerdown', 'keydown'].forEach(ev => {
    window.addEventListener(ev, () => {
        const ctx = getNotifCtx();
        if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    }, { passive: true });
});

function playRetroNotificationSound() {
    try {
        const ctx = getNotifCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn('Аудио недоступно или заблокировано браузером:', e);
    }
}

// Вспомогательная функция для экранирования HTML в модалях
function escapeHtmlModal(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.showCustomAlert = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-modal-overlay";
        
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <div class="custom-modal-header">${window.t('modal_alert_title', 'ВНИМАНИЕ')}</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-ok" id="customAlertOkBtn">${window.t('modal_ok', 'OK')}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const okBtn = overlay.querySelector("#customAlertOkBtn");
        if (okBtn) okBtn.focus();
        
        okBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve();
        });
    });
};

window.showCustomConfirm = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-modal-overlay";
        
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <div class="custom-modal-header">${window.t('modal_confirm_title', 'ПОДТВЕРЖДЕНИЕ')}</div>
                <div class="custom-modal-content">${escapeHtmlModal(message)}</div>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn btn-yes" id="customConfirmYesBtn">${window.t('modal_yes', 'ДА')}</button>
                    <button class="custom-modal-btn btn-no" id="customConfirmNoBtn">${window.t('modal_no', 'НЕТ')}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const yesBtn = overlay.querySelector("#customConfirmYesBtn");
        const noBtn = overlay.querySelector("#customConfirmNoBtn");
        if (noBtn) noBtn.focus();
        
        yesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve(true);
        });
        
        noBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setTimeout(() => {
                overlay.remove();
            }, 50);
            resolve(false);
        });
    });
};


if (!window._navbarInitialized) {
window._navbarInitialized = true;
let _navbarInterval1 = null;
let _navbarInterval2 = null;

// Since navbar is global, we keep listeners and intervals, 
// BUT we re-trigger checkRole on spa:navigate to update auth buttons correctly!
document.addEventListener("spa:navigate", () => {
    if (window.updateNavbarNotifications) window.updateNavbarNotifications();
    if (window.updateNavbarVisibility) window.updateNavbarVisibility(window.currentUserNavbarData);
    if (window.currentUserNavbarData) {
        checkRole(window.currentUserNavbarData);
    }
});

document.addEventListener("DOMContentLoaded", () => {

    // Проверка авторизации через cookie (httpOnly)
    fetch("/api/users/profile", {
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error('Not authorized');
        return res.json();
    })
    .then(data => {
        initializeNavbar(data);
    })
    .catch(() => {
        initializeNavbar(null);
    });
});

function updateNavbarVisibility(myData) {
    const token = myData ? true : false;
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const btnRegister = document.getElementById("nav-register");
    const btnLogin = document.getElementById("nav-login");
    const btnProfile = document.getElementById("nav-profile");
    const btnSearch = document.getElementById("nav-search");
    const btnFriends = document.getElementById("nav-friends");
    const btnChat = document.getElementById("nav-chat");
    const btnAdmin = document.getElementById("nav-admin");
    const btnLogout = document.getElementById("nav-logout");

    const params = new URLSearchParams(window.location.search);
    const viewingUsername = params.get('username');
    const isViewingSomeoneElse = (currentPage === 'profile.html' && viewingUsername);

    // Reset default visibility first based on auth
    if (token) {
        if (btnRegister) btnRegister.style.display = "none";
        if (btnLogin) btnLogin.style.display = "none";
        if (btnProfile) btnProfile.style.display = "inline-block";
        if (btnFriends) btnFriends.style.display = "inline-block";
        if (btnChat) btnChat.style.display = "inline-block";
        if (btnSearch) btnSearch.style.display = "inline-block";
        if (btnLogout) btnLogout.style.display = "inline-block";
    } else {
        if (btnRegister) btnRegister.style.display = "inline-block";
        if (btnLogin) btnLogin.style.display = "inline-block";
        if (btnProfile) btnProfile.style.display = "none";
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        if (btnSearch) btnSearch.style.display = "none";
        if (btnAdmin) btnAdmin.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
    }

    if (btnRegister && currentPage === 'register.html') btnRegister.style.display = "none";
    if (btnLogin && currentPage === 'login.html') btnLogin.style.display = "none";
    if (btnProfile && currentPage === 'profile.html' && !isViewingSomeoneElse) btnProfile.style.display = "none";
    if (btnSearch && currentPage === 'search.html') btnSearch.style.display = "none";
    if (btnFriends && currentPage === 'friends.html') btnFriends.style.display = "none";
    if (btnChat && currentPage === 'chat.html') btnChat.style.display = "none";
    if (btnAdmin && currentPage === 'admin.html') btnAdmin.style.display = "none";
}

window.updateNavbarVisibility = updateNavbarVisibility;

function initializeNavbar(myData) {
    window.currentUserNavbarData = myData;
    const token = myData ? true : false;

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

    const params = new URLSearchParams(window.location.search);
    const viewingUsername = params.get('username');
    const isViewingSomeoneElse = (currentPage === 'profile.html' && viewingUsername);

    updateNavbarVisibility(myData);

    function updateNavbarNotifications() {
        if (!token) return;

        // Инициализируем переменные отслеживания звука в контексте окна
        if (typeof window.prevUnreadNotificationCount === 'undefined') {
            window.prevUnreadNotificationCount = -1;
            window.lastNotificationSoundTime = 0;
        }

        // Получаем непрочитанные от друзей с количеством
        fetch("/api/messages/unread/friends", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(unreadList => {
            const list = Array.isArray(unreadList) ? unreadList : [];
            
            // Общая сумма для кнопки в навбаре
            const totalCount = list.reduce((acc, item) => acc + item.count, 0);
            
            const btnChat = document.getElementById("nav-chat");
            if (btnChat) {
                const chatText = window.t('nav_chat', 'Чат');
                btnChat.textContent = totalCount > 0 ? `${chatText} (+${totalCount})` : chatText;
            }

            // Сумма для уведомлений (исключаем открытый чат, если окно в фокусе)
            const isChatPage = window.location.pathname.split('/').pop() === 'chat.html';
            const isAppVisible = !document.hidden && document.hasFocus();
            const activeFriendId = (isChatPage && isAppVisible && window.currentFriendId) ? parseInt(window.currentFriendId) : null;

            const notificationCount = list
                .filter(item => !activeFriendId || parseInt(item.sender_id) !== activeFriendId)
                .reduce((acc, item) => acc + item.count, 0);

            if (window.prevUnreadNotificationCount !== -1 && notificationCount > window.prevUnreadNotificationCount) {
                const now = Date.now();
                if (now - window.lastNotificationSoundTime > 5000) {
                    playRetroNotificationSound();
                    window.lastNotificationSoundTime = now;
                }
            }
            window.prevUnreadNotificationCount = notificationCount;
        })
        .catch(err => console.error("Ошибка при получении непрочитанных сообщений:", err));

        // Получаем входящие запросы в друзья
        fetch("/api/friends/requests/incoming", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(requests => {
            const count = Array.isArray(requests) ? requests.length : 0;
            const btnFriends = document.getElementById("nav-friends");
            if (btnFriends) {
                const friendsText = window.t('nav_friends', 'Друзья');
                btnFriends.textContent = count > 0 ? `${friendsText} (+${count})` : friendsText;
            }
        })
        .catch(err => console.error("Ошибка при получении запросов в друзья:", err));

        // Получаем количество непрочитанных отзывов на стене
        fetch("/api/users/unread-wall-count", {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            const count = data.count || 0;
            const btnProfile = document.getElementById("nav-profile");
            if (btnProfile) {
                const profileText = window.t('nav_profile', 'Профиль');
                btnProfile.textContent = count > 0 ? `${profileText} (+${count})` : profileText;
            }
        })
        .catch(err => console.error("Ошибка при получении непрочитанных отзывов на стене:", err));
    }

    window.updateNavbarNotifications = updateNavbarNotifications;

    if (token) {
        // Если пользователь ЗАЛОГИНИЛСЯ:
        if (btnRegister) btnRegister.style.display = "none";
        if (btnLogin) btnLogin.style.display = "none";
        if (btnProfile && (currentPage !== 'profile.html' || isViewingSomeoneElse)) btnProfile.style.display = "inline-block";
        if (btnFriends && currentPage !== 'friends.html') btnFriends.style.display = "inline-block";
        if (btnChat && currentPage !== 'chat.html') btnChat.style.display = "inline-block";
        if (btnSearch && currentPage !== 'search.html' && currentPage !== 'profile.html') btnSearch.style.display = "inline-block";
        if (btnLogout) btnLogout.style.display = "inline-block";

        updateNavbarNotifications();

        // Автообновление уведомлений в реальном времени каждые 10 секунд
        if(_navbarInterval1) clearInterval(_navbarInterval1); _navbarInterval1 = setInterval(updateNavbarNotifications, 10000);

        // Детекция активности и фоновый пинг присутствия
        let lastActivityTime = Date.now();
        let isIdle = false;

        const resetTimer = () => {
            lastActivityTime = Date.now();
            if (isIdle) {
                isIdle = false;
                sendPresencePing(false);
            }
        };

        // Подписываемся на события взаимодействия
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);
        window.addEventListener('scroll', resetTimer);

        function sendPresencePing(idleState) {
            fetch('/api/users/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ isIdle: idleState })
            })
            .then(res => res.json())
            .then(data => {
                // Если мы на странице собственного профиля, динамически обновим отображаемый статус (без сброса селекта настроек)
                // #10 Обновляем #userStatusText ТОЛЬКО на своём профиле, иначе пинг
                // перезаписывает статус чужого профиля своим (человек "away", а показывает "online").
                const page = window.location.pathname.split('/').pop();
                const viewingUsername = new URLSearchParams(window.location.search).get('username');
                const ownName = window.currentUserNavbarData && window.currentUserNavbarData.username;
                const isOwnProfile = page === 'profile.html' && (!viewingUsername || (ownName && viewingUsername.toLowerCase() === ownName.toLowerCase()));
                if (data.currentStatus && isOwnProfile) {
                    const statusText = document.getElementById("userStatusText");
                    const statusMap = { online: 'Online', offline: 'Offline', away: 'Away', dnd: 'DND' };
                    const statusColors = { online: '#00ff00', offline: '#888888', away: '#ffcc00', dnd: '#ff3333' };
                    if (statusText) {
                        statusText.innerText = statusMap[data.currentStatus] || 'Offline';
                        statusText.style.color = statusColors[data.currentStatus] || '#888888';
                    }
                }
            })
            .catch(err => console.error('Ошибка отправки пинга присутствия:', err));
        }

        // Стартовый пинг при загрузке страницы
        sendPresencePing(false);

        // Периодический пинг каждые 30 секунд для проверки простоя и обновления last_active
        
if(_navbarInterval2) clearInterval(_navbarInterval2); _navbarInterval2 = setInterval(() => {
    const idleThreshold = 5 * 60 * 1000;
    const currentIdleState = (Date.now() - lastActivityTime) > idleThreshold;
    if (currentIdleState !== isIdle) {
        isIdle = currentIdleState;
    }
    sendPresencePing(isIdle);
}, 30000);

        // Проверяем роль через профиль, чтобы показать кнопку админки или скрыть функции забаненного
        if (myData) {
            checkRole(myData);
        }
    } else {
        // Если пользователь НЕ залогинился:
        if (btnRegister && currentPage !== 'register.html') btnRegister.style.display = "inline-block";
        if (btnLogin && currentPage !== 'login.html') btnLogin.style.display = "inline-block";
        if (btnProfile) btnProfile.style.display = "none";
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        if (btnSearch) btnSearch.style.display = "none";
        if (btnAdmin) btnAdmin.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
    }

    // Логика для кнопки "Выйти"
    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            fetch('/api/users/logout', {
                method: 'POST',
                credentials: 'include'
            }).finally(() => {
                window.location.href = "index.html";
            });
        });
    }
}

function checkRole(data) {
    const btnFriends = document.getElementById("nav-friends");
    const btnChat = document.getElementById("nav-chat");
    const btnAdmin = document.getElementById("nav-admin");
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (data.role === 'banned') {
        if (btnFriends) btnFriends.style.display = "none";
        if (btnChat) btnChat.style.display = "none";
        
        // Перенаправление забаненных пользователей
        if (currentPage === 'friends.html' || currentPage === 'chat.html') {
            window.showCustomAlert(window.t('alert_banned_access', 'Ваш аккаунт заблокирован. Доступ к друзьям и чату ограничен.')).then(() => {
                window.location.href = "profile.html";
            });
        }
    }
    if ((data.role === 'admin' || data.role === 'moderator') && btnAdmin && currentPage !== 'admin.html') {
        btnAdmin.style.display = "inline-block";
    }
}

}
