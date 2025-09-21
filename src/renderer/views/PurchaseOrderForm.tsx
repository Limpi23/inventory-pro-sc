import React, { useState, useEffect, useRef } from 'react';
import { supabase, logAppEvent } from '../lib/supabase';
import PurchaseOrderItemsImport, { ImportOrderItem } from '../components/purchase/PurchaseOrderItemsImport';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';

interface Supplier {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  purchase_price: number;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const PurchaseOrderForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedSupplierId = queryParams.get('supplier');
  
  const isEditing = !!id;
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    warehouse_id: '',
    status: 'borrador'
  });
  
  const [currentItem, setCurrentItem] = useState<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>({
    product_id: '',
    quantity: 1,
    unit_price: 0
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    fetchSuppliers();
    fetchWarehouses();
    fetchProducts();
    
    if (isEditing) {
      fetchOrderDetails();
    } else if (preselectedSupplierId) {
      setFormData(prev => ({
        ...prev,
        supplier_id: preselectedSupplierId
      }));
    }
  }, [id]);

  // Asegurar enfoque en la caja de búsqueda al abrir una orden nueva o editable
  useEffect(() => {
    if (!isLoading && (!isEditing || formData.status === 'borrador')) {
      // Usar setTimeout para esperar a que el input esté en el DOM tras render
      const t = setTimeout(() => {
        productSearchInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isLoading, isEditing, formData.status]);
  
  useEffect(() => {
    // Filtrar productos basados en el término de búsqueda
    if (productSearchTerm) {
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [productSearchTerm, products]);
  
  const fetchSuppliers = async () => {
    try {
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('suppliers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
  setSuppliers((data || []) as unknown as Supplier[]);
    } catch (err: any) {
      console.error('Error cargando proveedores:', err);
      setError(err.message);
    }
  };
  
  const fetchWarehouses = async () => {
    try {
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('warehouses')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
  setWarehouses((data || []) as unknown as Warehouse[]);
    } catch (err: any) {
      console.error('Error cargando almacenes:', err);
      setError(err.message);
    }
  };
  
  const fetchProducts = async () => {
    try {
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('products')
        .select('id, name, sku, purchase_price')
        .order('name');
      
      if (error) throw error;
  setProducts((data || []) as unknown as Product[]);
    } catch (err: any) {
      console.error('Error cargando productos:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      
      // Obtener la orden
  const client = await supabase.getClient();
      const { data: orderData, error: orderError } = await client
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (orderError) throw orderError;
      
      if (orderData) {
        const od = orderData as any;
        setFormData({
          supplier_id: String(od.supplier_id || ''),
          warehouse_id: String(od.warehouse_id || ''),
          status: String(od.status || 'borrador')
        });
        
        setOrderDate(String(od.order_date || new Date().toISOString().split('T')[0]));
        
        // Obtener los items de la orden
  const { data: itemsData, error: itemsError } = await client
          .from('purchase_order_items')
          .select(`
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            product:products(name, sku)
          `)
          .eq('purchase_order_id', id);
        
        if (itemsError) throw itemsError;
        
        if (itemsData) {
          const formattedItems = itemsData.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product?.name || 'Producto desconocido',
            product_sku: item.product?.sku || '-',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          }));
          
          setOrderItems(formattedItems);
        }
      }
    } catch (err: any) {
      console.error('Error cargando detalles de la orden:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleItemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setCurrentItem(prev => {
      const updated = {
        ...prev,
        [name]: name === 'product_id' ? value : parseFloat(value)
      };
      
      // Actualizar el precio unitario si se cambia el producto
      if (name === 'product_id' && value) {
        const selectedProduct = products.find(p => p.id === value);
        if (selectedProduct) {
          updated.unit_price = selectedProduct.purchase_price || 0;
        }
      }
      
      return updated;
    });
  };
  
  const addItemToOrder = () => {
    if (!currentItem.product_id || currentItem.quantity <= 0) {
      setError('Por favor seleccione un producto y una cantidad válida');
      return;
    }
    
    const selectedProduct = products.find(p => p.id === currentItem.product_id);
    
    if (!selectedProduct) {
      setError('Producto no encontrado');
      return;
    }
    
    const existingItemIndex = orderItems.findIndex(item => item.product_id === currentItem.product_id);
    
    if (existingItemIndex !== -1) {
      // Si el producto ya está en la orden, actualizar cantidad
      setOrderItems(prev => {
        const updated = [...prev];
        const item = updated[existingItemIndex];
        
        item.quantity += currentItem.quantity;
        item.unit_price = currentItem.unit_price;
        item.total_price = item.quantity * item.unit_price;
        
        return updated;
      });
    } else {
      // Agregar nuevo producto a la orden
      const newItem: OrderItem = {
        product_id: currentItem.product_id,
        product_name: selectedProduct.name,
        product_sku: selectedProduct.sku,
        quantity: currentItem.quantity,
        unit_price: currentItem.unit_price,
        total_price: currentItem.quantity * currentItem.unit_price
      };
      
      setOrderItems(prev => [...prev, newItem]);
    }
    
    // Limpiar el formulario
    setCurrentItem({
      product_id: '',
      quantity: 1,
      unit_price: 0
    });
    
    setProductSearchTerm('');
  };

  const addImportedItems = (items: ImportOrderItem[]) => {
    setOrderItems(prev => {
      const map = new Map(prev.map(i => [i.product_id, { ...i }]));
      for (const it of items) {
        const existing = map.get(it.product_id);
        if (existing) {
          existing.quantity += it.quantity;
          existing.unit_price = it.unit_price;
          existing.total_price = existing.quantity * existing.unit_price;
        } else {
          map.set(it.product_id, {
            product_id: it.product_id,
            product_name: it.product_name,
            product_sku: it.product_sku,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: it.quantity * it.unit_price
          });
        }
      }
      return Array.from(map.values());
    });
  };
  
  const removeItemFromOrder = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total_price, 0);
  };
  
  const handleSubmit = async (e: React.FormEvent, saveAsDraft: boolean = true) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.warehouse_id || orderItems.length === 0) {
      setError('Por favor complete todos los campos requeridos y agregue al menos un producto');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const status = saveAsDraft ? 'borrador' : 'enviada';
      const total = calculateTotal();
      
      if (isEditing) {
        // Actualizar orden existente
  const client = await supabase.getClient();
  const { error: updateError } = await client
          .from('purchase_orders')
          .update({
            supplier_id: formData.supplier_id,
            warehouse_id: formData.warehouse_id,
            order_date: orderDate,
            status,
            total_amount: total,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (updateError) throw updateError;
        
        // Eliminar items existentes
  const { error: deleteError } = await client
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', id);
        
        if (deleteError) throw deleteError;
        
        // Insertar nuevos items
        const items = orderItems.map(item => ({
          purchase_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));
        
  const { error: insertError } = await client
          .from('purchase_order_items')
          .insert(items);
        
        if (insertError) throw insertError;
        // Log de actualización de orden
        await logAppEvent('purchase_order.update', 'purchase_order', id as string, { status, total, items_count: items.length });
        
        navigate(`/ordenes-compra/${id}`);
      } else {
        // Crear nueva orden
  const client = await supabase.getClient();
  const { data: orderData, error: orderError } = await client
          .from('purchase_orders')
          .insert([{
            supplier_id: formData.supplier_id,
            warehouse_id: formData.warehouse_id,
            order_date: orderDate,
            status,
            total_amount: total
          }])
          .select();
        
        if (orderError) throw orderError;
        
        if (orderData && orderData.length > 0) {
          const newOrderId = orderData[0].id;
          
          // Insertar items de la orden
          const items = orderItems.map(item => ({
            purchase_order_id: newOrderId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          }));
          
          const { error: itemsError } = await client
            .from('purchase_order_items')
            .insert(items);
          
          if (itemsError) throw itemsError;
          // Log de creación de orden
          await logAppEvent('purchase_order.create', 'purchase_order', newOrderId as string, { status, total, items_count: items.length, supplier_id: formData.supplier_id, warehouse_id: formData.warehouse_id });
          
          navigate(`/ordenes-compra/${newOrderId}`);
        }
      }
    } catch (err: any) {
      console.error('Error guardando orden de compra:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
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
            {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </h1>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={(e) => handleSubmit(e, true)}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor *
                </label>
                <select
                  id="supplier_id"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleInputChange}
                  required
                  className="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isEditing && formData.status !== 'borrador'}
                >
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="warehouse_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Almacén de destino *
                </label>
                <select
                  id="warehouse_id"
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleInputChange}
                  required
                  className="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isEditing && formData.status !== 'borrador'}
                >
                  <option value="">Seleccionar almacén</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="order_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de orden *
                </label>
                <input
                  type="date"
                  id="order_date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isEditing && formData.status !== 'borrador'}
                />
              </div>
            </div>
            
            {/* Sección para agregar productos */}
            <div className="mb-6 border p-4 rounded-md bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Agregar Productos</h2>
                <PurchaseOrderItemsImport
                  products={products}
                  onImport={addImportedItems}
                  size="sm"
                  disabled={isEditing && formData.status !== 'borrador'}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="product_search" className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Producto
                  </label>
                  <div className="relative">
                    <input
                      ref={productSearchInputRef}
                      type="text"
                      id="product_search"
                      placeholder="Buscar por nombre o SKU..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      onKeyDownCapture={(e) => {
                        // Evitar que atajos/handlers globales bloqueen la escritura en este campo
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => {
                        // Bloquear burbujeo hacia handlers globales
                        e.stopPropagation();
                      }}
                      onBeforeInput={(e) => {
                        // Aislar del documento para que no se intercepten teclas
                        e.stopPropagation();
                      }}
                      autoComplete="off"
                      className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={isEditing && formData.status !== 'borrador'}
                    />
                    {productSearchTerm && filteredProducts.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                        {filteredProducts.map(product => (
                          <div
                            key={product.id}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              setCurrentItem(prev => ({
                                ...prev,
                                product_id: product.id,
                                unit_price: product.purchase_price || 0
                              }));
                              setProductSearchTerm(product.name);
                            }}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={currentItem.quantity}
                    onChange={handleItemInputChange}
                    min="1"
                    step="1"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={isEditing && formData.status !== 'borrador'}
                  />
                </div>
                
                <div>
                  <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario
                  </label>
                  <input
                    type="number"
                    id="unit_price"
                    name="unit_price"
                    value={currentItem.unit_price}
                    onChange={handleItemInputChange}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={isEditing && formData.status !== 'borrador'}
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={addItemToOrder}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                  disabled={(isEditing && formData.status !== 'borrador') || !currentItem.product_id}
                >
                  <i className="fas fa-plus mr-2"></i>
                  Agregar a la Orden
                </button>
              </div>
            </div>
            
            {/* Lista de productos en la orden */}
            <div className="mb-6">
              <h2 className="text-lg font-medium mb-4">Productos en la Orden</h2>
              
              {orderItems.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-8 text-center">
                  <i className="fas fa-shopping-cart text-gray-300 dark:text-gray-600 text-4xl mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No hay productos agregados a la orden</p>
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
                        <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {orderItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="py-3 px-4 text-sm dark:text-gray-300">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.product_sku}</div>
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
                          <td className="py-3 px-4 text-sm text-center">
                            {(formData.status === 'borrador' || !isEditing) && (
                              <button
                                type="button"
                                onClick={() => removeItemFromOrder(index)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus:outline-none rounded-md p-1"
                                title="Eliminar"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan={3} className="py-3 px-4 text-sm text-right font-medium dark:text-gray-300">
                          Total:
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold dark:text-gray-300">
                          {formatCurrency(calculateTotal())}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <Link
                to="/ordenes-compra"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancelar
              </Link>
              
              {(!isEditing || formData.status === 'borrador') && (
                <>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    disabled={isSaving || orderItems.length === 0}
                  >
                    <i className="fas fa-save mr-2"></i>
                    Guardar como Borrador
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, false)}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                    disabled={isSaving || orderItems.length === 0}
                  >
                    <i className="fas fa-paper-plane mr-2"></i>
                    Enviar Orden
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderForm; 