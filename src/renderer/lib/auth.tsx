import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, SubscriptionInfo } from '../../types';
import authService from './authService';
import subscriptionService from './subscriptionService';
import { supabase } from './supabase';
import { toast } from 'react-hot-toast';
import userService from './userService';

interface AuthContextType {
  user: User | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  checkSubscription: () => Promise<SubscriptionInfo | null>;
  hasPermission: (resource: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<{ resource: string; action: string }[]>([]);

  // Función para mapear y tipar correctamente el usuario
  const mapUser = (userData: any): User => ({
    id: String(userData.id),
    email: String(userData.email),
    full_name: String(userData.full_name),
    active: Boolean(userData.active),
    role_id: Number(userData.role_id),
    role_name: String(userData.role_name || ''),
    role_description: String(userData.role_description || ''),
    last_login: String(userData.last_login || ''),
    created_at: String(userData.created_at || ''),
    tenant_id: userData.tenant_id ? String(userData.tenant_id) : undefined,
  });

  // Función para guardar la sesión de forma segura
  const saveSession = (user: any) => {
    localStorage.setItem('inventory_session', JSON.stringify(mapUser(user)));
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const sessionData = localStorage.getItem('inventory_session');
        if (sessionData) {
          const sessionUser = JSON.parse(sessionData);
          const client = await supabase.getClient();
          // Preferir vista user_roles para obtener role_name/description junto con el usuario
          const { data: userData, error } = await client
            .from('user_roles')
            .select('id, email, full_name, active, role_id, role_name, role_description, last_login, created_at')
            .eq('id', sessionUser.id)
            .eq('active', true)
            .single();
          if (error || !userData) {
            localStorage.removeItem('inventory_session');
            setUser(null);
            setPermissions([]);
            setLoading(false);
            return;
          }
          const userMapped = mapUser(userData);
          saveSession(userMapped);
          setUser(userMapped);
          // Debug: log user role info
          try {
            
          } catch {}
          // Cargar permisos del usuario
          const userPermissions = await userService.getUserPermissions(userMapped.id);
          setPermissions(userPermissions.map(p => ({
            resource: p.resource,
            action: p.action
          })));
          try {
            const hasUbicacionesRead = userPermissions.some((p: any) => p.resource === 'ubicaciones' && (p.action === 'read' || p.action === '*'));
            
          } catch {}
        }
      } catch (error) {
        localStorage.removeItem('inventory_session');
        setUser(null);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
    
    // Verificar suscripción periódicamente (cada hora)
    const interval = setInterval(async () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser && currentUser.tenant_id) {
        const subscriptionInfo = await checkSubscription();
        setSubscription(subscriptionInfo);
      }
    }, 60 * 60 * 1000);
    
    // Escuchar cambios en localStorage (para sincronizar sesión entre pestañas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'inventory_session') {
        loadUser();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      // Iniciar sesión con nuestro servicio personalizado
      const userData = await authService.login(email, password);
      if (!userData) {
        toast.error('Credenciales incorrectas');
        return false;
      }
      // Actualizar último acceso
      try {
        const client = await supabase.getClient();
        await client
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id);
      } catch (e) {
        
      }
      // Establecer usuario en el estado
      setUser(userData);
      // Obtener tenant_id del usuario si no existe
      if (!userData.tenant_id) {
        const client = await supabase.getClient();
        const { data, error } = await client
          .from('users')
          .select('tenant_id')
          .eq('id', userData.id)
          .single();
        if (!error && data?.tenant_id) {
          userData.tenant_id = String(data.tenant_id);
          const userMapped = mapUser(userData);
          saveSession(userMapped);
          setUser(userMapped);
        }
      }
      // Cargar permisos del usuario
      const userPermissions = await userService.getUserPermissions(userData.id);
      setPermissions(userPermissions.map(p => ({
        resource: p.resource,
        action: p.action
      })));
      try {
        const hasUbicacionesRead = userPermissions.some((p: any) => p.resource === 'ubicaciones' && (p.action === 'read' || p.action === '*'));
        
      } catch {}
      // Verificar suscripción al iniciar sesión
      if (userData.tenant_id) {
        const subscriptionInfo = await checkSubscription();
        setSubscription(subscriptionInfo);
      }
      toast.success('Sesión iniciada correctamente');
      return true;
    } catch (error: any) {
      
      toast.error(error.message || 'Error al iniciar sesión');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    authService.logout();
    setUser(null);
    setSubscription(null);
    setPermissions([]);
    toast.success('Sesión cerrada correctamente');
  };

  const checkSubscription = async (): Promise<SubscriptionInfo | null> => {
    const currentUser = user || authService.getCurrentUser();
    if (!currentUser || !currentUser.tenant_id) return null;
    
    try {
      const subscriptionInfo = await subscriptionService.getCurrentSubscription(currentUser.tenant_id);
      return subscriptionInfo;
    } catch (error) {
      
      return {
        isActive: false,
        endDate: null,
        planName: null,
        daysRemaining: null,
        status: 1 // Bloqueado por defecto en caso de error
      };
    }
  };

  const hasPermission = (resource: string, action: string) => {
    if (!user) return false;
    
    // Los administradores tienen acceso a todo (soporta variantes/localización)
    const roleName = (user.role_name || '').toLowerCase();
    if (roleName === 'admin' || roleName.includes('admin') || user.role_id === 1) return true;
    
    // Verificar si el usuario tiene el permiso específico
    return permissions.some(p => 
      p.resource === resource && 
      (p.action === action || p.action === '*')
    );
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      subscription, 
      loading, 
      signIn, 
      signOut, 
      checkSubscription,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}; 