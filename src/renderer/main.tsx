import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './lib/auth';

// LIMPIEZA TEMPORAL DE LOCALSTORAGE PARA DEPURACIÓN EN ELECTRON
if (window.location.protocol === 'file:') {
  localStorage.clear();
  console.log('LocalStorage limpiado automáticamente en modo Electron.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
); 