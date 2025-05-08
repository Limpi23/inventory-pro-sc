import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

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

const PurchaseOrders: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], // Últimos 3 meses
    end: new Date().toISOString().split('T')[0] // Hoy
  });
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchOrders();
  }, [dateRange, statusFilter]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('purchase_orders')
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
      start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
    setCurrentPage(1);
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2
    }).format(amount);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Órdenes de Compra</h1>
        <Link
          to="/ordenes-compra/nueva"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
        >
          <i className="fas fa-plus mr-2"></i>
          Nueva Orden
        </Link>
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
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Acciones
                  </th>
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
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium">
                        <Link to={`/ordenes-compra/${order.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
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
                      <td className="py-3 px-4 text-sm text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Link 
                            to={`/ordenes-compra/${order.id}`}
                            className="text-blue-600 hover:text-blue-800 focus:outline-none rounded-md p-1"
                            title="Ver detalles"
                          >
                            <i className="fas fa-eye"></i>
                          </Link>
                          {order.status !== 'completada' && order.status !== 'cancelada' && (
                            <Link
                              to={`/ordenes-compra/${order.id}/recibir`}
                              className="text-green-600 hover:text-green-800 focus:outline-none rounded-md p-1"
                              title="Recibir mercancía"
                            >
                              <i className="fas fa-truck-loading"></i>
                            </Link>
                          )}
                          {order.status === 'borrador' && (
                            <Link
                              to={`/ordenes-compra/${order.id}/editar`}
                              className="text-yellow-600 hover:text-yellow-800 focus:outline-none rounded-md p-1"
                              title="Editar"
                            >
                              <i className="fas fa-edit"></i>
                            </Link>
                          )}
                        </div>
                      </td>
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
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      currentPage === 1
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
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          currentPage === pageNumber
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
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      currentPage === totalPages
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
    </div>
  );
};

export default PurchaseOrders; 