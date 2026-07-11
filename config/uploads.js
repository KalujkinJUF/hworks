// Физическое удаление загруженных файлов при удалении сообщения/поста/комментария.
// Каждая загрузка (multer) создаёт уникальное имя файла, поэтому запись владеет своими
// файлами единолично — их безопасно удалять вместе с записью.
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Собирает имена файлов из image_url + media (JSON-строка/массив) и удаляет их из
// public/uploads. Защита от path traversal: принимаем только безопасные basename
// вида /uploads/<name>, где name = [A-Za-z0-9._-]+ и не '.'/'..'.
function deleteMediaFiles(imageUrl, media) {
    const urls = [];
    if (imageUrl) urls.push(imageUrl);
    if (media) {
        let arr = media;
        if (typeof media === 'string') { try { arr = JSON.parse(media); } catch (e) { arr = []; } }
        if (Array.isArray(arr)) urls.push(...arr);
    }
    const seen = new Set();
    urls.filter(Boolean).forEach((u) => {
        const m = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(String(u));
        if (!m) return;
        const name = m[1];
        if (name === '.' || name === '..' || seen.has(name)) return;
        seen.add(name);
        fs.unlink(path.join(UPLOAD_DIR, name), (err) => {
            if (err && err.code !== 'ENOENT') logger.error('Не удалось удалить файл загрузки: ' + name);
        });
    });
}

module.exports = { deleteMediaFiles };
