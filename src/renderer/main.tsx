import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './lib/auth';

// En producción (protocolo file://) usamos HashRouter para evitar problemas de rutas con file system
const UsingHash = window.location.protocol === 'file:';
const Router: React.FC<{ children: React.ReactNode }> = ({ children }) => UsingHash ? <HashRouter>{children}</HashRouter> : <BrowserRouter>{children}</BrowserRouter>;

if (UsingHash) {
  console.log('[bootstrap] Ejecutando en modo producción file:// usando HashRouter');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
);