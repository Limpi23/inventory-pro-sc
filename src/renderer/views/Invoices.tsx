import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Invoice } from '../../types';
import { toast } from 'react-hot-toast';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';

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
      const { data, error } = await supabase
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
      const updatedInvoices = (data || []).map(invoice => {
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
        invoice => invoice.status === 'vencida' && data?.find(i => i.id === invoice.id)?.status !== 'vencida'
      );
      
      if (overdueInvoices.length > 0) {
        for (const invoice of overdueInvoices) {
          await supabase
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
      
  toast.error(`Error al cargar cotizaciones: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceId: string) => {
    try {
      setDrawerLoading(true);
      const { data, error } = await supabase
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
  if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
  // En vez de eliminar, anulamos la cotización
      const { error } = await supabase
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
        <Link 
          to="/ventas/facturas/nueva" 
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <i className="fas fa-plus mr-2"></i> Nueva Cotización
        </Link>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice) => {
                    // Calcular días restantes para cotizaciones emitidas
                    const daysRemaining = invoice.due_date && invoice.status === 'emitida' 
                      ? getDaysRemaining(invoice.due_date)
                      : null;
                    
                    // Determinar si esta cotización está próxima a vencer (menos de 7 días)
                    const isUpcomingDue = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
                    
                    return (
                      <tr 
                        key={invoice.id} 
                        className={`hover:bg-gray-50 ${isUpcomingDue ? 'bg-amber-50' : ''} cursor-pointer`}
                        onClick={() => handleInvoiceRowClick(invoice)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{invoice.invoice_number}</div>
                          <div className="text-sm text-gray-500">Almacén: {invoice.warehouse?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{invoice.customer?.name}</div>
                          {invoice.customer?.identification_number && (
                            <div className="text-sm text-gray-500">ID: {invoice.customer.identification_number}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(invoice.invoice_date)}</div>
                          {invoice.due_date && (
                            <div className={`text-sm ${isUpcomingDue ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                              Vence: {formatDate(invoice.due_date)}
                              {isUpcomingDue && (
                                <span className="ml-1 text-xs font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                  {daysRemaining === 1 ? '¡Mañana!' : `${daysRemaining} días`}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {formatCurrency(invoice.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renderStatusBadge(invoice.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <Link 
                              to={`/ventas/facturas/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-900"
                              title="Ver detalle"
                            >
                              <i className="fas fa-eye"></i>
                            </Link>
                            
                            {invoice.status === 'borrador' && (
                              <Link 
                                to={`/ventas/facturas/editar/${invoice.id}`}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Editar"
                              >
                                <i className="fas fa-edit"></i>
                              </Link>
                            )}
                            
                            {invoice.status !== 'anulada' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteInvoice(invoice.id);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Anular"
                              >
                                <i className="fas fa-ban"></i>
                              </button>
                            )}
                            
                            <Link 
                              to={`/ventas/facturas/${invoice.id}`}
                              className="text-green-600 hover:text-green-900"
                              title="Imprimir"
                            >
                              <i className="fas fa-print"></i>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t">
                <div className="hidden sm:block">
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{indexOfFirstInvoice + 1}</span> a{' '}
                    <span className="font-medium">
                      {Math.min(indexOfLastInvoice, filteredInvoices.length)}
                    </span>{' '}
                    de <span className="font-medium">{filteredInvoices.length}</span> cotizaciones
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

      <div className={`fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-50 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium">Vista Previa de Cotización</h2>
          <button 
            onClick={closeDrawer}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {drawerLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : selectedInvoice ? (
            <div className="space-y-6 print:p-0 print:shadow-none">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div>
                    {settings.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        alt={settings.name || "Logo"} 
                        className="h-16 object-contain mb-4 md:mb-0"
                      />
                    ) : (
                      <h1 className="text-xl font-bold text-gray-800 mb-2">
                        {settings.name || "Empresa"}
                      </h1>
                    )}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-md text-right">
                    <h2 className="text-lg font-bold text-blue-800 mb-1">COTIZACIÓN</h2>
                    <p className="text-md font-semibold text-blue-700">
                      # {selectedInvoice.invoice_number}
                    </p>
                    <div className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedInvoice.status)}`}>
                      {getStatusText(selectedInvoice.status)}
                    </div>
                  </div>
                </div>
                
                <hr className="my-6" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-gray-500 font-medium mb-2">Cliente</h3>
                    <p className="font-semibold">{selectedInvoice.customer?.name}</p>
                    <p>{selectedInvoice.customer?.identification_type}: {selectedInvoice.customer?.identification_number}</p>
                    <p>{selectedInvoice.customer?.address}</p>
                    <p>{selectedInvoice.customer?.phone} | {selectedInvoice.customer?.email}</p>
                  </div>
                  <div>
                    <h3 className="text-gray-500 font-medium mb-2">Información de la Cotización</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="text-gray-600">Fecha de Emisión:</p>
                      <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                      
                      {selectedInvoice.due_date && (
                        <>
                          <p className="text-gray-600">Fecha de Vencimiento:</p>
                          <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                        </>
                      )}
                      
                      <p className="text-gray-600">Almacén:</p>
                      <p className="font-medium">{selectedInvoice.warehouse?.name}</p>
                      
                      {selectedInvoice.payment_method && (
                        <>
                          <p className="text-gray-600">Método de Pago:</p>
                          <p className="font-medium">{selectedInvoice.payment_method}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-medium">Detalle de Productos</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impuesto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoiceItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-sm text-gray-500">SKU: {item.product?.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.tax_amount)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex justify-end">
                  <div className="w-full md:w-64">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatCurrency(selectedInvoice.subtotal ?? 0)}</span>
                    </div>
                    {(selectedInvoice.discount_amount ?? 0) > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Descuento:</span>
                        <span>-{formatCurrency(selectedInvoice.discount_amount ?? 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Impuestos:</span>
                      <span>{formatCurrency(selectedInvoice.tax_amount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold text-lg border-t border-gray-200 mt-2 pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedInvoice.notes && (
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                  <h3 className="font-medium mb-2">Notas</h3>
                  <p className="text-gray-700">{selectedInvoice.notes}</p>
                </div>
              )}
              
              <div className="text-center text-gray-500 text-sm mt-8">
                <p>
                  {settings.name ? `${settings.name} - ` : ''}
                  {settings.taxId ? `NIT: ${settings.taxId}` : ''}
                </p>
                <p>{settings.address}</p>
                <p>
                  {settings.phone && `Tel: ${settings.phone}`}
                  {settings.email && settings.phone && ' | '}
                  {settings.email && `Email: ${settings.email}`}
                </p>
                {settings.footerText && <p className="mt-2">{settings.footerText}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <i className="fas fa-file-invoice text-6xl mb-4"></i>
              <p>Seleccione una cotización para ver su detalle</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between">
            <Link 
              to={selectedInvoice ? `/ventas/facturas/${selectedInvoice.id}` : '#'}
              className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${!selectedInvoice ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={(e) => !selectedInvoice && e.preventDefault()}
            >
              <i className="fas fa-external-link-alt mr-2"></i> Ver Completo
            </Link>
            <button 
              onClick={closeDrawer}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeDrawer}
        ></div>
      )}
    </div>
  );
};

export default Invoices; 