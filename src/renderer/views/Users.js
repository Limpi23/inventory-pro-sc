import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';
import userService from '../lib/userService';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, } from '../components/ui/dropdown-menu';
import authService from '../lib/authService';
const Users = () => {
    const { user: currentUser, hasPermission } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editForm, setEditForm] = useState({
        role_id: '',
        active: true
    });
    const [newUserForm, setNewUserForm] = useState({
        email: '',
        full_name: '',
        password: '',
        role_id: '',
    });
    // Verificar permisos
    const canEdit = hasPermission('users', 'write');
    const canDelete = hasPermission('users', 'delete');
    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await userService.getAllUsers();
            setUsers(data);
        }
        catch (error) {
            console.error('Error al cargar usuarios:', error.message);
            toast.error(`Error al cargar usuarios: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchRoles = async () => {
        try {
            const data = await userService.getAllRoles();
            setRoles(data);
        }
        catch (error) {
            console.error('Error al cargar roles:', error.message);
            toast.error(`Error al cargar roles: ${error.message}`);
        }
    };
    const handleEditUser = (user) => {
        setSelectedUser(user);
        setEditForm({
            role_id: user.role_id.toString(),
            active: user.active
        });
        setIsEditDialogOpen(true);
    };
    const handleUpdateUser = async () => {
        if (!selectedUser)
            return;
        try {
            await userService.updateUser(selectedUser.id, {
                role_id: parseInt(editForm.role_id),
                active: editForm.active
            });
            toast.success('Usuario actualizado correctamente');
            setIsEditDialogOpen(false);
            fetchUsers();
        }
        catch (error) {
            console.error('Error al actualizar usuario:', error.message);
            toast.error(`Error al actualizar usuario: ${error.message}`);
        }
    };
    const handleAddUser = async () => {
        try {
            if (!newUserForm.email || !newUserForm.password || !newUserForm.full_name || !newUserForm.role_id) {
                toast.error('Todos los campos son obligatorios');
                return;
            }
            await userService.createUser({
                email: newUserForm.email,
                password: newUserForm.password,
                full_name: newUserForm.full_name,
                role_id: parseInt(newUserForm.role_id)
            });
            toast.success('Usuario creado correctamente');
            setIsAddDialogOpen(false);
            setNewUserForm({
                email: '',
                full_name: '',
                password: '',
                role_id: '',
            });
            fetchUsers();
        }
        catch (error) {
            const msg = error.message?.toLowerCase() || '';
            if (msg.includes('ya existe en la base de datos') || msg.includes('ya está registrado')) {
                toast('El usuario ya fue creado o ya existe.', { icon: 'ℹ️' });
                setIsAddDialogOpen(false);
                setNewUserForm({
                    email: '',
                    full_name: '',
                    password: '',
                    role_id: '',
                });
                fetchUsers();
            }
            else {
                console.error('Error al crear usuario:', error.message);
                toast.error(`Error al crear usuario: ${error.message}`);
            }
        }
    };
    const handleDeleteUser = async (userId) => {
        if (!confirm('¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            await userService.deleteUser(userId);
            toast.success('Usuario eliminado correctamente');
            fetchUsers();
        }
        catch (error) {
            console.error('Error al eliminar usuario:', error.message);
            toast.error(`Error al eliminar usuario: ${error.message}`);
        }
    };
    const handleSendReset = async (email) => {
        try {
            await authService.requestPasswordReset(email);
            toast.success('Correo de recuperación enviado');
        }
        catch (error) {
            toast.error(error.message || 'No se pudo enviar el correo');
        }
    };
    // Filtrar usuarios por término de búsqueda
    const filteredUsers = users.filter(user => user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.role_name ? user.role_name.toLowerCase().includes(searchTerm.toLowerCase()) : false));
    // Verificar si es el usuario actual
    const isCurrentUser = (userId) => {
        return currentUser?.id === userId;
    };
    return (_jsxs("div", { className: "container mx-auto p-4", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Gesti\u00F3n de Usuarios" }), _jsx("p", { className: "text-muted-foreground", children: "Administre los usuarios de la aplicaci\u00F3n, asigne roles y permisos." })] }), _jsxs("div", { className: "mb-6 flex justify-between items-center", children: [_jsxs("div", { className: "relative w-64", children: [_jsx("i", { className: "fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { type: "text", placeholder: "Buscar usuarios...", className: "pl-10", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), canEdit && (_jsxs(Dialog, { open: isAddDialogOpen, onOpenChange: setIsAddDialogOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nuevo Usuario"] }) }), _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Crear Nuevo Usuario" }), _jsx(DialogDescription, { children: "Ingrese los datos del nuevo usuario para crear una cuenta." })] }), _jsxs("div", { className: "grid gap-4 py-4", children: [_jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "full_name", className: "text-right", children: "Nombre Completo" }), _jsx(Input, { id: "full_name", className: "col-span-3", value: newUserForm.full_name, onChange: (e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value })) })] }), _jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "email", className: "text-right", children: "Email" }), _jsx(Input, { id: "email", type: "email", className: "col-span-3", value: newUserForm.email, onChange: (e) => setNewUserForm(prev => ({ ...prev, email: e.target.value })) })] }), _jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "password", className: "text-right", children: "Contrase\u00F1a" }), _jsx(Input, { id: "password", type: "password", className: "col-span-3", value: newUserForm.password, onChange: (e) => setNewUserForm(prev => ({ ...prev, password: e.target.value })) })] }), _jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "role", className: "text-right", children: "Rol" }), _jsxs(Select, { value: newUserForm.role_id, onValueChange: (value) => setNewUserForm(prev => ({ ...prev, role_id: value })), children: [_jsx(SelectTrigger, { className: "col-span-3", children: _jsx(SelectValue, { placeholder: "Seleccione un rol" }) }), _jsx(SelectContent, { children: roles.map(role => (_jsxs(SelectItem, { value: role.id.toString(), children: [role.name, " - ", role.description] }, role.id))) })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setIsAddDialogOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: handleAddUser, disabled: !newUserForm.email || !newUserForm.full_name || !newUserForm.password || !newUserForm.role_id, children: "Crear Usuario" })] })] })] }))] }), loading ? (_jsx("div", { className: "flex justify-center items-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-primary" }) })) : (_jsx("div", { className: "bg-card rounded-md shadow", children: _jsxs(Table, { children: [_jsx(TableCaption, { children: "Lista de usuarios registrados en el sistema" }), _jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { children: "Email" }), _jsx(TableHead, { children: "Rol" }), _jsx(TableHead, { children: "Estado" }), _jsx(TableHead, { children: "\u00DAltimo Acceso" }), _jsx(TableHead, { children: "Acciones" })] }) }), _jsx(TableBody, { children: filteredUsers.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "text-center py-8", children: "No se encontraron usuarios con la b\u00FAsqueda actual." }) })) : (filteredUsers.map(user => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: user.full_name }), _jsx(TableCell, { children: user.email }), _jsx(TableCell, { children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs ${user.role_name === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`, children: user.role_name }) }), _jsx(TableCell, { children: user.active ? (_jsx("span", { className: "px-2 py-1 rounded-full text-xs bg-green-100 text-green-800", children: "Activo" })) : (_jsx("span", { className: "px-2 py-1 rounded-full text-xs bg-red-100 text-red-800", children: "Inactivo" })) }), _jsx(TableCell, { children: user.last_login ? new Date(user.last_login).toLocaleString() : 'Nunca' }), _jsx(TableCell, { children: (canEdit || canDelete) ? (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-8 px-2", children: [_jsx("i", { className: "fas fa-ellipsis-v mr-2" }), "Acciones"] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "min-w-[180px]", children: [canEdit && (_jsxs(DropdownMenuItem, { onClick: () => handleEditUser(user), children: [_jsx("i", { className: "fas fa-edit text-muted-foreground" }), _jsx("span", { className: "ml-2", children: "Editar" })] })), canEdit && (_jsxs(DropdownMenuItem, { onClick: () => handleSendReset(user.email), children: [_jsx("i", { className: "fas fa-unlock-alt text-muted-foreground" }), _jsx("span", { className: "ml-2", children: "Enviar recuperaci\u00F3n" })] })), canEdit && canDelete && !isCurrentUser(user.id) && (_jsx(DropdownMenuSeparator, {})), canDelete && !isCurrentUser(user.id) && (_jsxs(DropdownMenuItem, { onClick: () => handleDeleteUser(user.id), className: "text-red-600 focus:text-red-700", children: [_jsx("i", { className: "fas fa-trash" }), _jsx("span", { className: "ml-2", children: "Eliminar" })] }))] })] })) : (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) })] }, user.id)))) })] }) })), _jsx(Dialog, { open: isEditDialogOpen, onOpenChange: setIsEditDialogOpen, children: _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Editar Usuario" }), _jsxs(DialogDescription, { children: ["Actualice los datos del usuario ", selectedUser?.full_name] })] }), _jsxs("div", { className: "grid gap-4 py-4", children: [_jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "edit-role", className: "text-right", children: "Rol" }), _jsxs(Select, { value: editForm.role_id, onValueChange: (value) => setEditForm(prev => ({ ...prev, role_id: value })), children: [_jsx(SelectTrigger, { className: "col-span-3", children: _jsx(SelectValue, { placeholder: "Seleccione un rol" }) }), _jsx(SelectContent, { children: roles.map(role => (_jsxs(SelectItem, { value: role.id.toString(), children: [role.name, " - ", role.description] }, role.id))) })] })] }), _jsxs("div", { className: "grid grid-cols-4 items-center gap-4", children: [_jsx(Label, { htmlFor: "active", className: "text-right", children: "Estado" }), _jsxs("div", { className: "flex items-center col-span-3 space-x-2", children: [_jsx(Switch, { id: "active", checked: editForm.active, onCheckedChange: (checked) => setEditForm(prev => ({ ...prev, active: checked })) }), _jsx(Label, { htmlFor: "active", className: "cursor-pointer", children: editForm.active ? 'Activo' : 'Inactivo' })] })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setIsEditDialogOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: handleUpdateUser, children: "Guardar Cambios" })] })] }) })] }));
};
export default Users;
