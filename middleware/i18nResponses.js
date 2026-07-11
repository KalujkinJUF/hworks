// Локализация серверных сообщений (поля message/error в res.json).
// Язык берётся из cookie app_lang, которую ставит клиент (i18n.js). Русский —
// это «исходник», поэтому для 'ru' (и неизвестных языков) ничего не трогаем.
// Тексты берутся из config/serverMessages.js (RU -> {en, uk}); динамические
// сообщения (с переменной частью) переводятся regex-правилами ниже.

const dict = require('../config/serverMessages');

const regexRules = [
    { re: /^Роль изменена на (.+)$/, en: 'Role changed to $1', uk: 'Роль змінено на $1' },
    { re: /^Неизвестный бейдж: (.+)$/, en: 'Unknown badge: $1', uk: 'Невідомий бейдж: $1' },
    { re: /^Ошибка при обновлении: (.+)$/, en: 'Update error: $1', uk: 'Помилка при оновленні: $1' },
    { re: /^Лимит каналов: (.+)$/, en: 'Channel limit: $1', uk: 'Ліміт каналів: $1' },
    { re: /^Лимит участников: (.+)$/, en: 'Member limit: $1', uk: 'Ліміт учасників: $1' },
    { re: /^Вы не можете изменять профиль так часто\. Подождите еще (.+) сек\.$/,
      en: 'You are changing your profile too often. Wait $1 more sec.',
      uk: 'Ви змінюєте профіль надто часто. Зачекайте ще $1 сек.' },
    { re: /^Вы не можете оставлять комментарии так часто\. Подождите еще (.+) сек\.$/,
      en: 'You are commenting too often. Wait $1 more sec.',
      uk: 'Ви коментуєте надто часто. Зачекайте ще $1 сек.' },
    { re: /^Вы не можете публиковать посты так часто\. Пожалуйста, подождите еще (.+) сек\.$/,
      en: 'You are posting too often. Please wait $1 more sec.',
      uk: 'Ви публікуєте дописи надто часто. Будь ласка, зачекайте ще $1 сек.' }
];

function translate(text, lang) {
    if (typeof text !== 'string') return text;
    const exact = dict[text];
    if (exact && exact[lang]) return exact[lang];
    for (const r of regexRules) {
        if (r.re.test(text)) return text.replace(r.re, r[lang]);
    }
    return text;
}

module.exports = function i18nResponses(req, res, next) {
    const lang = (req.cookies && req.cookies.app_lang) || 'ru';
    if (lang !== 'en' && lang !== 'uk') return next(); // 'ru' и неизвестные — как есть
    const origJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object') {
            if (typeof body.message === 'string') body.message = translate(body.message, lang);
            if (typeof body.error === 'string') body.error = translate(body.error, lang);
        }
        return origJson(body);
    };
    next();
};
