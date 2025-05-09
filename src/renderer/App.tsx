import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Products from './views/Products';
import Categories from './views/Categories';
import Warehouses from './views/Warehouses';
import Suppliers from './views/Suppliers';
import Reports from './views/Reports';

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
import Settings from './views/Settings';
import { AuthProvider, useAuth } from './lib/auth';
import { Toaster } from 'react-hot-toast';

// Componentes de suscripción
import SubscriptionExpired from './views/SubscriptionExpired';
import SubscriptionRenew from './views/SubscriptionRenew';
import SubscriptionGuard from './components/SubscriptionGuard';
import Onboarding from './Onboarding';

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
const LayoutWrapper = () => {
  return (
    <Layout>
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

const App = () => {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (window as any).supabaseConfig.get().then((config: any) => {
      if (config?.url && config?.anonKey) {
        setReady(true);
      }
    });
  }, []);

  const handleReconfigure = async () => {
    await (window as any).supabaseConfig.save({ url: '', anonKey: '' });
    setReady(false);
    setShowOnboarding(true);
  };

  if (!ready || showOnboarding) {
    return <Onboarding onFinish={() => { setReady(true); setShowOnboarding(false); }} />;
  }

  return (
    <AuthProvider>
      <Toaster position="top-right" />
      {user?.role_name === 'admin' && (
        <button
          onClick={handleReconfigure}
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, background: '#f59e42', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}
          title="Reconfigurar Supabase"
        >
          Reconfigurar Supabase
        </button>
      )}
      <Routes>
        {/* Ruta pública para login */}
        <Route path="/login" element={<Login />} />
        
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
              <LayoutWrapper />
            </SubscriptionGuard>
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="productos" element={<Products />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="almacenes" element={<Warehouses />} />
          <Route path="proveedores" element={<Suppliers />} />
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
          
          {/* Rutas de Gestión de Usuarios */}
          <Route path="usuarios" element={<Users />} />
          <Route path="usuarios/permisos" element={<RolePermissions />} />
          
          {/* Ruta de Ajustes */}
          <Route path="ajustes" element={<Settings />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App; 