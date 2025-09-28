import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
const UpdateNotification = () => {
    const [, setUpdateStatus] = useState(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    useEffect(() => {
        // Función para manejar los mensajes de actualización
        const handleUpdateMessage = (_event, message) => {
            setUpdateStatus(message);
            // Verificamos el estado de la actualización
            if (message.includes('Buscando actualizaciones')) {
                toast(message, { icon: '🔍' });
            }
            else if (message.includes('Actualización disponible')) {
                setUpdateAvailable(true);
                toast.success(message);
            }
            else if (message.includes('Error')) {
                toast.error(message);
            }
            else if (message.includes('descargada')) {
                setUpdateDownloaded(true);
                setUpdateAvailable(true);
                toast.success(message);
            }
            else if (message.includes('Aplicación actualizada') || message.includes('última versión')) {
                setUpdateAvailable(false);
                setUpdateDownloaded(false);
                toast.success(message);
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
    return (_jsx(_Fragment, { children: updateAvailable && (_jsx("div", { className: "absolute right-5 bottom-5", children: _jsxs("button", { onClick: installUpdate, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm flex items-center", children: [_jsx("i", { className: "fas fa-download mr-2" }), updateDownloaded ? 'Instalar actualización' : 'Actualización disponible'] }) })) }));
};
export default UpdateNotification;
