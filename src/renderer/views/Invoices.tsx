import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Invoice } from '../../types';
import { toast } from 'react-hot-toast';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [invoicesPerPage] = useState(10);
  const [upcomingDueInvoices, setUpcomingDueInvoices] = useState<Invoice[]>([]);
  const [showUpcomingAlert, setShowUpcomingAlert] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const { settings } = useCompanySettings();
  const currency = useCurrency();
  const { hasPermission, user } = useAuth();

  const canViewInvoices = hasPermission('invoices', 'view');
  const canCreateInvoices = hasPermission('invoices', 'create');
  const canEditInvoices = hasPermission('invoices', 'edit');
  const canDeleteInvoices = hasPermission('invoices', 'delete');
  const roleName = (user?.role_name || '').toLowerCase();
  const isAdmin = roleName.includes('admin') || user?.role_id === 1;
  const hasActionPermissions = isAdmin && (canViewInvoices || canEditInvoices || canDeleteInvoices);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoice) {
      fetchInvoiceItems(selectedInvoice.id);
    }
  }, [selectedInvoice]);

  useEffect(() => {
    // Detectar cotizaciones próximas a vencer (en los próximos 7 días)
    const checkUpcomingDueInvoices = () => {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const upcoming = invoices.filter(invoice => {
        if (invoice.status !== 'emitida' || !invoice.due_date) return false;
        
        const dueDate = new Date(invoice.due_date);
        return dueDate > today && dueDate <= nextWeek;
      });
      
      setUpcomingDueInvoices(upcoming);
    };
    
    checkUpcomingDueInvoices();
  }, [invoices]);
  
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, identification_number),
          warehouse:warehouses(id, name)
        `)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      
      // Actualizar el estado de cotizaciones vencidas
      const today = new Date();
      const updatedInvoices = (data || []).map((invoice: any) => {
        if (invoice.status === 'emitida' && invoice.due_date) {
          const dueDate = new Date(invoice.due_date);
          if (dueDate < today) {
            return { ...invoice, status: 'vencida' };
          }
        }
        return invoice;
      });
      
      // Actualizar cotizaciones vencidas en la base de datos
      const overdueInvoices = updatedInvoices.filter(
        (invoice: any) => invoice.status === 'vencida' && data?.find((i: any) => i.id === invoice.id)?.status !== 'vencida'
      );
      
      if (overdueInvoices.length > 0) {
        for (const invoice of overdueInvoices) {
          await client
            .from('invoices')
            .update({ 
              status: 'vencida',
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
        }
        
        if (overdueInvoices.length === 1) {
          toast.error(`La cotización ${overdueInvoices[0].invoice_number} ha vencido`);
        } else {
          toast.error(`${overdueInvoices.length} cotizaciones han vencido`);
        }
      }
      
      setInvoices(updatedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast.error(`Error al cargar cotizaciones: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceId: string) => {
    try {
      setDrawerLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('invoice_items')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('invoice_id', invoiceId);

      if (error) throw error;
      setInvoiceItems(data || []);
    } catch (error: any) {
      console.error('Error al cargar items de cotización:', error.message);
      toast.error(`Error al cargar detalles de cotización: ${error.message}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleInvoiceRowClick = (invoice: Invoice) => {
    if (!canViewInvoices) return;
    setSelectedInvoice(invoice);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setSelectedInvoice(null);
      setInvoiceItems([]);
    }, 300);
  };

  // Filtrar facturas basadas en el término de búsqueda y filtro de estado
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = (
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.identification_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calcular la paginación
  const indexOfLastInvoice = currentPage * invoicesPerPage;
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
  const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);

  const handleDeleteInvoice = async (id: string) => {
    if (!isAdmin || !canDeleteInvoices) {
      toast.error('No tienes permiso para anular cotizaciones.');
      return;
    }

    if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const client = await supabase.getClient();
      // En vez de eliminar, anulamos la cotización
      const { error } = await client
        .from('invoices')
        .update({ 
          status: 'anulada',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Cotización anulada correctamente');
      fetchInvoices();
    } catch (error: any) {
      console.error('Error al anular cotización:', error.message);
      toast.error(`Error al anular cotización: ${error.message}`);
    }
  };

  // Calcular los días restantes hasta la fecha de vencimiento
  const getDaysRemaining = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Formateo centralizado
  const formatCurrency = (amount: number) => currency.format(amount);
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(currency.settings.locale, options);
  };

  // Renderizar el badge de estado
  const renderStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string, icon: string, text: string } } = {
      'borrador': { color: 'bg-gray-100 text-gray-800', icon: 'fa-pencil', text: 'Borrador' },
      'emitida': { color: 'bg-blue-100 text-blue-800', icon: 'fa-paper-plane', text: 'Emitida' },
      'pagada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Pagada' },
      'vencida': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-exclamation-circle', text: 'Vencida' },
      'anulada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Anulada' }
    };
    
    const config = statusConfig[status] || statusConfig.borrador;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <i className={`fas ${config.icon} mr-1`}></i>
        {config.text}
      </span>
    );
  };

  // Nueva función para obtener la clase del badge según el estado
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'borrador':
        return 'bg-gray-100 text-gray-800';
      case 'emitida':
        return 'bg-blue-100 text-blue-800';
      case 'pagada':
        return 'bg-green-100 text-green-800';
      case 'vencida':
        return 'bg-yellow-100 text-yellow-800';
      case 'anulada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Nueva función para obtener el texto del estado
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'borrador': 'Borrador',
      'emitida': 'Emitida',
      'pagada': 'Pagada',
      'vencida': 'Vencida',
      'anulada': 'Anulada'
    };
    
    return statusMap[status] || 'Desconocido';
  };

  // Filtro rápido para mostrar solo cotizaciones próximas a vencer
  const filterUpcomingDue = () => {
    setStatusFilter('emitida');
    const upcomingIds = upcomingDueInvoices.map(invoice => invoice.invoice_number);
    setSearchTerm(upcomingIds.length > 0 ? upcomingIds[0] ?? '' : '');
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Ventas
          </Link>
          <h1 className="text-2xl font-semibold">Gestión de Cotizaciones</h1>
        </div>
        {canCreateInvoices && (
          <Link 
            to="/ventas/facturas/nueva" 
            className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <i className="fas fa-plus mr-2"></i> Nueva Cotización
          </Link>
        )}
      </div>

      {upcomingDueInvoices.length > 0 && showUpcomingAlert && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md flex justify-between items-center">
          <div className="flex items-center">
            <i className="fas fa-exclamation-triangle text-amber-500 mr-3 text-lg"></i>
            <div>
              <h3 className="font-semibold text-amber-800">Cotizaciones próximas a vencer</h3>
              <p className="text-amber-700">
                {upcomingDueInvoices.length === 1 
                  ? `Hay 1 cotización que vencerá en los próximos 7 días` 
                  : `Hay ${upcomingDueInvoices.length} cotizaciones que vencerán en los próximos 7 días`
                }
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={filterUpcomingDue}
              className="px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-sm"
            >
              Ver cotizaciones
            </button>
            <button 
              onClick={() => setShowUpcomingAlert(false)}
              className="text-amber-500 hover:text-amber-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-medium">Lista de Cotizaciones</h2>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                >
                  <option value="all">Todos los estados</option>
                  <option value="borrador">Borrador</option>
                  <option value="emitida">Emitida</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                  <option value="anulada">Anulada</option>
                </select>
                <i className="fas fa-filter absolute left-3 top-3 text-gray-400"></i>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar cotización..."
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : currentInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fas fa-file-invoice text-gray-300 text-5xl mb-4"></i>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'No se encontraron cotizaciones que coincidan con la búsqueda.'
                : 'No hay cotizaciones registradas. ¡Crea tu primera cotización!'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cotización</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    {hasActionPermissions && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice) => (
                    <tr 
                      key={invoice.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleInvoiceRowClick(invoice)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-blue-600">{invoice.invoice_number}</div>
                        {invoice.due_date && (
                          <div className={`text-xs ${getDaysRemaining(invoice.due_date) < 3 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                            Vence: {formatDate(invoice.due_date)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{invoice.customer?.name}</div>
                        <div className="text-xs text-gray-500">{invoice.customer?.identification_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(invoice.status)}
                      </td>
                      {hasActionPermissions && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menú</span>
                                <i className="fas fa-ellipsis-v"></i>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canViewInvoices && (
                                <DropdownMenuItem onClick={() => handleInvoiceRowClick(invoice)}>
                                  <i className="fas fa-eye mr-2"></i> Ver detalles
                                </DropdownMenuItem>
                              )}
                              {canEditInvoices && invoice.status === 'borrador' && (
                                <DropdownMenuItem asChild>
                                  <Link to={`/ventas/facturas/editar/${invoice.id}`}>
                                    <i className="fas fa-edit mr-2"></i> Editar
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {canDeleteInvoices && invoice.status !== 'anulada' && invoice.status !== 'pagada' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                    className="text-red-600"
                                  >
                                    <i className="fas fa-times-circle mr-2"></i> Anular
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mostrando {indexOfFirstInvoice + 1} a {Math.min(indexOfLastInvoice, filteredInvoices.length)} de {filteredInvoices.length} cotizaciones
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
                  >
                    Anterior
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer de detalles */}
      {isDrawerOpen && selectedInvoice && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeDrawer}></div>
            <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="w-screen max-w-md transform transition-all ease-in-out duration-500 sm:duration-700 bg-white shadow-xl flex flex-col">
                <div className="flex-1 flex flex-col overflow-y-auto">
                  <div className="py-6 px-4 bg-blue-600 sm:px-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-white">
                        Cotización #{selectedInvoice.invoice_number}
                      </h2>
                      <div className="ml-3 h-7 flex items-center">
                        <button
                          type="button"
                          className="bg-blue-600 rounded-md text-blue-200 hover:text-white focus:outline-none"
                          onClick={closeDrawer}
                        >
                          <span className="sr-only">Cerrar panel</span>
                          <i className="fas fa-times text-xl"></i>
                        </button>
                      </div>
                    </div>
                    <div className="mt-1">
                      <p className="text-sm text-blue-100">
                        {formatDate(selectedInvoice.invoice_date)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-1 py-6 px-4 sm:px-6">
                    <div className="flex flex-col space-y-6">
                      {/* Estado */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Estado</h3>
                        <div className="mt-1">
                          {renderStatusBadge(selectedInvoice.status)}
                        </div>
                      </div>
                      
                      {/* Cliente */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Cliente</h3>
                        <div className="mt-1 text-sm text-gray-900 font-medium">
                          {selectedInvoice.customer?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedInvoice.customer?.identification_number}
                        </div>
                      </div>
                      
                      {/* Almacén */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Almacén</h3>
                        <div className="mt-1 text-sm text-gray-900">
                          {selectedInvoice.warehouse?.name || 'No especificado'}
                        </div>
                      </div>
                      
                      {/* Items */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Productos</h3>
                        {drawerLoading ? (
                          <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                          </div>
                        ) : (
                          <div className="border rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prod</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {invoiceItems.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 text-sm text-gray-900">
                                      <div className="truncate w-32">{item.product?.name}</div>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-500 text-right">{item.quantity}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                      {formatCurrency(item.total_price)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50">
                                <tr>
                                  <td colSpan={2} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">Total:</td>
                                  <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                                    {formatCurrency(selectedInvoice.total_amount)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                      
                      {/* Notas */}
                      {selectedInvoice.notes && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Notas</h3>
                          <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                            {selectedInvoice.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 px-4 py-4 flex justify-end space-x-2 bg-gray-50 border-t">
                  <Link
                    to={`/ventas/facturas/${selectedInvoice.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Ver Detalle Completo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;