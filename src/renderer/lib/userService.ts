import { supabase } from './supabase';
import { User, Role, Permission } from '../../types';
import authService from './authService';

export const userService = {
  // Obtener todos los usuarios
  getAllUsers: async (): Promise<User[]> => {
    try {
      const client = await supabase.getClient();
      // Primero obtenemos los usuarios básicos
      const { data: usersData, error: usersError } = await client
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
        .order('full_name');
      
      if (usersError) throw usersError;
      if (!usersData) return [];
      
      // Luego obtenemos todos los roles para hacer match
      const { data: rolesData, error: rolesError } = await client
        .from('roles')
        .select('id, name, description');
      
      if (rolesError) throw rolesError;
      
      // Creamos un mapa de roles por id para acceder fácilmente
      const rolesMap = (rolesData || []).reduce((map, role) => {
        map[role.id] = role;
        return map;
      }, {} as Record<number, { id: number, name: string, description?: string }>);
      
      // Mapear los datos de usuarios con sus roles
      return usersData.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        active: user.active,
        role_id: user.role_id,
        role_name: rolesMap[user.role_id]?.name || '',
        role_description: rolesMap[user.role_id]?.description || '',
        last_login: user.last_login,
        created_at: user.created_at
      }));
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },
  
  // Obtener un usuario por ID
  getUserById: async (id: string): Promise<User | null> => {
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
        .eq('id', id)
        .single();
      
      if (userError) throw userError;
      if (!userData) return null;
      
      // Obtener información del rol
      const { data: roleData, error: roleError } = await client
        .from('roles')
        .select('id, name, description')
        .eq('id', userData.role_id)
        .single();
      
      if (roleError && roleError.code !== 'PGRST116') throw roleError;
      
      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        active: userData.active,
        role_id: userData.role_id,
        role_name: roleData?.name || '',
        role_description: roleData?.description || '',
        last_login: userData.last_login,
        created_at: userData.created_at
      };
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw error;
    }
  },
  
  // Obtener un usuario por email
  getUserByEmail: async (email: string): Promise<User | null> => {
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
      
      if (!userData) return null;
      
      // Obtener información del rol
      const { data: roleData, error: roleError } = await client
        .from('roles')
        .select('id, name, description')
        .eq('id', userData.role_id)
        .single();
      
      if (roleError && roleError.code !== 'PGRST116') throw roleError;
      
      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        active: userData.active,
        role_id: userData.role_id,
        role_name: roleData?.name || '',
        role_description: roleData?.description || '',
        last_login: userData.last_login,
        created_at: userData.created_at
      };
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw error;
    }
  },
  
  // Crear un nuevo usuario
  createUser: async (userData: {
    email: string;
    password: string;
    full_name: string;
    role_id: number;
  }): Promise<User> => {
    try {
      // Usar nuestro servicio de autenticación personalizado en lugar de Supabase Auth
      const newUser = await authService.register({
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        role_id: userData.role_id
      });
      
      return newUser;
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      throw new Error(`Database error saving new user: ${error.message}`);
    }
  },
  
  // Actualizar usuario
  updateUser: async (id: string, updates: {
    full_name?: string;
    role_id?: number;
    active?: boolean;
  }): Promise<User> => {
    try {
      const client = await supabase.getClient();
      // Actualizar el usuario
      const { error } = await client
        .from('users')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      // Obtener usuario actualizado - reutilizamos getUserById
      const updatedUser = await userService.getUserById(id);
      if (!updatedUser) {
        throw new Error('No se pudo encontrar el usuario actualizado');
      }
      
      return updatedUser;
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  },
  
  // Eliminar usuario
  deleteUser: async (id: string): Promise<void> => {
    try {
      const client = await supabase.getClient();
      // Eliminar directamente de la tabla users
      const { error } = await client
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  },
  
  // Actualizar última conexión
  updateLastLogin: async (id: string): Promise<void> => {
    const client = await supabase.getClient();
    const { error } = await client
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // Obtener todos los roles
  getAllRoles: async (): Promise<Role[]> => {
    const client = await supabase.getClient();
    const { data, error } = await client
      .from('roles')
      .select('*')
      .order('id');
    
    if (error) throw error;
    return data || [];
  },
  
  // Obtener permisos de un usuario
  getUserPermissions: async (userId: string): Promise<Permission[]> => {
    const client = await supabase.getClient();
    const { data, error } = await client
      .rpc('get_user_permissions', { user_id: userId });
    
    if (error) throw error;
    return data || [];
  },
  
  // Cambiar contraseña
  changePassword: async (): Promise<void> => {
    try {
      await authService.changePassword();
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      throw error;
    }
  },
  
  // Solicitar restablecimiento de contraseña
  requestPasswordReset: async (): Promise<void> => {
    throw new Error('Esta funcionalidad no está disponible con el sistema de autenticación personalizado');
  }
};

export default userService; 