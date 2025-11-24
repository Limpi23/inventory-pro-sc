import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Customer } from '../../types';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [customersPerPage] = useState(10);
  const { user } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const roleName = (user.role_name || '').toLowerCase();
    return roleName.includes('admin') || user.role_id === 1;
  }, [user]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error al cargar clientes:', error.message);
      toast.error(`Error al cargar clientes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar clientes basados en el término de búsqueda
  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.identification_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular la paginación
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(filteredCustomers.length / customersPerPage);

  const handleToggleCustomerStatus = async (customer: Customer, activate: boolean) => {
    const verb = activate ? 'activar' : 'eliminar';
    const confirmation = activate
      ? `¿Desea reactivar al cliente ${customer.name}?`
      : `¿Desea eliminar (marcar como inactivo) al cliente ${customer.name}? Los reportes históricos se mantendrán.`;
    if (!confirm(confirmation)) {
      return;
    }

    try {
      const client = await supabase.getClient();
      const { error } = await client
        .from('customers')
        .update({
          is_active: activate,
        })
        .eq('id', customer.id);

      if (error) throw error;

      toast.success(`Cliente ${activate ? 'reactivado' : 'marcado como inactivo'} correctamente`);
      fetchCustomers();
    } catch (error: any) {
      console.error(`Error al ${verb} cliente:`, error.message);
      toast.error(`Error al ${verb} cliente: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Ventas
          </Link>
          <h1 className="text-2xl font-semibold">Gestión de Clientes</h1>
        </div>
        <Link 
          to="/ventas/clientes/nuevo" 
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <i className="fas fa-plus mr-2"></i> Nuevo Cliente
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-medium">Lista de Clientes</h2>
            <div className="mt-3 md:mt-0 relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                className="pl-10 pr-4 py-2 border rounded-md w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : currentCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fas fa-users text-gray-300 text-5xl mb-4"></i>
            <p className="text-gray-500">
              {searchTerm 
                ? 'No se encontraron clientes que coincidan con la búsqueda.'
                : 'No hay clientes registrados. ¡Agrega tu primer cliente!'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificación</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        {customer.contact_name && (
                          <div className="text-sm text-gray-500">{customer.contact_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.identification_type && customer.identification_number && (
                          <div className="text-sm text-gray-900">
                            {customer.identification_type}: {customer.identification_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.email && (
                          <div className="text-sm text-gray-900">{customer.email}</div>
                        )}
                        {customer.phone && (
                          <div className="text-sm text-gray-500">{customer.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.address && (
                          <div className="text-sm text-gray-900">{customer.address}</div>
                        )}
                        {customer.city && (
                          <div className="text-sm text-gray-500">
                            {customer.city}{customer.state ? `, ${customer.state}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          <i className={`fas ${customer.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i>
                          {customer.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 px-2">
                                <i className="fas fa-ellipsis-v mr-2"></i>
                                Acciones
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[200px]">
                              <DropdownMenuItem asChild>
                                <Link
                                  to={`/ventas/clientes/${customer.id}`}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <i className="fas fa-eye text-muted-foreground"></i>
                                  <span>Ver detalle</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  to={`/ventas/clientes/editar/${customer.id}`}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <i className="fas fa-edit text-yellow-600"></i>
                                  <span>Editar</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {customer.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => handleToggleCustomerStatus(customer, false)}
                                  className="text-red-600 focus:text-red-700"
                                >
                                  <i className="fas fa-trash-alt"></i>
                                  <span className="ml-2">Eliminar (inactivar)</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleToggleCustomerStatus(customer, true)}
                                >
                                  <i className="fas fa-undo text-green-600"></i>
                                  <span className="ml-2">Reactivar cliente</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Link
                            to={`/ventas/clientes/${customer.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalle"
                          >
                            <i className="fas fa-eye"></i>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{indexOfFirstCustomer + 1}</span> a{' '}
                    <span className="font-medium">
                      {Math.min(indexOfLastCustomer, filteredCustomers.length)}
                    </span>{' '}
                    de <span className="font-medium">{filteredCustomers.length}</span> clientes
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === 1 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === totalPages 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Customers;