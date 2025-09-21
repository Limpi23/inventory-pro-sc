import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../hooks/useCurrency';

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  order_date: string;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  supplier: {
    name: string;
  };
  warehouse: {
    name: string;
  };
  items_count: number;
}

const PurchaseOrderList: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const ordersPerPage = 10;
  const currency = useCurrency();

  useEffect(() => {
    fetchOrders();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      const client = await supabase.getClient();
      
      let query = client.from('purchase_orders')
        .select(`
          id,
          supplier_id,
          order_date,
          status,
          total_amount,
          created_at,
          updated_at,
          supplier:suppliers(name),
          warehouse:warehouses(name),
          items_count:purchase_order_items(count)
        `, { count: 'exact' });
      
      // Aplicar filtros
      if (searchTerm) {
        // Hacemos una consulta independiente para encontrar proveedores por nombre
        let proveedoresIds: string[] = [];
        
        try {
          // Primero buscamos proveedores cuyo nombre coincida
          const { data: proveedores } = await client.from('suppliers')
            .select('id')
            .ilike('name', `%${searchTerm}%`);
          
          if (proveedores && proveedores.length > 0) {
            proveedoresIds = (proveedores as { id: string }[]).map(p => p.id);
          }
        } catch (err) {
          console.error("Error al buscar proveedores:", err);
        }
        
        // Ahora configuramos el filtro incluyendo IDs y supplier_id si encontramos proveedores
        if (proveedoresIds.length > 0) {
          // Si hay proveedores, buscamos por ID de orden o ID de proveedor
          query = query.or(`id.ilike.%${searchTerm}%,supplier_id.in.(${proveedoresIds.join(',')})`);
        } else {
          // Si no hay proveedores, solo buscamos por ID de orden
          query = query.or(`id.ilike.%${searchTerm}%`);
        }
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      // Ordenar por fecha de creación (más reciente primero)
      query = query.order('created_at', { ascending: false });
      
      // Paginación
      const from = (currentPage - 1) * ordersPerPage;
      const to = from + ordersPerPage - 1;
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Transformar los datos al formato esperado por PurchaseOrder
      const formattedData = transformOrderData(data || []);
      
      setOrders(formattedData || []);
      setTotalPages(count ? Math.ceil(count / ordersPerPage) : 1);
      
    } catch (err: any) {
      console.error('Error al cargar órdenes de compra:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const transformOrderData = (data: any[]): PurchaseOrder[] => {
    if (!data) return [];
    
    return data.map(item => {
      // Extraer el nombre del proveedor, con manejo seguro de tipos
      let supplierName = 'Sin nombre';
      if (Array.isArray(item.supplier) && item.supplier.length > 0) {
        supplierName = item.supplier[0]?.name || 'Sin nombre';
      }
      
      // Extraer el nombre del almacén, con manejo seguro de tipos
      let warehouseName = 'Sin ubicación';
      if (Array.isArray(item.warehouse) && item.warehouse.length > 0) {
        warehouseName = item.warehouse[0]?.name || 'Sin ubicación';
      }
      
      // Extraer el conteo de ítems, con manejo seguro de tipos
      let itemsCount = 0;
      if (Array.isArray(item.items_count) && item.items_count.length > 0 && item.items_count[0]) {
        const count = item.items_count[0].count;
        if (count !== undefined && count !== null) {
          itemsCount = Number(count);
        }
      }
      
      return {
        ...item,
        supplier: { name: supplierName },
        warehouse: { name: warehouseName },
        items_count: itemsCount
      };
    });
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const refreshOrders = () => {
    fetchOrders();
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => currency.format(amount);
  
  // Formatear fecha
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(currency.settings.locale, options);
  };
  
  // Renderizar el badge de estado
  const renderStatusBadge = (status: string) => {
    let badgeClass = '';
    let text = '';
    
    switch(status) {
      case 'completada':
        badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        text = 'completada';
        break;
      case 'recibida_parcialmente':
        badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        text = 'recibida_parcialmente';
        break;
      default:
        badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        text = status;
    }
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs ${badgeClass}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Órdenes de Compra</h1>
        <Link 
          to="/ordenes-compra/nueva" 
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <i className="fas fa-plus mr-2"></i>
          Nueva Orden
        </Link>
      </div>
      
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 !dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por proveedor..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada</option>
              <option value="recibida_parcialmente">Recibida Parcialmente</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Inicial
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Final
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setCurrentPage(1);
            }}
            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <i className="fas fa-times mr-2"></i>
            Limpiar Filtros
          </button>
        </div>
      </div>
      
      {/* Lista de órdenes */}
      <div className="bg-white dark:bg-gray-800 !dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
            <p>{error}</p>
            <button 
              onClick={refreshOrders}
              className="text-red-700 hover:text-red-900 underline mt-2"
            >
              Intentar nuevamente
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-gray-400 dark:text-gray-500 mb-3">
              <i className="fas fa-file-invoice text-5xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No se encontraron órdenes</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {searchTerm || statusFilter 
                ? 'Intenta con otros filtros de búsqueda' 
                : 'Crea tu primera orden de compra para comenzar'}
            </p>
            {!searchTerm && !statusFilter && (
              <Link 
                to="/ordenes-compra/nueva" 
                className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <i className="fas fa-plus mr-2"></i>
                Nueva Orden
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto dark:bg-gray-800 !dark:bg-gray-800">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 !dark:bg-gray-800">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 !dark:bg-gray-700">
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ORDEN
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      PROVEEDOR
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      FECHA
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ALMACÉN
                    </th>
                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ESTADO
                    </th>
                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      TOTAL
                    </th>
                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 !dark:bg-gray-800">
                  {orders.map((order) => (
                    <tr key={order.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">#{order.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-300">{order.supplier.name || 'Sin proveedor'}</div>
                      </td>
                      <td className="px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(order.order_date)}</div>
                      </td>
                      <td className="px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="text-sm text-gray-900 dark:text-gray-300">{order.warehouse.name}</div>
                      </td>
                      <td className="px-4 py-4 text-center bg-white dark:bg-gray-800 dark:text-gray-300">
                        {renderStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-4 text-right bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-300">{formatCurrency(order.total_amount)}</div>
                      </td>
                      <td className="px-4 py-4 text-right bg-white dark:bg-gray-800 dark:text-gray-300">
                        <div className="flex justify-end space-x-2">
                          <Link
                            to={`/ordenes-compra/${order.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Ver detalles"
                          >
                            <i className="fas fa-eye"></i>
                          </Link>
                          
                          {order.status === 'borrador' && (
                            <Link
                              to={`/ordenes-compra/editar/${order.id}`}
                              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                              title="Editar"
                            >
                              <i className="fas fa-edit"></i>
                            </Link>
                          )}
                          
                          {['enviada', 'recibida_parcialmente'].includes(order.status) && (
                            <Link
                              to={`/ordenes-compra/${order.id}/recibir`}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              title="Recibir mercancía"
                            >
                              <i className="fas fa-truck-loading"></i>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 !dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Mostrando <span className="font-medium">{(currentPage - 1) * ordersPerPage + 1}</span> a {' '}
                      <span className="font-medium">
                        {Math.min(currentPage * ordersPerPage, totalPages * ordersPerPage)}
                      </span> de{' '}
                      <span className="font-medium">{totalPages * ordersPerPage}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${
                          currentPage === 1 
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      
                      {/* Botones de número de página */}
                      {Array.from({ length: totalPages }).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPage(index + 1)}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${
                            currentPage === index + 1
                              ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-700 text-blue-600 dark:text-blue-300'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${
                          currentPage === totalPages 
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrderList; 