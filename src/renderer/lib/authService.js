import { supabase } from './supabase';
const SESSION_KEY = 'inventory_session';
export const authService = {
    // Iniciar sesión con email y contraseña usando Supabase Auth
    login: async (email, password) => {
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
                userData = created;
            }
            else if (error) {
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
            if (userData.roles) {
                const roles = userData.roles;
                if (isRoleArray(roles)) {
                    roleName = roles[0]?.name || '';
                    roleDescription = roles[0]?.description || '';
                }
                else if (typeof roles === 'object' && roles !== null) {
                    roleName = roles.name || '';
                    roleDescription = roles.description || '';
                }
            }
            const sessionUser = {
                id: String(userData.id),
                email: String(userData.email),
                full_name: String(userData.full_name || ''),
                active: Boolean(userData.active),
                role_id: Number(userData.role_id || 0),
                role_name: String(roleName || ''),
                role_description: String(roleDescription || ''),
                last_login: userData.last_login ? String(userData.last_login) : undefined,
                created_at: String(userData.created_at || new Date().toISOString())
            };
            // Guardar sesión
            saveSession(sessionUser);
            return sessionUser;
        }
        catch (error) {
            console.error('Error detallado al iniciar sesión:', error);
            return null;
        }
    },
    // Verificar sesión actual
    getCurrentUser: () => {
        try {
            const sessionData = localStorage.getItem(SESSION_KEY);
            if (!sessionData) {
                return null;
            }
            return JSON.parse(sessionData);
        }
        catch (error) {
            console.error('Error al obtener sesión:', error);
            return null;
        }
    },
    // Cerrar sesión
    logout: async () => {
        const client = await supabase.getClient();
        await client.auth.signOut();
        localStorage.removeItem(SESSION_KEY);
    },
    // Registrar un nuevo usuario usando Supabase Auth
    register: async (userData) => {
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
            }
            catch (preErr) {
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
                    }
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
                .upsert({
                id: signUpData.user.id,
                email: userData.email.toLowerCase(),
                full_name: userData.full_name,
                role_id: userData.role_id,
                active: true,
                created_at: new Date().toISOString()
            }, { onConflict: 'id' })
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
            const user = {
                id: String(newUserData.id),
                email: String(newUserData.email),
                full_name: String(newUserData.full_name || ''),
                active: Boolean(newUserData.active),
                role_id: Number(newUserData.role_id || 0),
                role_name: String(roleData?.name || ''),
                role_description: String(roleData?.description || ''),
                created_at: String(newUserData.created_at || new Date().toISOString())
            };
            return user;
        }
        catch (error) {
            console.error('Error al registrar usuario:', error);
            throw error;
        }
    },
    // Cambiar contraseña usando Supabase Auth
    changePassword: async () => {
        try {
            // Supabase Auth gestiona el cambio de contraseña por el usuario autenticado
            throw new Error('El cambio de contraseña debe hacerse mediante el flujo de Supabase Auth.');
        }
        catch (error) {
            console.error('Error al cambiar contraseña:', error);
            throw error;
        }
    },
    // Enviar email de recuperación de contraseña
    requestPasswordReset: async (email) => {
        const client = await supabase.getClient();
        const redirectTo = getResetRedirectUrl();
        const { error } = await client.auth.resetPasswordForEmail(email.toLowerCase(), {
            redirectTo,
        });
        if (error)
            throw error;
    },
    // Reenviar correo de confirmación de registro
    resendSignupConfirmation: async (email) => {
        const client = await supabase.getClient();
        const redirectTo = getLoginRedirectUrl();
        const { error } = await client.auth.resend({
            type: 'signup',
            email: email.toLowerCase(),
            options: { emailRedirectTo: redirectTo }
        });
        if (error)
            throw error;
    },
};
// Función auxiliar para guardar la sesión
const saveSession = (user) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};
// Type guard para roles
function isRoleArray(roles) {
    return Array.isArray(roles) && roles.length > 0 && typeof roles[0].name === 'string';
}
export default authService;
// URL de redirección para el flujo de recuperación
function getResetRedirectUrl() {
    try {
        // Si estamos en un contexto web (dev), usamos la misma origin
        if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
            return `${window.location.origin}/reset-password`;
        }
        // En producción (Electron) se recomienda configurar en Supabase Authentication > URL Configuration
        // un Site URL público (p.ej. página estática) que apunte a /reset-password.
        // Si no hay, devolver undefined para usar el Site URL por defecto de Supabase.
        return undefined;
    }
    catch {
        return undefined;
    }
}
// URL de redirección después de confirmar email
function getLoginRedirectUrl() {
    try {
        if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
            return `${window.location.origin}/login`;
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
