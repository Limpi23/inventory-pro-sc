import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { setupElectronBridge } from './lib/electronBridge';

// Configurar el puente Electron
setupElectronBridge();

// LIMPIEZA TEMPORAL DE LOCALSTORAGE PARA DEPURACIÓN EN ELECTRON
if (window.location.protocol === 'file:') {
  localStorage.clear();
  console.log('LocalStorage limpiado automáticamente en modo Electron.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 