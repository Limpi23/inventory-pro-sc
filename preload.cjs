// CommonJS preload to evitar error "Cannot use import statement outside a module" en paquete ASAR
// Expone sólo lo necesario. Si agregas más APIs, hazlo aquí en CJS.
const { contextBridge, ipcRenderer } = require('electron');

// Bridge IPC limitado
contextBridge.exposeInMainWorld('electron', {
  ipc: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener)
  }
});

// Versión de la app
contextBridge.exposeInMainWorld('appVersion', {
  get: () => ipcRenderer.invoke('app-version')
});

// Configuración Supabase persistida vía electron-store (manejada en electron.cjs)
contextBridge.exposeInMainWorld('supabaseConfig', {
  save: (config) => ipcRenderer.invoke('save-supabase-config', config),
  get: () => ipcRenderer.invoke('get-supabase-config')
});

// Mensajes de actualización / estado
ipcRenderer.on('update-message', (_e, msg) => {
  console.log('[update]', msg);
});

// Diagnóstico para verificar carga correcta
console.log('[preload.cjs] cargado correctamente');
