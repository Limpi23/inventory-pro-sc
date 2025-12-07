import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { getLocalDateISOString } from '../lib/dateUtils';

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  supplier_name: string;
  warehouse_name: string;
  items_count: number;
  created_at: string;
}

interface PurchaseOrderPreview extends PurchaseOrder {
  supplier?: {
    id?: string;
    name?: string;
    contact_info?: {
      contact_name?: string;
      phone?: string;
      email?: string;
      address?: string;
    };
  } | null;
  warehouse?: {
    id?: string;
    name?: string;
    location?: string;
  } | null;
  notes?: string | null;
  updated_at?: string;
}

interface PurchaseOrderItemPreview {
  id: string;
  product_id: string;
  quantity: number;
  received_quantity?: number | null;
  unit_price: number;
  total_price: number;
  product?: {
    name?: string;
    sku?: string;
  } | null;
}

const PurchaseOrders: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
    start: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return getLocalDateISOString(d);
    })(),
    end: getLocalDateISOString()
  });
  const currency = useCurrency();
  const { hasPermission, user } = useAuth();

  const [selectedOrderSummary, setSelectedOrderSummary] = useState<PurchaseOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderPreview | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItemPreview[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const canViewOrders = hasPermission('purchase_orders', 'view');
  const canEditOrders = hasPermission('purchase_orders', 'edit');
  const roleName = (user?.role_name || '').toLowerCase();
  const isAdmin = roleName.includes('admin') || user?.role_id === 1;
  const canManageOrders = isAdmin || canEditOrders;
  const showActionsColumn = canViewOrders;

  useEffect(() => {
    if (!canViewOrders) {
      setIsLoading(false);
      return;
    }
    fetchOrders();
  }, [dateRange, statusFilter, canViewOrders]);

  const fetchOrders = async () => {
    if (!canViewOrders) return;

    try {
      setIsLoading(true);

      const client = await supabase.getClient();
      let query = client.from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          warehouse:warehouses(name),
          items:purchase_order_items(count)
        `)
        .gte('order_date', dateRange.start)
        .lte('order_date', dateRange.end)
        .order('order_date', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedOrders = (data || []).map((order: any) => ({
        id: order.id,
        order_date: order.order_date,
        status: order.status,
        total_amount: order.total_amount || 0,
        supplier_name: order.supplier?.name || 'Desconocido',
        warehouse_name: order.warehouse?.name || 'Desconocido',
        items_count: order.items?.length || 0,
        created_at: order.created_at
      }));

      setOrders(formattedOrders);

    } catch (err: any) {
      console.error('Error cargando órdenes de compra:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDateRange({
      start: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return getLocalDateISOString(d);
      })(),
      end: getLocalDateISOString()
    });
    setCurrentPage(1);
  };

  const handleOrderRowClick = (order: PurchaseOrder) => {
    if (!canViewOrders) return;
    setSelectedOrderSummary(order);
    setSelectedOrder(null);
    setOrderItems([]);
    setDrawerError(null);
    setIsDrawerOpen(true);
    fetchOrderPreview(order.id, order);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      setSelectedOrderSummary(null);
      setSelectedOrder(null);
      setOrderItems([]);
      setDrawerError(null);
    }, 250);
  };

  const fetchOrderPreview = async (orderId: string, summary?: PurchaseOrder) => {
    try {
      setDrawerLoading(true);
      setDrawerError(null);
      const client = await supabase.getClient();

      const { data: orderData, error: orderError } = await client
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name, contact_info),
          warehouse:warehouses(id, name, location)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await client
        .from('purchase_order_items')
        .select(`
          id,
          product_id,
          quantity,
          received_quantity,
          unit_price,
          total_price,
          product:products(name, sku)
        `)
        .eq('purchase_order_id', orderId);

      if (itemsError) throw itemsError;

      const baseSummary = summary || selectedOrderSummary;

      const normalizedOrder: PurchaseOrderPreview = {
        id: (orderData as any).id,
        order_date: (orderData as any).order_date,
        status: (orderData as any).status,
        total_amount: (orderData as any).total_amount ?? 0,
        supplier_name:
          (orderData as any)?.supplier?.name || baseSummary?.supplier_name || 'Desconocido',
        warehouse_name:
          (orderData as any)?.warehouse?.name || baseSummary?.warehouse_name || 'Desconocido',
        items_count: baseSummary?.items_count ?? (itemsData?.length ?? 0),
        created_at: (orderData as any).created_at,
        supplier: (orderData as any)?.supplier || null,
        warehouse: (orderData as any)?.warehouse || null,
        notes: (orderData as any)?.notes || null,
        updated_at: (orderData as any)?.updated_at || (orderData as any)?.created_at,
      };

      setSelectedOrder(normalizedOrder);
      setOrderItems((itemsData || []) as unknown as PurchaseOrderItemPreview[]);
    } catch (err: any) {
      console.error('Error al cargar vista previa de orden:', err);
      setDrawerError(err.message || 'No se pudo cargar la orden seleccionada');
      toast.error(`Error al cargar la orden: ${err.message || err}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!canManageOrders) {
      toast.error('No tienes permiso para cancelar órdenes de compra.');
      return;
    }

    const confirmed = confirm('¿Está seguro que desea cancelar esta orden de compra? Esta acción no se puede deshacer.');
    if (!confirmed) {
      return;
    }

    try {
      const client = await supabase.getClient();
      const { error: updateError } = await client
        .from('purchase_orders')
        .update({ status: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast.success('Orden cancelada correctamente');
      fetchOrders();
      if (selectedOrderSummary?.id === orderId) {
        fetchOrderPreview(orderId, selectedOrderSummary);
      }
    } catch (err: any) {
      console.error('Error al cancelar orden:', err);
      toast.error(`Error al cancelar orden: ${err.message || err}`);
    }
  };

  // Filtrar órdenes por término de búsqueda
  const filteredOrders = orders.filter(order =>
    order.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Cambiar de página
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Formatear moneda
  const formatCurrency = (amount: number) => currency.format(amount);

  const formatDateLong = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(currency.settings.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Formatear estado con colores
  const getStatusBadge = (status: string) => {
    let colorClass = '';
    let icon = '';

    switch (status.toLowerCase()) {
      case 'draft':
      case 'borrador':
        colorClass = 'bg-gray-100 text-gray-800';
        icon = 'fas fa-pencil-alt';
        break;
      case 'sent':
      case 'enviada':
        colorClass = 'bg-blue-100 text-blue-800';
        icon = 'fas fa-paper-plane';
        break;
      case 'partially_received':
      case 'recibida_parcialmente':
        colorClass = 'bg-yellow-100 text-yellow-800';
        icon = 'fas fa-truck-loading';
        break;
      case 'completed':
      case 'completada':
        colorClass = 'bg-green-100 text-green-800';
        icon = 'fas fa-check-circle';
        break;
      case 'cancelled':
      case 'cancelada':
        colorClass = 'bg-red-100 text-red-800';
        icon = 'fas fa-ban';
        break;
      default:
        colorClass = 'bg-gray-100 text-gray-800';
        icon = 'fas fa-question-circle';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        <i className={`${icon} mr-1`}></i>
        {status}
      </span>
    );
  };

  if (!canViewOrders) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Órdenes de Compra</h1>
        <p className="text-gray-600">No tienes permisos para ver las órdenes de compra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Órdenes de Compra</h1>
        {canManageOrders && (
          <Link
            to="/ordenes-compra/nueva"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
          >
            <i className="fas fa-plus mr-2"></i>
            Nueva Orden
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
              <input
                type="text"
                id="searchTerm"
                placeholder="Buscar por proveedor, almacén..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada</option>
              <option value="recibida_parcialmente">Recibida parcialmente</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div>
            <label htmlFor="start" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicial
            </label>
            <input
              type="date"
              id="start"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="end" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Final
            </label>
            <input
              type="date"
              id="end"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 inline-flex items-center"
          >
            <i className="fas fa-times mr-2"></i>
            Limpiar Filtros
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Orden
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Proveedor
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Fecha
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Almacén
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Estado
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Total
                  </th>
                  {showActionsColumn && (
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center">
                        <i className="fas fa-shopping-cart text-gray-300 text-4xl mb-2"></i>
                        <p>No hay órdenes de compra disponibles</p>
                        {searchTerm && (
                          <p className="text-xs mt-1">
                            No se encontraron resultados para "{searchTerm}"
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleOrderRowClick(order)}
                    >
                      <td className="py-3 px-4 text-sm font-medium">
                        <Link
                          to={`/ordenes-compra/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          # {order.id.slice(0, 8)}...
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {order.supplier_name}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(order.order_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {order.warehouse_name}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium">
                        {formatCurrency(order.total_amount)}
                      </td>
                      {showActionsColumn && (
                        <td className="py-3 px-4 text-sm text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <i className="fas fa-ellipsis-v mr-2"></i>
                                Acciones
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                              {canViewOrders && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    to={`/ordenes-compra/${order.id}`}
                                    className="flex items-center gap-2 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <i className="fas fa-eye text-muted-foreground"></i>
                                    <span>Ver detalle</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                              {canManageOrders && ['enviada', 'recibida_parcialmente'].includes(order.status) && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    to={`/ordenes-compra/${order.id}/recibir`}
                                    className="flex items-center gap-2 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <i className="fas fa-truck-loading text-green-600"></i>
                                    <span>Registrar recepción</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                              {canManageOrders && order.status === 'borrador' && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    to={`/ordenes-compra/editar/${order.id}`}
                                    className="flex items-center gap-2 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <i className="fas fa-edit text-yellow-600"></i>
                                    <span>Editar</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                              {canManageOrders && ['borrador', 'enviada'].includes(order.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCancelOrder(order.id);
                                    }}
                                    className="text-red-600 focus:text-red-700"
                                  >
                                    <i className="fas fa-ban"></i>
                                    <span>Cancelar orden</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Paginación */}
            {filteredOrders.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredOrders.length)} de {filteredOrders.length} órdenes
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Botones de página */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === pageNumber
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {canViewOrders && (
        <div
          className={`fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-50 flex flex-col`}
        >
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium">Vista previa de orden de compra</h2>
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
            ) : drawerError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                <p>{drawerError}</p>
              </div>
            ) : selectedOrder ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Orden</p>
                        <h3 className="text-xl font-semibold">#{selectedOrder.id}</h3>
                      </div>
                      <div>{getStatusBadge(selectedOrder.status)}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Proveedor</h4>
                        <p className="font-semibold text-gray-900">{selectedOrder.supplier?.name || selectedOrder.supplier_name}</p>
                        {selectedOrder.supplier?.contact_info?.contact_name && (
                          <p className="text-sm text-gray-600">Contacto: {selectedOrder.supplier.contact_info.contact_name}</p>
                        )}
                        {(selectedOrder.supplier?.contact_info?.phone || selectedOrder.supplier?.contact_info?.email) && (
                          <p className="text-sm text-gray-600">
                            {selectedOrder.supplier?.contact_info?.phone}
                            {selectedOrder.supplier?.contact_info?.phone && selectedOrder.supplier?.contact_info?.email && ' | '}
                            {selectedOrder.supplier?.contact_info?.email}
                          </p>
                        )}
                        {selectedOrder.supplier?.contact_info?.address && (
                          <p className="text-sm text-gray-600">{selectedOrder.supplier.contact_info.address}</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Información</h4>
                        <p className="text-sm text-gray-600">Fecha: {formatDateLong(selectedOrder.order_date)}</p>
                        <p className="text-sm text-gray-600">Almacén: {selectedOrder.warehouse?.name || selectedOrder.warehouse_name}</p>
                        {selectedOrder.updated_at && (
                          <p className="text-sm text-gray-600">Actualizado: {formatDateLong(selectedOrder.updated_at)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/ordenes-compra/${selectedOrder.id}`}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-flex items-center gap-2"
                        onClick={closeDrawer}
                      >
                        <i className="fas fa-external-link-alt"></i>
                        Ver detalle completo
                      </Link>
                      {canManageOrders && ['enviada', 'recibida_parcialmente'].includes(selectedOrder.status) && (
                        <Link
                          to={`/ordenes-compra/${selectedOrder.id}/recibir`}
                          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center gap-2"
                          onClick={closeDrawer}
                        >
                          <i className="fas fa-truck-loading"></i>
                          Registrar recepción
                        </Link>
                      )}
                      {canManageOrders && ['borrador', 'enviada'].includes(selectedOrder.status) && (
                        <button
                          onClick={() => handleCancelOrder(selectedOrder.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 inline-flex items-center gap-2"
                        >
                          <i className="fas fa-ban"></i>
                          Cancelar orden
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <h3 className="font-medium text-gray-700 mb-4">Resumen del inventario</h3>
                  {orderItems.length > 0 ? (
                    (() => {
                      const totalOrdered = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                      const totalReceived = orderItems.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
                      const totalPending = Math.max(totalOrdered - totalReceived, 0);
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-md p-4">
                            <p className="text-xs uppercase text-gray-500">Total ordenado</p>
                            <p className="text-lg font-semibold">{totalOrdered}</p>
                          </div>
                          <div className="bg-green-50 rounded-md p-4">
                            <p className="text-xs uppercase text-green-600">Recibido</p>
                            <p className="text-lg font-semibold text-green-700">{totalReceived}</p>
                          </div>
                          <div className="bg-yellow-50 rounded-md p-4">
                            <p className="text-xs uppercase text-yellow-600">Pendiente</p>
                            <p className="text-lg font-semibold text-yellow-700">{totalPending}</p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-gray-500">No hay items en esta orden.</p>
                  )}
                </div>

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-medium text-gray-700">Detalle de productos</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recibido</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {orderItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-sm text-center text-gray-500">
                              No se encontraron productos para esta orden.
                            </td>
                          </tr>
                        ) : (
                          orderItems.map((item) => {
                            const received = item.received_quantity || 0;
                            const pending = Math.max((item.quantity || 0) - received, 0);
                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{item.product?.name || 'Producto sin nombre'}</div>
                                  {item.product?.sku && (
                                    <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                                <td className="px-4 py-3 text-right text-sm text-green-700">{received}</td>
                                <td className={`px-4 py-3 text-right text-sm ${pending === 0 ? 'text-gray-500' : 'text-yellow-600'}`}>{pending}</td>
                                <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(item.total_price)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t flex justify-end">
                    <div className="w-full sm:w-64 space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Total ordenado:</span>
                        <span>{formatCurrency(orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0))}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold text-gray-900">
                        <span>Total factura:</span>
                        <span>{formatCurrency(selectedOrder.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="bg-white rounded-lg border shadow-sm p-6">
                    <h3 className="font-medium text-gray-700 mb-2">Notas</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-500">Selecciona una orden para ver su vista previa.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;