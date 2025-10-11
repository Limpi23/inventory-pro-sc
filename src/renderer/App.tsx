import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Products from './views/Products';
import Categories from './views/Categories';
import Warehouses from './views/Warehouses';
import Suppliers from './views/Suppliers';
import SupplierDetail from './views/SupplierDetail';
import Reports from './views/Reports';
import Locations from './views/Locations';

// Existentes
import Sales from './views/Sales';
import Inventory from './views/Inventory';
import InventoryGeneral from './views/InventoryGeneral';
import PurchaseOrders from './views/PurchaseOrders';
import PurchaseOrderForm from './views/PurchaseOrderForm';
import PurchaseOrderDetail from './views/PurchaseOrderDetail';
import PurchaseOrderList from './views/PurchaseOrderList';
import SupplierPurchases from './views/SupplierPurchases';

// Nuevas vistas para el módulo de ventas
import Customers from './views/Customers';
import CustomerForm from './views/CustomerForm';
import Invoices from './views/Invoices';
import InvoiceForm from './views/InvoiceForm';
import Returns from './views/Returns';
import InvoiceDetail from './views/InvoiceDetail';
import ReturnForm from './views/ReturnForm';
import ReturnDetail from './views/ReturnDetail';

// Gestión de usuarios
import Users from './views/Users';
import RolePermissions from './views/RolePermissions';
import Login from './views/Login';
import ResetPassword from './views/ResetPassword';
import Settings from './views/Settings';
import { AuthProvider, useAuth } from './lib/auth';
import { Toaster } from 'react-hot-toast';

// Componentes de suscripción
import SubscriptionExpired from './views/SubscriptionExpired';
import SubscriptionRenew from './views/SubscriptionRenew';
import SubscriptionGuard from './components/SubscriptionGuard';
import Onboarding from './Onboarding';
import SupabaseConfigModal from './components/SupabaseConfigModal';

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

// Componente contenedor para Layout
const LayoutWrapper = ({ onOpenConfig }: { onOpenConfig: () => void }) => {
  return (
    <Layout onOpenConfig={onOpenConfig}>
      <Outlet />
    </Layout>
  );
};

// Componente para proteger rutas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
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
  const { user } = useAuth();

  useEffect(() => {
    const win = window as any;
    const forced = sessionStorage.getItem('forceOnboarding') === '1';
    if (forced) {
  // debug silenciado
      setShowOnboarding(true);
      sessionStorage.removeItem('forceOnboarding');
      return;
    }
    if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
      win.supabaseConfig.get().then((config: any) => {
  // debug silenciado
        if (config?.url && config?.anonKey) {
          setReady(true);
        } else {
          // debug silenciado
          setShowOnboarding(true);
        }
      }).catch((e: any) => {
  // debug silenciado
        setShowOnboarding(true);
      });
    } else {
  // debug silenciado
      setReady(true);
    }
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
    </>
  );
};

export default App; 