import { supabase } from './supabase';
import { User } from '../../types';

const SESSION_KEY = 'inventory_session';

export const authService = {
  // Iniciar sesión con email y contraseña usando Supabase Auth
  login: async (email: string, password: string): Promise<User | null> => {
    try {
      // Autenticar con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !authData.user) {
        console.error('Error de autenticación:', authError);
        return null;
      }
      // Buscar usuario en la tabla users para obtener datos adicionales
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          id, 
          email, 
          full_name, 
          active, 
          role_id,
          last_login,
          created_at,
          roles (
            name,
            description
          )
        `)
        .eq('id', authData.user.id)
        .single();
      if (error || !userData) {
        console.error('Error al buscar usuario:', error);
        return null;
      }
      if (!userData.active) {
        console.error('Usuario desactivado:', email);
        throw new Error('Usuario desactivado');
      }
      let roleName = '';
      let roleDescription = '';
      if (userData.roles) {
        if (isRoleArray(userData.roles)) {
          roleName = userData.roles[0] && typeof userData.roles[0].name === 'string' ? userData.roles[0].name : '';
          roleDescription = userData.roles[0] && typeof userData.roles[0].description === 'string' ? userData.roles[0].description : '';
        } else if (typeof userData.roles === 'object' && userData.roles !== null) {
          roleName = (userData.roles as any).name || '';
          roleDescription = (userData.roles as any).description || '';
        }
      }
      const sessionUser: User = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        active: userData.active,
        role_id: userData.role_id,
        role_name: roleName,
        role_description: roleDescription,
        last_login: userData.last_login,
        created_at: userData.created_at
      };
      // Guardar sesión
      saveSession(sessionUser);
      return sessionUser;
    } catch (error) {
      console.error('Error detallado al iniciar sesión:', error);
      return null;
    }
  },

  // Verificar sesión actual
  getCurrentUser: (): User | null => {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (!sessionData) {
        return null;
      }
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Error al obtener sesión:', error);
      return null;
    }
  },

  // Cerrar sesión
  logout: (): void => {
    localStorage.removeItem(SESSION_KEY);
    supabase.auth.signOut();
  },

  // Registrar un nuevo usuario usando Supabase Auth
  register: async (userData: {
    email: string;
    password: string;
    full_name: string;
    role_id: number;
  }): Promise<User> => {
    try {
      // Registrar en Supabase Auth directamente
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name
          }
        }
      });
      if (signUpError || !signUpData.user) {
        // Si el error es de email ya registrado, muestra mensaje claro
        if (signUpError?.message?.toLowerCase().includes('user already registered') || signUpError?.message?.toLowerCase().includes('email')) {
          throw new Error('El email ya está registrado en el sistema.');
        }
        throw new Error(signUpError?.message || 'No se pudo registrar el usuario');
      }
      // Insertar en la tabla users
      const { data: newUserData, error } = await supabase
        .from('users')
        .insert({
          id: signUpData.user.id,
          email: userData.email.toLowerCase(),
          full_name: userData.full_name,
          role_id: userData.role_id,
          active: true,
          created_at: new Date().toISOString()
        })
        .select(`
          id, 
          email, 
          full_name, 
          active, 
          role_id,
          created_at
        `)
        .single();
      if (error || !newUserData) {
        throw new Error(error?.message || 'No se pudo crear el usuario en la base de datos.');
      }
      // Obtener información del rol
      const { data: roleData } = await supabase
        .from('roles')
        .select('name, description')
        .eq('id', userData.role_id)
        .single();
      const user: User = {
        id: newUserData.id,
        email: newUserData.email,
        full_name: newUserData.full_name,
        active: newUserData.active,
        role_id: newUserData.role_id,
        role_name: roleData?.name || '',
        role_description: roleData?.description || '',
        created_at: newUserData.created_at
      };
      return user;
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      throw error;
    }
  },

  // Cambiar contraseña usando Supabase Auth
  changePassword: async (): Promise<void> => {
    try {
      // Supabase Auth gestiona el cambio de contraseña por el usuario autenticado
      throw new Error('El cambio de contraseña debe hacerse mediante el flujo de Supabase Auth.');
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  },
};

// Función auxiliar para guardar la sesión
const saveSession = (user: User): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

// Type guard para roles
function isRoleArray(roles: any): roles is { name: string; description?: string }[] {
  return Array.isArray(roles) && roles.length > 0 && typeof roles[0].name === 'string';
}

export default authService; 