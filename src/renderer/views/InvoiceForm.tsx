import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';

interface Customer {
  id: string;
  name: string;
  identification_number?: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  tax_rate: number;
}

interface InvoiceItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  total_price: number;
}

const InvoiceForm: React.FC = () => {
  const currency = useCurrency();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedCustomerId = queryParams.get('customer');
  
  const isEditing = !!id;
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  
  const [formData, setFormData] = useState({
    customer_id: '',
    warehouse_id: '',
    status: 'borrador',
    payment_method: 'efectivo',
    invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    notes: ''
  });
  
  const [currentItem, setCurrentItem] = useState<{
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount_percent: number;
  }>({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    discount_percent: 0
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  
  useEffect(() => {
    fetchCustomers();
    fetchWarehouses();
    fetchProducts();
    
    if (isEditing) {
      fetchInvoiceDetails();
    } else if (preselectedCustomerId) {
      setFormData(prev => ({
        ...prev,
        customer_id: preselectedCustomerId
      }));
    }
  }, [id]);
  
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
  
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, identification_number')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error('Error cargando clientes:', err);
      setError(err.message);
    }
  };
  
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setWarehouses(data || []);
    } catch (err: any) {
      console.error('Error cargando almacenes:', err);
      setError(err.message);
    }
  };
  
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, sale_price, tax_rate')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error cargando productos:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchInvoiceDetails = async () => {
    try {
      setIsLoading(true);
      
      // Obtener la factura
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
      
      if (invoiceError) throw invoiceError;
      
      if (invoiceData) {
        setFormData({
          customer_id: invoiceData.customer_id,
          warehouse_id: invoiceData.warehouse_id,
          status: invoiceData.status,
          payment_method: invoiceData.payment_method || 'efectivo',
          invoice_number: invoiceData.invoice_number,
          notes: invoiceData.notes || ''
        });
        
        setInvoiceDate(invoiceData.invoice_date);
        if (invoiceData.due_date) {
          setDueDate(invoiceData.due_date);
        }
        
        // Obtener los items de la factura
        const { data: itemsData, error: itemsError } = await supabase
          .from('invoice_items')
          .select(`
            id,
            product_id,
            quantity,
            unit_price,
            tax_rate,
            tax_amount,
            discount_percent,
            discount_amount,
            total_price,
            product:products(name, sku)
          `)
          .eq('invoice_id', id);
        
        if (itemsError) throw itemsError;
        
        if (itemsData) {
          const formattedItems = itemsData.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product?.name || 'Producto desconocido',
            product_sku: item.product?.sku || '-',
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            tax_amount: item.tax_amount,
            discount_percent: item.discount_percent || 0,
            discount_amount: item.discount_amount || 0,
            total_price: item.total_price
          }));
          
          setInvoiceItems(formattedItems);
        }
      }
    } catch (err: any) {
      console.error('Error cargando detalles de la factura:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleItemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'product_id') {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        setCurrentItem(prev => ({
          ...prev,
          [name]: value,
          unit_price: selectedProduct.sale_price,
          tax_rate: selectedProduct.tax_rate || 0
        }));
      } else {
        setCurrentItem(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      setCurrentItem(prev => ({
        ...prev,
        [name]: name === 'quantity' || name === 'unit_price' || name === 'discount_percent' || name === 'tax_rate'
          ? parseFloat(value) || 0
          : value
      }));
    }
  };
  
  const calculateItemTotals = (quantity: number, unitPrice: number, taxRate: number, discountPercent: number) => {
    const subtotal = quantity * unitPrice;
    const discountAmount = (subtotal * discountPercent) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const totalPrice = taxableAmount + taxAmount;
    
    return {
      discountAmount,
      taxAmount,
      totalPrice
    };
  };
  
  const addItemToInvoice = () => {
    if (!currentItem.product_id) {
      toast.error('Por favor seleccione un producto');
      return;
    }
    
    if (currentItem.quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    
    const selectedProduct = products.find(p => p.id === currentItem.product_id);
    if (!selectedProduct) {
      toast.error('Producto no encontrado');
      return;
    }
    
    const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(
      currentItem.quantity,
      currentItem.unit_price,
      currentItem.tax_rate,
      currentItem.discount_percent
    );
    
    const newItem: InvoiceItem = {
      product_id: currentItem.product_id,
      product_name: selectedProduct.name,
      product_sku: selectedProduct.sku,
      quantity: currentItem.quantity,
      unit_price: currentItem.unit_price,
      tax_rate: currentItem.tax_rate,
      tax_amount: taxAmount,
      discount_percent: currentItem.discount_percent,
      discount_amount: discountAmount,
      total_price: totalPrice
    };
    
    setInvoiceItems(prev => [...prev, newItem]);
    
    // Limpiar el formulario de item
    setCurrentItem({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
      discount_percent: 0
    });
    
    setProductSearchTerm('');
  };
  
  const removeItemFromInvoice = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    let total = 0;
    
    invoiceItems.forEach(item => {
      subtotal += item.quantity * item.unit_price;
      taxAmount += item.tax_amount;
      discountAmount += item.discount_amount;
      total += item.total_price;
    });
    
    return { subtotal, taxAmount, discountAmount, total };
  };
  
  const handleSubmit = async (e: React.FormEvent, saveAsDraft: boolean = true) => {
    e.preventDefault();
    
    if (!formData.customer_id) {
      toast.error('Por favor seleccione un cliente');
      return;
    }
    
    if (!formData.warehouse_id) {
      toast.error('Por favor seleccione un almacén');
      return;
    }
    
    if (invoiceItems.length === 0) {
      toast.error('Por favor agregue al menos un producto a la factura');
      return;
    }
    
    try {
      setIsSaving(true);
      const { subtotal, taxAmount, discountAmount, total } = calculateInvoiceTotals();
      
      const status = saveAsDraft ? 'borrador' : 'emitida';
      
      if (isEditing) {
        // Actualizar factura existente
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: status,
            payment_method: formData.payment_method,
            subtotal: subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: total,
            notes: formData.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
          
        if (invoiceError) throw invoiceError;
        
        // Eliminar items existentes
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);
          
        if (deleteError) throw deleteError;
        
        // Insertar nuevos items
        const itemsToInsert = invoiceItems.map(item => ({
          invoice_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: item.tax_amount,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          total_price: item.total_price
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
          
        if (itemsError) throw itemsError;
        
        toast.success(`Factura ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
      } else {
        // Crear nueva factura
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            customer_id: formData.customer_id,
            warehouse_id: formData.warehouse_id,
            invoice_number: formData.invoice_number,
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            status: status,
            payment_method: formData.payment_method,
            subtotal: subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: total,
            notes: formData.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (invoiceError) throw invoiceError;
        
        if (invoiceData) {
          // Insertar items
          const itemsToInsert = invoiceItems.map(item => ({
            invoice_id: invoiceData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            tax_amount: item.tax_amount,
            discount_percent: item.discount_percent,
            discount_amount: item.discount_amount,
            total_price: item.total_price
          }));
          
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);
            
          if (itemsError) throw itemsError;
          
          // Si la factura se emite, registrar los movimientos de inventario
          if (status === 'emitida') {
            // Nota: Para productos serializados, en próximas iteraciones se deben insertar N movimientos por serial con quantity=1 y serial_id.
            // Por ahora mantenemos el comportamiento existente para productos por cantidad.
            const stockMovements = invoiceItems.map(item => ({
              product_id: item.product_id,
              warehouse_id: formData.warehouse_id,
              quantity: item.quantity,
              movement_type_id: 2, // OUT_SALE
              reference: `Factura ${invoiceData.invoice_number}`,
              related_id: invoiceData.id,
              movement_date: new Date().toISOString(),
              notes: `Venta a cliente, factura #${invoiceData.invoice_number}`
            }));

            const { error: movementError } = await supabase
              .from('stock_movements')
              .insert(stockMovements);
              
            if (movementError) {
              console.error('Error registrando movimientos de inventario:', movementError);
              // No interrumpimos el proceso por errores en los movimientos
            }
          }
          
          toast.success(`Factura ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
        }
      }
      
      // Redirigir a la lista de facturas
      navigate('/ventas/facturas');
    } catch (err: any) {
      console.error('Error guardando factura:', err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const formatCurrency = (amount: number) => currency.format(amount);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const { subtotal, taxAmount, discountAmount, total } = calculateInvoiceTotals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas/facturas" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Facturas
          </Link>
          <h1 className="text-2xl font-semibold">
            {isEditing ? 'Editar Factura' : 'Nueva Factura'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, true)} className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Encabezado de la factura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleInputChange}
                required
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">-- Seleccione cliente --</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.identification_number ? `(${customer.identification_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Almacén <span className="text-red-500">*</span></label>
              <select
                name="warehouse_id"
                value={formData.warehouse_id}
                onChange={handleInputChange}
                required
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">-- Seleccione almacén --</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Factura</label>
              <input
                type="text"
                name="invoice_number"
                value={formData.invoice_number}
                onChange={handleInputChange}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                readOnly={isEditing}
              />
              {!isEditing && (
                <p className="text-xs text-gray-500 mt-1">Generado automáticamente. Puede cambiarlo si lo desea.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Factura <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleInputChange}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          {/* Agregar productos */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-lg font-medium mb-4">Agregar Productos</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Producto <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md overflow-auto max-h-60">
                      {filteredProducts.map(product => (
                        <div
                          key={product.id}
                          className="p-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setCurrentItem(prev => ({
                              ...prev,
                              product_id: product.id,
                              unit_price: product.sale_price,
                              tax_rate: product.tax_rate || 0
                            }));
                            setProductSearchTerm(product.name);
                          }}
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  step="1"
                  value={currentItem.quantity}
                  onChange={handleItemInputChange}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unitario <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="unit_price"
                  min="0"
                  step="0.01"
                  value={currentItem.unit_price}
                  onChange={handleItemInputChange}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
                <input
                  type="number"
                  name="discount_percent"
                  min="0"
                  max="100"
                  step="0.01"
                  value={currentItem.discount_percent}
                  onChange={handleItemInputChange}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addItemToInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <i className="fas fa-plus mr-2"></i>Agregar Producto
              </button>
            </div>
          </div>

          {/* Lista de productos */}
          <div>
            <h2 className="text-lg font-medium mb-4">Productos en la Factura</h2>
            
            {invoiceItems.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-gray-500">No hay productos agregados a la factura</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoiceItems.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-gray-500">SKU: {item.product_sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.unit_price)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.discount_percent > 0 ? (
                            <>
                              <div>{item.discount_percent}%</div>
                              <div className="text-sm text-gray-500">{formatCurrency(item.discount_amount)}</div>
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>{item.tax_rate}%</div>
                          <div className="text-sm text-gray-500">{formatCurrency(item.tax_amount)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(item.total_price)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => removeItemFromInvoice(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen */}
          {invoiceItems.length > 0 && (
            <div className="flex justify-end">
              <div className="w-full md:w-1/3 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Descuentos:</span>
                  <span>{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA:</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Agregar notas o comentarios adicionales..."
            ></textarea>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <Link
            to="/ventas/facturas"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {isEditing ? 'Actualizando...' : 'Guardando...'}
              </>
            ) : (
              <>Guardar como Borrador</>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Emitiendo...
              </>
            ) : (
              <>Emitir Factura</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm; 