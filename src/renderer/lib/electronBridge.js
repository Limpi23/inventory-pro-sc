/**
 * Este archivo actúa como un puente seguro entre Electron y React
 * usando el bridge expuesto por preload.js
 */
// Helper para acceder al ipcRenderer expuesto por preload.js
export const electronBridge = {
    on: (channel, listener) => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.on(channel, listener);
        }
        else {
            console.warn('Electron bridge no disponible: ipcRenderer no expuesto');
        }
    },
    send: (channel, ...args) => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.send(channel, ...args);
        }
        else {
            console.warn('Electron bridge no disponible: ipcRenderer no expuesto');
        }
    },
    removeListener: (channel, listener) => {
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.removeListener(channel, listener);
        }
        else {
            console.warn('Electron bridge no disponible: ipcRenderer no expuesto');
        }
    }
};
