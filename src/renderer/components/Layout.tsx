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
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface LayoutProps {
  children: React.ReactNode;
  onOpenConfig?: () => void;
}

interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  children?: { name: string; path: string }[];
  isExpanded?: boolean;
  requiredPermission?: { resource: string; action: string };
}

const Layout: React.FC<LayoutProps> = ({ children, onOpenConfig }) => {
  const location = useLocation();
  const { user, signOut, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    inventario: false,
    usuarios: location.pathname.startsWith('/usuarios')
  });

  const navigationItems: NavigationItem[] = [
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
      name: 'Ubicaciones', 
      path: '/ubicaciones', 
      icon: 'fas fa-map-marker-alt',
      requiredPermission: { resource: 'ubicaciones', action: 'read' }
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

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName.toLowerCase()]: !prev[itemName.toLowerCase()]
    }));
  };

  // Filtrar elementos de navegación según permisos
  const filteredNavigationItems = navigationItems.filter(item => {
    if (!item.requiredPermission) return true;
    // Mostrar siempre para administradores
    const roleName = (user?.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || (user?.role_id === 1);
    if (isAdmin) return true;
    const allowed = hasPermission(item.requiredPermission.resource, item.requiredPermission.action);
    // Debug puntual para Ubicaciones
    if (item.requiredPermission.resource === 'ubicaciones') {
      try { console.log('[Layout] Ubicaciones visible?', { roleName, role_id: user?.role_id, allowed }); } catch {}
    }
    return allowed;
  });

  const handleLogout = async () => {
    try {
      await signOut();
      // Al cerrar sesión, la redirección se manejará en el AuthProvider
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const [appVersion, setAppVersion] = useState<string>('');
  useEffect(() => {
    const w = window as typeof window & { appVersion?: { get: () => Promise<string> } };
    w.appVersion?.get?.().then((v: string) => setAppVersion(v)).catch(()=>{});
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <div
        className={cn(
          "bg-card border-r transition-all duration-300 hidden lg:block",
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className="p-4 flex items-center justify-between border-b">
          {sidebarOpen ? (
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">Inventario Pro - SC</h1>
            </div>
          ) : (
            <h1 className="text-xl font-bold text-primary">IP</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <i className={`fas ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
          </Button>
        </div>

        <nav className="mt-6">
          <ul className="space-y-1">
            {filteredNavigationItems.map((item) => (
              <React.Fragment key={item.path}>
                <li>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleExpand(item.name)}
                        aria-expanded={expandedItems[item.name.toLowerCase()]}
                        className={cn(
                          "flex items-center w-full py-3 px-4 transition-colors rounded-md",
                          (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <i className={`${item.icon} w-5`}></i>
                        {sidebarOpen && (
                          <>
                            <span className="ml-3 flex-1 text-left">{item.name}</span>
                            <i
                              className={`fas fa-chevron-${expandedItems[item.name.toLowerCase()] ? 'down' : 'right'} ml-auto transition-transform text-gray-500 dark:text-gray-300`}
                            ></i>
                          </>
                        )}
                      </button>
                      {expandedItems[item.name.toLowerCase()] && sidebarOpen && (
                        <div className="relative ml-12 pl-5 mt-2">
                          <div className="absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700" />
                          <ul className="mt-1 space-y-1">
                            {item.children.map((child) => (
                              <li key={child.path} className="relative">
                                {location.pathname === child.path && (
                                  <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-6 w-[2px] bg-primary" />
                                )}
                                <Link
                                  to={child.path}
                                  className={cn(
                                    "flex items-center py-2 px-3 text-sm transition-colors rounded-md",
                                    location.pathname === child.path
                                      ? "text-primary font-medium"
                                      : "text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center py-3 px-4 transition-colors",
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary border-r-4 border-primary"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <i className={`${item.icon} w-5`}></i>
                      {sidebarOpen && <span className="ml-3">{item.name}</span>}
                    </Link>
                  )}
                </li>
              </React.Fragment>
            ))}
          </ul>
        </nav>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              {/* Menú móvil */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden text-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-white hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="Abrir menú"
                  >
                    <i className="fas fa-bars text-2xl"></i>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center">
                      <h1 className="text-xl font-bold text-primary">Inventario Pro - SC</h1>
                    </div>
                  </div>
                  <nav className="mt-4">
                    <ul className="space-y-1 px-2">
                      {filteredNavigationItems.map((item) => (
                        <React.Fragment key={item.path}>
                          <li>
                            {item.children ? (
                              <div>
                                <button
                                  onClick={() => toggleExpand(item.name)}
                                  aria-expanded={expandedItems[item.name.toLowerCase()]}
                                  className={cn(
                                    "flex items-center w-full py-3 px-4 rounded-md transition-colors",
                                    (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  <i className={`${item.icon} w-5`}></i>
                                  <span className="ml-3 flex-1 text-left">{item.name}</span>
                                  <i className={`fas fa-chevron-${expandedItems[item.name.toLowerCase()] ? 'down' : 'right'} ml-auto transition-transform text-gray-500 dark:text-gray-300`}></i>
                                </button>
                                {expandedItems[item.name.toLowerCase()] && (
                                  <div className="relative ml-12 pl-5 mt-2">
                                    <div className="absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700" />
                                    <ul className="mt-1 space-y-1">
                                      {item.children.map((child) => (
                                        <li key={child.path} className="relative">
                                          {location.pathname === child.path && (
                                            <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-6 w-[2px] bg-primary" />
                                          )}
                                          <Link
                                            to={child.path}
                                            className={cn(
                                              "flex items-center py-2 px-3 text-sm rounded-md transition-colors",
                                              location.pathname === child.path
                                                ? "text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted"
                                            )}
                                            onClick={() => setMobileOpen(false)}
                                          >
                                            {child.name}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Link
                                to={item.path}
                                className={cn(
                                  "flex items-center py-3 px-4 rounded-md transition-colors",
                                  location.pathname === item.path
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                                )}
                                onClick={() => setMobileOpen(false)}
                              >
                                <i className={`${item.icon} w-5`}></i>
                                <span className="ml-3">{item.name}</span>
                              </Link>
                            )}
                          </li>
                        </React.Fragment>
                      ))}
                    </ul>
                  </nav>
                </SheetContent>
              </Sheet>

              <h1 className="text-xl font-semibold hidden sm:block">{navigationItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}</h1>
            </div>

            <div className="flex items-center space-x-2">
              <SubscriptionHelpButton />
              {appVersion && (
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground select-none" title="Versión de la aplicación">
                  v{appVersion}
                </span>
              )}
              <DatabaseStatus />
              <UpdateNotification />
              {/* Botón de engranaje para configuración de conexión */}
              <button
                className="rounded-full w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors"
                title="Configurar conexión"
                onClick={onOpenConfig}
                style={{ marginRight: 8 }}
              >
                <i className="fas fa-cog text-xl text-gray-500" />
              </button>
              <div className="relative">
                <Button
                  variant="outline"
                  className="rounded-full w-10 h-10 p-0 sm:w-auto sm:h-auto sm:p-2 sm:pl-3 sm:pr-3"
                  onClick={handleLogout}
                >
                  <i className="fas fa-sign-out-alt sm:mr-2"></i>
                  <span className="hidden sm:inline">{user?.full_name || 'Usuario'}</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Información de suscripción */}
          <SubscriptionInfo />
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 