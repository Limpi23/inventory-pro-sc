import { supabase } from './supabase';
import { User } from '../../types';

const SESSION_KEY = 'inventory_session';

export const authService = {
  // Iniciar sesión con email y contraseña usando Supabase Auth
  login: async (email: string, password: string): Promise<User | null> => {
    try {
      const client = await supabase.getClient();
      
      // MÉTODO 1: Intentar con Supabase Auth primero
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      
      // Si Supabase Auth funciona, continuar con el flujo normal
      if (!authError && authData.user) {
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
      }
      
      // MÉTODO 2: Si Supabase Auth falla, intentar con password_hash en public.users
      // Verificar si existe la columna password_hash
      const { data: userWithHash, error: hashError } = await client
        .from('users')
        .select(`
          id, 
          email, 
          full_name, 
          active, 
          role_id,
          password_hash,
          last_login,
          created_at,
          roles (
            name,
            description
          )
        `)
        .eq('email', email.toLowerCase())
        .maybeSingle();
      
      if (hashError) {
        return null;
      }
      
      if (!userWithHash) {
        return null;
      }
      
      // Verificar si tiene password_hash
      if (!userWithHash.password_hash) {
        return null;
      }
      
      // Verificar contraseña usando crypt
      const { data: passwordMatch, error: cryptError } = await client.rpc('verify_password', {
        user_email: email.toLowerCase(),
        user_password: password
      });
      
      // Si no existe la función verify_password, intentar crear una query directa
      if (cryptError?.code === 'PGRST202') {
        // Crear la función verify_password si no existe
        await client.rpc('execute_migration', {
          migration_sql: `
            CREATE OR REPLACE FUNCTION public.verify_password(user_email TEXT, user_password TEXT)
            RETURNS BOOLEAN
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
              stored_hash TEXT;
            BEGIN
              SELECT password_hash INTO stored_hash
              FROM public.users
              WHERE email = user_email;
              
              IF stored_hash IS NULL THEN
                RETURN FALSE;
              END IF;
              
              RETURN (stored_hash = crypt(user_password, stored_hash));
            END;
            $$;
            
            GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated;
          `
        });
        
        // Intentar verificar nuevamente
        const { data: retryMatch, error: retryError } = await client.rpc('verify_password', {
          user_email: email.toLowerCase(),
          user_password: password
        });
        
        if (retryError || !retryMatch) {
          console.error('Contraseña incorrecta');
          return null;
        }
      } else if (cryptError || !passwordMatch) {
        return null;
      }
      
      // Contraseña válida, retornar usuario
      if (!userWithHash.active) {
        throw new Error('Usuario desactivado');
      }
      
      // Mapear datos del usuario
      let roleName = '';
      let roleDescription = '';
      if ((userWithHash as any).roles) {
        const roles = (userWithHash as any).roles;
        if (isRoleArray(roles)) {
          roleName = roles[0]?.name || '';
          roleDescription = roles[0]?.description || '';
        } else if (typeof roles === 'object' && roles !== null) {
          roleName = (roles as any).name || '';
          roleDescription = (roles as any).description || '';
        }
      }
      
      const sessionUser: User = {
        id: String(userWithHash.id),
        email: String(userWithHash.email),
        full_name: String(userWithHash.full_name || ''),
        active: Boolean(userWithHash.active),
        role_id: Number(userWithHash.role_id || 0),
        role_name: String(roleName || ''),
        role_description: String(roleDescription || ''),
        last_login: userWithHash.last_login ? String(userWithHash.last_login) : undefined,
        created_at: String(userWithHash.created_at || new Date().toISOString())
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
      // Pre-chequeo: evitar registrar si el email ya existe en public.users
      const lowerEmail = userData.email.toLowerCase();
      try {
        const { data: existing } = await client
          .from('users')
          .select('id')
          .eq('email', lowerEmail)
          .maybeSingle();
        if (existing?.id) {
          throw new Error('El email ya está registrado en el sistema.');
        }
      } catch (preErr: any) {
        // Si la API no soporta maybeSingle y responde con error distinto a not found, propagamos
        if (preErr?.message && !/not found|PGRST116/i.test(preErr.message)) {
          throw preErr;
        }
      }
      // Registrar en Supabase Auth directamente
      const { data: signUpData, error: signUpError } = await client.auth.signUp({
        email: lowerEmail,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name
          },
          emailRedirectTo: getConfirmEmailRedirectUrl()
        }
      });
      if (signUpError || !signUpData.user) {
        // Clarificar mensajes comunes
        const raw = (signUpError?.message || '').toLowerCase();
        if (raw.includes('user already registered') || raw.includes('email')) {
          throw new Error('El email ya está registrado en el sistema.');
        }
        if (raw.includes('over quota') || raw.includes('status 500')) {
          throw new Error('Servicio de autenticación temporalmente no disponible. Inténtalo de nuevo.');
        }
        // Propagar el error original si no es uno de los conocidos
        throw new Error(signUpError?.message || 'No se pudo registrar el usuario');
      }
      // Actualizar/crear registro en public.users SIN duplicar (el trigger ya crea una fila)
      // Usamos upsert por id para que sea idempotente y podamos aplicar el rol elegido
      const { data: newUserData, error } = await client
        .from('users')
        .upsert(
          {
            id: signUpData.user.id,
            email: userData.email.toLowerCase(),
            full_name: userData.full_name,
            role_id: userData.role_id,
            active: true,
            created_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
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
        throw new Error(error?.message || 'No se pudo actualizar el perfil del usuario.');
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

  // Enviar email de recuperación de contraseña
  requestPasswordReset: async (email: string): Promise<void> => {
    const client = await supabase.getClient();
    const redirectTo = getResetRedirectUrl();
    const { error } = await (client as any).auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo,
    });
    if (error) throw error;
  },

  // Reenviar correo de confirmación de registro
  resendSignupConfirmation: async (email: string): Promise<void> => {
    const client = await supabase.getClient();
    const redirectTo = getConfirmEmailRedirectUrl();
    const { error } = await (client as any).auth.resend({
      type: 'signup',
      email: email.toLowerCase(),
      options: { emailRedirectTo: redirectTo }
    } as any);
    if (error) throw error;
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

// URL de redirección para el flujo de recuperación
function getResetRedirectUrl(): string | undefined {
  try {
    // Permitir override por variable de entorno en tiempo de build
    const envBase = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
    if (envBase) return `${envBase.replace(/\/$/, '')}/reset-password`;
    // Si estamos en un contexto web (dev), usamos la misma origin
    if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/reset-password`;
    }
    // En producción (Electron) se recomienda configurar en Supabase Authentication > URL Configuration
    // un Site URL público (p.ej. página estática) que apunte a /reset-password.
    // Si no hay, devolver undefined para usar el Site URL por defecto de Supabase.
    return undefined;
  } catch {
    return undefined;
  }
}

// URL de redirección después de confirmar email
function getLoginRedirectUrl(): string | undefined {
  try {
    const envBase = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
    if (envBase) return `${envBase.replace(/\/$/, '')}/login`;
    if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/login`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// URL a la que debe llegar el usuario tras confirmar su email
function getConfirmEmailRedirectUrl(): string | undefined {
  try {
    const envBase = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
    if (envBase) return `${envBase.replace(/\/$/, '')}/login`;
    if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
      // Tras confirmar, que vuelva al login por si necesita iniciar sesión
      return `${window.location.origin}/login`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}