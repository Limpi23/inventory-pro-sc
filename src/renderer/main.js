import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.css';
import { AuthProvider } from './lib/auth';
// En producción (protocolo file://) usamos HashRouter para evitar problemas de rutas con file system
const UsingHash = window.location.protocol === 'file:';
const Router = ({ children }) => UsingHash ? _jsx(HashRouter, { children: children }) : _jsx(BrowserRouter, { children: children });
// (debug removed)
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(AuthProvider, { children: _jsx(Router, { children: _jsx(App, {}) }) }) }));
