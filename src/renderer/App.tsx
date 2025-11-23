import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './lib/auth';
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
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Si no hay tema guardado, usar preferencia del sistema
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }
};

// Inicializar el tema cuando se carga la app
initializeTheme();

// Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
  </div>
);

// Componente contenedor para Layout
const LayoutWrapper = ({ onOpenConfig }: { onOpenConfig: () => void }) => {
  return (
    <Layout onOpenConfig={onOpenConfig}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

// Componente para proteger rutas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Ruta solo para administradores
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const roleName = (user.role_name || '').toLowerCase();
  const isAdmin = roleName.includes('admin') || user.role_id === 1;
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  const [ready, setReady] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const win = window as any;
    const forced = sessionStorage.getItem('forceOnboarding') === '1';
    if (forced) {
      setShowOnboarding(true);
      sessionStorage.removeItem('forceOnboarding');
      return;
    }
    if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
      win.supabaseConfig.get().then((config: any) => {
        if (config?.url && config?.anonKey) {
          setReady(true);
        } else {
          setShowOnboarding(true);
        }
      }).catch((e: any) => {
        setShowOnboarding(true);
      });
    } else {
      setReady(true);
    }
  }, []);

  // Escuchar eventos del menú de Electron
  useEffect(() => {
    const win = window as any;
    
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
      } catch (error: any) {
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
              toast.success('SQL copiado al portapapeles.\nEjecútalo en Supabase SQL Editor:\nhttps://supabase.com/dashboard', 
                { id: 'bootstrap-copied', duration: 10000 }
              );
            } catch (clipError) {
              toast.error('Por favor, ejecuta el SQL manualmente en Supabase SQL Editor', 
                { id: 'bootstrap-manual', duration: 8000 }
              );
            }
            
            // Mostrar el SQL en consola para que el usuario pueda copiarlo
            console.log('==========================================');
            console.log('EJECUTA ESTE SQL EN SUPABASE SQL EDITOR:');
            console.log('==========================================');
            console.log(bootstrapSQL);
            console.log('==========================================');
          }
        } else {
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
        } else {
          toast.success('La base de datos está actualizada.', { id: 'check-db' });
        }
      } catch (error: any) {
        toast.error(`Error al verificar: ${error.message}`, { id: 'check-db' });
      }
    };

    // Guardar referencias de los listeners
    let showConfigListener: any;
    let runMigrationsListener: any;
    let checkStatusListener: any;

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
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (!ready && !showOnboarding) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',fontFamily:'system-ui'}}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4" />
        <div style={{opacity:0.8,fontSize:16,fontWeight:500}}>⚙️ Iniciando Inventario Pro...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      {/* Modal de configuración de conexión */}
      {showConfigModal && (
        <SupabaseConfigModal onFinish={handleConfigFinish} onClose={() => setShowConfigModal(false)} />
      )}
      {/* Onboarding solo la primera vez */}
      {showOnboarding && (
        <Onboarding onFinish={handleOnboardingFinish} />
      )}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Ruta pública para login */}
          <Route path="/login" element={<Login />} />
          {/* Ruta pública para recuperación de contraseña */}
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Rutas de suscripción */}
          <Route path="/subscription/expired" element={
            <ProtectedRoute>
              <SubscriptionExpired />
            </ProtectedRoute>
          } />
          <Route path="/subscription/renew" element={
            <ProtectedRoute>
              <SubscriptionRenew />
            </ProtectedRoute>
          } />
          {/* Rutas protegidas con verificación de suscripción */}
          <Route path="/" element={
            <ProtectedRoute>
              <SubscriptionGuard>
                <LayoutWrapper onOpenConfig={handleOpenConfig} />
              </SubscriptionGuard>
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<Products />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="almacenes" element={<Warehouses />} />
            <Route path="ubicaciones" element={<Locations />} />
            <Route path="proveedores" element={<Suppliers />} />
            <Route path="proveedores/:id" element={<SupplierDetail />} />
            <Route path="proveedores/:id/compras" element={<SupplierPurchases />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="inventario/general" element={<InventoryGeneral />} />
            <Route path="reportes" element={<Reports />} />
            {/* Rutas de Órdenes de Compra */}
            <Route path="ordenes-compra" element={<PurchaseOrders />} />
            <Route path="ordenes-compra/lista" element={<PurchaseOrderList />} />
            <Route path="ordenes-compra/nueva" element={<PurchaseOrderForm />} />
            <Route path="ordenes-compra/editar/:id" element={<PurchaseOrderForm />} />
            <Route path="ordenes-compra/:id" element={<PurchaseOrderDetail />} />
            <Route path="ordenes-compra/:id/recibir" element={<PurchaseOrderDetail />} />
            {/* Rutas del módulo de Ventas */}
            <Route path="ventas" element={<Sales />} />
            {/* Rutas de Clientes */}
            <Route path="ventas/clientes" element={<Customers />} />
            <Route path="ventas/clientes/nuevo" element={<CustomerForm />} />
            <Route path="ventas/clientes/editar/:id" element={<CustomerForm />} />
            {/* Rutas de Facturas */}
            <Route path="ventas/facturas" element={<Invoices />} />
            <Route path="ventas/facturas/nueva" element={<InvoiceForm />} />
            <Route path="ventas/facturas/editar/:id" element={<InvoiceForm />} />
            <Route path="ventas/facturas/:id" element={<InvoiceDetail />} />
            {/* Rutas de Devoluciones */}
            <Route path="ventas/devoluciones" element={<Returns />} />
            <Route path="ventas/devoluciones/nueva" element={<ReturnForm />} />
            <Route path="ventas/devoluciones/:id" element={<ReturnDetail />} />
            {/* Rutas de Gestión de Usuarios (solo admin) */}
            <Route path="usuarios" element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            } />
            <Route path="usuarios/permisos" element={
              <AdminRoute>
                <RolePermissions />
              </AdminRoute>
            } />
            {/* Ruta de Ajustes */}
            <Route path="ajustes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;