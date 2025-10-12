// Este archivo será renombrado a electron.mjs para soportar ESM.
// Cambiaremos los require por import.
// ... el resto del código se migrará en el siguiente paso ... 

const { app, BrowserWindow, session, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const os = require('os');
// El paquete 'winreg' exporta la clase por defecto, no como named export
const Registry = require('winreg'); // Para Windows solamente
const fs = require('fs');
const Store = require('electron-store');

let mainWindow;
let manualUpdateRequested = false;
let progressWindow = null;

// Función para crear ventana de progreso de descarga
function createProgressWindow() {
  progressWindow = new BrowserWindow({
    width: 500,
    height: 200,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // HTML inline para la ventana de progreso
  const progressHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          color: white;
        }
        .container {
          text-align: center;
          padding: 30px;
          width: 100%;
        }
        h2 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
          color: white;
        }
        .progress-container {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          height: 40px;
          margin: 20px 0;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
          width: 0%;
          transition: width 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .status {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          margin-top: 10px;
        }
        .speed {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📥 Descargando Actualización</h2>
        <div class="progress-container">
          <div class="progress-bar" id="progressBar">0%</div>
        </div>
        <div class="status" id="status">Iniciando descarga...</div>
        <div class="speed" id="speed"></div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('download-progress', (event, data) => {
          const progressBar = document.getElementById('progressBar');
          const status = document.getElementById('status');
          const speed = document.getElementById('speed');
          
          const percent = Math.round(data.percent);
          progressBar.style.width = percent + '%';
          progressBar.textContent = percent + '%';
          
          const downloaded = (data.transferred / 1024 / 1024).toFixed(2);
          const total = (data.total / 1024 / 1024).toFixed(2);
          const speedMB = (data.bytesPerSecond / 1024 / 1024).toFixed(2);
          
          status.textContent = \`Descargado \${downloaded} MB de \${total} MB\`;
          speed.textContent = \`Velocidad: \${speedMB} MB/s\`;
        });
      </script>
    </body>
    </html>
  `;

  progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(progressHTML));
  
  progressWindow.on('closed', () => {
    progressWindow = null;
  });
}

// Función para cerrar ventana de progreso
function closeProgressWindow() {
  if (progressWindow) {
    progressWindow.close();
    progressWindow = null;
  }
}

// Mitigar crashes del proceso GPU en algunos drivers de Windows
try { app.disableHardwareAcceleration(); } catch (_) {}

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
  manualUpdateRequested = false;
  sendStatusToWindow('Actualización disponible.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: `Nueva versión ${info.version} disponible. ¿Desea descargarla ahora?`,
    buttons: ['Sí', 'No']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      // Crear ventana de progreso
      createProgressWindow();
      sendStatusToWindow('Descargando actualización...');
      // Iniciar la descarga de la actualización
      autoUpdater.downloadUpdate().catch(err => {
        closeProgressWindow();
        const errorMsg = `Error al descargar actualización: ${err.toString()}`;
        sendStatusToWindow(errorMsg);
        dialog.showErrorBox('Error de descarga', errorMsg);
      });
    } else {
      sendStatusToWindow('Descarga de actualización cancelada por el usuario.');
    }
  });
});
autoUpdater.on('update-not-available', () => {
  const currentVersion = app.getVersion();
  const message = `Ya estás utilizando la última versión (${currentVersion}).`;
  sendStatusToWindow(message);
  if (manualUpdateRequested) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Sin actualizaciones disponibles',
      message,
      detail: 'No se encontraron nuevas versiones en este momento.'
    });
    manualUpdateRequested = false;
  }
});
autoUpdater.on('error', (err) => {
  // Cerrar ventana de progreso si está abierta
  closeProgressWindow();
  
  // Limpiar barra de progreso en taskbar
  if (mainWindow && process.platform === 'win32') {
    mainWindow.setProgressBar(-1);
  }
  
  const errorMessage = `Error en actualización: ${err.toString()}`;
  sendStatusToWindow(errorMessage);
  if (manualUpdateRequested) {
    dialog.showErrorBox('Error al buscar actualizaciones', errorMessage);
    manualUpdateRequested = false;
  }
});
autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Velocidad: ${progressObj.bytesPerSecond} - Descargado ${progressObj.percent}%`;
  sendStatusToWindow(logMessage);
  
  // Enviar progreso a la ventana de progreso
  if (progressWindow) {
    progressWindow.webContents.send('download-progress', progressObj);
  }
  
  // Actualizar barra de progreso en la taskbar (Windows)
  if (mainWindow && process.platform === 'win32') {
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});
autoUpdater.on('update-downloaded', () => {
  // Cerrar ventana de progreso
  closeProgressWindow();
  
  // Limpiar barra de progreso en taskbar
  if (mainWindow && process.platform === 'win32') {
    mainWindow.setProgressBar(-1);
  }
  
  sendStatusToWindow('Actualización descargada');
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'La actualización se ha descargado y está lista para instalar. ¿Desea reiniciar la aplicación ahora?',
    buttons: ['Reiniciar', 'Más tarde']
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      // isSilent: false - mostrar instalador
      // isForceRunAfter: true - FORZAR que reabra la app después de instalar
      autoUpdater.quitAndInstall(false, true);
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
  // Usamos preload.cjs en raíz para garantizar CommonJS dentro de ASAR
  preload: path.join(__dirname, 'preload.cjs')
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

  // Configurar menú de la aplicación (solo una vez)
  setupApplicationMenu();
}

// IPC: Logging de eventos a archivo JSONL en userData/logs
ipcMain.handle('log-event', (_event, payload) => {
  try {
    const logDir = require('path').join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = require('path').join(logDir, 'events.jsonl');
    const entry = {
      ts: new Date().toISOString(),
      appVersion: app.getVersion(),
      ...payload
    };
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
    return true;
  } catch (e) {
    console.error('Error escribiendo log de evento:', e);
    return { error: e && e.message ? e.message : String(e) };
  }
});

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
  // Configurar feed de actualizaciones para Squirrel.Windows
  try {
    // Solo configurar actualizaciones en Windows (plataforma objetivo)
    if (process.platform === 'win32') {
      const CUSTOM_FEED_URL = process.env.UPDATE_FEED_URL;
      
      if (CUSTOM_FEED_URL) {
        // Opción: URL personalizada
        autoUpdater.setFeedURL({ provider: 'generic', url: CUSTOM_FEED_URL });
        sendStatusToWindow('Update feed configurado (CUSTOM)');
        console.log('✓ Usando feed de actualizaciones personalizado');
      } else {
        // Para Squirrel.Windows con GitHub Releases
        const owner = 'Limpi23';
        const repo = 'inventory-pro-sc';
        const updateUrl = `https://github.com/${owner}/${repo}/releases/latest/download`;
        
        // IMPORTANTE: No usar setFeedURL con Squirrel.Windows en producción
        // Dejar que autoUpdater use su configuración por defecto desde app-update.yml
        // que será generado por electron-builder/forge
        
        // Solo configurar en desarrollo para testing
        if (process.env.NODE_ENV === 'development') {
          autoUpdater.setFeedURL({ 
            provider: 'generic',
            url: updateUrl
          });
          console.log('⚠️ Modo desarrollo: Feed URL configurado manualmente');
        }
        
        sendStatusToWindow('Update feed listo para producción');
        console.log('✓ Auto-updater configurado para Squirrel.Windows');
        console.log(`   URL: ${updateUrl}`);
      }
      
    } else {
      console.log('Auto-updater solo está configurado para Windows');
    }
  } catch (e) {
    console.warn('No se pudo configurar el feed de actualizaciones:', e);
  }
  // Solo buscar actualizaciones automáticamente en Windows y en producción
  if (process.env.NODE_ENV !== 'development' && process.platform === 'win32') {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }
});
ipcMain.on('check-for-updates', () => {
  // Solo permitir búsqueda manual de actualizaciones en Windows
  if (process.platform !== 'win32') {
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Actualizaciones no disponibles',
        message: 'Las actualizaciones automáticas solo están disponibles en Windows.',
      });
    }
    return;
  }
  manualUpdateRequested = true;
  autoUpdater.checkForUpdates();
});
ipcMain.on('install-update', () => {
  // isSilent: false - mostrar instalador
  // isForceRunAfter: true - FORZAR que reabra la app después de instalar
  autoUpdater.quitAndInstall(false, true);
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

async function testSupabaseConnection(showDialogs = true) {
  const started = Date.now();
  try {
    const saved = store.get('supabase') || {};
    const url = (saved && saved.url) || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = (saved && saved.anonKey) || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      if (showDialogs) dialog.showErrorBox('Supabase', 'No hay configuración (URL / anonKey) definida.');
      return { success: false, message: 'Sin configuración' };
    }
    const healthUrl = url.replace(/\/$/, '') + '/auth/v1/health';
    const res = await fetch(healthUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    const ms = Date.now() - started;
    if (res.ok) {
      const msg = `Conexión OK (${res.status}) en ${ms}ms`;
      if (showDialogs) dialog.showMessageBox({ type: 'info', title: 'Supabase', message: msg, detail: url });
      return { success: true, message: msg, url };
    }
    const text = await res.text();
    const errMsg = `Fallo (${res.status}) ${text.slice(0,120)}`;
    if (showDialogs) dialog.showErrorBox('Supabase', errMsg);
    return { success: false, message: errMsg, url };
  } catch (e) {
    const errMsg = 'Error: ' + (e && e.message ? e.message : e);
    if (showDialogs) dialog.showErrorBox('Supabase', errMsg);
    return { success: false, message: errMsg };
  }
}

function setupApplicationMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Herramientas',
      submenu: [
        {
          label: 'Probar conexión Supabase',
          click: () => { testSupabaseConnection(true); }
        },
        {
          label: 'Abrir carpeta de logs',
          click: () => {
            try {
              const logDir = require('path').join(app.getPath('userData'), 'logs');
              // Abre la carpeta de logs (crea si no existe para que abra algo)
              if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
              shell.openPath(logDir);
            } catch (e) {
              console.warn('No se pudo abrir carpeta de logs', e);
            }
          }
        },
        {
          label: 'Buscar actualizaciones',
          enabled: process.platform === 'win32',
          click: async () => {
            try {
              manualUpdateRequested = true;
              sendStatusToWindow('Buscando actualizaciones (manual)...');
              await autoUpdater.checkForUpdates();
            } catch (e) {
              const errMsg = 'Error al buscar actualizaciones: ' + (e && e.message ? e.message : e);
              sendStatusToWindow(errMsg);
              if (manualUpdateRequested) {
                dialog.showErrorBox('Error al buscar actualizaciones', errMsg);
                manualUpdateRequested = false;
              }
            }
          }
        },
        {
          label: 'Mostrar Onboarding',
          click: () => {
            try {
              const Store = require('electron-store');
              const s = new Store();
              s.set('supabase', { url: '', anonKey: '' }); // limpiar
            } catch (e) {
              console.warn('No se pudo limpiar supabase store', e);
            }
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript("sessionStorage.setItem('forceOnboarding','1'); location.reload();");
            }
          }
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar Ventana' },
        { role: 'toggledevtools', label: 'Toggle DevTools' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'Inventario Pro - SC',
            message: 'Inventario Pro - SC',
            detail: `Versión ${app.getVersion()}\n©2025`
          })
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
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
ipcMain.handle('test-supabase-connection', () => testSupabaseConnection(false));
// Versión de la aplicación para mostrar en el renderer
ipcMain.handle('app-version', () => app.getVersion());