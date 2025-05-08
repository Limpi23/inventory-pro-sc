import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Navigate, useLocation } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { user, subscription, loading, checkSubscription } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    const checkStatus = async () => {
      if (user) {
        await checkSubscription();
      }
      setChecking(false);
    };
    
    checkStatus();
  }, [user, checkSubscription]);
  
  // Si está cargando o verificando, mostrar un spinner
  if (loading || checking) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Si la ruta es para renovar la suscripción, permitir acceso
  if (location.pathname === '/subscription/renew') {
    return <>{children}</>;
  }
  
  // Si la suscripción no está activa o está bloqueada, mostrar página de suscripción expirada
  if (subscription && (subscription.status === 1 || !subscription.isActive)) {
    return <Navigate to="/subscription/expired" replace />;
  }
  
  // Si todo está bien, mostrar el contenido normal
  return <>{children}</>;
};

export default SubscriptionGuard; 