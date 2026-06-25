const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const clientDir = __dirname;
const updatesDir = path.join(clientDir, '..', 'updates');

if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
}

// Попытка прочесть текущую версию из main.js
let version = 'unknown';
try {
    const mainContent = fs.readFileSync(path.join(clientDir, 'main.js'), 'utf8');
    const versionMatch = mainContent.match(/const CLIENT_VERSION = ['"]([^'"]+)['"]/);
    if (versionMatch) {
        version = versionMatch[1];
    }
} catch (e) {
    console.error('Не удалось определить версию из main.js:', e);
}

console.log(`Начало упаковки обновления версии: ${version}`);

const zip = new AdmZip();

// Список файлов для упаковки в корень архива
const filesToPack = [
    'main.js',
    'preload.js',
    'setup.html',
    'setup.js',
    'setup.css',
    'package.json'
];

filesToPack.forEach(file => {
    const filePath = path.join(clientDir, file);
    if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
        console.log(`Добавлен файл: ${file}`);
    } else {
        console.warn(`Внимание: файл ${file} не найден`);
    }
});

// Добавление папки fonts рекурсивно
const fontsDir = path.join(clientDir, 'fonts');
if (fs.existsSync(fontsDir)) {
    zip.addLocalFolder(fontsDir, 'fonts');
    console.log('Добавлена папка fonts');
}

const outputPath = path.join(updatesDir, 'client.zip');
zip.writeZip(outputPath);
console.log(`\nОбновление успешно упаковано в: ${outputPath}`);
console.log(`Размер архива: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
