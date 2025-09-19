import { contextBridge, ipcRenderer } from 'electron';
// Expone funcionalidades específicas de Electron al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
    // Productos
    getProducts: () => ipcRenderer.invoke('get-products'),
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    updateProduct: (product) => ipcRenderer.invoke('update-product', product),
    deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
    // Entradas y salidas de inventario
    registerInventoryIn: (data) => ipcRenderer.invoke('register-inventory-in', data),
    registerInventoryOut: (data) => ipcRenderer.invoke('register-inventory-out', data),
    // Notas de venta
    createSaleNote: (saleData) => ipcRenderer.invoke('create-sale-note', saleData),
    getSaleNotes: () => ipcRenderer.invoke('get-sale-notes'),
});
// Exponer APIs protegidas a través del puente contextual
contextBridge.exposeInMainWorld('electron', {
    // Comunicación IPC
    ipcRenderer: {
        on: (channel, listener) => {
            ipcRenderer.on(channel, listener);
        },
        send: (channel, ...args) => {
            ipcRenderer.send(channel, ...args);
        },
        removeListener: (channel, listener) => {
            ipcRenderer.removeListener(channel, listener);
        }
    },
    // Información del sistema
    system: {
        // Obtener plataforma (win32, darwin, linux)
        platform: process.platform
    }
});
// Reenviar eventos de actualización hacia el renderer (mismo proceso) usando canales directos
ipcRenderer.on('update-available', () => {
    window.postMessage({ type: 'update-message', payload: 'Actualización disponible. Se está descargando la nueva versión...' }, '*');
});
ipcRenderer.on('checking-for-update', () => {
    window.postMessage({ type: 'update-message', payload: 'Buscando actualizaciones...' }, '*');
});
ipcRenderer.on('update-not-available', () => {
    window.postMessage({ type: 'update-message', payload: 'Aplicación actualizada' }, '*');
});
ipcRenderer.on('update-downloaded', () => {
    window.postMessage({ type: 'update-message', payload: 'Actualización descargada. Reinicia para instalar.' }, '*');
});
ipcRenderer.on('update-error', (_e, msg) => {
    window.postMessage({ type: 'update-message', payload: `Error de actualización: ${msg}` }, '*');
});

// Exponer una función para solicitar búsqueda manual de actualización
contextBridge.exposeInMainWorld('appUpdater', {
    checkForUpdates: () => ipcRenderer.send('check-for-updates')
});
contextBridge.exposeInMainWorld('supabaseConfig', {
    save: (config) => ipcRenderer.invoke('save-supabase-config', config),
    get: () => ipcRenderer.invoke('get-supabase-config')
});
