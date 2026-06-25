const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Re-encoding загруженных изображений для удаления metadata и потенциальных XSS в EXIF
const processUploadedImage = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const outputPath = filePath; // Перезаписываем оригинальный файл
        
        // Получаем информацию о файле
        const metadata = await sharp(filePath).metadata();
        
        // Определяем формат вывода
        let format = 'jpeg';
        if (ext === '.png') format = 'png';
        else if (ext === '.webp') format = 'webp';
        else if (ext === '.gif') format = 'gif';
        
        // Re-encode изображение с удалением всей metadata
        await sharp(filePath)
            .toFormat(format, { 
                quality: 90,
                progressive: true
            })
            .withMetadata({ // Оставляем только безопасные метаданные
                exif: null, // Удаляем EXIF
                xmp: null,  // Удаляем XMP
                icc: null   // Удаляем ICC профили
            })
            .toFile(outputPath);
        
        return true;
    } catch (error) {
        console.error('Error processing image:', error);
        // Если не удалось обработать, удаляем файл
        try {
            fs.unlinkSync(filePath);
        } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
        }
        return false;
    }
};

module.exports = { processUploadedImage };