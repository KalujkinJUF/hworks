const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Re-encoding загруженных изображений для удаления metadata и потенциальных XSS в EXIF
const processUploadedImage = async (filePath) => {
    const tmpPath = `${filePath}.tmp`;
    try {
        const ext = path.extname(filePath).toLowerCase();

        // Определяем формат вывода
        let format = 'jpeg';
        if (ext === '.png') format = 'png';
        else if (ext === '.webp') format = 'webp';
        else if (ext === '.gif') format = 'gif';

        // Re-encode во ВРЕМЕННЫЙ файл (нельзя читать и писать один и тот же файл — sharp может его повредить),
        // metadata по умолчанию удаляется (EXIF/XMP/ICC не переносятся)
        await sharp(filePath)
            .toFormat(format, {
                quality: 90,
                progressive: true
            })
            .toFile(tmpPath);

        // Атомарно заменяем оригинал обработанной версией
        fs.renameSync(tmpPath, filePath);

        return true;
    } catch (error) {
        console.error('Error processing image:', error);
        // Если не удалось обработать — удаляем и временный, и исходный файл
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
        try {
            fs.unlinkSync(filePath);
        } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
        }
        return false;
    }
};

module.exports = { processUploadedImage };