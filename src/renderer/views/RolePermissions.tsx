import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Role, Permission, RolePermission } from '../../types';
import { toast } from 'react-hot-toast';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// Interfaz para agrupar permisos por recurso
interface GroupedPermissions {
  [resource: string]: Permission[];
}

// Definición de módulos del sistema
interface ModuleDefinition {
  id: string;
  name: string;
  resources: string[];
  icon: string;
}

// Definición de perfiles predefinidos
interface PermissionProfile {
  id: string;
  name: string;
  description: string;
  permissions: {
    resource: string;
    actions: string[];
  }[];
}

const RolePermissions: React.FC = () => {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changedPermissions, setChangedPermissions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("modules");

  // Verificar permiso de escritura
  const canEdit = hasPermission('users', 'write');

  // Definición de módulos del sistema
  const modules: ModuleDefinition[] = [
    { 
      id: 'inventario', 
      name: 'Inventario', 
      resources: ['products', 'categories', 'warehouses', 'stock'], 
      icon: 'box' 
    },
    { 
      id: 'compras', 
      name: 'Compras', 
      resources: ['suppliers', 'purchase_orders'], 
      icon: 'shopping-cart' 
    },
    { 
      id: 'ventas', 
      name: 'Ventas', 
      resources: ['customers', 'invoices', 'returns'], 
      icon: 'dollar-sign' 
    },
    { 
      id: 'reportes', 
      name: 'Reportes', 
      resources: ['reports'], 
      icon: 'bar-chart-2' 
    },
    { 
      id: 'configuracion', 
      name: 'Configuración', 
      resources: ['settings', 'users'], 
      icon: 'settings' 
    }
  ];

  // Perfiles predefinidos de permisos
  const permissionProfiles: PermissionProfile[] = [
    {
      id: 'vendedor',
      name: 'Vendedor',
      description: 'Acceso a ventas, clientes y consulta de inventario',
      permissions: [
        { resource: 'products', actions: ['view'] },
        { resource: 'customers', actions: ['view', 'create', 'edit'] },
        { resource: 'invoices', actions: ['view', 'create', 'edit'] },
        { resource: 'returns', actions: ['view', 'create'] },
        { resource: 'reports', actions: ['view'] }
      ]
    },
    {
      id: 'almacenista',
      name: 'Almacenista',
      description: 'Gestión de inventario y recepción de compras',
      permissions: [
        { resource: 'products', actions: ['view', 'create', 'edit'] },
        { resource: 'categories', actions: ['view', 'create', 'edit'] },
        { resource: 'warehouses', actions: ['view'] },
        { resource: 'stock', actions: ['view', 'create', 'edit'] },
        { resource: 'purchase_orders', actions: ['view', 'edit'] }
      ]
    },
    {
      id: 'supervisor',
      name: 'Supervisor',
      description: 'Acceso a reportes y supervisión de operaciones',
      permissions: [
        { resource: 'products', actions: ['view'] },
        { resource: 'customers', actions: ['view'] },
        { resource: 'invoices', actions: ['view'] },
        { resource: 'purchase_orders', actions: ['view'] },
        { resource: 'reports', actions: ['view'] },
        { resource: 'users', actions: ['view'] }
      ]
    }
  ];

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole.id);
    }
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      // Intentar cargar roles de localStorage primero
      const localRoles = localStorage.getItem('localRoles');
      if (localRoles) {
        const roles = JSON.parse(localRoles);
        setRoles(roles);
        
        // Seleccionar automáticamente el primer rol
        if (roles.length > 0) {
          setSelectedRole(roles[0]);
        }
        return;
      }
      
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('id');

      if (error) throw error;
      setRoles(data || []);
      
      // Seleccionar automáticamente el primer rol
      if (data && data.length > 0) {
        setSelectedRole(data[0]);
      }
    } catch (error: any) {
      console.error('Error al cargar roles:', error.message);
      toast.error(`Error al cargar roles: ${error.message}`);
      
      // Crear roles predeterminados en caso de error
      const defaultRoles: Role[] = [
        { id: 1, name: 'admin', description: 'Administrador con acceso completo', created_at: new Date().toISOString() },
        { id: 2, name: 'operador', description: 'Operador con acceso limitado a funciones específicas', created_at: new Date().toISOString() }
      ];
      localStorage.setItem('localRoles', JSON.stringify(defaultRoles));
      setRoles(defaultRoles);
      setSelectedRole(defaultRoles[0]);
    }
  };

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      
      // Intentar cargar permisos de localStorage primero
      const localPermissions = localStorage.getItem('localPermissions');
      if (localPermissions) {
        setPermissions(JSON.parse(localPermissions));
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('resource', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        localStorage.setItem('localPermissions', JSON.stringify(data));
        setPermissions(data);
      } else {
        // Si no hay datos, crear permisos predeterminados
        const defaultPermissions = generateDefaultPermissions();
        localStorage.setItem('localPermissions', JSON.stringify(defaultPermissions));
        setPermissions(defaultPermissions);
      }
    } catch (error: any) {
      console.error('Error al cargar permisos:', error.message);
      toast.error(`Error al cargar permisos: ${error.message}`);
      
      // Crear permisos predeterminados en caso de error
      const defaultPermissions = generateDefaultPermissions();
      localStorage.setItem('localPermissions', JSON.stringify(defaultPermissions));
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultPermissions = (): Permission[] => {
    // Generar permisos predeterminados para todos los recursos
    const resources = [
      'products', 'categories', 'warehouses', 'stock',
      'suppliers', 'purchase_orders',
      'customers', 'invoices', 'returns',
      'reports', 'settings', 'users'
    ];
    
    const actions = ['view', 'create', 'edit', 'delete'];
    
    let permissionId = 1;
    const permissions: Permission[] = [];
    
    resources.forEach(resource => {
      actions.forEach(action => {
        permissions.push({
          id: permissionId++,
          name: `${resource}_${action}`,
          description: `Permiso para ${action} en ${resource}`,
          resource,
          action
        });
      });
    });
    
    return permissions;
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      setLoading(true);
      
      // Intentar cargar de localStorage primero
      const localRolePermissions = localStorage.getItem('localRolePermissions');
      if (localRolePermissions) {
        const allRolePermissions = JSON.parse(localRolePermissions);
        const filteredPermissions = allRolePermissions.filter((rp: RolePermission) => rp.role_id === roleId);
        setRolePermissions(filteredPermissions);
        setChangedPermissions(new Set()); // Reiniciar cambios
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId);

      if (error) throw error;
      
      if (data) {
        // Si hay datos en Supabase, guardarlos en localStorage
        localStorage.setItem('localRolePermissions', JSON.stringify(data));
        setRolePermissions(data);
      } else {
        // Si no hay datos, inicializar un array vacío (excepto para admin)
        let defaultRolePermissions: RolePermission[] = [];
        
        if (roleId === 1) { // Admin role
          // Dar todos los permisos al admin
          defaultRolePermissions = permissions.map(p => ({
            role_id: 1,
            permission_id: p.id,
            created_at: new Date().toISOString()
          }));
        }
        
        localStorage.setItem('localRolePermissions', JSON.stringify(defaultRolePermissions));
        setRolePermissions(defaultRolePermissions);
      }
      
      setChangedPermissions(new Set()); // Reiniciar cambios
    } catch (error: any) {
      console.error('Error al cargar permisos del rol:', error.message);
      toast.error(`Error al cargar permisos del rol: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    // Preguntar si hay cambios sin guardar
    if (changedPermissions.size > 0) {
      if (!confirm('Hay cambios sin guardar. ¿Desea continuar y perder estos cambios?')) {
        return;
      }
    }
    setSelectedRole(role);
  };

  const hasPermissionAssigned = (permissionId: number) => {
    return rolePermissions.some(rp => rp.permission_id === permissionId);
  };

  const togglePermission = (permissionId: number) => {
    if (!canEdit) return;
    
    const key = `${selectedRole?.id}-${permissionId}`;
    
    // Actualizar el conjunto de cambios
    const newChangedPermissions = new Set(changedPermissions);
    if (newChangedPermissions.has(key)) {
      newChangedPermissions.delete(key);
    } else {
      newChangedPermissions.add(key);
    }
    setChangedPermissions(newChangedPermissions);
  };

  const isPermissionChanged = (permissionId: number) => {
    const key = `${selectedRole?.id}-${permissionId}`;
    return changedPermissions.has(key);
  };

  const getEffectivePermissionState = (permissionId: number) => {
    const isAssigned = hasPermissionAssigned(permissionId);
    const isChanged = isPermissionChanged(permissionId);
    
    return isChanged ? !isAssigned : isAssigned;
  };

  const saveChanges = async () => {
    if (!selectedRole) return;
    
    try {
      setSaving(true);
      
      // Cargar todos los role_permissions actuales
      const localRolePermissions = localStorage.getItem('localRolePermissions');
      let allRolePermissions: RolePermission[] = localRolePermissions 
        ? JSON.parse(localRolePermissions) 
        : [];
      
      // Procesar cada cambio
      for (const key of changedPermissions) {
        const [roleId, permissionId] = key.split('-').map(Number);
        const isCurrentlyAssigned = rolePermissions.some(
          rp => rp.role_id === roleId && rp.permission_id === Number(permissionId)
        );
        
        if (isCurrentlyAssigned) {
          // Eliminar permiso
          allRolePermissions = allRolePermissions.filter(
            rp => !(rp.role_id === roleId && rp.permission_id === Number(permissionId))
          );
        } else {
          // Agregar permiso
          allRolePermissions.push({
            role_id: roleId,
            permission_id: permissionId,
            created_at: new Date().toISOString()
          });
        }
      }
      
      // Guardar cambios en localStorage
      localStorage.setItem('localRolePermissions', JSON.stringify(allRolePermissions));
      
      // Recargar los permisos
      await fetchRolePermissions(selectedRole.id);
      toast.success('Permisos actualizados correctamente');
      
    } catch (error: any) {
      console.error('Error al guardar permisos:', error.message);
      toast.error(`Error al guardar permisos: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Aplicar un perfil predefinido de permisos
  const applyPermissionProfile = (profile: PermissionProfile) => {
    if (!selectedRole || !canEdit || selectedRole.name === 'admin') return;
    
    if (!confirm(`¿Está seguro de aplicar el perfil "${profile.name}" a este rol? Esto sobrescribirá los permisos actuales.`)) {
      return;
    }
    
    try {
      // Limpiar permisos actuales
      const newChangedPermissions = new Set<string>();
      
      // Para cada permiso existente, verificar si debe ser retirado
      rolePermissions.forEach(rp => {
        const permission = permissions.find(p => p.id === rp.permission_id);
        if (permission) {
          const shouldHavePermission = profile.permissions.some(
            pp => pp.resource === permission.resource && pp.actions.includes(permission.action)
          );
          
          // Si no debe tener el permiso pero lo tiene, añadirlo al conjunto de cambios
          if (!shouldHavePermission) {
            newChangedPermissions.add(`${selectedRole.id}-${permission.id}`);
          }
        }
      });
      
      // Para cada permiso en el perfil, verificar si debe ser agregado
      profile.permissions.forEach(profilePermission => {
        profilePermission.actions.forEach(action => {
          const permission = permissions.find(
            p => p.resource === profilePermission.resource && p.action === action
          );
          
          if (permission) {
            const hasPermission = rolePermissions.some(rp => rp.permission_id === permission.id);
            
            // Si debe tener el permiso pero no lo tiene, añadirlo al conjunto de cambios
            if (!hasPermission) {
              newChangedPermissions.add(`${selectedRole.id}-${permission.id}`);
            }
          }
        });
      });
      
      // Actualizar el conjunto de cambios
      setChangedPermissions(newChangedPermissions);
      
      toast.success(`Perfil "${profile.name}" aplicado. No olvide guardar los cambios.`);
    } catch (error: any) {
      console.error('Error al aplicar perfil de permisos:', error.message);
      toast.error(`Error al aplicar perfil: ${error.message}`);
    }
  };

  // Agrupar permisos por recurso
  const groupPermissionsByResource = (): GroupedPermissions => {
    const grouped: GroupedPermissions = {};
    
    permissions.forEach(permission => {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource].push(permission);
    });
    
    return grouped;
  };

  const groupedPermissions = groupPermissionsByResource();

  // Filtrar permisos por módulo
  const getPermissionsForModule = (moduleId: string): JSX.Element => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return <></>;
    
    return (
      <div className="space-y-6">
        {module.resources.map(resource => {
          const resourcePermissions = groupedPermissions[resource];
          if (!resourcePermissions || resourcePermissions.length === 0) return null;
          
          return (
            <Card key={resource}>
              <CardHeader className="pb-2">
                <CardTitle className="text-md capitalize">{resource.replace('_', ' ')}</CardTitle>
                <CardDescription>Permisos para {resource.replace('_', ' ')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6">
                  {resourcePermissions.map(permission => (
                    <div key={permission.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`permission-${permission.id}`}
                        checked={getEffectivePermissionState(permission.id)}
                        onCheckedChange={() => togglePermission(permission.id)}
                        disabled={!canEdit || selectedRole?.name === 'admin'}
                        className={isPermissionChanged(permission.id) ? 'bg-amber-500 text-white' : ''}
                      />
                      <label
                        htmlFor={`permission-${permission.id}`}
                        className={`text-sm cursor-pointer capitalize ${isPermissionChanged(permission.id) ? 'text-amber-600 font-semibold' : ''}`}
                      >
                        {permission.action}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gestión de Permisos por Rol</h1>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        {/* Selección de Rol */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-3">Seleccione un Rol:</h2>
          <div className="flex space-x-4">
            {roles.map(role => (
              <Button
                key={role.id}
                variant={selectedRole?.id === role.id ? "default" : "outline"}
                onClick={() => handleRoleSelect(role)}
                disabled={loading}
              >
                {role.name}
              </Button>
            ))}
          </div>
        </div>

        {selectedRole && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-medium">
                Permisos para el rol: <span className="text-primary">{selectedRole.name}</span>
              </h2>
              <p className="text-muted-foreground text-sm">{selectedRole.description}</p>
            </div>

            {/* Cambios sin guardar */}
            {changedPermissions.size > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 dark:bg-amber-900 dark:border-amber-800 dark:text-amber-200">
                <p className="flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Hay {changedPermissions.size} cambios sin guardar
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {selectedRole.name !== 'admin' && (
                  <Tabs defaultValue="modules" value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <TabsList>
                      <TabsTrigger value="modules">Por Módulos</TabsTrigger>
                      <TabsTrigger value="profiles">Perfiles Predefinidos</TabsTrigger>
                      <TabsTrigger value="all">Todos los Permisos</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="modules">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {modules.map(module => (
                          <Card key={module.id} className="overflow-hidden">
                            <CardHeader className="bg-gray-50 dark:bg-gray-700 pb-2">
                              <CardTitle className="flex items-center text-lg">
                                <i className={`fas fa-${module.icon} mr-2 text-primary`}></i>
                                {module.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                              {getPermissionsForModule(module.id)}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="profiles">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                        {permissionProfiles.map(profile => (
                          <Card key={profile.id} className="overflow-hidden">
                            <CardHeader className="pb-2">
                              <CardTitle>{profile.name}</CardTitle>
                              <CardDescription>{profile.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="text-sm space-y-2 mb-4">
                                <p className="font-medium">Incluye permisos para:</p>
                                <ul className="list-disc list-inside pl-2 space-y-1">
                                  {profile.permissions.map(permission => (
                                    <li key={`${profile.id}-${permission.resource}`} className="capitalize">
                                      {permission.resource.replace('_', ' ')}: {permission.actions.join(', ')}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <Button 
                                onClick={() => applyPermissionProfile(profile)}
                                disabled={!canEdit || selectedRole.name === 'admin'}
                                className="w-full"
                              >
                                Aplicar perfil
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="all">
                      <div className="overflow-x-auto mt-4">
                        <Table>
                          <TableCaption>Permisos disponibles en el sistema</TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[300px]">Recurso</TableHead>
                              <TableHead>Permisos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                              <TableRow key={resource}>
                                <TableCell className="font-medium capitalize">
                                  {resource.replace('_', ' ')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-6">
                                    {resourcePermissions.map(permission => (
                                      <div key={permission.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`all-permission-${permission.id}`}
                                          checked={getEffectivePermissionState(permission.id)}
                                          onCheckedChange={() => togglePermission(permission.id)}
                                          disabled={!canEdit || selectedRole.name === 'admin'}
                                          className={isPermissionChanged(permission.id) ? 'bg-amber-500 text-white' : ''}
                                        />
                                        <label
                                          htmlFor={`all-permission-${permission.id}`}
                                          className={`text-sm cursor-pointer capitalize ${isPermissionChanged(permission.id) ? 'text-amber-600 font-semibold' : ''}`}
                                        >
                                          {permission.action}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
                
                {selectedRole.name === 'admin' && (
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-6 dark:bg-blue-900 dark:text-blue-200">
                    <p className="flex items-center">
                      <i className="fas fa-info-circle mr-2"></i>
                      El rol de Administrador tiene todos los permisos por defecto y no puede ser modificado.
                    </p>
                  </div>
                )}

                {canEdit && selectedRole.name !== 'admin' && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={saveChanges}
                      disabled={changedPermissions.size === 0 || saving}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      {saving ? (
                        <>
                          <i className="fas fa-spinner animate-spin mr-2"></i>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save mr-2"></i>
                          Guardar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RolePermissions; 