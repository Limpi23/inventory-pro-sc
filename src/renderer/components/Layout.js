import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { useAuth } from '../lib/auth';
import DatabaseStatus from './ui/DatabaseStatus';
import UpdateNotification from './ui/UpdateNotification';
import SubscriptionHelpButton from './SubscriptionHelpButton';
import SubscriptionInfo from './SubscriptionInfo';
// Función cn simple para manejar la combinación de clases
const cn = (...classes) => {
    return classes.filter(Boolean).join(' ');
};
const Layout = ({ children, onOpenConfig }) => {
    const location = useLocation();
    const { user, signOut, hasPermission } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState({
        inventario: false,
        usuarios: location.pathname.startsWith('/usuarios')
    });
    const navigationItems = [
        { name: 'Dashboard', path: '/', icon: 'fas fa-tachometer-alt' },
        {
            name: 'Productos',
            path: '/productos',
            icon: 'fas fa-box',
            requiredPermission: { resource: 'productos', action: 'read' }
        },
        {
            name: 'Categorías',
            path: '/categorias',
            icon: 'fas fa-tags',
            requiredPermission: { resource: 'categorias', action: 'read' }
        },
        {
            name: 'Almacenes',
            path: '/almacenes',
            icon: 'fas fa-store',
            requiredPermission: { resource: 'almacenes', action: 'read' }
        },
        {
            name: 'Proveedores',
            path: '/proveedores',
            icon: 'fas fa-truck',
            requiredPermission: { resource: 'proveedores', action: 'read' }
        },
        {
            name: 'Órdenes de Compra',
            path: '/ordenes-compra',
            icon: 'fas fa-shopping-basket',
            requiredPermission: { resource: 'ordenes-compra', action: 'read' }
        },
        {
            name: 'Inventario',
            path: '/inventario',
            icon: 'fas fa-warehouse',
            requiredPermission: { resource: 'inventario', action: 'read' },
            children: [
                { name: 'Control de Inventario', path: '/inventario' },
                { name: 'Inventario General', path: '/inventario/general' }
            ]
        },
        {
            name: 'Ventas',
            path: '/ventas',
            icon: 'fas fa-shopping-cart',
            requiredPermission: { resource: 'ventas', action: 'read' }
        },
        {
            name: 'Reportes',
            path: '/reportes',
            icon: 'fas fa-chart-bar',
            requiredPermission: { resource: 'reportes', action: 'read' }
        },
        {
            name: 'Usuarios',
            path: '/usuarios',
            icon: 'fas fa-users',
            requiredPermission: { resource: 'users', action: 'read' },
            children: [
                { name: 'Lista de Usuarios', path: '/usuarios' },
                { name: 'Gestión de Permisos', path: '/usuarios/permisos' }
            ]
        },
        {
            name: 'Ajustes',
            path: '/ajustes',
            icon: 'fas fa-cog'
        },
    ];
    const toggleExpand = (itemName) => {
        setExpandedItems(prev => ({
            ...prev,
            [itemName.toLowerCase()]: !prev[itemName.toLowerCase()]
        }));
    };
    // Filtrar elementos de navegación según permisos
    const filteredNavigationItems = navigationItems.filter(item => {
        if (!item.requiredPermission)
            return true;
        return hasPermission(item.requiredPermission.resource, item.requiredPermission.action);
    });
    const handleLogout = async () => {
        try {
            await signOut();
            // Al cerrar sesión, la redirección se manejará en el AuthProvider
        }
        catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };
    const [appVersion, setAppVersion] = useState('');
    useEffect(() => {
        const w = window;
        w.appVersion?.get?.().then((v) => setAppVersion(v)).catch(() => { });
    }, []);
    return (_jsxs("div", { className: "flex h-screen bg-background", children: [_jsxs("div", { className: cn("bg-card border-r transition-all duration-300 hidden lg:block", sidebarOpen ? 'w-64' : 'w-20'), children: [_jsxs("div", { className: "p-4 flex items-center justify-between border-b", children: [sidebarOpen ? (_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-xl font-bold text-primary", children: "Inventario Pro - SC" }) })) : (_jsx("h1", { className: "text-xl font-bold text-primary", children: "IP" })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setSidebarOpen(!sidebarOpen), children: _jsx("i", { className: `fas ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}` }) })] }), _jsx("nav", { className: "mt-6", children: _jsx("ul", { className: "space-y-1", children: filteredNavigationItems.map((item) => (_jsx(React.Fragment, { children: _jsx("li", { children: item.children ? (_jsxs("div", { children: [_jsxs("button", { onClick: () => toggleExpand(item.name), "aria-expanded": expandedItems[item.name.toLowerCase()], className: cn("flex items-center w-full py-3 px-4 transition-colors rounded-md", (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted"), children: [_jsx("i", { className: `${item.icon} w-5` }), sidebarOpen && (_jsxs(_Fragment, { children: [_jsx("span", { className: "ml-3 flex-1 text-left", children: item.name }), _jsx("i", { className: `fas fa-chevron-${expandedItems[item.name.toLowerCase()] ? 'down' : 'right'} ml-auto transition-transform text-gray-500 dark:text-gray-300` })] }))] }), expandedItems[item.name.toLowerCase()] && sidebarOpen && (_jsxs("div", { className: "relative ml-12 pl-5 mt-2", children: [_jsx("div", { className: "absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700" }), _jsx("ul", { className: "mt-1 space-y-1", children: item.children.map((child) => (_jsxs("li", { className: "relative", children: [location.pathname === child.path && (_jsx("span", { className: "absolute -left-[1px] top-1/2 -translate-y-1/2 h-6 w-[2px] bg-primary" })), _jsx(Link, { to: child.path, className: cn("flex items-center py-2 px-3 text-sm transition-colors rounded-md", location.pathname === child.path
                                                                        ? "text-primary font-medium"
                                                                        : "text-muted-foreground hover:bg-muted"), children: child.name })] }, child.path))) })] }))] })) : (_jsxs(Link, { to: item.path, className: cn("flex items-center py-3 px-4 transition-colors", location.pathname === item.path
                                            ? "bg-primary/10 text-primary border-r-4 border-primary"
                                            : "text-muted-foreground hover:bg-muted"), children: [_jsx("i", { className: `${item.icon} w-5` }), sidebarOpen && _jsx("span", { className: "ml-3", children: item.name })] })) }) }, item.path))) }) })] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("header", { className: "bg-card border-b z-10", children: [_jsxs("div", { className: "flex items-center justify-between p-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs(Sheet, { open: mobileOpen, onOpenChange: setMobileOpen, children: [_jsx(SheetTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "lg:hidden text-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", "aria-label": "Abrir men\u00FA", children: _jsx("i", { className: "fas fa-bars text-2xl" }) }) }), _jsxs(SheetContent, { side: "left", className: "p-0 w-72", children: [_jsx("div", { className: "p-4 border-b flex items-center justify-between", children: _jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-xl font-bold text-primary", children: "Inventario Pro - SC" }) }) }), _jsx("nav", { className: "mt-4", children: _jsx("ul", { className: "space-y-1 px-2", children: filteredNavigationItems.map((item) => (_jsx(React.Fragment, { children: _jsx("li", { children: item.children ? (_jsxs("div", { children: [_jsxs("button", { onClick: () => toggleExpand(item.name), "aria-expanded": expandedItems[item.name.toLowerCase()], className: cn("flex items-center w-full py-3 px-4 rounded-md transition-colors", (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                                                                                            ? "bg-primary/10 text-primary"
                                                                                            : "text-muted-foreground hover:bg-muted"), children: [_jsx("i", { className: `${item.icon} w-5` }), _jsx("span", { className: "ml-3 flex-1 text-left", children: item.name }), _jsx("i", { className: `fas fa-chevron-${expandedItems[item.name.toLowerCase()] ? 'down' : 'right'} ml-auto transition-transform text-gray-500 dark:text-gray-300` })] }), expandedItems[item.name.toLowerCase()] && (_jsxs("div", { className: "relative ml-12 pl-5 mt-2", children: [_jsx("div", { className: "absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700" }), _jsx("ul", { className: "mt-1 space-y-1", children: item.children.map((child) => (_jsxs("li", { className: "relative", children: [location.pathname === child.path && (_jsx("span", { className: "absolute -left-[1px] top-1/2 -translate-y-1/2 h-6 w-[2px] bg-primary" })), _jsx(Link, { to: child.path, className: cn("flex items-center py-2 px-3 text-sm rounded-md transition-colors", location.pathname === child.path
                                                                                                                ? "text-primary font-medium"
                                                                                                                : "text-muted-foreground hover:bg-muted"), onClick: () => setMobileOpen(false), children: child.name })] }, child.path))) })] }))] })) : (_jsxs(Link, { to: item.path, className: cn("flex items-center py-3 px-4 rounded-md transition-colors", location.pathname === item.path
                                                                                    ? "bg-primary/10 text-primary"
                                                                                    : "text-muted-foreground hover:bg-muted"), onClick: () => setMobileOpen(false), children: [_jsx("i", { className: `${item.icon} w-5` }), _jsx("span", { className: "ml-3", children: item.name })] })) }) }, item.path))) }) })] })] }), _jsx("h1", { className: "text-xl font-semibold hidden sm:block", children: navigationItems.find(item => item.path === location.pathname)?.name || 'Dashboard' })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(SubscriptionHelpButton, {}), appVersion && (_jsxs("span", { className: "text-xs px-2 py-1 rounded bg-muted text-muted-foreground select-none", title: "Versi\u00F3n de la aplicaci\u00F3n", children: ["v", appVersion] })), _jsx(DatabaseStatus, {}), _jsx(UpdateNotification, {}), _jsx("button", { className: "rounded-full w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors", title: "Configurar conexi\u00F3n", onClick: onOpenConfig, style: { marginRight: 8 }, children: _jsx("i", { className: "fas fa-cog text-xl text-gray-500" }) }), _jsx("div", { className: "relative", children: _jsxs(Button, { variant: "outline", className: "rounded-full w-10 h-10 p-0 sm:w-auto sm:h-auto sm:p-2 sm:pl-3 sm:pr-3", onClick: handleLogout, children: [_jsx("i", { className: "fas fa-sign-out-alt sm:mr-2" }), _jsx("span", { className: "hidden sm:inline", children: user?.full_name || 'Usuario' })] }) })] })] }), _jsx(SubscriptionInfo, {})] }), _jsx("main", { className: "flex-1 overflow-auto p-4 sm:p-6", children: children })] })] }));
};
export default Layout;
