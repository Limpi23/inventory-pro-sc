import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Declaramos la interfaz IPC para TypeScript
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, listener: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}

const UpdateNotification: React.FC = () => {
  const [, setUpdateStatus] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateDownloaded, setUpdateDownloaded] = useState<boolean>(false);
  
  useEffect(() => {
    // Función para manejar los mensajes de actualización
    const handleUpdateMessage = (_event: any, message: string) => {
      setUpdateStatus(message);
      
      // Verificamos el estado de la actualización
      if (message.includes('Actualización disponible')) {
        setUpdateAvailable(true);
        toast.success(message);
      } else if (message.includes('Error')) {
        toast.error(message);
      } else if (message.includes('descargada')) {
        setUpdateDownloaded(true);
        setUpdateAvailable(true);
        toast.success(message);
      } else if (message.includes('Aplicación actualizada')) {
        setUpdateAvailable(false);
        setUpdateDownloaded(false);
      }
    };
    
    // Registrar el listener para los mensajes de actualización
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('update-message', handleUpdateMessage);
    }
    
    // Limpiar el listener cuando el componente se desmonte
    return () => {
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('update-message', handleUpdateMessage);
      }
    };
  }, []);
  
  // Función para instalar la actualización
  const installUpdate = () => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('install-update');
      toast.success('Instalando actualización...');
    }
  };
  
  // Solo renderizamos el botón si hay una actualización disponible
  return (
    <>
      {updateAvailable && (
        <div className="absolute right-5 bottom-5">
          <button
            onClick={installUpdate}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm flex items-center"
          >
            <i className="fas fa-download mr-2"></i>
            {updateDownloaded ? 'Instalar actualización' : 'Actualización disponible'}
          </button>
        </div>
      )}
    </>
  );
};

export default UpdateNotification; 