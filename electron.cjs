// Este archivo será renombrado a electron.mjs para soportar ESM.
// Cambiaremos los require por import.
// ... el resto del código se migrará en el siguiente paso ... 

const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const os = require('os');
const { Registry } = require('winreg'); // Para Windows solamente
const fs = require('fs');
const Store = require('electron-store');

let mainWindow;

if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

function loadEnvConfig() {
  const envPath = path.join(app.getAppPath(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('Cargando configuración desde .env');
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = envContent.split('\n');
      envVars.forEach(line => {
        const parts = line.trim().split('=');
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join('=');
          process.env[key] = value;
        }
      });
      console.log('Configuración .env cargada correctamente');
    } catch (error) {
      console.error('Error al cargar el archivo .env:', error);
    }
  } else {
    console.log('No se encontró archivo .env');
  }
}

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Buscando actualizaciones...');
});
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Actualización disponible.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: `Nueva versión ${info.version} disponible. ¿Desea descargarla ahora?`,
    buttons: ['Sí', 'No']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      sendStatusToWindow('Descargando actualización...');
    }
  });
});
autoUpdater.on('update-not-available', () => {
  sendStatusToWindow('Aplicación actualizada.');
});
autoUpdater.on('error', (err) => {
  sendStatusToWindow(`Error en actualización: ${err.toString()}`);
});
autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Velocidad: ${progressObj.bytesPerSecond} - Descargado ${progressObj.percent}%`;
  sendStatusToWindow(logMessage);
});
autoUpdater.on('update-downloaded', () => {
  sendStatusToWindow('Actualización descargada');
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'La actualización se ha descargado y está lista para instalar. ¿Desea reiniciar la aplicación ahora?',
    buttons: ['Reiniciar', 'Más tarde']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'src/assets/app-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'dist/preload.js')
    }
  });
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true
      });
  mainWindow.loadURL(startUrl);
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on('did-finish-load', () => {
    if (process.platform === 'win32') {
      try {
        readWindowsRegistrySettings();
      } catch (error) {
        console.error('Error leyendo configuración del registro:', error);
      }
    }
    sendDatabaseConfigToRenderer();
    sendSupabaseConfigToRenderer();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sendDatabaseConfigToRenderer() {
  if (!mainWindow) return;
  const dbConfig = {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || '',
    port: process.env.DB_PORT || '',
    name: process.env.DB_NAME || '',
    user: process.env.DB_USER || ''
  };
  mainWindow.webContents.send('database-config', dbConfig);
  if (dbConfig.url) {
    mainWindow.webContents.executeJavaScript(`
      try {
        localStorage.setItem('databaseConfig', JSON.stringify(${JSON.stringify(dbConfig)}));
        if ('${process.env.VITE_SUPABASE_URL}') {
          localStorage.setItem('supabaseUrl', '${process.env.VITE_SUPABASE_URL}');
        }
        if ('${process.env.VITE_SUPABASE_ANON_KEY}') {
          localStorage.setItem('supabaseKey', '${process.env.VITE_SUPABASE_ANON_KEY}');
        }
      } catch (e) {
        console.error('Error guardando configuración de base de datos:', e);
      }
    `);
  }
}

function sendSupabaseConfigToRenderer() {
  if (!mainWindow) return;
  mainWindow.webContents.send('supabase-config', {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  });
}

function readWindowsRegistrySettings() {
  if (process.platform !== 'win32') return;
  const regKey = new Registry({
    hive: Registry.HKCU,
    key: '\\Software\\Inventario Pro\\Inventario Pro - SC'
  });
  regKey.get('CompanyName', (err, item) => {
    if (!err) {
      mainWindow.webContents.send('registry-settings', {
        companyName: item.value
      });
      mainWindow.webContents.executeJavaScript(`
        try {
          localStorage.setItem('companySettings', JSON.stringify({
            name: '${item.value}',
            taxId: '',
            address: '',
            phone: '',
            email: '',
            website: '',
            logoUrl: '',
            footerText: '©2025 - Todos los derechos reservados'
          }));
          localStorage.setItem('appConfigured', 'true');
        } catch (e) {
          console.error('Error guardando configuración:', e);
        }
      `);
    }
  });
  regKey.get('IsNewInstallation', (err, item) => {
    if (!err) {
      mainWindow.webContents.send('registry-settings-install-type', {
        isNewInstallation: item.value === '1'
      });
    }
  });
  regKey.get('SetupCompleted', (err, item) => {
    if (!err && item.value === '1') {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('setupCompletedByInstaller', 'true');
      `);
    }
  });
  regKey.get('DbConnectionString', (err, item) => {
    if (!err && item.value) {
      process.env.DATABASE_URL = item.value;
      mainWindow.webContents.executeJavaScript(`
        try {
          localStorage.setItem('dbConnectionString', '${item.value}');
        } catch (e) {
          console.error('Error guardando cadena de conexión:', e);
        }
      `);
    }
  });
}

app.whenReady().then(async () => {
  loadEnvConfig();
  if (process.env.NODE_ENV === 'development') {
    const ses = session.defaultSession;
    await ses.clearCache();
  }
  createWindow();
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }
});
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
ipcMain.on('get-supabase-config', (event) => {
  event.sender.send('supabase-config', {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
ipcMain.on('select-directory', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled) {
    event.reply('directory-selected', result.filePaths[0]);
  }
});
const store = new Store();
ipcMain.handle('save-supabase-config', (event, config) => {
  try {
    store.set('supabase', config);
    return true;
  } catch (e) {
    return { error: e.message || 'Error desconocido al guardar la configuración' };
  }
});
ipcMain.handle('get-supabase-config', () => {
  return store.get('supabase');
}); 