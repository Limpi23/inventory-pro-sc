import React, { useState, useEffect } from 'react';
import { User, Role } from '../../types';
import { useAuth } from '../lib/auth';
import { toast } from 'react-hot-toast';
import userService from '../lib/userService';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

const Users: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
    } catch (error: any) {
      console.error('Error al cargar usuarios:', error.message);
      toast.error(`Error al cargar usuarios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await userService.getAllRoles();
      setRoles(data);
    } catch (error: any) {
      console.error('Error al cargar roles:', error.message);
      toast.error(`Error al cargar roles: ${error.message}`);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      role_id: user.role_id.toString(),
      active: user.active
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await userService.updateUser(selectedUser.id, {
        role_id: parseInt(editForm.role_id),
        active: editForm.active
      });
      
      toast.success('Usuario actualizado correctamente');
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
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
    } catch (error: any) {
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
      } else {
        console.error('Error al crear usuario:', error.message);
        toast.error(`Error al crear usuario: ${error.message}`);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      toast.success('Usuario eliminado correctamente');
      fetchUsers();
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error.message);
      toast.error(`Error al eliminar usuario: ${error.message}`);
    }
  };

  // Filtrar usuarios por término de búsqueda
  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role_name ? user.role_name.toLowerCase().includes(searchTerm.toLowerCase()) : false)
  );

  // Verificar si es el usuario actual
  const isCurrentUser = (userId: string) => {
    return currentUser?.id === userId;
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>
        <p className="text-muted-foreground">
          Administre los usuarios de la aplicación, asigne roles y permisos.
        </p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="relative w-64">
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
          <Input
            type="text"
            placeholder="Buscar usuarios..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <i className="fas fa-plus mr-2"></i>
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Ingrese los datos del nuevo usuario para crear una cuenta.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="full_name" className="text-right">
                    Nombre Completo
                  </Label>
                  <Input
                    id="full_name"
                    className="col-span-3"
                    value={newUserForm.full_name}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className="col-span-3"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    className="col-span-3"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">
                    Rol
                  </Label>
                  <Select
                    value={newUserForm.role_id}
                    onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role_id: value }))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name} - {role.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddUser} 
                  disabled={!newUserForm.email || !newUserForm.full_name || !newUserForm.password || !newUserForm.role_id}
                >
                  Crear Usuario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-card rounded-md shadow">
          <Table>
            <TableCaption>Lista de usuarios registrados en el sistema</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No se encontraron usuarios con la búsqueda actual.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.role_name === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {user.role_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.active ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                          Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUser(user)}
                            title="Editar usuario"
                          >
                            <i className="fas fa-edit text-muted-foreground"></i>
                          </Button>
                        )}
                        {canDelete && !isCurrentUser(user.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Eliminar usuario"
                          >
                            <i className="fas fa-trash text-red-500"></i>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Diálogo de edición de usuario */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Actualice los datos del usuario {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                Rol
              </Label>
              <Select
                value={editForm.role_id}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, role_id: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name} - {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="active" className="text-right">
                Estado
              </Label>
              <div className="flex items-center col-span-3 space-x-2">
                <Switch
                  id="active"
                  checked={editForm.active}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  {editForm.active ? 'Activo' : 'Inactivo'}
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users; 