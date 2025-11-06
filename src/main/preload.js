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
    // Migraciones
    readMigrationFile: (migrationName) => ipcRenderer.invoke('read-migration-file', migrationName),
});
// Exponer APIs protegidas a través del puente contextual
contextBridge.exposeInMainWorld('electron', {
    // Comunicación IPC
    ipcRenderer: {
        on: (channel, listener) => {
            console.log('[Preload] Registrando listener para canal:', channel);
            // Wrapper para que funcione correctamente con contextBridge
            const subscription = (_event, ...args) => listener(...args);
            ipcRenderer.on(channel, subscription);
            return subscription;
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
// Reenviar eventos de actualización como mensajes legibles
ipcRenderer.on('update-available', () => {
    ipcRenderer.sendToHost('update-message', 'Actualización disponible. Se está descargando la nueva versión...');
});
ipcRenderer.on('update-downloaded', () => {
    ipcRenderer.sendToHost('update-message', 'Actualización descargada. Reinicia para instalar.');
});
contextBridge.exposeInMainWorld('supabaseConfig', {
    save: (config) => ipcRenderer.invoke('save-supabase-config', config),
    get: () => ipcRenderer.invoke('get-supabase-config')
});
