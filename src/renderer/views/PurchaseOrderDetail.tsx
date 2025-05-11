import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import PrintableOrder from '../components/PrintableOrder';

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  order_date: string;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  supplier: {
    id: string;
    name: string;
    contact_name: string;
    phone: string;
    email: string;
    address: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

interface PrintFormat {
  value: 'letter' | 'roll';
  label: string;
}

const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReceivingItems, setIsReceivingItems] = useState(false);
  const [receivedItems, setReceivedItems] = useState<{[key: string]: number}>({});
  const [receivingError, setReceivingError] = useState<{[key: string]: string}>({});
  const [printFormat, setPrintFormat] = useState<PrintFormat>({ value: 'letter', label: 'Carta' });
  const [showPrintOptions, setShowPrintOptions] = useState<boolean>(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  
  // Función para cerrar las opciones de impresión
  const handleClosePrintOptions = () => {
    setShowPrintOptions(false);
  };
  
  // Función para manejar la impresión usando contentRef en lugar de content
  const handlePrint = useReactToPrint({
    documentTitle: `Orden de Compra #${id}`,
    onAfterPrint: handleClosePrintOptions,
    contentRef: printRef,
  });
  
  useEffect(() => {
    fetchOrderDetails();
    
    // Verificar si estamos en la ruta de recepción
    const isReceivingRoute = location.pathname.includes('/recibir');
    if (isReceivingRoute) {
      // Inicialmente marcamos que estamos en modo de recepción
      // La visualización efectiva se realizará cuando la orden esté cargada
      setIsReceivingItems(true);
    }
  }, [id, location.pathname]);
  
  // Efecto para mostrar la recepción cuando los datos estén cargados
  useEffect(() => {
    if (order && !isLoading) {
      const isReceivingRoute = location.pathname.includes('/recibir');
      
      // Si estamos en la ruta de recepción pero el estado de la orden no lo permite,
      // redirigir a la vista de detalle normal
      if (isReceivingRoute && !['enviada', 'recibida_parcialmente'].includes(order.status)) {
        navigate(`/ordenes-compra/${id}`);
        toast.error('Esta orden no puede recibir mercancía en su estado actual');
      }
    }
  }, [location.hash, order, isLoading]);
  
  // Efecto para detectar cambios en el hash
  useEffect(() => {
    if (location.hash === '#recibir' && order && !isLoading) {
      if (['enviada', 'recibida_parcialmente'].includes(order.status)) {
        setIsReceivingItems(true);
      }
    }
  }, [location.hash, order, isLoading]);
  
  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      
      // Obtener los detalles de la orden de compra
      const client = await supabase.getClient();
      const { data: orderData, error: orderError } = await client.from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*),
          warehouse:warehouses(*)
        `)
        .eq('id', id)
        .single();
      
      if (orderError) throw orderError;
      setOrder(orderData);
      
      // Obtener los items de la orden
      const { data: itemsData, error: itemsError } = await client.from('purchase_order_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('purchase_order_id', id);
      
      if (itemsError) throw itemsError;
      
      // Al obtener los items, agregar order_id si falta
      const itemsWithOrderId = (itemsData || []).map((item: any) => ({
        ...item,
        order_id: item.purchase_order_id || id
      }));
      setOrderItems(itemsWithOrderId);
      
      // Inicializar el objeto de cantidades recibidas
      const initialReceivedItems: Record<string, number> = {};
      itemsWithOrderId.forEach(item => {
        initialReceivedItems[item.id] = 0;
      });

      setReceivedItems(initialReceivedItems);
      
    } catch (err: any) {
      console.error('Error al cargar detalles de la orden:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancelOrder = async () => {
    if (!confirm('¿Está seguro que desea cancelar esta orden? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const client = await supabase.getClient();
      const { error } = await client.from('purchase_orders')
        .update({ status: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('Orden cancelada correctamente');
      fetchOrderDetails();
    } catch (err: any) {
      console.error('Error al cancelar la orden:', err);
      toast.error('Error al cancelar la orden: ' + err.message);
    }
  };
  
  // Función para cancelar el modo de recepción
  const handleCancelReceiving = () => {
    // Si estamos en la ruta específica de recepción, volvemos a la vista de detalle
    if (location.pathname.includes('/recibir')) {
      navigate(`/ordenes-compra/${id}`);
    } else {
      // Si estamos en la vista normal con el modo de recepción activado, solo desactivamos el modo
      setIsReceivingItems(false);
    }
  };
  
  const handleReceiveItems = () => {
    // Solo permitir recibir mercancía si la orden está en estados válidos
    if (!order || !['enviada', 'recibida_parcialmente'].includes(order.status)) {
      return;
    }
    
    // Si no estamos en la ruta de recepción, redirigir a ella
    if (!location.pathname.includes('/recibir')) {
      navigate(`/ordenes-compra/${id}/recibir`);
      return;
    }
    
    // Inicializar el objeto de cantidades recibidas
    const initialReceivedItems: Record<string, number> = {};
    orderItems.forEach(item => {
      initialReceivedItems[item.id] = 0;
    });
    
    setReceivedItems(initialReceivedItems);
    setReceivingError({});
    setIsReceivingItems(true);
  };
  
  const handleReceiveQuantityChange = (itemId: string, quantity: number, maxQuantity: number) => {
    if (quantity < 0) quantity = 0;
    if (quantity > maxQuantity) quantity = maxQuantity;
    
    setReceivedItems(prev => ({
      ...prev,
      [itemId]: quantity
    }));
    
    // Limpiar error si es que había
    if (receivingError[itemId]) {
      setReceivingError(prev => {
        const newErrors = {...prev};
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };
  
  const handleSaveReceived = async () => {
    // Validar que al menos un ítem haya sido recibido
    const hasReceivedItems = Object.values(receivedItems).some(qty => qty > 0);
    if (!hasReceivedItems) {
      toast.error('Debe ingresar al menos una cantidad recibida');
      return;
    }
    
    try {
      // Registrar cada ítem recibido
      const client = await supabase.getClient();
      const receivedEntries = Object.entries(receivedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, receivedQty]) => {
          const item = orderItems.find(i => i.id === itemId);
          if (!item) throw new Error(`Ítem no encontrado: ${itemId}`);
          
          return {
            purchase_order_id: id,
            purchase_order_item_id: itemId,
            product_id: item.product_id,
            quantity: receivedQty,
            warehouse_id: order?.warehouse_id,
            received_at: new Date().toISOString()
          };
        });
      
      // Insertar registros de recepción
      const { error: receiptError } = await client.from('purchase_receipts')
        .insert(receivedEntries);
      
      if (receiptError) throw receiptError;
      
      // Actualizar cantidades recibidas en los ítems de la orden
      for (const [itemId, receivedQty] of Object.entries(receivedItems)) {
        if (receivedQty <= 0) continue;
        
        const item = orderItems.find(i => i.id === itemId);
        if (!item) continue;
        
        const newReceivedQty = (item.received_quantity || 0) + receivedQty;
        
        const { error: stockError } = await client.rpc('add_stock', {
          p_product_id: item.product_id,
          p_warehouse_id: order?.warehouse_id,
          p_quantity: receivedQty,
          p_reference: `Recepción orden #${id}`,
          p_type: 'entrada'
        });
        
        if (stockError) {
          console.error('Error en la función add_stock:', stockError);
          throw new Error(`Error al actualizar el inventario: ${stockError.message || 'Error desconocido'}`);
        }
        
        const { error: updateError } = await client.from('purchase_order_items')
          .update({ received_quantity: newReceivedQty })
          .eq('id', itemId);
        
        if (updateError) throw updateError;
      }
      
      // Determinar el nuevo estado de la orden
      let newStatus = 'recibida_parcialmente';
      const allItemsReceived = orderItems.every(item => {
        const currentReceived = (item.received_quantity || 0);
        const newReceived = currentReceived + (receivedItems[item.id] || 0);
        return newReceived >= item.quantity;
      });
      
      if (allItemsReceived) {
        newStatus = 'completada';
      }
      
      // Actualizar el estado de la orden
      const { error: orderUpdateError } = await client.from('purchase_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (orderUpdateError) throw orderUpdateError;
      
      toast.success('Mercancía recibida correctamente');
      setIsReceivingItems(false);
      
      // Recargar datos
      fetchOrderDetails();
      
      // Mostrar opciones de impresión
      handleShowPrintOptions();
    } catch (err: any) {
      console.error('Error al registrar recepción:', err);
      toast.error('Error al registrar recepción: ' + err.message);
    }
  };
  
  const calculateRemainingItems = (item: OrderItem) => {
    return item.quantity - (item.received_quantity || 0);
  };
  
  const calculateOrderProgress = () => {
    if (!orderItems.length) return 0;
    
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const receivedItems = orderItems.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
    
    return (receivedItems / totalItems) * 100;
  };
  
  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Formatear fecha
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('es-CO', options);
  };
  
  // Renderizar el badge de estado
  const renderStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string, icon: string, text: string } } = {
      'borrador': { color: 'bg-gray-100 text-gray-800', icon: 'fa-pencil', text: 'Borrador' },
      'enviada': { color: 'bg-blue-100 text-blue-800', icon: 'fa-paper-plane', text: 'Enviada' },
      'recibida_parcialmente': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-truck-loading', text: 'Recibida Parcialmente' },
      'completada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Completada' },
      'cancelada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Cancelada' }
    };
    
    const config = statusConfig[status] || statusConfig.borrador;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <i className={`fas ${config.icon} mr-1`}></i>
        {config.text}
      </span>
    );
  };
  
  // Función para mostrar las opciones de impresión
  const handleShowPrintOptions = () => {
    setShowPrintOptions(true);
  };

  // Función para cambiar el formato de impresión
  const handlePrintFormatChange = (format: PrintFormat) => {
    setPrintFormat(format);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !order) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
        <p>{error || 'Orden no encontrada'}</p>
        <Link to="/ordenes-compra" className="text-red-700 hover:text-red-900 underline mt-2 inline-block">
          Volver a la lista de órdenes
        </Link>
      </div>
    );
  }
  
  // Determinar si estamos en la ruta de recepción
  const isReceivingRoute = location.pathname.includes('/recibir');
  
  // Si estamos en la ruta de recepción pero no tenemos activo el modo, activarlo
  if (isReceivingRoute && !isReceivingItems) {
    setIsReceivingItems(true);
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link 
            to="/ordenes-compra" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-2"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Órdenes de Compra
          </Link>
          <h1 className="text-2xl font-semibold">
            {location.pathname.includes('/recibir') ? 
              `Recibir Mercancía - Orden #${id}` : 
              `Orden de Compra #${id}`}
          </h1>
        </div>
        
        <div className="space-x-3 mt-3 md:mt-0">
          <button
            onClick={handleShowPrintOptions}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <i className="fas fa-print mr-2"></i>
            Imprimir
          </button>
          
          {order.status === 'borrador' && (
            <Link 
              to={`/ordenes-compra/editar/${id}`}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <i className="fas fa-edit mr-2"></i>
              Editar
            </Link>
          )}
          
          {['enviada', 'recibida_parcialmente'].includes(order.status) && (
            <button
              onClick={handleReceiveItems}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <i className="fas fa-truck-loading mr-2"></i>
              Recibir Mercancía
            </button>
          )}
          
          {['borrador', 'enviada'].includes(order.status) && (
            <button
              onClick={handleCancelOrder}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <i className="fas fa-times mr-2"></i>
              Cancelar Orden
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información de la orden */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Estado</h3>
              <div className="mt-1">
                {renderStatusBadge(order.status)}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Fecha de Orden</h3>
              <p className="mt-1 text-sm text-gray-900">{formatDate(order.order_date)}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total</h3>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>
          
          {/* Progreso de la recepción */}
          {['recibida_parcialmente', 'completada'].includes(order.status) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Progreso de recepción</h3>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(calculateOrderProgress())}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${calculateOrderProgress()}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Tabla de productos */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-200">Productos</h3>
            
            {isReceivingItems ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Producto
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Ordenados
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Recibidos
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Pendientes
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Cantidad a Recibir
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {orderItems.map(item => {
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="py-3 px-4 text-sm dark:text-gray-300">
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.product.sku}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-center dark:text-gray-300">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-4 text-sm text-center dark:text-gray-300">
                            {item.received_quantity || 0}
                          </td>
                          <td className="py-3 px-4 text-sm text-center dark:text-gray-300">
                            {calculateRemainingItems(item)}
                          </td>
                          <td className="py-3 px-4 text-sm text-center">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => handleReceiveQuantityChange(item.id, (receivedItems[item.id] || 0) - 1, calculateRemainingItems(item))}
                                  className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-l-md hover:bg-gray-300 dark:hover:bg-gray-500"
                                  disabled={calculateRemainingItems(item) === 0}
                                >
                                  <i className="fas fa-minus"></i>
                                </button>
                                <input
                                  type="number"
                                  value={receivedItems[item.id] || 0}
                                  onChange={(e) => handleReceiveQuantityChange(item.id, parseInt(e.target.value) || 0, calculateRemainingItems(item))}
                                  className="w-16 text-center border-t border-b border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 py-1"
                                  min="0"
                                  max={calculateRemainingItems(item)}
                                  disabled={calculateRemainingItems(item) === 0}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReceiveQuantityChange(item.id, (receivedItems[item.id] || 0) + 1, calculateRemainingItems(item))}
                                  className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-r-md hover:bg-gray-300 dark:hover:bg-gray-500"
                                  disabled={calculateRemainingItems(item) === 0 || (receivedItems[item.id] || 0) >= calculateRemainingItems(item)}
                                >
                                  <i className="fas fa-plus"></i>
                                </button>
                              </div>
                              {receivingError[item.id] && (
                                <p className="text-xs text-red-500 mt-1">{receivingError[item.id]}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Producto
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Cantidad
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Precio Unit.
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                        Total
                      </th>
                      {['recibida_parcialmente', 'completada'].includes(order.status) && (
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                          Recibidos
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {orderItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-3 px-4 text-sm dark:text-gray-300">
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.product.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right dark:text-gray-300">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-sm text-right dark:text-gray-300">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium dark:text-gray-300">
                          {formatCurrency(item.total_price)}
                        </td>
                        {['recibida_parcialmente', 'completada'].includes(order.status) && (
                          <td className="py-3 px-4 text-sm text-right">
                            <span className={item.received_quantity === item.quantity ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                              {item.received_quantity || 0} / {item.quantity}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={3} className="py-3 px-4 text-sm text-right font-medium dark:text-gray-300">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-bold dark:text-gray-300">
                        {formatCurrency(order.total_amount)}
                      </td>
                      {['recibida_parcialmente', 'completada'].includes(order.status) && <td></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {isReceivingItems && (
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancelReceiving}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveReceived}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <i className="fas fa-save mr-2"></i>
                  Guardar Recepción
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Información lateral */}
        <div>
          {/* Información del proveedor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-200">Información del Proveedor</h3>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Nombre</h4>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-300">{order.supplier.name}</p>
              </div>
              
              {order.supplier.contact_name && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Contacto</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-300">{order.supplier.contact_name}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {order.supplier.phone && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Teléfono</h4>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-300">{order.supplier.phone}</p>
                  </div>
                )}
                
                {order.supplier.email && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h4>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-300">{order.supplier.email}</p>
                  </div>
                )}
              </div>
              
              {order.supplier.address && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Dirección</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-300">{order.supplier.address}</p>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <Link 
                to={`/proveedores/${order.supplier.id}/compras`}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                <i className="fas fa-history mr-1"></i>
                Ver historial de compras
              </Link>
            </div>
          </div>
          
          {/* Información del almacén */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-3">Almacén de Destino</h3>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Nombre</h4>
                <p className="mt-1 text-sm text-gray-900">{order.warehouse.name}</p>
              </div>
              
              {order.warehouse.location && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Ubicación</h4>
                  <p className="mt-1 text-sm text-gray-900">{order.warehouse.location}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal para opciones de impresión */}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Opciones de Impresión</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Seleccione el formato de impresión:</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePrintFormatChange({ value: 'letter', label: 'Carta' })}
                  className={`px-4 py-2 border rounded-md ${
                    printFormat.value === 'letter' 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-file-alt mr-2"></i>
                  Carta
                </button>
                <button
                  onClick={() => handlePrintFormatChange({ value: 'roll', label: 'Rollo' })}
                  className={`px-4 py-2 border rounded-md ${
                    printFormat.value === 'roll' 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-receipt mr-2"></i>
                  Rollo
                </button>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClosePrintOptions}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <i className="fas fa-print mr-2"></i>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Componente oculto para impresión */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PrintableOrder 
            order={order} 
            orderItems={orderItems} 
            format={printFormat.value}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail; 