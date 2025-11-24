import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './lib/auth';
import { Toaster } from 'react-hot-toast';
import SplashScreen from './components/SplashScreen';
import Onboarding from './Onboarding';
import SupabaseConfigModal from './components/SupabaseConfigModal';
import SubscriptionGuard from './components/SubscriptionGuard';
// Lazy load pages
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const Products = React.lazy(() => import('./views/Products'));
const Categories = React.lazy(() => import('./views/Categories'));
const Warehouses = React.lazy(() => import('./views/Warehouses'));
const Suppliers = React.lazy(() => import('./views/Suppliers'));
const SupplierDetail = React.lazy(() => import('./views/SupplierDetail'));
const Reports = React.lazy(() => import('./views/Reports'));
const Locations = React.lazy(() => import('./views/Locations'));
// Existentes
const Sales = React.lazy(() => import('./views/Sales'));
const Inventory = React.lazy(() => import('./views/Inventory'));
const InventoryGeneral = React.lazy(() => import('./views/InventoryGeneral'));
const PurchaseOrders = React.lazy(() => import('./views/PurchaseOrders'));
const PurchaseOrderForm = React.lazy(() => import('./views/PurchaseOrderForm'));
const PurchaseOrderDetail = React.lazy(() => import('./views/PurchaseOrderDetail'));
const PurchaseOrderList = React.lazy(() => import('./views/PurchaseOrderList'));
const SupplierPurchases = React.lazy(() => import('./views/SupplierPurchases'));
// Nuevas vistas para el módulo de ventas
const Customers = React.lazy(() => import('./views/Customers'));
const CustomerForm = React.lazy(() => import('./views/CustomerForm'));
const Invoices = React.lazy(() => import('./views/Invoices'));
const InvoiceForm = React.lazy(() => import('./views/InvoiceForm'));
const Returns = React.lazy(() => import('./views/Returns'));
const InvoiceDetail = React.lazy(() => import('./views/InvoiceDetail'));
const ReturnForm = React.lazy(() => import('./views/ReturnForm'));
const ReturnDetail = React.lazy(() => import('./views/ReturnDetail'));
// Gestión de usuarios
const Users = React.lazy(() => import('./views/Users'));
const RolePermissions = React.lazy(() => import('./views/RolePermissions'));
const Login = React.lazy(() => import('./views/Login'));
const ResetPassword = React.lazy(() => import('./views/ResetPassword'));
const Settings = React.lazy(() => import('./views/Settings'));
// Componentes de suscripción
const SubscriptionExpired = React.lazy(() => import('./views/SubscriptionExpired'));
const SubscriptionRenew = React.lazy(() => import('./views/SubscriptionRenew'));
// Inicializar el tema
const initializeTheme = () => {
    // Verificar el tema guardado en localStorage
    const savedTheme = localStorage.getItem('theme');
    // Si hay un tema guardado, usarlo; si no, detectar preferencia del sistema
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    }
    else {
        // Si no hay tema guardado, usar preferencia del sistema
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
    }
};
// Inicializar el tema cuando se carga la app
initializeTheme();
// Loading Fallback
const PageLoader = () => (_jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
// Componente contenedor para Layout
const LayoutWrapper = ({ onOpenConfig }) => {
    return (_jsx(Layout, { onOpenConfig: onOpenConfig, children: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(Outlet, {}) }) }));
};
// Componente para proteger rutas
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return _jsx(PageLoader, {});
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
// Ruta solo para administradores
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return _jsx(PageLoader, {});
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    const roleName = (user.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || user.role_id === 1;
    if (!isAdmin) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
const App = () => {
    const [ready, setReady] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const { user } = useAuth();
    useEffect(() => {
        const win = window;
        const forced = sessionStorage.getItem('forceOnboarding') === '1';
        if (forced) {
            setShowOnboarding(true);
            sessionStorage.removeItem('forceOnboarding');
            return;
        }
        if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
            win.supabaseConfig.get().then((config) => {
                if (config?.url && config?.anonKey) {
                    setReady(true);
                }
                else {
                    setShowOnboarding(true);
                }
            }).catch((e) => {
                setShowOnboarding(true);
            });
        }
        else {
            setReady(true);
        }
    }, []);
    // Escuchar eventos del menú de Electron
    useEffect(() => {
        const win = window;
        // Listener para "Configurar Conexión Supabase"
        const handleShowSupabaseConfig = () => {
            setShowConfigModal(true);
        };
        // Listener personalizado desde Settings
        const handleCustomShowConfig = () => {
            setShowConfigModal(true);
        };
        // Listener para "Ejecutar Migraciones"
        const handleRunMigrations = async () => {
            const { toast } = await import('react-hot-toast');
            const { migrationService } = await import('./lib/migrationService');
            toast.loading('Ejecutando migraciones...', { id: 'migrations' });
            try {
                await migrationService.runMigrations((progress) => {
                    if (progress.status === 'running') {
                        toast.loading(`${progress.currentMigration} (${progress.currentIndex}/${progress.totalMigrations})`, { id: 'migrations' });
                    }
                });
                toast.success('Migraciones completadas exitosamente', { id: 'migrations' });
            }
            catch (error) {
                // Verificar si es el error de bootstrap requerido
                if (error.message?.includes('BOOTSTRAP_REQUIRED')) {
                    toast.error('Se requiere configuración inicial', { id: 'migrations', duration: 5000 });
                    // Extraer el SQL del mensaje de error
                    const sqlMatch = error.message.match(/ejecuta:\n\n([\s\S]+)$/);
                    const bootstrapSQL = sqlMatch ? sqlMatch[1] : '';
                    if (bootstrapSQL) {
                        // Copiar al portapapeles
                        try {
                            await navigator.clipboard.writeText(bootstrapSQL);
                            toast.success('SQL copiado al portapapeles.\nEjecútalo en Supabase SQL Editor:\nhttps://supabase.com/dashboard', { id: 'bootstrap-copied', duration: 10000 });
                        }
                        catch (clipError) {
                            toast.error('Por favor, ejecuta el SQL manualmente en Supabase SQL Editor', { id: 'bootstrap-manual', duration: 8000 });
                        }
                        // Mostrar el SQL en consola para que el usuario pueda copiarlo
                        console.log('==========================================');
                        console.log('EJECUTA ESTE SQL EN SUPABASE SQL EDITOR:');
                        console.log('==========================================');
                        console.log(bootstrapSQL);
                        console.log('==========================================');
                    }
                }
                else {
                    toast.error(`Error: ${error.message}`, { id: 'migrations', duration: 5000 });
                }
            }
        };
        // Listener para "Verificar Estado de BD"
        const handleCheckMigrationStatus = async () => {
            const { migrationService } = await import('./lib/migrationService');
            const { toast } = await import('react-hot-toast');
            toast.loading('Verificando estado...', { id: 'check-db' });
            try {
                const needsSetup = await migrationService.needsInitialSetup();
                if (needsSetup) {
                    toast.error('La base de datos requiere migraciones. Use "Ejecutar Migraciones" del menú.', { id: 'check-db' });
                }
                else {
                    toast.success('La base de datos está actualizada.', { id: 'check-db' });
                }
            }
            catch (error) {
                toast.error(`Error al verificar: ${error.message}`, { id: 'check-db' });
            }
        };
        // Guardar referencias de los listeners
        let showConfigListener;
        let runMigrationsListener;
        let checkStatusListener;
        // Registrar listeners de Electron IPC
        if (win.electron?.ipcRenderer) {
            showConfigListener = win.electron.ipcRenderer.on('show-supabase-config', handleShowSupabaseConfig);
            runMigrationsListener = win.electron.ipcRenderer.on('run-migrations-manual', handleRunMigrations);
            checkStatusListener = win.electron.ipcRenderer.on('check-migration-status', handleCheckMigrationStatus);
        }
        // Registrar listener de evento personalizado
        window.addEventListener('show-supabase-config', handleCustomShowConfig);
        return () => {
            if (win.electron?.ipcRenderer) {
                if (showConfigListener) {
                    win.electron.ipcRenderer.removeListener('show-supabase-config', showConfigListener);
                }
                if (runMigrationsListener) {
                    win.electron.ipcRenderer.removeListener('run-migrations-manual', runMigrationsListener);
                }
                if (checkStatusListener) {
                    win.electron.ipcRenderer.removeListener('check-migration-status', checkStatusListener);
                }
            }
            window.removeEventListener('show-supabase-config', handleCustomShowConfig);
        };
    }, []);
    const handleOpenConfig = () => {
        setShowConfigModal(true);
    };
    const handleConfigFinish = () => {
        setReady(true);
        setShowConfigModal(false);
    };
    const handleOnboardingFinish = () => {
        setReady(true);
        setShowOnboarding(false);
    };
    const handleSplashFinish = () => {
        setShowSplash(false);
    };
    // Mostrar splash screen durante la carga inicial
    if (showSplash) {
        return _jsx(SplashScreen, { onFinish: handleSplashFinish });
    }
    if (!ready && !showOnboarding) {
        return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', fontFamily: 'system-ui' }, children: [_jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4" }), _jsx("div", { style: { opacity: 0.8, fontSize: 16, fontWeight: 500 }, children: "\u2699\uFE0F Iniciando Inventario Pro..." })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(Toaster, { position: "top-right" }), showConfigModal && (_jsx(SupabaseConfigModal, { onFinish: handleConfigFinish, onClose: () => setShowConfigModal(false) })), showOnboarding && (_jsx(Onboarding, { onFinish: handleOnboardingFinish })), _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/reset-password", element: _jsx(ResetPassword, {}) }), _jsx(Route, { path: "/subscription/expired", element: _jsx(ProtectedRoute, { children: _jsx(SubscriptionExpired, {}) }) }), _jsx(Route, { path: "/subscription/renew", element: _jsx(ProtectedRoute, { children: _jsx(SubscriptionRenew, {}) }) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(SubscriptionGuard, { children: _jsx(LayoutWrapper, { onOpenConfig: handleOpenConfig }) }) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "productos", element: _jsx(Products, {}) }), _jsx(Route, { path: "categorias", element: _jsx(Categories, {}) }), _jsx(Route, { path: "almacenes", element: _jsx(Warehouses, {}) }), _jsx(Route, { path: "ubicaciones", element: _jsx(Locations, {}) }), _jsx(Route, { path: "proveedores", element: _jsx(Suppliers, {}) }), _jsx(Route, { path: "proveedores/:id", element: _jsx(SupplierDetail, {}) }), _jsx(Route, { path: "proveedores/:id/compras", element: _jsx(SupplierPurchases, {}) }), _jsx(Route, { path: "inventario", element: _jsx(Inventory, {}) }), _jsx(Route, { path: "inventario/general", element: _jsx(InventoryGeneral, {}) }), _jsx(Route, { path: "reportes", element: _jsx(Reports, {}) }), _jsx(Route, { path: "ordenes-compra", element: _jsx(PurchaseOrders, {}) }), _jsx(Route, { path: "ordenes-compra/lista", element: _jsx(PurchaseOrderList, {}) }), _jsx(Route, { path: "ordenes-compra/nueva", element: _jsx(PurchaseOrderForm, {}) }), _jsx(Route, { path: "ordenes-compra/editar/:id", element: _jsx(PurchaseOrderForm, {}) }), _jsx(Route, { path: "ordenes-compra/:id", element: _jsx(PurchaseOrderDetail, {}) }), _jsx(Route, { path: "ordenes-compra/:id/recibir", element: _jsx(PurchaseOrderDetail, {}) }), _jsx(Route, { path: "ventas", element: _jsx(Sales, {}) }), _jsx(Route, { path: "ventas/clientes", element: _jsx(Customers, {}) }), _jsx(Route, { path: "ventas/clientes/nuevo", element: _jsx(CustomerForm, {}) }), _jsx(Route, { path: "ventas/clientes/editar/:id", element: _jsx(CustomerForm, {}) }), _jsx(Route, { path: "ventas/facturas", element: _jsx(Invoices, {}) }), _jsx(Route, { path: "ventas/facturas/nueva", element: _jsx(InvoiceForm, {}) }), _jsx(Route, { path: "ventas/facturas/editar/:id", element: _jsx(InvoiceForm, {}) }), _jsx(Route, { path: "ventas/facturas/:id", element: _jsx(InvoiceDetail, {}) }), _jsx(Route, { path: "ventas/devoluciones", element: _jsx(Returns, {}) }), _jsx(Route, { path: "ventas/devoluciones/nueva", element: _jsx(ReturnForm, {}) }), _jsx(Route, { path: "ventas/devoluciones/:id", element: _jsx(ReturnDetail, {}) }), _jsx(Route, { path: "usuarios", element: _jsx(AdminRoute, { children: _jsx(Users, {}) }) }), _jsx(Route, { path: "usuarios/permisos", element: _jsx(AdminRoute, { children: _jsx(RolePermissions, {}) }) }), _jsx(Route, { path: "ajustes", element: _jsx(Settings, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }) })] }));
};
export default App;
