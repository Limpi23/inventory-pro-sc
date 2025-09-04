import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useParams, Link } from 'react-router-dom';

interface PurchaseOrder {
  id: string;
  order_date: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface PurchaseOrderDetail extends PurchaseOrder {
  items_count: number;
  warehouse_name: string;
}

interface PurchaseOrderItem {
  id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_info?: any;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  contact_person?: string;
}

const SupplierPurchases: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOrderDetail[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<string | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Primer día del año actual
    end: new Date().toISOString().split('T')[0] // Hoy
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    if (id) {
      fetchSupplier();
      fetchPurchases();
    }
  }, [id, dateRange]);

  useEffect(() => {
    if (selectedPurchase) {
      fetchPurchaseItems(selectedPurchase);
    }
  }, [selectedPurchase]);

  const fetchSupplier = async () => {
    try {
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
  setSupplier(data as unknown as Supplier);
    } catch (err: any) {
      console.error('Error cargando proveedor:', err);
      setError(err.message);
    }
  };

  const fetchPurchases = async () => {
    try {
      setIsLoading(true);
      
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('purchase_orders')
        .select(`
          *,
          warehouse:warehouses(name),
          items:purchase_order_items(count)
        `)
        .eq('supplier_id', id)
        .gte('order_date', dateRange.start)
        .lte('order_date', dateRange.end)
        .order('order_date', { ascending: false });
      
      if (error) throw error;
      
      const formattedPurchases = (data || []).map((p: any) => ({
        id: p.id,
        order_date: p.order_date,
        status: p.status,
        total_amount: p.total_amount || 0,
        created_at: p.created_at,
        items_count: p.items?.length || 0,
        warehouse_name: p.warehouse?.name || 'Desconocido'
      }));
      
      setPurchases(formattedPurchases);
      setIsLoading(false);
      
      // Si hay compras y no hay ninguna seleccionada, seleccionar la primera
      if (formattedPurchases.length > 0 && !selectedPurchase) {
        setSelectedPurchase(formattedPurchases[0].id);
      } else if (formattedPurchases.length === 0) {
        setSelectedPurchase(null);
        setPurchaseItems([]);
      }
      
    } catch (err: any) {
      console.error('Error cargando compras:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const fetchPurchaseItems = async (purchaseId: string) => {
    try {
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('purchase_order_items')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('purchase_order_id', purchaseId);
      
      if (error) throw error;
      
      const formattedItems = (data || []).map((item: any) => ({
        id: item.id,
        product_name: item.product?.name || 'Producto desconocido',
        product_sku: item.product?.sku || '-',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0
      }));
      
      setPurchaseItems(formattedItems);
      
    } catch (err: any) {
      console.error('Error cargando items de compra:', err);
      setError(err.message);
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

  // Calcular paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPurchases = purchases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(purchases.length / itemsPerPage);

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
    
    switch (status.toLowerCase()) {
      case 'completed':
      case 'completado':
        colorClass = 'bg-green-100 text-green-800';
        break;
      case 'pending':
      case 'pendiente':
        colorClass = 'bg-yellow-100 text-yellow-800';
        break;
      case 'cancelled':
      case 'cancelado':
        colorClass = 'bg-red-100 text-red-800';
        break;
      default:
        colorClass = 'bg-gray-100 text-gray-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  const contactInfo = supplier?.contact_info as ContactInfo || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link 
            to="/proveedores" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-2"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Proveedores
          </Link>
          <h1 className="text-2xl font-semibold">Historial de Compras</h1>
          {supplier && (
            <div className="mt-1 text-gray-500">
              Proveedor: <span className="font-medium text-gray-700">{supplier.name}</span>
              {contactInfo.contact_person && (
                <span className="ml-2">• Contacto: {contactInfo.contact_person}</span>
              )}
              {contactInfo.phone && (
                <span className="ml-2">• Tel: {contactInfo.phone}</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="flex items-end">
            <Link
              to={`/ordenes-compra/nueva?supplier=${id}`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              Nueva Orden de Compra
            </Link>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Lista de órdenes */}
            <div className="lg:col-span-2 overflow-x-auto">
              <h2 className="text-lg font-medium mb-4">Órdenes de Compra</h2>
              
              {purchases.length === 0 ? (
                <div className="bg-gray-50 rounded-md p-8 text-center">
                  <i className="fas fa-shopping-cart text-gray-300 text-4xl mb-2"></i>
                  <p className="text-gray-500">No hay órdenes de compra en el período seleccionado</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden border border-gray-200 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                            Fecha
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                            Estado
                          </th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentPurchases.map((purchase) => (
                          <tr 
                            key={purchase.id} 
                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                              selectedPurchase === purchase.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => setSelectedPurchase(purchase.id)}
                          >
                            <td className="py-3 px-4 text-sm">
                              <div className="font-medium">
                                {new Date(purchase.order_date).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {purchase.warehouse_name}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {getStatusBadge(purchase.status)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium">
                              {formatCurrency(purchase.total_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Paginación */}
                  {purchases.length > itemsPerPage && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, purchases.length)} de {purchases.length} órdenes
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
                </>
              )}
            </div>
            
            {/* Detalles de orden seleccionada */}
            <div className="lg:col-span-3">
              <h2 className="text-lg font-medium mb-4">Detalles de la Orden</h2>
              
              {!selectedPurchase ? (
                <div className="bg-gray-50 rounded-md p-8 text-center">
                  <i className="fas fa-receipt text-gray-300 text-4xl mb-2"></i>
                  <p className="text-gray-500">Seleccione una orden para ver sus detalles</p>
                </div>
              ) : purchaseItems.length === 0 ? (
                <div className="bg-gray-50 rounded-md p-8 text-center">
                  <i className="fas fa-box-open text-gray-300 text-4xl mb-2"></i>
                  <p className="text-gray-500">Esta orden no tiene productos</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                          Producto
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                          Cantidad
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                          Precio Unit.
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {purchaseItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-medium">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="py-2 px-4 text-sm text-right font-medium">
                          Total:
                        </td>
                        <td className="py-2 px-4 text-sm text-right font-bold">
                          {formatCurrency(purchaseItems.reduce((sum, item) => sum + item.total_price, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              
              {selectedPurchase && (
                <div className="mt-4 flex justify-end">
                  <Link
                    to={`/ordenes-compra/${selectedPurchase}`}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
                  >
                    <i className="fas fa-eye mr-2"></i>
                    Ver Orden Completa
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierPurchases; 