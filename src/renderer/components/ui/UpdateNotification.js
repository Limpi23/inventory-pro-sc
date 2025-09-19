import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
const UpdateNotification = () => {
    const [, setUpdateStatus] = useState(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    useEffect(() => {
        const handleMessage = (_event, raw) => {
            const message = typeof raw === 'string' ? raw : (raw?.payload || '');
            if (!message) return;
            setUpdateStatus(message);
            if (message.toLowerCase().includes('buscando actualizaciones')) {
                toast('Buscando actualizaciones...');
            } else if (message.includes('Actualización disponible')) {
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
                toast.success('Estás en la última versión');
            }
        };
        // 1) Vía postMessage (preload.js)
        const onWindowPost = (event) => {
            if (event?.data && event.data.type === 'update-message') handleMessage(null, event.data);
        };
        window.addEventListener('message', onWindowPost);
        // 2) Vía ipcRenderer expuesto (preload path index.js)
        const ipcRenderer = window.electron && window.electron.ipcRenderer;
        if (ipcRenderer && typeof ipcRenderer.on === 'function') {
            ipcRenderer.on('update-message', handleMessage);
        }
        // 3) Vía ipc expuesto (preload.cjs con electron.cjs)
        const ipc = window.electron && window.electron.ip;
        if (ipc && typeof ipc.on === 'function') {
            ipc.on('update-message', handleMessage);
        }
        return () => {
            window.removeEventListener('message', onWindowPost);
            if (ipcRenderer && typeof ipcRenderer.on === 'function') {
                try { ipcRenderer.removeListener && ipcRenderer.removeListener('update-message', handleMessage); } catch {}
            }
            if (ipc && typeof ipc.on === 'function') {
                // No expusimos remove en preload.cjs, así que no removemos aquí.
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
    // Solo renderizamos el botón de instalar si hay una actualización disponible
    return (_jsx(_Fragment, { children: updateAvailable && (_jsx("div", { className: "absolute right-5 bottom-5", children: _jsxs("button", { onClick: installUpdate, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm flex items-center", children: [_jsx("i", { className: "fas fa-download mr-2" }), updateDownloaded ? 'Instalar actualización' : 'Actualización disponible'] }) })) }));
};
export default UpdateNotification;
