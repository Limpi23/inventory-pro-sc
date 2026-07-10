import { supabase } from './supabase';
import authService from './authService';
export const userService = {
    // Obtener todos los usuarios
    getAllUsers: async () => {
        try {
            const client = await supabase.getClient();
            // Primero obtenemos los usuarios básicos
            let { data: usersData, error: usersError } = await client
                .from('users')
                .select(`
          id,
          email,
          full_name,
          active,
          role_id,
          warehouse_id,
          last_login,
          created_at
        `)
                .order('full_name');
            // Fallback para bases sin la migración de sucursales (columna warehouse_id inexistente)
            if (usersError && /warehouse_id/i.test(usersError.message || '')) {
                const retry = await client
                    .from('users')
                    .select('id, email, full_name, active, role_id, last_login, created_at')
                    .order('full_name');
                usersData = retry.data;
                usersError = retry.error;
            }
            if (usersError)
                throw usersError;
            if (!usersData)
                return [];
            // Luego obtenemos todos los roles para hacer match
            const { data: rolesData, error: rolesError } = await client
                .from('roles')
                .select('id, name, description');
            if (rolesError)
                throw rolesError;
            // Creamos un mapa de roles por id para acceder fácilmente
            const rolesMap = (rolesData || []).reduce((map, role) => {
                map[role.id] = role;
                return map;
            }, {});
            // Mapa de sucursales para mostrar el nombre de la sucursal asignada
            const { data: warehousesData } = await client
                .from('warehouses')
                .select('id, name');
            const warehousesMap = (warehousesData || []).reduce((map, w) => {
                map[String(w.id)] = w;
                return map;
            }, {});
            // Mapear los datos de usuarios con sus roles
            return usersData.map((user) => ({
                id: String(user.id),
                email: String(user.email),
                full_name: String(user.full_name || ''),
                active: Boolean(user.active),
                role_id: Number(user.role_id),
                role_name: rolesMap[Number(user.role_id)]?.name || '',
                role_description: rolesMap[Number(user.role_id)]?.description || '',
                warehouse_id: user.warehouse_id ? String(user.warehouse_id) : null,
                warehouse_name: user.warehouse_id ? (warehousesMap[String(user.warehouse_id)]?.name || '') : '',
                last_login: user.last_login ? String(user.last_login) : undefined,
                created_at: String(user.created_at || new Date().toISOString())
            }));
        }
        catch (error) {
            console.error('Error al obtener usuarios:', error);
            throw error;
        }
    },
    // Obtener un usuario por ID
    getUserById: async (id) => {
        try {
            const client = await supabase.getClient();
            // Obtener los datos básicos del usuario
            const { data: userData, error: userError } = await client
                .from('users')
                .select(`
          id,
          email,
          full_name,
          active,
          role_id,
          warehouse_id,
          last_login,
          created_at
        `)
                .eq('id', id)
                .single();
            if (userError)
                throw userError;
            if (!userData)
                return null;
            // Obtener información del rol
            const { data: roleData, error: roleError } = await client
                .from('roles')
                .select('id, name, description')
                .eq('id', userData.role_id)
                .single();
            if (roleError && roleError.code !== 'PGRST116')
                throw roleError;
            const u = userData;
            return {
                id: String(u.id),
                email: String(u.email),
                full_name: String(u.full_name || ''),
                active: Boolean(u.active),
                role_id: Number(u.role_id),
                role_name: roleData?.name || '',
                role_description: roleData?.description || '',
                warehouse_id: u.warehouse_id ? String(u.warehouse_id) : null,
                last_login: u.last_login ? String(u.last_login) : undefined,
                created_at: String(u.created_at || new Date().toISOString())
            };
        }
        catch (error) {
            console.error('Error al obtener usuario por ID:', error);
            throw error;
        }
    },
    // Obtener un usuario por email
    getUserByEmail: async (email) => {
        try {
            const client = await supabase.getClient();
            // Obtener los datos básicos del usuario
            const { data: userData, error: userError } = await client
                .from('users')
                .select(`
          id, 
          email, 
          full_name, 
          active, 
          role_id,
          last_login,
          created_at
        `)
                .eq('email', email)
                .single();
            if (userError) {
                if (userError.code === 'PGRST116') {
                    // No se encontró el usuario
                    return null;
                }
                throw userError;
            }
            if (!userData)
                return null;
            // Obtener información del rol
            const { data: roleData, error: roleError } = await client
                .from('roles')
                .select('id, name, description')
                .eq('id', userData.role_id)
                .single();
            if (roleError && roleError.code !== 'PGRST116')
                throw roleError;
            const u = userData;
            return {
                id: String(u.id),
                email: String(u.email),
                full_name: String(u.full_name || ''),
                active: Boolean(u.active),
                role_id: Number(u.role_id),
                role_name: roleData?.name || '',
                role_description: roleData?.description || '',
                last_login: u.last_login ? String(u.last_login) : undefined,
                created_at: String(u.created_at || new Date().toISOString())
            };
        }
        catch (error) {
            console.error('Error al obtener usuario por email:', error);
            throw error;
        }
    },
    // Crear un nuevo usuario
    createUser: async (userData) => {
        try {
            let newUser;
            // Intentar primero crear directamente en public.users (más confiable)
            try {
                newUser = await authService.createUserDirectly({
                    email: userData.email,
                    password: userData.password,
                    full_name: userData.full_name,
                    role_id: userData.role_id
                });
            }
            catch (directError) {
                console.warn('Fallo creación directa, intentando con Supabase Auth:', directError.message);
                // Fallback: intentar con Supabase Auth
                newUser = await authService.register({
                    email: userData.email,
                    password: userData.password,
                    full_name: userData.full_name,
                    role_id: userData.role_id
                });
            }
            // Asignar sucursal si se indicó
            if (userData.warehouse_id) {
                try {
                    const client = await supabase.getClient();
                    await client
                        .from('users')
                        .update({ warehouse_id: userData.warehouse_id })
                        .eq('id', newUser.id);
                    newUser.warehouse_id = userData.warehouse_id;
                }
                catch (whError) {
                    console.warn('No se pudo asignar la sucursal al usuario:', whError.message);
                }
            }
            return newUser;
        }
        catch (error) {
            console.error('Error al crear usuario (detalle):', error);
            throw error;
        }
    },
    // Actualizar usuario
    updateUser: async (id, updates) => {
        try {
            const client = await supabase.getClient();
            // Actualizar el usuario
            const { error } = await client
                .from('users')
                .update(updates)
                .eq('id', id);
            if (error)
                throw error;
            // Obtener usuario actualizado - reutilizamos getUserById
            const updatedUser = await userService.getUserById(id);
            if (!updatedUser) {
                throw new Error('No se pudo encontrar el usuario actualizado');
            }
            return updatedUser;
        }
        catch (error) {
            console.error('Error al actualizar usuario:', error);
            throw error;
        }
    },
    // Eliminar usuario
    deleteUser: async (id) => {
        try {
            const client = await supabase.getClient();
            // Intentar eliminar a través del RPC que borra en auth.users (cascade a public.users)
            const { error: rpcError } = await client.rpc('admin_delete_user', { p_user_id: id });
            if (rpcError) {
                // Fallback: si el RPC no existe o no hay permisos, intentar borrar la fila visible
                const { error: tblErr } = await client
                    .from('users')
                    .delete()
                    .eq('id', id);
                if (tblErr)
                    throw rpcError; // preferimos surfacing el error real del RPC
            }
        }
        catch (error) {
            console.error('Error al eliminar usuario:', error);
            throw error;
        }
    },
    // Actualizar última conexión
    updateLastLogin: async (id) => {
        const client = await supabase.getClient();
        const { error } = await client
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
    },
    // Obtener todos los roles
    getAllRoles: async () => {
        const client = await supabase.getClient();
        const { data, error } = await client
            .from('roles')
            .select('*')
            .order('id');
        if (error)
            throw error;
        return data || [];
    },
    // Obtener permisos de un usuario
    getUserPermissions: async (userId) => {
        const client = await supabase.getClient();
        const { data, error } = await client
            .rpc('get_user_permissions', { user_id: userId });
        if (error)
            throw error;
        return data || [];
    },
    // Cambiar contraseña
    changePassword: async () => {
        try {
            await authService.changePassword();
        }
        catch (error) {
            console.error('Error al cambiar contraseña:', error);
            throw error;
        }
    },
    // Solicitar restablecimiento de contraseña
    requestPasswordReset: async () => {
        throw new Error('Esta funcionalidad no está disponible con el sistema de autenticación personalizado');
    }
};
export default userService;
