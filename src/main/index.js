import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
// Mantener una referencia global del objeto window para evitar que se cierre automáticamente
let mainWindow = null;
// Ruta donde guardarás la configuración de Supabase
const configPath = path.join(app.getPath('userData'), 'supabase-config.json');
function createWindow() {
    // Crear ventana del navegador
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../dist/preload.js')
        }
    });
    // Limpiar todas las cachés
    mainWindow.webContents.session.clearCache();
    mainWindow.webContents.session.clearStorageData({
        storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
    });
    // Cargar la aplicación
    if (process.env.NODE_ENV === 'development') {
        // Desarrollo: Cargar desde el servidor de Vite
        mainWindow.loadURL('http://localhost:3000');
        // Abrir DevTools automáticamente
        mainWindow.webContents.openDevTools();
    }
    else {
        // Producción: Cargar desde los archivos compilados
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    // Emitido cuando la ventana es cerrada
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Evento activado cuando Electron ha finalizado su inicialización
app.whenReady().then(() => {
    createWindow();
    // Configurar actualizaciones automáticas solo en producción
    if (process.env.NODE_ENV !== 'development') {
        // Configurar el proveedor de actualizaciones (GitHub Releases)
        try {
            const FEED_URL = process.env.UPDATE_FEED_URL;
            if (FEED_URL) {
                autoUpdater.setFeedURL({ provider: 'generic', url: FEED_URL });
                console.log('Update feed configurado (GENERIC)');
            }
            else {
                // Por defecto usamos GitHub Releases del repo público
                autoUpdater.setFeedURL({
                    provider: 'github',
                    owner: 'Limpi23',
                    repo: 'inventory-pro-sc'
                });
                console.log('Update feed configurado (GITHUB)');
            }
        }
        catch (e) {
            console.warn('No se pudo configurar el feed de actualizaciones:', e);
        }
        // Configurar eventos del auto-updater
        autoUpdater.on('checking-for-update', () => {
            console.log('Verificando actualizaciones...');
            if (mainWindow) {
                mainWindow.webContents.send('update-checking');
            }
        });
        autoUpdater.on('update-available', (info) => {
            console.log('Actualización disponible:', info);
            if (mainWindow) {
                mainWindow.webContents.send('update-available', info);
            }
        });
        autoUpdater.on('update-not-available', (info) => {
            console.log('No hay actualizaciones disponibles:', info);
            if (mainWindow) {
                mainWindow.webContents.send('update-not-available', info);
            }
        });
        autoUpdater.on('error', (err) => {
            console.error('Error en actualización:', err);
            if (mainWindow) {
                mainWindow.webContents.send('update-error', err);
            }
        });
        autoUpdater.on('download-progress', (progressObj) => {
            console.log(`Descargando: ${progressObj.percent}%`);
            if (mainWindow) {
                mainWindow.webContents.send('update-download-progress', progressObj);
            }
        });
        autoUpdater.on('update-downloaded', (info) => {
            console.log('Actualización descargada:', info);
            if (mainWindow) {
                mainWindow.webContents.send('update-downloaded', info);
            }
        });
        // Verificar actualizaciones después de 3 segundos
        setTimeout(() => {
            autoUpdater.checkForUpdates();
        }, 3000);
    }
    app.on('activate', () => {
        // En macOS es común recrear una ventana cuando
        // se hace clic en el icono del dock y no hay ventanas abiertas
        if (mainWindow === null)
            createWindow();
    });
});
// Permitir que el renderer solicite la instalación de la actualización
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});
// Permitir que el renderer solicite verificar actualizaciones manualmente
ipcMain.on('check-for-updates', () => {
    if (process.env.NODE_ENV !== 'development') {
        console.log('Verificación manual de actualizaciones solicitada');
        autoUpdater.checkForUpdates();
    }
    else {
        console.log('Actualizaciones deshabilitadas en desarrollo');
        if (mainWindow) {
            mainWindow.webContents.send('update-error', {
                message: 'Las actualizaciones están deshabilitadas en modo desarrollo'
            });
        }
    }
});
// Salir cuando todas las ventanas estén cerradas, excepto en macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
// Configurar los manejadores de IPC para comunicación entre procesos
// Ejemplos de funciones que se implementarán para el inventario
ipcMain.handle('get-products', async () => {
    // Aquí irá la lógica para obtener productos de la base de datos
    return [];
});
ipcMain.handle('add-product', async (_event) => {
    // Aquí irá la lógica para agregar un producto a la base de datos
    return { success: true, id: Date.now() };
});
ipcMain.handle('update-product', async (_event) => {
    // Aquí irá la lógica para actualizar un producto
    return { success: true };
});
ipcMain.handle('delete-product', async (_event) => {
    // Aquí irá la lógica para eliminar un producto
    return { success: true };
});
// Funciones para entradas y salidas de inventario
ipcMain.handle('register-inventory-in', async (_event) => {
    // Registrar entrada de inventario
    return { success: true, id: Date.now() };
});
ipcMain.handle('register-inventory-out', async (_event) => {
    // Registrar salida de inventario
    return { success: true, id: Date.now() };
});
// Notas de venta
ipcMain.handle('create-sale-note', async (_event) => {
    // Crear nota de venta
    return { success: true, id: Date.now() };
});
ipcMain.handle('get-sale-notes', async () => {
    // Obtener notas de venta
    return [];
});
// Handler para guardar la configuración
ipcMain.handle('save-supabase-config', async (_event, config) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Handler para obtener la configuración
ipcMain.handle('get-supabase-config', async () => {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
        return {};
    }
    catch (error) {
        return {};
    }
});
