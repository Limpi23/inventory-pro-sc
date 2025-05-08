/**
 * Este archivo actúa como un puente entre Electron y React
 * para permitir la comunicación a través de IPC
 */
export const setupElectronBridge = () => {
  // Solo ejecutar si estamos en un entorno Electron (y no en el navegador web)
  if (window.require) {
    try {
      const { ipcRenderer } = window.require('electron');

      // Crear el objeto global para acceder al IPC
      window.electron = {
        ipcRenderer: {
          on: (channel: string, listener: (...args: any[]) => void) => {
            ipcRenderer.on(channel, listener);
          },
          send: (channel: string, ...args: any[]) => {
            ipcRenderer.send(channel, ...args);
          },
          removeListener: (channel: string, listener: (...args: any[]) => void) => {
            ipcRenderer.removeListener(channel, listener);
          }
        }
      };
      
      console.log('Electron bridge configurado correctamente');
    } catch (error) {
      console.error('Error al configurar Electron bridge:', error);
    }
  } else {
    console.log('No se configuró Electron bridge: no estamos en un entorno Electron');
  }
}; 