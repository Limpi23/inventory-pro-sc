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

  const fetchRoles = async () => {
    try {
      const localRoles = localStorage.getItem('localRoles');
      if (localRoles) {
        const roles = JSON.parse(localRoles);
        setRoles(roles);
        if (roles.length > 0 && !selectedRole) setSelectedRole(roles[0]);
      }

      const client = await supabase.getClient();
      const { data, error } = await client.from('roles').select('*').order('id');
      if (error) throw error;
      
      setRoles(data || []);
      localStorage.setItem('localRoles', JSON.stringify(data || []));
      if (data && data.length > 0 && !selectedRole) setSelectedRole(data[0]);
    } catch (error: any) {
      console.error('Error al cargar roles:', error.message);
      toast.error(`Error al cargar roles: ${error.message}`);
      if (roles.length === 0) {
        const defaultRoles: Role[] = [
          { id: 1, name: 'admin', description: 'Administrador', created_at: new Date().toISOString() },
          { id: 2, name: 'operador', description: 'Operador', created_at: new Date().toISOString() }
        ];
        setRoles(defaultRoles);
        setSelectedRole(defaultRoles[0]);
      }
    }
  };

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const localPermissions = localStorage.getItem('localPermissions');
      if (localPermissions) setPermissions(JSON.parse(localPermissions));
      
      const client = await supabase.getClient();
      const { data, error } = await client.from('permissions').select('*').order('id');
      if (error) throw error;
      
      if (data && data.length > 0) {
        localStorage.setItem('localPermissions', JSON.stringify(data));
        setPermissions(data);
      } else {
        const defaultPermissions = generateDefaultPermissions();
        setPermissions(defaultPermissions);
      }
    } catch (error: any) {
      console.error('Error al cargar permisos:', error.message);
      const defaultPermissions = generateDefaultPermissions();
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultPermissions = (): Permission[] => {
    const resources = ['products', 'categories', 'warehouses', 'stock', 'suppliers', 'purchase_orders', 'customers', 'invoices', 'returns', 'reports', 'settings', 'users'];
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
      const localRolePermissions = localStorage.getItem('localRolePermissions');
      if (localRolePermissions) {
        const allRolePermissions = JSON.parse(localRolePermissions);
        setRolePermissions(allRolePermissions.filter((rp: RolePermission) => rp.role_id === roleId));
      }
      
      const client = await supabase.getClient();
      const { data, error } = await client.from('role_permissions').select('*').eq('role_id', roleId);
      if (error) throw error;
      
      if (data) {
        const currentLocal = localStorage.getItem('localRolePermissions');
        let allLocal = currentLocal ? JSON.parse(currentLocal) : [];
        allLocal = allLocal.filter((rp: RolePermission) => rp.role_id !== roleId);
        allLocal = [...allLocal, ...data];
        localStorage.setItem('localRolePermissions', JSON.stringify(allLocal));
        setRolePermissions(data);
      } else {
        let defaultRolePermissions: RolePermission[] = [];
        if (roleId === 1) {
          defaultRolePermissions = permissions.map(p => ({ role_id: 1, permission_id: p.id, created_at: new Date().toISOString() }));
        }
        setRolePermissions(defaultRolePermissions);
      }
      setChangedPermissions(new Set());
    } catch (error: any) {
      console.error('Error al cargar permisos del rol:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    if (changedPermissions.size > 0) {
      if (!confirm('Hay cambios sin guardar. ¿Desea continuar y perder estos cambios?')) return;
    }
    setSelectedRole(role);
  };

  const hasPermissionAssigned = (permissionId: number) => {
    return rolePermissions.some(rp => rp.permission_id === permissionId);
  };

  const togglePermission = (permissionId: number) => {
    if (!canEdit) return;
    const key = `${selectedRole?.id}-${permissionId}`;
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
                            <CardHeader className="bg-gray-50 dark:bg-gray-700 pb-2">
                              <CardTitle className="text-lg">{profile.name}</CardTitle>
                              <CardDescription>{profile.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold mb-2">Incluye permisos para:</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                                  {profile.permissions.map((p, idx) => (
                                    <li key={idx} className="capitalize">
                                      {p.resource.replace('_', ' ')} ({p.actions.join(', ')})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <Button 
                                onClick={() => applyPermissionProfile(profile)}
                                className="w-full"
                                variant="secondary"
                                disabled={!canEdit || selectedRole.name === 'admin'}
                              >
                                Aplicar Perfil
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="all">
                      <div className="bg-white rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Recurso</TableHead>
                              <TableHead>Acción</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {permissions.map(permission => (
                              <TableRow key={permission.id}>
                                <TableCell className="font-medium capitalize">{permission.resource.replace('_', ' ')}</TableCell>
                                <TableCell className="capitalize">{permission.action}</TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`table-permission-${permission.id}`}
                                      checked={getEffectivePermissionState(permission.id)}
                                      onCheckedChange={() => togglePermission(permission.id)}
                                      disabled={!canEdit || selectedRole?.name === 'admin'}
                                      className={isPermissionChanged(permission.id) ? 'bg-amber-500 text-white' : ''}
                                    />
                                    <label
                                      htmlFor={`table-permission-${permission.id}`}
                                      className={`text-sm cursor-pointer ${isPermissionChanged(permission.id) ? 'text-amber-600 font-semibold' : ''}`}
                                    >
                                      {getEffectivePermissionState(permission.id) ? 'Permitido' : 'Denegado'}
                                    </label>
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
                  <div className="p-4 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    <p className="flex items-center">
                      <i className="fas fa-info-circle mr-2"></i>
                      El rol de Administrador tiene acceso completo a todos los módulos y recursos del sistema. No es necesario configurar permisos individuales.
                    </p>
                  </div>
                )}
              </>
            )}
            
            <div className="mt-6 flex justify-end">
              <Button
                onClick={saveChanges}
                disabled={changedPermissions.size === 0 || saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
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
          </>
        )}
      </div>
    </div>
  );
};

export default RolePermissions;