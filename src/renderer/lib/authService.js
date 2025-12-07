import { supabase } from './supabase';
const SESSION_KEY = 'inventory_session';
export const authService = {
    // Iniciar sesión con email y contraseña usando Supabase Auth
    login: async (email, password) => {
        try {
            console.log('[AuthService] 🔐 Intentando login con:', email);
            const client = await supabase.getClient();
            // MÉTODO 1: Intentar con Supabase Auth primero
            console.log('[AuthService] 📡 Método 1: Intentando con Supabase Auth...');
            const { data: authData, error: authError } = await client.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) {
                console.log('[AuthService] ❌ Supabase Auth falló:', authError.message);
            }
            // Si Supabase Auth funciona, continuar con el flujo normal
            if (!authError && authData.user) {
                console.log('[AuthService] ✅ Supabase Auth exitoso, usuario ID:', authData.user.id);
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
            // MÉTODO 2: Si Supabase Auth falla, intentar con password_hash en public.users
            console.log('[AuthService] 🔄 Método 2: Buscando usuario en public.users...');
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
                console.log('[AuthService] ❌ Error al buscar usuario:', hashError.message);
                return null;
            }
            if (!userWithHash) {
                console.log('[AuthService] ❌ Usuario no encontrado en public.users');
                return null;
            }
            console.log('[AuthService] ✅ Usuario encontrado:', {
                id: userWithHash.id,
                email: userWithHash.email,
                tiene_password_hash: !!userWithHash.password_hash,
                active: userWithHash.active
            });
            // Verificar si tiene password_hash
            if (!userWithHash.password_hash) {
                console.log('[AuthService] ❌ Usuario no tiene password_hash');
                return null;
            }
            // Verificar contraseña usando crypt
            console.log('[AuthService] 🔐 Verificando contraseña con verify_password...');
            const { data: passwordMatch, error: cryptError } = await client.rpc('verify_password', {
                user_email: email.toLowerCase(),
                user_password: password
            });
            console.log('[AuthService] 📊 Resultado verify_password:', {
                passwordMatch,
                error: cryptError?.message
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
                    console.error('[AuthService] ❌ Contraseña incorrecta después de reintentar');
                    return null;
                }
                console.log('[AuthService] ✅ Contraseña válida después de reintentar');
            }
            else if (cryptError || !passwordMatch) {
                console.log('[AuthService] ❌ Contraseña incorrecta o error en verify_password');
                return null;
            }
            console.log('[AuthService] ✅ Contraseña válida!');
            // Contraseña válida, retornar usuario
            if (!userWithHash.active) {
                console.log('[AuthService] ❌ Usuario desactivado');
                throw new Error('Usuario desactivado');
            }
            // Mapear datos del usuario
            let roleName = '';
            let roleDescription = '';
            if (userWithHash.roles) {
                const roles = userWithHash.roles;
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
            console.log('[AuthService] 🎉 Login exitoso! Usuario:', {
                id: sessionUser.id,
                email: sessionUser.email,
                role: sessionUser.role_name
            });
            // Guardar sesión
            saveSession(sessionUser);
            return sessionUser;
        }
        catch (error) {
            console.error('[AuthService] 💥 Error en login:', error);
            throw error;
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
        const redirectTo = getConfirmEmailRedirectUrl();
        const { error } = await client.auth.resend({
            type: 'signup',
            email: email.toLowerCase(),
            options: { emailRedirectTo: redirectTo }
        });
        if (error)
            throw error;
    },
    // Crear usuario directamente en public.users (sin Supabase Auth)
    // Útil cuando Supabase Auth tiene rate limiting o problemas
    createUserDirectly: async (userData) => {
        try {
            const bcrypt = await import('bcryptjs');
            const client = await supabase.getClient();
            const lowerEmail = userData.email.toLowerCase();
            // Verificar que el email no exista
            const { data: existing } = await client
                .from('users')
                .select('id')
                .eq('email', lowerEmail)
                .maybeSingle();
            if (existing?.id) {
                throw new Error('El email ya está registrado en el sistema.');
            }
            // Hashear la contraseña en el cliente usando bcryptjs
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(userData.password, salt);
            // Insertar directamente en public.users con password_hash
            const { data: newUserData, error: insertError } = await client
                .from('users')
                .insert({
                email: lowerEmail,
                full_name: userData.full_name,
                role_id: userData.role_id,
                password_hash: passwordHash,
                active: true
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
            if (insertError || !newUserData) {
                throw new Error(insertError?.message || 'No se pudo crear el usuario.');
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
            console.error('Error al crear usuario directamente:', error);
            throw error;
        }
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
        // Permitir override por variable de entorno en tiempo de build
        const envBase = import.meta?.env?.VITE_PUBLIC_APP_URL;
        if (envBase)
            return `${envBase.replace(/\/$/, '')}/reset-password`;
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
        const envBase = import.meta?.env?.VITE_PUBLIC_APP_URL;
        if (envBase)
            return `${envBase.replace(/\/$/, '')}/login`;
        if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
            return `${window.location.origin}/login`;
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
// URL a la que debe llegar el usuario tras confirmar su email
function getConfirmEmailRedirectUrl() {
    try {
        const envBase = import.meta?.env?.VITE_PUBLIC_APP_URL;
        if (envBase)
            return `${envBase.replace(/\/$/, '')}/login`;
        if (typeof window !== 'undefined' && window.location && window.location.origin.startsWith('http')) {
            // Tras confirmar, que vuelva al login por si necesita iniciar sesión
            return `${window.location.origin}/login`;
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
