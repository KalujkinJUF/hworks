// Глобальная обёртка над fetch: автоматически добавляет заголовок X-CSRF-Token
// для всех изменяющих запросов (POST/PUT/DELETE/PATCH) к нашему API.
// Токен читается из cookie 'csrfToken' (он не httpOnly специально для этого).
(function () {
    function getCookie(name) {
        const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? decodeURIComponent(m.pop()) : '';
    }

    const nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        init = init || {};
        const method = (init.method || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();

        // Только same-origin и только изменяющие методы
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
        const needsToken = sameOrigin && !['GET', 'HEAD', 'OPTIONS'].includes(method);

        if (needsToken) {
            const token = getCookie('csrfToken');
            const headers = new Headers(init.headers || (typeof input !== 'string' && input ? input.headers : undefined) || {});
            if (token && !headers.has('X-CSRF-Token')) {
                headers.set('X-CSRF-Token', token);
            }
            init = Object.assign({ credentials: 'include' }, init, { headers });
        }

        return nativeFetch(input, init);
    };
})();
