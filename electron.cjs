const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const os = require('os');
const { Registry } = require('winreg'); // Para Windows solamente
const fs = require('fs');

// Mantener referencia global al objeto window
let mainWindow;

// Suprime las advertencias de seguridad en desarrollo
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// Cargar configuraciones desde .env si existe
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

// Configuración de actualizaciones automáticas
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Eventos de actualización
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

// Envía mensajes a la ventana principal
function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

// Función para crear la ventana principal
function createWindow() {
  // Configuración de la ventana principal
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

  // Determinar la URL a cargar según el modo
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true
      });

  // Cargar la aplicación
  mainWindow.loadURL(startUrl);

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Leer información de configuración del registro (Windows) después de que la ventana esté lista
  mainWindow.webContents.on('did-finish-load', () => {
    // En Windows, obtener los datos del registro si existen
    if (process.platform === 'win32') {
      try {
        readWindowsRegistrySettings();
      } catch (error) {
        console.error('Error leyendo configuración del registro:', error);
      }
    }
    
    // Enviar la configuración de la base de datos desde el archivo .env
    sendDatabaseConfigToRenderer();
  });

  // Evento de cierre
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Función para enviar la configuración de la base de datos al renderizador
function sendDatabaseConfigToRenderer() {
  if (!mainWindow) return;
  
  const dbConfig = {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || '',
    port: process.env.DB_PORT || '',
    name: process.env.DB_NAME || '',
    user: process.env.DB_USER || ''
  };
  
  // Enviamos la configuración sin la contraseña
  mainWindow.webContents.send('database-config', dbConfig);
  
  // También guardamos en localStorage para que la aplicación pueda acceder
  if (dbConfig.url) {
    mainWindow.webContents.executeJavaScript(`
      try {
        localStorage.setItem('databaseConfig', JSON.stringify(${JSON.stringify(dbConfig)}));
        // Si estamos usando Supabase, configuramos sus variables
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

// Función para leer configuración del registro de Windows
function readWindowsRegistrySettings() {
  if (process.platform !== 'win32') return;
  
  // Definir la clave del registro donde se guarda la información
  const regKey = new Registry({
    hive: Registry.HKCU,
    key: '\\Software\\Inventario Pro\\Inventario Pro - SC'
  });
  
  // Leer el nombre de la empresa
  regKey.get('CompanyName', (err, item) => {
    if (!err) {
      // Enviar al proceso de renderizado si se encuentra
      mainWindow.webContents.send('registry-settings', {
        companyName: item.value
      });
      
      // También guardar en localStorage si la aplicación lo soporta
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
          // Marcar como configurado para que no muestre el asistente
          localStorage.setItem('appConfigured', 'true');
        } catch (e) {
          console.error('Error guardando configuración:', e);
        }
      `);
    }
  });
  
  // Verificar si es una instalación nueva o conexión a existente
  regKey.get('IsNewInstallation', (err, item) => {
    if (!err) {
      mainWindow.webContents.send('registry-settings-install-type', {
        isNewInstallation: item.value === '1'
      });
    }
  });
  
  // Verificar si el setup fue completado durante la instalación
  regKey.get('SetupCompleted', (err, item) => {
    if (!err && item.value === '1') {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('setupCompletedByInstaller', 'true');
      `);
    }
  });
  
  // Leer la cadena de conexión a la base de datos si existe
  regKey.get('DbConnectionString', (err, item) => {
    if (!err && item.value) {
      process.env.DATABASE_URL = item.value;
      
      // Enviamos la cadena de conexión al renderizador
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

// Este método será llamado cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(async () => {
  // Cargar configuración del archivo .env
  loadEnvConfig();
  
  // Elimina la caché antes de iniciar
  if (process.env.NODE_ENV === 'development') {
    const ses = session.defaultSession;
    await ses.clearCache();
  }
  createWindow();
  
  // Verificar actualizaciones después de iniciar
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000); // Esperar 3 segundos antes de buscar actualizaciones
  }
});

// Escuchar solicitudes de verificación manual de actualizaciones
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

// Escuchar solicitudes para instalar actualizaciones
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS
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

// Manejador de IPC para acciones entre renderizado y principal
ipcMain.on('select-directory', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    event.reply('directory-selected', result.filePaths[0]);
  }
}); 