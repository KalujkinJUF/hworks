document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("searchInput");
    const resultsDiv = document.getElementById("searchResults");
    const messageDiv = document.getElementById("searchMessage");

    const roleColors = {
        admin: '#ff4444', moderator: '#ff8c00', user: '#00ccff',
        newbie: '#888888', premium: '#ffd700', vip: '#9b59b6', banned: '#333333'
    };

    const roleLabels = {
        newbie: 'NEWBIE', user: 'USER', premium: 'PREMIUM',
        vip: 'VIP', moderator: 'MOD', admin: 'ADMIN', banned: 'BANNED'
    };

    let currentSearchPage = 1;
    let currentSearchQuery = "";

    function renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
        container.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                const pageBtn = document.createElement('button');
                pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
                pageBtn.textContent = i;
                if (i === currentPage) {
                    pageBtn.disabled = true;
                } else {
                    pageBtn.addEventListener('click', () => onPageChange(i));
                }
                container.appendChild(pageBtn);
            } else if (i === 2 && currentPage > 3) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'white';
                dots.style.margin = '0 5px';
                container.appendChild(dots);
                i = currentPage - 2;
            } else if (i === currentPage + 2 && currentPage < totalPages - 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'white';
                dots.style.margin = '0 5px';
                container.appendChild(dots);
                i = totalPages - 1;
            }
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
        container.appendChild(nextBtn);
    }


    // Загружаем пользователей постранично с бэкенда
    function loadUsers(page = currentSearchPage, query = currentSearchQuery) {
        currentSearchPage = page;
        currentSearchQuery = query;

        fetch(`/api/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=15`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                const users = data.users || [];
                const totalPages = data.totalPages || 0;
                const currentPage = data.currentPage || 1;

                displayUsers(users);
                messageDiv.textContent = "";

                renderPagination('searchPagination', currentPage, totalPages, (p) => {
                    loadUsers(p, query);
                });
            })
            .catch(err => {
                console.error("Error loading search users:", err);
                messageDiv.textContent = window.t('error_load', 'Ошибка загрузки данных');
                messageDiv.style.color = "#ff4444";
            });
    }

    function displayUsers(users) {
        if (users.length === 0) {
            resultsDiv.innerHTML = `<p class="loading-text">${window.t('search_no_results', 'Пользователей не найдено')}</p>`;
        } else {
            resultsDiv.innerHTML = users.map(u => {
                const color = roleColors[u.role] || '#ffffff';
                const roleLabel = roleLabels[u.role] || u.role.toUpperCase();
                return `
                    <div class="search-result-card" style="display: flex; justify-content: space-between; align-items: flex-start; cursor: auto;">
                        <a href="profile.html?username=${encodeURIComponent(u.username)}" style="text-decoration: none; color: inherit; flex: 1;">
                            <div class="result-header">
                                ${u.avatar ? `<img src="${escapeHtml(u.avatar)}" class="result-avatar" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><div style="display:none; width: 44px; height: 44px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%;"></div>` : '<div style="width: 44px; height: 44px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: inline-block;"></div>'}
                                <span class="result-username" style="color: ${color};">${escapeHtml(u.username)}</span>
                                <span class="result-role" style="color: ${color}; border-color: ${color};">${escapeHtml(roleLabel)}</span>
                            </div>
                            <p class="result-about">${escapeHtml(u.about) || window.t('no_info', 'Нет информации')}</p>
                        </a>
                    </div>
                `;
            }).join('');
        }
    }

    let searchTimeout = null;
    // Поиск при вводе (в реальном времени с дебаунсом)
    searchInput.addEventListener("input", () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const q = searchInput.value.trim();
            loadUsers(1, q);
        }, 300);
    });

    // Загружаем всех пользователей при открытии страницы
    loadUsers(1, "");

    // Функция для экранирования HTML
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
