import React, { useState, useEffect, useRef } from 'react';
import { supabase, stockMovementService } from '../lib/supabase';
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
  tracking_method?: string;
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
  serial_id?: string;
}

interface ProductSerial {
  id: string;
  serial_code: string;
  vin?: string;
  engine_number?: string;
  year?: number;
  color?: string;
  status: string;
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
  const [productStock, setProductStock] = useState<Record<string, number>>({});
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemDraft, setEditingItemDraft] = useState<{
    quantity: string;
    unit_price: string;
    discount_percent: string;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  
  // Estados para descuento global
  const [discountMode, setDiscountMode] = useState<'product' | 'global'>('product');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  
  // Estado para mostrar/ocultar columna de IVA
  const [showTaxColumn, setShowTaxColumn] = useState<boolean>(true);
  
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
    unit_price_display: string;
    tax_rate: number;
    discount_percent: number;
  }>({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    unit_price_display: '',
    tax_rate: 0,
    discount_percent: 0
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [availableSerials, setAvailableSerials] = useState<Record<string, ProductSerial[]>>({});
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');
  const [inputKey, setInputKey] = useState(0); // Key para forzar re-render del input
  
  // Ref para el campo de búsqueda de productos
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    fetchCustomers();
    fetchWarehouses();
    fetchProducts();
    
    // NO cargar stock inicial - solo se cargará cuando se seleccione un almacén
    // fetchProductStock(''); // ← REMOVIDO
    
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
      const searchLower = productSearchTerm.toLowerCase().trim();
      const filtered = products.filter(product => {
        const nameMatch = product.name?.toLowerCase().includes(searchLower);
        const skuMatch = product.sku?.toLowerCase().includes(searchLower);
        return nameMatch || skuMatch;
      });
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [productSearchTerm, products]);

  useEffect(() => {
    if (editingItemIndex === null) {
      setEditingItemDraft(null);
    }
  }, [editingItemIndex]);

  // Nuevo useEffect: Cargar stock bajo demanda cuando cambian los productos filtrados
  useEffect(() => {
    if (filteredProducts.length > 0 && formData.warehouse_id) {
      // Extraer SKUs de los productos filtrados
      const skus = filteredProducts
        .map(p => p.sku)
        .filter((sku): sku is string => sku !== null && sku !== undefined);
      
      if (skus.length > 0) {
        fetchStockForProducts(skus, formData.warehouse_id);
      }
    }
  }, [filteredProducts, formData.warehouse_id]);

  useEffect(() => {
    // Ya NO cargar stock automáticamente cuando cambie el almacén
    // El stock se cargará bajo demanda cuando el usuario busque productos
    if (!formData.warehouse_id) {
      // Si no hay almacén seleccionado, limpiar el stock
      setProductStock({});
    }
  }, [formData.warehouse_id]);

  // Recalcular items cuando cambie el descuento global
  useEffect(() => {
    if (discountMode === 'global' && invoiceItems.length > 0) {
      const updatedItems = invoiceItems.map(item => {
        const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(
          item.quantity,
          item.unit_price,
          item.tax_rate,
          globalDiscountPercent
        );
        return {
          ...item,
          discount_percent: globalDiscountPercent,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_price: totalPrice
        };
      });
      setInvoiceItems(updatedItems);
    }
  }, [globalDiscountPercent, discountMode]);

  // Cargar stock de los productos en la cotización
  useEffect(() => {
    if (invoiceItems.length > 0 && formData.warehouse_id) {
      const skus = invoiceItems
        .map(item => item.product_sku)
        .filter((sku): sku is string => sku !== null && sku !== undefined);
      
      if (skus.length > 0) {
        fetchStockForProducts(skus, formData.warehouse_id);
      }
    }
  }, [invoiceItems.length, formData.warehouse_id]);

  // Restaurar focus al campo de búsqueda después de agregar productos
  useEffect(() => {
    // Pequeño delay para asegurar que el DOM se haya actualizado
    const timer = setTimeout(() => {
      if (productSearchInputRef.current && !isEditing) {
        productSearchInputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [invoiceItems.length]); // Se ejecuta cuando cambia el número de items

  // Hacer focus inicial cuando termina de cargar el componente
  useEffect(() => {
    if (!isLoading && !isEditing && productSearchInputRef.current) {
      // Forzar re-render del input para evitar problemas de focus en Windows
      setInputKey(prev => prev + 1);
      
      // Delay más largo para asegurar que todo el componente esté renderizado
      const timer = setTimeout(() => {
        productSearchInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isEditing]);
  
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
      
      setError(err.message);
    }
  };
  
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, sale_price, tax_rate, tracking_method')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductStock = async (warehouseId: string) => {
    try {
      setIsLoadingStock(true);
      
      // Construir query sin encadenar - aplicar todo de una vez
      const queryConfig: any = {
        count: 'exact'
      };
      
      let queryBuilder = supabase
        .from('current_stock')
        .select('product_id, product_name, sku, current_quantity, warehouse_id, warehouse_name', queryConfig);
      
      // Si hay almacén seleccionado, filtrar por ese almacén
      if (warehouseId) {
        queryBuilder = queryBuilder.eq('warehouse_id', warehouseId);
      }
      
      // Hacer múltiples consultas si es necesario (paginación manual)
      const BATCH_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error, count } = await queryBuilder.range(offset, offset + BATCH_SIZE - 1);
        
        if (error) {
          console.error('[fetchProductStock] Error en query:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allData = allData.concat(data);
          offset += BATCH_SIZE;
          
          // Si recibimos menos de BATCH_SIZE, ya no hay más datos
          if (data.length < BATCH_SIZE) {
            hasMore = false;
          }
          
          // Límite de seguridad: máximo 50 batches (50,000 registros)
          if (offset >= 50000) {
            console.warn('[fetchProductStock] Alcanzado límite de seguridad de 50,000 registros');
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      const data = allData;
      const error = null;
      
      if (error) {
        console.error('[fetchProductStock] Error en query:', error);
        throw error;
      }
      
      const stockMap: Record<string, number> = {};
      
      if (warehouseId) {
        // Stock específico del almacén seleccionado
        // USAR SKU como clave en lugar de product_id
        data?.forEach(item => {
          if (item.sku) {
            stockMap[item.sku] = Number(item.current_quantity) || 0;
          }
        });
      } else {
        // Stock total de todos los almacenes (sumar cantidades por producto)
        // USAR SKU como clave en lugar de product_id
        data?.forEach(item => {
          if (item.sku) {
            const currentQty = stockMap[item.sku] || 0;
            stockMap[item.sku] = currentQty + (Number(item.current_quantity) || 0);
          }
        });
      }
      
      setProductStock(stockMap);
    } catch (err: any) {
      console.error('[fetchProductStock] Error fatal:', err);
      // NO resetear el stock en caso de error, mantener el estado anterior
      toast.error('Error al cargar stock de productos');
    } finally {
      setIsLoadingStock(false);
    }
  };

  // Nueva función: Cargar stock solo para productos específicos (optimizada)
  const fetchStockForProducts = async (productSkus: string[], warehouseId: string) => {
    if (!warehouseId || productSkus.length === 0) {
      return;
    }

    try {
      setIsLoadingStock(true);
      
      const { data, error } = await supabase
        .from('current_stock')
        .select('sku, current_quantity')
        .eq('warehouse_id', warehouseId)
        .in('sku', productSkus);
      
      if (error) {
        console.error('[fetchStockForProducts] Error:', error);
        throw error;
      }
      
      // Actualizar solo los SKUs consultados (merge con stock existente)
      setProductStock(prevStock => {
        const newStock = { ...prevStock };
        data?.forEach(item => {
          if (item.sku) {
            newStock[item.sku] = Number(item.current_quantity) || 0;
          }
        });
        return newStock;
      });
      
    } catch (err: any) {
      console.error('[fetchStockForProducts] Error fatal:', err);
      toast.error('Error al cargar stock de productos');
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchAvailableSerials = async (productId: string, warehouseId: string) => {
    if (!productId || !warehouseId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('product_serials')
        .select('id, serial_code, vin, engine_number, year, color, status')
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .eq('status', 'in_stock')
        .order('serial_code');

      if (error) throw error;

      setAvailableSerials(prev => ({
        ...prev,
        [productId]: data || []
      }));
    } catch (err: any) {
      console.error('Error fetching serials:', err);
      toast.error('Error al cargar seriales disponibles');
    }
  };
  
  const fetchInvoiceDetails = async () => {
    try {
      setIsLoading(true);
      
  // Obtener la cotización
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
        
  // Obtener los items de la cotización
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
          unit_price_display: (() => {
            const displayPrice = currency.toDisplay(selectedProduct.sale_price);
            return Number.isFinite(displayPrice) ? `${displayPrice}` : '';
          })(),
          tax_rate: selectedProduct.tax_rate || 0
        }));
      } else {
        setCurrentItem(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      if (name === 'unit_price') {
        const displayValue = value;
        const parsedDisplay = displayValue === '' ? NaN : parseFloat(displayValue);
        const baseValue = Number.isNaN(parsedDisplay) ? 0 : currency.toBase(parsedDisplay);
        setCurrentItem(prev => ({
          ...prev,
          unit_price: Number.isFinite(baseValue) ? Number(baseValue.toFixed(6)) : 0,
          unit_price_display: displayValue
        }));
        return;
      }

      setCurrentItem(prev => ({
        ...prev,
        [name]: name === 'quantity' || name === 'discount_percent' || name === 'tax_rate'
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
    
    const selectedProduct = products.find(p => p.id === currentItem.product_id);
    if (!selectedProduct) {
      toast.error('Producto no encontrado');
      return;
    }

    // Validación especial para productos serializados
    if (selectedProduct.tracking_method === 'serialized') {
      if (!selectedSerialId) {
        toast.error('Debe seleccionar un serial para este producto');
        return;
      }
    } else {
      if (currentItem.quantity <= 0) {
        toast.error('La cantidad debe ser mayor a 0');
        return;
      }
    }
    
    // Usar descuento global o por producto según el modo
    const effectiveDiscount = discountMode === 'global' ? globalDiscountPercent : currentItem.discount_percent;
    
    const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(
      currentItem.quantity,
      currentItem.unit_price,
      currentItem.tax_rate,
      effectiveDiscount
    );
    
    const newItem: InvoiceItem = {
      product_id: currentItem.product_id,
      product_name: selectedProduct.name,
      product_sku: selectedProduct.sku,
      quantity: currentItem.quantity,
      unit_price: currentItem.unit_price,
      tax_rate: currentItem.tax_rate,
      tax_amount: taxAmount,
      discount_percent: effectiveDiscount,
      discount_amount: discountAmount,
      total_price: totalPrice,
      serial_id: selectedProduct.tracking_method === 'serialized' ? selectedSerialId : undefined
    };
    
    setInvoiceItems(prev => [...prev, newItem]);
    
    // Limpiar el formulario de item
    setCurrentItem({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      unit_price_display: '',
      tax_rate: 0,
      discount_percent: 0
    });
    
    setProductSearchTerm('');
    setSelectedSerialId('');
  };
  
  const removeItemFromInvoice = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
    setEditingItemIndex((current) => {
      if (current === null) return current;
      if (current === index) {
        return null;
      }
      return current > index ? current - 1 : current;
    });
  };

  const startEditingInvoiceItem = (index: number) => {
    const item = invoiceItems[index];
    if (!item) return;
    setEditingItemIndex(index);
    setEditingItemDraft({
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      discount_percent: (item.discount_percent ?? 0).toString(),
    });
  };

  const cancelEditingInvoiceItem = () => {
    setEditingItemIndex(null);
    setEditingItemDraft(null);
  };

  const updateEditingDraft = (field: 'quantity' | 'unit_price' | 'discount_percent', value: string) => {
    setEditingItemDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveEditingInvoiceItem = (index: number) => {
    if (editingItemIndex !== index || !editingItemDraft) return;

    const normalizeNumber = (input: string) => {
      if (typeof input !== 'string') return Number.NaN;
      const trimmed = input.trim();
      if (!trimmed) return Number.NaN;
      const normalized = trimmed.replace(/\s+/g, '').replace(/,/g, '.');
      return Number(normalized);
    };

    const quantityValue = normalizeNumber(editingItemDraft.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast.error('La cantidad debe ser un número mayor a 0.');
      return;
    }

    const unitPriceDisplay = normalizeNumber(editingItemDraft.unit_price);
    if (!Number.isFinite(unitPriceDisplay) || unitPriceDisplay < 0) {
      toast.error('El precio unitario debe ser un número mayor o igual a 0.');
      return;
    }
    const unitPriceBase = currency.toBase(unitPriceDisplay);

    const discountPercentValue = normalizeNumber(editingItemDraft.discount_percent || '0');
    if (!Number.isFinite(discountPercentValue) || discountPercentValue < 0 || discountPercentValue > 100) {
      toast.error('El descuento debe estar entre 0 y 100%.');
      return;
    }

    setInvoiceItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const quantity = Number(quantityValue);
        const unit_price = Number(Number(unitPriceBase).toFixed(6));
        const discount_percent = Number(discountPercentValue);
        const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(
          quantity,
          unit_price,
          item.tax_rate,
          discount_percent
        );
        return {
          ...item,
          quantity,
          unit_price,
          discount_percent,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_price: totalPrice,
        };
      })
    );

    setEditingItemIndex(null);
    setEditingItemDraft(null);
    toast.success('Producto actualizado en la cotización.');
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
  toast.error('Por favor agregue al menos un producto a la cotización');
      return;
    }
    
    try {
      setIsSaving(true);
      const { subtotal, taxAmount, discountAmount, total } = calculateInvoiceTotals();

      const status = saveAsDraft ? 'borrador' : 'emitida';
      const movementDateISO = invoiceDate
        ? new Date(`${invoiceDate}T00:00:00`).toISOString()
        : new Date().toISOString();

      let outboundMovementTypeId: number | null = null;
      if (status === 'emitida') {
        outboundMovementTypeId = await stockMovementService.getOutboundSaleTypeId();
      }

      if (isEditing) {
  // Actualizar cotización existente
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
          total_price: item.total_price,
          serial_id: item.serial_id || null
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
          
        if (itemsError) throw itemsError;

        // Sincronizar movimientos de stock según el estado actual
        const { error: purgeMovementsError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('related_id', id);
        if (purgeMovementsError) throw purgeMovementsError;

        if (status === 'emitida' && outboundMovementTypeId !== null) {
          const stockMovements = invoiceItems.map(item => ({
            product_id: item.product_id,
            warehouse_id: formData.warehouse_id,
            quantity: item.quantity,
            movement_type_id: outboundMovementTypeId!,
            reference: `Cotización ${formData.invoice_number}`,
            related_id: id,
            movement_date: movementDateISO,
            notes: `Venta a cliente, cotización #${formData.invoice_number}`,
            serial_id: item.serial_id || null
          }));

          if (stockMovements.length) {
            const { error: movementError } = await supabase
              .from('stock_movements')
              .insert(stockMovements);
            if (movementError) throw movementError;
          }

          // Actualizar status de seriales a 'sold'
          const serialIds = invoiceItems
            .filter(item => item.serial_id)
            .map(item => item.serial_id!);

          if (serialIds.length > 0) {
            const { error: serialUpdateError } = await supabase
              .from('product_serials')
              .update({ status: 'sold' })
              .in('id', serialIds);

            if (serialUpdateError) throw serialUpdateError;
          }
        }
        
        toast.success(`Factura ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
      } else {
  // Crear nueva cotización
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
            total_price: item.total_price,
            serial_id: item.serial_id || null
          }));
          
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);
            
          if (itemsError) throw itemsError;
          
          // Si la cotización se emite, registrar los movimientos de inventario
          if (status === 'emitida' && outboundMovementTypeId !== null) {
            const stockMovements = invoiceItems.map(item => ({
              product_id: item.product_id,
              warehouse_id: formData.warehouse_id,
              quantity: item.quantity,
              movement_type_id: outboundMovementTypeId!,
              reference: `Cotización ${invoiceData.invoice_number}`,
              related_id: invoiceData.id,
              movement_date: movementDateISO,
              notes: `Venta a cliente, cotización #${invoiceData.invoice_number}`,
              serial_id: item.serial_id || null
            }));

            if (stockMovements.length) {
              const { error: movementError } = await supabase
                .from('stock_movements')
                .insert(stockMovements);
              if (movementError) throw movementError;
            }

            // Actualizar status de seriales a 'sold'
            const serialIds = invoiceItems
              .filter(item => item.serial_id)
              .map(item => item.serial_id!);

            if (serialIds.length > 0) {
              const { error: serialUpdateError } = await supabase
                .from('product_serials')
                .update({ status: 'sold' })
                .in('id', serialIds);

              if (serialUpdateError) throw serialUpdateError;
            }
          }
          
          toast.success(`Cotización ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
        }
      }
      
  // Redirigir a la lista de cotizaciones
      navigate('/ventas/facturas');
    } catch (err: any) {
      
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
            Volver a Cotizaciones
          </Link>
          <h1 className="text-2xl font-semibold">
            {isEditing ? 'Editar Cotización' : 'Nueva Cotización'}
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
          {/* Encabezado de la cotización */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cotización</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Cotización <span className="text-red-500">*</span></label>
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
                <option value="qr">QR</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          {/* Agregar productos */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Agregar Productos</h2>
              
              {/* Toggle para modo de descuento y columna IVA */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Descuento:</label>
                  <button
                    type="button"
                    onClick={() => setDiscountMode(discountMode === 'product' ? 'global' : 'product')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      discountMode === 'global' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        discountMode === 'global' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600">
                    {discountMode === 'product' ? 'Por Producto' : 'Global'}
                  </span>
                </div>
                
                {/* Toggle para mostrar/ocultar columna IVA */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Mostrar IVA:</label>
                  <button
                    type="button"
                    onClick={() => setShowTaxColumn(!showTaxColumn)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showTaxColumn ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showTaxColumn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600">
                    {showTaxColumn ? 'Sí' : 'No'}
                  </span>
                </div>
                
                {/* Campo de descuento global */}
                {discountMode === 'global' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={globalDiscountPercent}
                      onChange={(e) => setGlobalDiscountPercent(Number(e.target.value) || 0)}
                      className="w-20 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`grid grid-cols-1 gap-4 mb-4 ${discountMode === 'product' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Producto <span className="text-red-500">*</span></label>
                {!formData.warehouse_id && (
                  <p className="text-sm text-amber-600 mb-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Primero seleccione un almacén para ver productos disponibles
                  </p>
                )}
                <div className="relative">
                  <input
                    key={inputKey}
                    ref={productSearchInputRef}
                    type="text"
                    placeholder={formData.warehouse_id ? "Buscar por nombre o SKU..." : "Seleccione un almacén primero..."}
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    onClick={(e) => {
                      // Forzar focus explícito en Windows
                      e.currentTarget.focus();
                    }}
                    onKeyDownCapture={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    onBeforeInput={(event) => {
                      event.stopPropagation();
                    }}
                    autoComplete="off"
                    disabled={!formData.warehouse_id}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md overflow-auto max-h-60 border border-gray-200">
                      {filteredProducts.map((product, index) => {
                        const searchLower = productSearchTerm.toLowerCase().trim();
                        const matchesSku = product.sku?.toLowerCase().includes(searchLower);
                        // CAMBIO: Usar SKU en lugar de ID para buscar stock
                        const availableStock = product.sku ? productStock[product.sku] : undefined;
                        const hasStockData = availableStock !== undefined;
                        const stockValue = availableStock || 0;
                        const stockColor = stockValue > 0 ? 'text-green-600' : 'text-red-600';
                        
                        return (
                          <div
                            key={product.id}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            onClick={() => {
                              const displayPrice = currency.toDisplay(product.sale_price);
                              setCurrentItem(prev => ({
                                ...prev,
                                product_id: product.id,
                                unit_price: product.sale_price,
                                unit_price_display: Number.isFinite(displayPrice) ? `${displayPrice}` : '',
                                tax_rate: product.tax_rate || 0,
                                quantity: product.tracking_method === 'serialized' ? 1 : prev.quantity
                              }));
                              setProductSearchTerm(product.name);
                              setSelectedSerialId('');
                              
                              // Cargar seriales si es un producto serializado
                              if (product.tracking_method === 'serialized' && formData.warehouse_id) {
                                fetchAvailableSerials(product.id, formData.warehouse_id);
                              }
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{product.name}</div>
                                <div className={`text-sm ${matchesSku ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                                  SKU: {product.sku || 'Sin SKU'}
                                </div>
                              </div>
                              <div className="text-right ml-2">
                                {isLoadingStock ? (
                                  <div className="text-sm text-gray-400">
                                    <i className="fas fa-spinner fa-spin mr-1"></i>
                                    Cargando...
                                  </div>
                                ) : !hasStockData ? (
                                  <div className="text-sm text-gray-400">
                                    Stock: --
                                  </div>
                                ) : (
                                  <div className={`text-sm font-semibold ${stockColor}`}>
                                    Stock: {stockValue}
                                  </div>
                                )}
                                {!formData.warehouse_id && hasStockData && stockValue > 0 && !isLoadingStock && (
                                  <div className="text-xs text-gray-400">
                                    (Total)
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Selector de Serial o Cantidad */}
              {currentItem.product_id && products.find(p => p.id === currentItem.product_id)?.tracking_method === 'serialized' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs text-purple-600 font-medium">Producto Serializado</span>
                  </label>
                  <select
                    value={selectedSerialId}
                    onChange={(e) => {
                      setSelectedSerialId(e.target.value);
                      setCurrentItem(prev => ({ ...prev, quantity: e.target.value ? 1 : 0 }));
                    }}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar serial...</option>
                    {availableSerials[currentItem.product_id]?.map(serial => (
                      <option key={serial.id} value={serial.id}>
                        {serial.serial_code}
                        {serial.vin && ` - VIN: ${serial.vin}`}
                        {serial.engine_number && ` - Motor: ${serial.engine_number}`}
                        {serial.year && ` - ${serial.year}`}
                        {serial.color && ` - ${serial.color}`}
                      </option>
                    ))}
                  </select>
                  {currentItem.product_id && (!availableSerials[currentItem.product_id] || availableSerials[currentItem.product_id].length === 0) && (
                    <p className="mt-1 text-sm text-red-600">No hay seriales disponibles para este producto en la bodega seleccionada</p>
                  )}
                </div>
              ) : (
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
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Unitario <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="unit_price"
                  min="0"
                  step="0.01"
                  value={currentItem.unit_price_display}
                  onChange={handleItemInputChange}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Campo de descuento individual - solo en modo "product" */}
              {discountMode === 'product' && (
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
              )}
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
            <h2 className="text-lg font-medium mb-4">Productos en la Cotización</h2>
            
            {invoiceItems.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-gray-500">No hay productos agregados a la cotización</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                      {discountMode === 'product' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</th>
                      )}
                      {showTaxColumn && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoiceItems.map((item, index) => {
                      const isEditingRow = editingItemIndex === index;
                      // CAMBIO: Usar product_sku en lugar de product_id para buscar stock
                      const availableStock = item.product_sku ? productStock[item.product_sku] : undefined;
                      const hasStockData = availableStock !== undefined;
                      const stockValue = availableStock || 0;
                      const stockWarning = hasStockData && item.quantity > stockValue;
                      
                      return (
                        <tr key={`${item.product_id}-${index}`} className={stockWarning ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-sm text-gray-500">SKU: {item.product_sku}</div>
                            {item.serial_id && (
                              <div className="text-xs text-purple-600 font-medium mt-1">
                                Serial: {availableSerials[item.product_id]?.find(s => s.id === item.serial_id)?.serial_code || item.serial_id}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditingRow ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingItemDraft?.quantity ?? ''}
                                onChange={(e) => updateEditingDraft('quantity', e.target.value)}
                                className="w-24 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            ) : (
                              item.quantity
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditingRow ? (
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editingItemDraft?.unit_price ?? ''}
                                  onChange={(e) => updateEditingDraft('unit_price', e.target.value)}
                                  className="w-28 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <div className="text-xs text-gray-500">Actual: {formatCurrency(item.unit_price)}</div>
                              </div>
                            ) : (
                              formatCurrency(item.unit_price)
                            )}
                          </td>
                          {discountMode === 'product' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isEditingRow ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={editingItemDraft?.discount_percent ?? ''}
                                    onChange={(e) => updateEditingDraft('discount_percent', e.target.value)}
                                    className="w-24 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-500">{formatCurrency(item.discount_amount)}</span>
                                </div>
                              ) : item.discount_percent > 0 ? (
                                <>
                                  <div>{item.discount_percent}%</div>
                                  <div className="text-sm text-gray-500">{formatCurrency(item.discount_amount)}</div>
                                </>
                              ) : (
                                '-'
                              )}
                            </td>
                          )}
                          {showTaxColumn && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>{item.tax_rate}%</div>
                              <div className="text-sm text-gray-500">{formatCurrency(item.tax_amount)}</div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(item.total_price)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditingRow ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => saveEditingInvoiceItem(index)}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <i className="fas fa-check"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingInvoiceItem}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => startEditingInvoiceItem(index)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <i className="fas fa-pen"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeItemFromInvoice(index)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <i className="fas fa-trash-alt"></i>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                  <span>
                    Descuentos:
                    {discountMode === 'global' && globalDiscountPercent > 0 && (
                      <span className="ml-1 text-xs text-blue-600">({globalDiscountPercent}% global)</span>
                    )}
                  </span>
                  <span>{formatCurrency(discountAmount)}</span>
                </div>
                {showTaxColumn && (
                  <div className="flex justify-between">
                    <span>IVA:</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
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
              <>Emitir Cotización</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm; 