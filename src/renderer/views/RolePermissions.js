import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
const RolePermissions = () => {
    const { hasPermission } = useAuth();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [rolePermissions, setRolePermissions] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changedPermissions, setChangedPermissions] = useState(new Set());
    const [activeTab, setActiveTab] = useState("modules");
    // Verificar permiso de escritura
    const canEdit = hasPermission('users', 'write');
    // Definición de módulos del sistema
    const modules = [
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
    const permissionProfiles = [
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
            if (error)
                throw error;
            setRoles(data || []);
            // Seleccionar automáticamente el primer rol
            if (data && data.length > 0) {
                setSelectedRole(data[0]);
            }
        }
        catch (error) {
            console.error('Error al cargar roles:', error.message);
            toast.error(`Error al cargar roles: ${error.message}`);
            // Crear roles predeterminados en caso de error
            const defaultRoles = [
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
            if (error)
                throw error;
            if (data && data.length > 0) {
                localStorage.setItem('localPermissions', JSON.stringify(data));
                setPermissions(data);
            }
            else {
                // Si no hay datos, crear permisos predeterminados
                const defaultPermissions = generateDefaultPermissions();
                localStorage.setItem('localPermissions', JSON.stringify(defaultPermissions));
                setPermissions(defaultPermissions);
            }
        }
        catch (error) {
            console.error('Error al cargar permisos:', error.message);
            toast.error(`Error al cargar permisos: ${error.message}`);
            // Crear permisos predeterminados en caso de error
            const defaultPermissions = generateDefaultPermissions();
            localStorage.setItem('localPermissions', JSON.stringify(defaultPermissions));
            setPermissions(defaultPermissions);
        }
        finally {
            setLoading(false);
        }
    };
    const generateDefaultPermissions = () => {
        // Generar permisos predeterminados para todos los recursos
        const resources = [
            'products', 'categories', 'warehouses', 'stock',
            'suppliers', 'purchase_orders',
            'customers', 'invoices', 'returns',
            'reports', 'settings', 'users'
        ];
        const actions = ['view', 'create', 'edit', 'delete'];
        let permissionId = 1;
        const permissions = [];
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
    const fetchRolePermissions = async (roleId) => {
        try {
            setLoading(true);
            // Intentar cargar de localStorage primero
            const localRolePermissions = localStorage.getItem('localRolePermissions');
            if (localRolePermissions) {
                const allRolePermissions = JSON.parse(localRolePermissions);
                const filteredPermissions = allRolePermissions.filter((rp) => rp.role_id === roleId);
                setRolePermissions(filteredPermissions);
                setChangedPermissions(new Set()); // Reiniciar cambios
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('role_permissions')
                .select('*')
                .eq('role_id', roleId);
            if (error)
                throw error;
            if (data) {
                // Si hay datos en Supabase, guardarlos en localStorage
                localStorage.setItem('localRolePermissions', JSON.stringify(data));
                setRolePermissions(data);
            }
            else {
                // Si no hay datos, inicializar un array vacío (excepto para admin)
                let defaultRolePermissions = [];
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
        }
        catch (error) {
            console.error('Error al cargar permisos del rol:', error.message);
            toast.error(`Error al cargar permisos del rol: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const handleRoleSelect = (role) => {
        // Preguntar si hay cambios sin guardar
        if (changedPermissions.size > 0) {
            if (!confirm('Hay cambios sin guardar. ¿Desea continuar y perder estos cambios?')) {
                return;
            }
        }
        setSelectedRole(role);
    };
    const hasPermissionAssigned = (permissionId) => {
        return rolePermissions.some(rp => rp.permission_id === permissionId);
    };
    const togglePermission = (permissionId) => {
        if (!canEdit)
            return;
        const key = `${selectedRole?.id}-${permissionId}`;
        // Actualizar el conjunto de cambios
        const newChangedPermissions = new Set(changedPermissions);
        if (newChangedPermissions.has(key)) {
            newChangedPermissions.delete(key);
        }
        else {
            newChangedPermissions.add(key);
        }
        setChangedPermissions(newChangedPermissions);
    };
    const isPermissionChanged = (permissionId) => {
        const key = `${selectedRole?.id}-${permissionId}`;
        return changedPermissions.has(key);
    };
    const getEffectivePermissionState = (permissionId) => {
        const isAssigned = hasPermissionAssigned(permissionId);
        const isChanged = isPermissionChanged(permissionId);
        return isChanged ? !isAssigned : isAssigned;
    };
    const saveChanges = async () => {
        if (!selectedRole)
            return;
        try {
            setSaving(true);
            // Cargar todos los role_permissions actuales
            const localRolePermissions = localStorage.getItem('localRolePermissions');
            let allRolePermissions = localRolePermissions
                ? JSON.parse(localRolePermissions)
                : [];
            // Procesar cada cambio
            for (const key of changedPermissions) {
                const [roleId, permissionId] = key.split('-').map(Number);
                const isCurrentlyAssigned = rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === Number(permissionId));
                if (isCurrentlyAssigned) {
                    // Eliminar permiso
                    allRolePermissions = allRolePermissions.filter(rp => !(rp.role_id === roleId && rp.permission_id === Number(permissionId)));
                }
                else {
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
        }
        catch (error) {
            console.error('Error al guardar permisos:', error.message);
            toast.error(`Error al guardar permisos: ${error.message}`);
        }
        finally {
            setSaving(false);
        }
    };
    // Aplicar un perfil predefinido de permisos
    const applyPermissionProfile = (profile) => {
        if (!selectedRole || !canEdit || selectedRole.name === 'admin')
            return;
        if (!confirm(`¿Está seguro de aplicar el perfil "${profile.name}" a este rol? Esto sobrescribirá los permisos actuales.`)) {
            return;
        }
        try {
            // Limpiar permisos actuales
            const newChangedPermissions = new Set();
            // Para cada permiso existente, verificar si debe ser retirado
            rolePermissions.forEach(rp => {
                const permission = permissions.find(p => p.id === rp.permission_id);
                if (permission) {
                    const shouldHavePermission = profile.permissions.some(pp => pp.resource === permission.resource && pp.actions.includes(permission.action));
                    // Si no debe tener el permiso pero lo tiene, añadirlo al conjunto de cambios
                    if (!shouldHavePermission) {
                        newChangedPermissions.add(`${selectedRole.id}-${permission.id}`);
                    }
                }
            });
            // Para cada permiso en el perfil, verificar si debe ser agregado
            profile.permissions.forEach(profilePermission => {
                profilePermission.actions.forEach(action => {
                    const permission = permissions.find(p => p.resource === profilePermission.resource && p.action === action);
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
        }
        catch (error) {
            console.error('Error al aplicar perfil de permisos:', error.message);
            toast.error(`Error al aplicar perfil: ${error.message}`);
        }
    };
    // Agrupar permisos por recurso
    const groupPermissionsByResource = () => {
        const grouped = {};
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
    const getPermissionsForModule = (moduleId) => {
        const module = modules.find(m => m.id === moduleId);
        if (!module)
            return _jsx(_Fragment, {});
        return (_jsx("div", { className: "space-y-6", children: module.resources.map(resource => {
                const resourcePermissions = groupedPermissions[resource];
                if (!resourcePermissions || resourcePermissions.length === 0)
                    return null;
                return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-2", children: [_jsx(CardTitle, { className: "text-md capitalize", children: resource.replace('_', ' ') }), _jsxs(CardDescription, { children: ["Permisos para ", resource.replace('_', ' ')] })] }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-6", children: resourcePermissions.map(permission => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: `permission-${permission.id}`, checked: getEffectivePermissionState(permission.id), onCheckedChange: () => togglePermission(permission.id), disabled: !canEdit || selectedRole?.name === 'admin', className: isPermissionChanged(permission.id) ? 'bg-amber-500 text-white' : '' }), _jsx("label", { htmlFor: `permission-${permission.id}`, className: `text-sm cursor-pointer capitalize ${isPermissionChanged(permission.id) ? 'text-amber-600 font-semibold' : ''}`, children: permission.action })] }, permission.id))) }) })] }, resource));
            }) }));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsx("h1", { className: "text-2xl font-semibold", children: "Gesti\u00F3n de Permisos por Rol" }) }), _jsxs("div", { className: "p-6 bg-white rounded-lg shadow-md dark:bg-gray-800", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-medium mb-3", children: "Seleccione un Rol:" }), _jsx("div", { className: "flex space-x-4", children: roles.map(role => (_jsx(Button, { variant: selectedRole?.id === role.id ? "default" : "outline", onClick: () => handleRoleSelect(role), disabled: loading, children: role.name }, role.id))) })] }), selectedRole && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-6", children: [_jsxs("h2", { className: "text-lg font-medium", children: ["Permisos para el rol: ", _jsx("span", { className: "text-primary", children: selectedRole.name })] }), _jsx("p", { className: "text-muted-foreground text-sm", children: selectedRole.description })] }), changedPermissions.size > 0 && (_jsx("div", { className: "mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 dark:bg-amber-900 dark:border-amber-800 dark:text-amber-200", children: _jsxs("p", { className: "flex items-center", children: [_jsx("i", { className: "fas fa-exclamation-triangle mr-2" }), "Hay ", changedPermissions.size, " cambios sin guardar"] }) })), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs(_Fragment, { children: [selectedRole.name !== 'admin' && (_jsxs(Tabs, { defaultValue: "modules", value: activeTab, onValueChange: setActiveTab, className: "mb-6", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "modules", children: "Por M\u00F3dulos" }), _jsx(TabsTrigger, { value: "profiles", children: "Perfiles Predefinidos" }), _jsx(TabsTrigger, { value: "all", children: "Todos los Permisos" })] }), _jsx(TabsContent, { value: "modules", children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mt-4", children: modules.map(module => (_jsxs(Card, { className: "overflow-hidden", children: [_jsx(CardHeader, { className: "bg-gray-50 dark:bg-gray-700 pb-2", children: _jsxs(CardTitle, { className: "flex items-center text-lg", children: [_jsx("i", { className: `fas fa-${module.icon} mr-2 text-primary` }), module.name] }) }), _jsx(CardContent, { className: "p-4", children: getPermissionsForModule(module.id) })] }, module.id))) }) }), _jsx(TabsContent, { value: "profiles", children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mt-4", children: permissionProfiles.map(profile => (_jsxs(Card, { className: "overflow-hidden", children: [_jsxs(CardHeader, { className: "pb-2", children: [_jsx(CardTitle, { children: profile.name }), _jsx(CardDescription, { children: profile.description })] }), _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "text-sm space-y-2 mb-4", children: [_jsx("p", { className: "font-medium", children: "Incluye permisos para:" }), _jsx("ul", { className: "list-disc list-inside pl-2 space-y-1", children: profile.permissions.map(permission => (_jsxs("li", { className: "capitalize", children: [permission.resource.replace('_', ' '), ": ", permission.actions.join(', ')] }, `${profile.id}-${permission.resource}`))) })] }), _jsx(Button, { onClick: () => applyPermissionProfile(profile), disabled: !canEdit || selectedRole.name === 'admin', className: "w-full", children: "Aplicar perfil" })] })] }, profile.id))) }) }), _jsx(TabsContent, { value: "all", children: _jsx("div", { className: "overflow-x-auto mt-4", children: _jsxs(Table, { children: [_jsx(TableCaption, { children: "Permisos disponibles en el sistema" }), _jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-[300px]", children: "Recurso" }), _jsx(TableHead, { children: "Permisos" })] }) }), _jsx(TableBody, { children: Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium capitalize", children: resource.replace('_', ' ') }), _jsx(TableCell, { children: _jsx("div", { className: "flex flex-wrap gap-6", children: resourcePermissions.map(permission => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: `all-permission-${permission.id}`, checked: getEffectivePermissionState(permission.id), onCheckedChange: () => togglePermission(permission.id), disabled: !canEdit || selectedRole.name === 'admin', className: isPermissionChanged(permission.id) ? 'bg-amber-500 text-white' : '' }), _jsx("label", { htmlFor: `all-permission-${permission.id}`, className: `text-sm cursor-pointer capitalize ${isPermissionChanged(permission.id) ? 'text-amber-600 font-semibold' : ''}`, children: permission.action })] }, permission.id))) }) })] }, resource))) })] }) }) })] })), selectedRole.name === 'admin' && (_jsx("div", { className: "bg-blue-50 text-blue-800 p-4 rounded-md mb-6 dark:bg-blue-900 dark:text-blue-200", children: _jsxs("p", { className: "flex items-center", children: [_jsx("i", { className: "fas fa-info-circle mr-2" }), "El rol de Administrador tiene todos los permisos por defecto y no puede ser modificado."] }) })), canEdit && selectedRole.name !== 'admin' && (_jsx("div", { className: "mt-6 flex justify-end", children: _jsx(Button, { onClick: saveChanges, disabled: changedPermissions.size === 0 || saving, className: "bg-green-500 hover:bg-green-600", children: saving ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner animate-spin mr-2" }), "Guardando..."] })) : (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-save mr-2" }), "Guardar Cambios"] })) }) }))] }))] }))] })] }));
};
export default RolePermissions;
