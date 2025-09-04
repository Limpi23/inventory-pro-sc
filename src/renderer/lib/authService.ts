import { supabase } from './supabase';
import { User } from '../../types';

const SESSION_KEY = 'inventory_session';

export const authService = {
  // Iniciar sesión con email y contraseña usando Supabase Auth
  login: async (email: string, password: string): Promise<User | null> => {
    try {
      const client = await supabase.getClient();
      // Autenticar con Supabase Auth
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !authData.user) {
        console.error('Error de autenticación:', authError);
        return null;
      }
      // Buscar usuario en la tabla users para obtener datos adicionales
      let { data: userData, error } = await client
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
      if (error?.code === 'PGRST116' || (error && /not found|No rows/.test(error.message)) || !userData) {
        // Si no existe perfil en public.users, crearlo automáticamente
        const insertPayload = {
          id: authData.user.id,
          email: (authData.user.email || '').toLowerCase(),
          full_name: (authData.user.user_metadata?.full_name || authData.user.email || '').toString(),
          active: true,
          role_id: 1, // rol por defecto
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        };
        const { data: created, error: createErr } = await client
          .from('users')
          .insert(insertPayload)
          .select(`
            id, email, full_name, active, role_id, last_login, created_at,
            roles (name, description)
          `)
          .single();
        if (createErr) {
          console.error('No se pudo crear el perfil de usuario:', createErr);
          return null;
        }
        userData = created as any;
      } else if (error) {
        console.error('Error al buscar usuario:', error);
        return null;
      }
      if (!userData.active) {
        console.error('Usuario desactivado:', email);
        throw new Error('Usuario desactivado');
      }
      // Mapear datos y castear tipos para cumplir interfaz User
      let roleName = '';
      let roleDescription = '';
      if ((userData as any).roles) {
        const roles = (userData as any).roles;
        if (isRoleArray(roles)) {
          roleName = roles[0]?.name || '';
          roleDescription = roles[0]?.description || '';
        } else if (typeof roles === 'object' && roles !== null) {
          roleName = (roles as any).name || '';
          roleDescription = (roles as any).description || '';
        }
      }
      const sessionUser: User = {
        id: String((userData as any).id),
        email: String((userData as any).email),
        full_name: String((userData as any).full_name || ''),
        active: Boolean((userData as any).active),
        role_id: Number((userData as any).role_id || 0),
        role_name: String(roleName || ''),
        role_description: String(roleDescription || ''),
        last_login: (userData as any).last_login ? String((userData as any).last_login) : undefined,
        created_at: String((userData as any).created_at || new Date().toISOString())
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
  logout: async (): Promise<void> => {
    const client = await supabase.getClient();
    await client.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
  },

  // Registrar un nuevo usuario usando Supabase Auth
  register: async (userData: {
    email: string;
    password: string;
    full_name: string;
    role_id: number;
  }): Promise<User> => {
    try {
      const client = await supabase.getClient();
      // Registrar en Supabase Auth directamente
      const { data: signUpData, error: signUpError } = await client.auth.signUp({
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
      const { data: newUserData, error } = await client
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
      const { data: roleData } = await client
        .from('roles')
        .select('name, description')
        .eq('id', userData.role_id)
        .single();
      const user: User = {
        id: String((newUserData as any).id),
        email: String((newUserData as any).email),
        full_name: String((newUserData as any).full_name || ''),
        active: Boolean((newUserData as any).active),
        role_id: Number((newUserData as any).role_id || 0),
        role_name: String((roleData as any)?.name || ''),
        role_description: String((roleData as any)?.description || ''),
        created_at: String((newUserData as any).created_at || new Date().toISOString())
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