const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const srcDir = __dirname; // e:\proektiki\sait\client
const distTemp = path.join(srcDir, 'dist_temp');
const resourcesDir = path.join(distTemp, 'resources');
const appDir = path.join(resourcesDir, 'app');

function findElectronZip() {
    const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron', 'Cache');
    if (!fs.existsSync(cacheDir)) {
        throw new Error('Electron cache directory not found at ' + cacheDir);
    }
    
    function walk(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = walk(fullPath);
                if (found) return found;
            } else if (file.endsWith('.zip') && file.includes('win32-x64')) {
                return fullPath;
            }
        }
        return null;
    }
    
    return walk(cacheDir);
}

try {
    const electronZip = findElectronZip();
    if (!electronZip) {
        throw new Error('Electron zip archive win32-x64 not found in cache.');
    }
    console.log('Found Electron ZIP in cache:', electronZip);

    console.log('Cleaning dist_temp...');
    if (fs.existsSync(distTemp)) {
        fs.rmSync(distTemp, { recursive: true, force: true });
    }
    fs.mkdirSync(distTemp, { recursive: true });

    console.log('Extracting Electron...');
    const zip = new AdmZip(electronZip);
    zip.extractAllTo(distTemp, true);
    console.log('Electron extracted successfully.');

    // 1. Delete default_app.asar if it exists
    const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
    if (fs.existsSync(defaultAppAsar)) {
        fs.unlinkSync(defaultAppAsar);
        console.log('Deleted default_app.asar');
    }

    // 2. Create resources/app directory
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
        console.log('Created resources/app directory');
    }

    // 3. Files to copy
    const filesToCopy = [
        'main.js',
        'preload.js',
        'setup.css',
        'setup.html',
        'setup.js',
        'package.json'
    ];

    filesToCopy.forEach(file => {
        const src = path.join(srcDir, file);
        const dest = path.join(appDir, file);
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file}`);
    });

    // 4. Copy fonts folder recursively
    function copyDirSync(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        let entries = fs.readdirSync(src, { withFileTypes: true });

        for (let entry of entries) {
            let srcPath = path.join(src, entry.name);
            let destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                copyDirSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    const fontsSrc = path.join(srcDir, 'fonts');
    const fontsDest = path.join(appDir, 'fonts');
    if (fs.existsSync(fontsSrc)) {
        copyDirSync(fontsSrc, fontsDest);
        console.log('Copied fonts folder');
    }

    // Copy node_modules recursively to ensure adm-zip and other dependencies exist in the packaged build
    // Оптимизация: копируем только необходимые для работы продакшн-зависимости (adm-zip и electron-squirrel-startup)
    const nodeModulesDest = path.join(appDir, 'node_modules');
    fs.mkdirSync(nodeModulesDest, { recursive: true });

    const prodDeps = ['adm-zip', 'electron-squirrel-startup'];
    prodDeps.forEach(dep => {
        const depSrc = path.join(srcDir, 'node_modules', dep);
        const depDest = path.join(nodeModulesDest, dep);
        if (fs.existsSync(depSrc)) {
            copyDirSync(depSrc, depDest);
            console.log(`Copied production dependency: ${dep}`);
        }
    });

    // 5. Rename electron.exe to social-network-client.exe
    const oldExe = path.join(distTemp, 'electron.exe');
    const newExe = path.join(distTemp, 'social-network-client.exe');
    if (fs.existsSync(oldExe)) {
        fs.renameSync(oldExe, newExe);
        console.log('Renamed electron.exe to social-network-client.exe');
    }

    // 6. Move/rename dist_temp to dist/social-network-client-win32-x64
    const finalParentDir = path.join(srcDir, 'dist');
    if (!fs.existsSync(finalParentDir)) {
        fs.mkdirSync(finalParentDir, { recursive: true });
    }

    const finalDest = path.join(finalParentDir, 'social-network-client-win32-x64');
    if (fs.existsSync(finalDest)) {
        fs.rmSync(finalDest, { recursive: true, force: true });
        console.log('Removed previous build');
    }

    fs.renameSync(distTemp, finalDest);
    console.log('Moved template to final path:', finalDest);
    console.log('\nPackaging successfully completed!');
} catch (error) {
    console.error('Packaging failed:', error);
    process.exit(1);
}
