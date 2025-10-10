import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase, stockMovementService } from '../lib/supabase';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';
const InvoiceForm = () => {
    const currency = useCurrency();
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const preselectedCustomerId = queryParams.get('customer');
    const isEditing = !!id;
    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [productStock, setProductStock] = useState({});
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [editingItemIndex, setEditingItemIndex] = useState(null);
    const [editingItemDraft, setEditingItemDraft] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    // Estados para descuento global
    const [discountMode, setDiscountMode] = useState('product');
    const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);
    const [formData, setFormData] = useState({
        customer_id: '',
        warehouse_id: '',
        status: 'borrador',
        payment_method: 'efectivo',
        invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        notes: ''
    });
    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        quantity: 1,
        unit_price: 0,
        unit_price_display: '',
        tax_rate: 0,
        discount_percent: 0
    });
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [availableSerials, setAvailableSerials] = useState({});
    const [selectedSerialId, setSelectedSerialId] = useState('');
    useEffect(() => {
        fetchCustomers();
        fetchWarehouses();
        fetchProducts();
        if (isEditing) {
            fetchInvoiceDetails();
        }
        else if (preselectedCustomerId) {
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
        }
        else {
            setFilteredProducts([]);
        }
    }, [productSearchTerm, products]);
    useEffect(() => {
        if (editingItemIndex === null) {
            setEditingItemDraft(null);
        }
    }, [editingItemIndex]);
    useEffect(() => {
        // Cargar stock cuando cambie el almacén (o al inicio sin almacén)
        fetchProductStock(formData.warehouse_id);
    }, [formData.warehouse_id]);
    // Recalcular items cuando cambie el descuento global
    useEffect(() => {
        if (discountMode === 'global' && invoiceItems.length > 0) {
            const updatedItems = invoiceItems.map(item => {
                const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(item.quantity, item.unit_price, item.tax_rate, globalDiscountPercent);
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
    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, identification_number')
                .eq('is_active', true)
                .order('name');
            if (error)
                throw error;
            setCustomers(data || []);
        }
        catch (err) {
            setError(err.message);
        }
    };
    const fetchWarehouses = async () => {
        try {
            const { data, error } = await supabase
                .from('warehouses')
                .select('id, name')
                .order('name');
            if (error)
                throw error;
            setWarehouses(data || []);
        }
        catch (err) {
            setError(err.message);
        }
    };
    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, sale_price, tax_rate, tracking_method')
                .order('name');
            if (error)
                throw error;
            setProducts(data || []);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const fetchProductStock = async (warehouseId) => {
        try {
            let query = supabase
                .from('current_stock')
                .select('product_id, current_quantity, warehouse_id');
            // Si hay almacén seleccionado, filtrar por ese almacén
            if (warehouseId) {
                query = query.eq('warehouse_id', warehouseId);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            const stockMap = {};
            if (warehouseId) {
                // Stock específico del almacén seleccionado
                data?.forEach(item => {
                    stockMap[item.product_id] = Number(item.current_quantity) || 0;
                });
            }
            else {
                // Stock total de todos los almacenes (sumar cantidades por producto)
                data?.forEach(item => {
                    const currentQty = stockMap[item.product_id] || 0;
                    stockMap[item.product_id] = currentQty + (Number(item.current_quantity) || 0);
                });
            }
            setProductStock(stockMap);
        }
        catch (err) {
            console.error('Error fetching stock:', err);
        }
    };
    const fetchAvailableSerials = async (productId, warehouseId) => {
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
            if (error)
                throw error;
            setAvailableSerials(prev => ({
                ...prev,
                [productId]: data || []
            }));
        }
        catch (err) {
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
            if (invoiceError)
                throw invoiceError;
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
                if (itemsError)
                    throw itemsError;
                if (itemsData) {
                    const formattedItems = itemsData.map((item) => ({
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
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleItemInputChange = (e) => {
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
            }
            else {
                setCurrentItem(prev => ({
                    ...prev,
                    [name]: value
                }));
            }
        }
        else {
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
    const calculateItemTotals = (quantity, unitPrice, taxRate, discountPercent) => {
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
        }
        else {
            if (currentItem.quantity <= 0) {
                toast.error('La cantidad debe ser mayor a 0');
                return;
            }
        }
        // Usar descuento global o por producto según el modo
        const effectiveDiscount = discountMode === 'global' ? globalDiscountPercent : currentItem.discount_percent;
        const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(currentItem.quantity, currentItem.unit_price, currentItem.tax_rate, effectiveDiscount);
        const newItem = {
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
    const removeItemFromInvoice = (index) => {
        setInvoiceItems(prev => prev.filter((_, i) => i !== index));
        setEditingItemIndex((current) => {
            if (current === null)
                return current;
            if (current === index) {
                return null;
            }
            return current > index ? current - 1 : current;
        });
    };
    const startEditingInvoiceItem = (index) => {
        const item = invoiceItems[index];
        if (!item)
            return;
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
    const updateEditingDraft = (field, value) => {
        setEditingItemDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    };
    const saveEditingInvoiceItem = (index) => {
        if (editingItemIndex !== index || !editingItemDraft)
            return;
        const normalizeNumber = (input) => {
            if (typeof input !== 'string')
                return Number.NaN;
            const trimmed = input.trim();
            if (!trimmed)
                return Number.NaN;
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
        setInvoiceItems((prev) => prev.map((item, idx) => {
            if (idx !== index)
                return item;
            const quantity = Number(quantityValue);
            const unit_price = Number(Number(unitPriceBase).toFixed(6));
            const discount_percent = Number(discountPercentValue);
            const { discountAmount, taxAmount, totalPrice } = calculateItemTotals(quantity, unit_price, item.tax_rate, discount_percent);
            return {
                ...item,
                quantity,
                unit_price,
                discount_percent,
                discount_amount: discountAmount,
                tax_amount: taxAmount,
                total_price: totalPrice,
            };
        }));
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
    const handleSubmit = async (e, saveAsDraft = true) => {
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
            let outboundMovementTypeId = null;
            if (status === 'emitida') {
                outboundMovementTypeId = await stockMovementService.getOutboundSaleTypeId();
                console.log('[DEBUG] outboundMovementTypeId:', outboundMovementTypeId);
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
                if (invoiceError)
                    throw invoiceError;
                // Eliminar items existentes
                const { error: deleteError } = await supabase
                    .from('invoice_items')
                    .delete()
                    .eq('invoice_id', id);
                if (deleteError)
                    throw deleteError;
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
                if (itemsError)
                    throw itemsError;
                // Sincronizar movimientos de stock según el estado actual
                const { error: purgeMovementsError } = await supabase
                    .from('stock_movements')
                    .delete()
                    .eq('related_id', id);
                if (purgeMovementsError)
                    throw purgeMovementsError;
                if (status === 'emitida' && outboundMovementTypeId !== null) {
                    const stockMovements = invoiceItems.map(item => ({
                        product_id: item.product_id,
                        warehouse_id: formData.warehouse_id,
                        quantity: item.quantity,
                        movement_type_id: outboundMovementTypeId,
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
                        if (movementError)
                            throw movementError;
                    }
                    // Actualizar status de seriales a 'sold'
                    const serialIds = invoiceItems
                        .filter(item => item.serial_id)
                        .map(item => item.serial_id);
                    if (serialIds.length > 0) {
                        const { error: serialUpdateError } = await supabase
                            .from('product_serials')
                            .update({ status: 'sold' })
                            .in('id', serialIds);
                        if (serialUpdateError)
                            throw serialUpdateError;
                    }
                }
                toast.success(`Factura ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
            }
            else {
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
                if (invoiceError)
                    throw invoiceError;
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
                    if (itemsError)
                        throw itemsError;
                    // Si la cotización se emite, registrar los movimientos de inventario
                    if (status === 'emitida' && outboundMovementTypeId !== null) {
                        const stockMovements = invoiceItems.map(item => ({
                            product_id: item.product_id,
                            warehouse_id: formData.warehouse_id,
                            quantity: item.quantity,
                            movement_type_id: outboundMovementTypeId,
                            reference: `Cotización ${invoiceData.invoice_number}`,
                            related_id: invoiceData.id,
                            movement_date: movementDateISO,
                            notes: `Venta a cliente, cotización #${invoiceData.invoice_number}`,
                            serial_id: item.serial_id || null
                        }));
                        console.log('[DEBUG] Stock movements to insert:', JSON.stringify(stockMovements, null, 2));
                        if (stockMovements.length) {
                            const { error: movementError } = await supabase
                                .from('stock_movements')
                                .insert(stockMovements);
                            if (movementError)
                                throw movementError;
                            console.log('[DEBUG] Stock movements inserted successfully');
                        }
                        // Actualizar status de seriales a 'sold'
                        const serialIds = invoiceItems
                            .filter(item => item.serial_id)
                            .map(item => item.serial_id);
                        if (serialIds.length > 0) {
                            const { error: serialUpdateError } = await supabase
                                .from('product_serials')
                                .update({ status: 'sold' })
                                .in('id', serialIds);
                            if (serialUpdateError)
                                throw serialUpdateError;
                        }
                    }
                    toast.success(`Cotización ${status === 'borrador' ? 'guardada como borrador' : 'emitida'} correctamente`);
                }
            }
            // Redirigir a la lista de cotizaciones
            navigate('/ventas/facturas');
        }
        catch (err) {
            toast.error(`Error: ${err.message}`);
        }
        finally {
            setIsSaving(false);
        }
    };
    const formatCurrency = (amount) => currency.format(amount);
    if (isLoading) {
        return (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    const { subtotal, taxAmount, discountAmount, total } = calculateInvoiceTotals();
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsxs("div", { children: [_jsxs(Link, { to: "/ventas/facturas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Cotizaciones"] }), _jsx("h1", { className: "text-2xl font-semibold", children: isEditing ? 'Editar Cotización' : 'Nueva Cotización' })] }) }), error && (_jsx("div", { className: "bg-red-50 border-l-4 border-red-500 p-4 mb-4", children: _jsx("p", { className: "text-red-700", children: error }) })), _jsxs("form", { onSubmit: (e) => handleSubmit(e, true), className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Cliente ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("select", { name: "customer_id", value: formData.customer_id, onChange: handleInputChange, required: true, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "-- Seleccione cliente --" }), customers.map(customer => (_jsxs("option", { value: customer.id, children: [customer.name, " ", customer.identification_number ? `(${customer.identification_number})` : ''] }, customer.id)))] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Almac\u00E9n ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("select", { name: "warehouse_id", value: formData.warehouse_id, onChange: handleInputChange, required: true, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "-- Seleccione almac\u00E9n --" }), warehouses.map(warehouse => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "N\u00FAmero de Cotizaci\u00F3n" }), _jsx("input", { type: "text", name: "invoice_number", value: formData.invoice_number, onChange: handleInputChange, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", readOnly: isEditing }), !isEditing && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Generado autom\u00E1ticamente. Puede cambiarlo si lo desea." }))] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Fecha de Cotizaci\u00F3n ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "date", value: invoiceDate, onChange: (e) => setInvoiceDate(e.target.value), required: true, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha de Vencimiento" }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "M\u00E9todo de Pago" }), _jsxs("select", { name: "payment_method", value: formData.payment_method, onChange: handleInputChange, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", children: [_jsx("option", { value: "efectivo", children: "Efectivo" }), _jsx("option", { value: "tarjeta", children: "Tarjeta" }), _jsx("option", { value: "transferencia", children: "Transferencia" }), _jsx("option", { value: "qr", children: "QR" }), _jsx("option", { value: "credito", children: "Cr\u00E9dito" })] })] })] }), _jsxs("div", { className: "border rounded-lg p-4 bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Agregar Productos" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm font-medium text-gray-700", children: "Descuento:" }), _jsx("button", { type: "button", onClick: () => setDiscountMode(discountMode === 'product' ? 'global' : 'product'), className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${discountMode === 'global' ? 'bg-blue-600' : 'bg-gray-300'}`, children: _jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${discountMode === 'global' ? 'translate-x-6' : 'translate-x-1'}` }) }), _jsx("span", { className: "text-sm text-gray-600", children: discountMode === 'product' ? 'Por Producto' : 'Global' })] }), discountMode === 'global' && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: "0", max: "100", step: "0.01", value: globalDiscountPercent, onChange: (e) => setGlobalDiscountPercent(Number(e.target.value) || 0), className: "w-20 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "0" }), _jsx("span", { className: "text-sm text-gray-600", children: "%" })] }))] })] }), _jsxs("div", { className: `grid grid-cols-1 gap-4 mb-4 ${discountMode === 'product' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`, children: [_jsxs("div", { className: "md:col-span-2", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Producto ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Buscar por nombre o SKU...", value: productSearchTerm, onChange: (e) => setProductSearchTerm(e.target.value), onKeyDownCapture: (event) => {
                                                                    event.stopPropagation();
                                                                }, onKeyDown: (event) => {
                                                                    event.stopPropagation();
                                                                }, onBeforeInput: (event) => {
                                                                    event.stopPropagation();
                                                                }, autoComplete: "off", className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" }), filteredProducts.length > 0 && (_jsx("div", { className: "absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md overflow-auto max-h-60 border border-gray-200", children: filteredProducts.map(product => {
                                                                    const searchLower = productSearchTerm.toLowerCase().trim();
                                                                    const matchesSku = product.sku?.toLowerCase().includes(searchLower);
                                                                    const availableStock = productStock[product.id] || 0;
                                                                    const stockColor = availableStock > 0 ? 'text-green-600' : 'text-red-600';
                                                                    return (_jsx("div", { className: "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors", onClick: () => {
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
                                                                        }, children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: product.name }), _jsxs("div", { className: `text-sm ${matchesSku ? 'text-blue-600 font-medium' : 'text-gray-500'}`, children: ["SKU: ", product.sku || 'Sin SKU'] })] }), _jsxs("div", { className: "text-right ml-2", children: [_jsxs("div", { className: `text-sm font-semibold ${stockColor}`, children: ["Stock: ", availableStock] }), !formData.warehouse_id && availableStock > 0 && (_jsx("div", { className: "text-xs text-gray-400", children: "(Total)" }))] })] }) }, product.id));
                                                                }) }))] })] }), currentItem.product_id && products.find(p => p.id === currentItem.product_id)?.tracking_method === 'serialized' ? (_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Serial ", _jsx("span", { className: "text-red-500", children: "*" }), _jsx("span", { className: "ml-2 text-xs text-purple-600 font-medium", children: "Producto Serializado" })] }), _jsxs("select", { value: selectedSerialId, onChange: (e) => {
                                                            setSelectedSerialId(e.target.value);
                                                            setCurrentItem(prev => ({ ...prev, quantity: e.target.value ? 1 : 0 }));
                                                        }, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", children: [_jsx("option", { value: "", children: "Seleccionar serial..." }), availableSerials[currentItem.product_id]?.map(serial => (_jsxs("option", { value: serial.id, children: [serial.serial_code, serial.vin && ` - VIN: ${serial.vin}`, serial.engine_number && ` - Motor: ${serial.engine_number}`, serial.year && ` - ${serial.year}`, serial.color && ` - ${serial.color}`] }, serial.id)))] }), currentItem.product_id && (!availableSerials[currentItem.product_id] || availableSerials[currentItem.product_id].length === 0) && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: "No hay seriales disponibles para este producto en la bodega seleccionada" }))] })) : (_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Cantidad ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "number", name: "quantity", min: "1", step: "1", value: currentItem.quantity, onChange: handleItemInputChange, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })] })), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Precio Unitario ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "number", name: "unit_price", min: "0", step: "0.01", value: currentItem.unit_price_display, onChange: handleItemInputChange, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })] }), discountMode === 'product' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Descuento (%)" }), _jsx("input", { type: "number", name: "discount_percent", min: "0", max: "100", step: "0.01", value: currentItem.discount_percent, onChange: handleItemInputChange, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })] }))] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { type: "button", onClick: addItemToInvoice, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Agregar Producto"] }) })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Productos en la Cotizaci\u00F3n" }), invoiceItems.length === 0 ? (_jsx("div", { className: "text-center py-8 border rounded-lg", children: _jsx("p", { className: "text-gray-500", children: "No hay productos agregados a la cotizaci\u00F3n" }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cantidad" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Disponible" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Precio Unit." }), discountMode === 'product' && (_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Descuento" })), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "IVA" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: invoiceItems.map((item, index) => {
                                                        const isEditingRow = editingItemIndex === index;
                                                        const availableStock = productStock[item.product_id] || 0;
                                                        const stockWarning = item.quantity > availableStock;
                                                        return (_jsxs("tr", { className: stockWarning ? 'bg-red-50' : '', children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium", children: item.product_name }), _jsxs("div", { className: "text-sm text-gray-500", children: ["SKU: ", item.product_sku] }), item.serial_id && (_jsxs("div", { className: "text-xs text-purple-600 font-medium mt-1", children: ["Serial: ", availableSerials[item.product_id]?.find(s => s.id === item.serial_id)?.serial_code || item.serial_id] }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: isEditingRow ? (_jsx("input", { type: "number", min: "0", step: "0.01", value: editingItemDraft?.quantity ?? '', onChange: (e) => updateEditingDraft('quantity', e.target.value), className: "w-24 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" })) : (item.quantity) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: `font-semibold ${stockWarning ? 'text-red-600' : 'text-green-600'}`, children: availableStock }), stockWarning && (_jsx("div", { className: "text-xs text-red-500", children: "\u00A1Stock insuficiente!" }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: isEditingRow ? (_jsxs("div", { className: "space-y-1", children: [_jsx("input", { type: "number", min: "0", step: "0.01", value: editingItemDraft?.unit_price ?? '', onChange: (e) => updateEditingDraft('unit_price', e.target.value), className: "w-28 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Actual: ", formatCurrency(item.unit_price)] })] })) : (formatCurrency(item.unit_price)) }), discountMode === 'product' && (_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: isEditingRow ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: "0", max: "100", step: "0.01", value: editingItemDraft?.discount_percent ?? '', onChange: (e) => updateEditingDraft('discount_percent', e.target.value), className: "w-24 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500" }), _jsx("span", { className: "text-xs text-gray-500", children: formatCurrency(item.discount_amount) })] })) : item.discount_percent > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [item.discount_percent, "%"] }), _jsx("div", { className: "text-sm text-gray-500", children: formatCurrency(item.discount_amount) })] })) : ('-') })), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { children: [item.tax_rate, "%"] }), _jsx("div", { className: "text-sm text-gray-500", children: formatCurrency(item.tax_amount) })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: formatCurrency(item.total_price) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: isEditingRow ? (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => saveEditingInvoiceItem(index), className: "text-green-600 hover:text-green-800", children: _jsx("i", { className: "fas fa-check" }) }), _jsx("button", { type: "button", onClick: cancelEditingInvoiceItem, className: "text-gray-500 hover:text-gray-700", children: _jsx("i", { className: "fas fa-times" }) })] })) : (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => startEditingInvoiceItem(index), className: "text-blue-600 hover:text-blue-800", children: _jsx("i", { className: "fas fa-pen" }) }), _jsx("button", { type: "button", onClick: () => removeItemFromInvoice(index), className: "text-red-600 hover:text-red-900", children: _jsx("i", { className: "fas fa-trash-alt" }) })] })) })] }, `${item.product_id}-${index}`));
                                                    }) })] }) }))] }), invoiceItems.length > 0 && (_jsx("div", { className: "flex justify-end", children: _jsxs("div", { className: "w-full md:w-1/3 space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Subtotal:" }), _jsx("span", { children: formatCurrency(subtotal) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { children: ["Descuentos:", discountMode === 'global' && globalDiscountPercent > 0 && (_jsxs("span", { className: "ml-1 text-xs text-blue-600", children: ["(", globalDiscountPercent, "% global)"] }))] }), _jsx("span", { children: formatCurrency(discountAmount) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "IVA:" }), _jsx("span", { children: formatCurrency(taxAmount) })] }), _jsxs("div", { className: "flex justify-between font-bold text-lg", children: [_jsx("span", { children: "Total:" }), _jsx("span", { children: formatCurrency(total) })] })] }) })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Notas" }), _jsx("textarea", { name: "notes", value: formData.notes, onChange: handleInputChange, rows: 3, className: "w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500", placeholder: "Agregar notas o comentarios adicionales..." })] })] }), _jsxs("div", { className: "px-6 py-4 bg-gray-50 flex justify-end space-x-3", children: [_jsx(Link, { to: "/ventas/facturas", className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50", children: "Cancelar" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", disabled: isSaving, children: isSaving ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner fa-spin mr-2" }), isEditing ? 'Actualizando...' : 'Guardando...'] })) : (_jsx(_Fragment, { children: "Guardar como Borrador" })) }), _jsx("button", { type: "button", onClick: (e) => handleSubmit(e, false), className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700", disabled: isSaving, children: isSaving ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner fa-spin mr-2" }), "Emitiendo..."] })) : (_jsx(_Fragment, { children: "Emitir Cotizaci\u00F3n" })) })] })] })] }));
};
export default InvoiceForm;
