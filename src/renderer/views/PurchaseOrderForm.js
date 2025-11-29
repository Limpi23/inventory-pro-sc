import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { supabase, logAppEvent } from '../lib/supabase';
import PurchaseOrderItemsImport from '../components/purchase/PurchaseOrderItemsImport';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
import { getLocalDateISOString } from '../lib/dateUtils';
const PurchaseOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const preselectedSupplierId = queryParams.get('supplier');
    const isEditing = !!id;
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [orderItems, setOrderItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [orderDate, setOrderDate] = useState(getLocalDateISOString());
    const [formData, setFormData] = useState({
        supplier_id: '',
        warehouse_id: '',
        status: 'borrador'
    });
    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        quantity: 1,
        unit_price: 0
    });
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const productSearchInputRef = useRef(null);
    useEffect(() => {
        fetchSuppliers();
        fetchWarehouses();
        fetchProducts();
        if (isEditing) {
            fetchOrderDetails();
        }
        else if (preselectedSupplierId) {
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
            const filtered = products.filter(product => product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                product.sku.toLowerCase().includes(productSearchTerm.toLowerCase()));
            setFilteredProducts(filtered);
        }
        else {
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
            if (error)
                throw error;
            setSuppliers((data || []));
        }
        catch (err) {
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
            if (error)
                throw error;
            setWarehouses((data || []));
        }
        catch (err) {
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
            if (error)
                throw error;
            setProducts((data || []));
        }
        catch (err) {
            console.error('Error cargando productos:', err);
            setError(err.message);
        }
        finally {
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
            if (orderError)
                throw orderError;
            if (orderData) {
                const od = orderData;
                setFormData({
                    supplier_id: String(od.supplier_id || ''),
                    warehouse_id: String(od.warehouse_id || ''),
                    status: String(od.status || 'borrador')
                });
                setOrderDate(String(od.order_date || getLocalDateISOString()));
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
                        total_price: item.total_price
                    }));
                    setOrderItems(formattedItems);
                }
            }
        }
        catch (err) {
            console.error('Error cargando detalles de la orden:', err);
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
        }
        else {
            // Agregar nuevo producto a la orden
            const newItem = {
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
    const addImportedItems = (items) => {
        setOrderItems(prev => {
            const map = new Map(prev.map(i => [i.product_id, { ...i }]));
            for (const it of items) {
                const existing = map.get(it.product_id);
                if (existing) {
                    existing.quantity += it.quantity;
                    existing.unit_price = it.unit_price;
                    existing.total_price = existing.quantity * existing.unit_price;
                }
                else {
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
    const removeItemFromOrder = (index) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };
    const calculateTotal = () => {
        return orderItems.reduce((sum, item) => sum + item.total_price, 0);
    };
    const handleSubmit = async (e, saveAsDraft = true) => {
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
                if (updateError)
                    throw updateError;
                // Eliminar items existentes
                const { error: deleteError } = await client
                    .from('purchase_order_items')
                    .delete()
                    .eq('purchase_order_id', id);
                if (deleteError)
                    throw deleteError;
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
                if (insertError)
                    throw insertError;
                // Log de actualización de orden
                await logAppEvent('purchase_order.update', 'purchase_order', id, { status, total, items_count: items.length });
                navigate(`/ordenes-compra/${id}`);
            }
            else {
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
                if (orderError)
                    throw orderError;
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
                    if (itemsError)
                        throw itemsError;
                    // Log de creación de orden
                    await logAppEvent('purchase_order.create', 'purchase_order', newOrderId, { status, total, items_count: items.length, supplier_id: formData.supplier_id, warehouse_id: formData.warehouse_id });
                    navigate(`/ordenes-compra/${newOrderId}`);
                }
            }
        }
        catch (err) {
            console.error('Error guardando orden de compra:', err);
            setError(err.message);
        }
        finally {
            setIsSaving(false);
        }
    };
    // Moneda y formato centralizado
    const { format: formatCurrency } = useCurrency();
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsxs("div", { children: [_jsxs(Link, { to: "/ordenes-compra", className: "inline-flex items-center text-blue-600 hover:text-blue-800 mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a \u00D3rdenes de Compra"] }), _jsx("h1", { className: "text-2xl font-semibold", children: isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra' })] }) }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsx("div", { className: "bg-white p-6 rounded-lg shadow-md", children: _jsxs("form", { onSubmit: (e) => handleSubmit(e, true), children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "supplier_id", className: "block text-sm font-medium text-gray-700 mb-1", children: "Proveedor *" }), _jsxs("select", { id: "supplier_id", name: "supplier_id", value: formData.supplier_id, onChange: handleInputChange, required: true, className: "w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador', children: [_jsx("option", { value: "", children: "Seleccionar proveedor" }), suppliers.map(supplier => (_jsx("option", { value: supplier.id, children: supplier.name }, supplier.id)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "warehouse_id", className: "block text-sm font-medium text-gray-700 mb-1", children: "Almac\u00E9n de destino *" }), _jsxs("select", { id: "warehouse_id", name: "warehouse_id", value: formData.warehouse_id, onChange: handleInputChange, required: true, className: "w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador', children: [_jsx("option", { value: "", children: "Seleccionar almac\u00E9n" }), warehouses.map(warehouse => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "order_date", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha de orden *" }), _jsx("input", { type: "date", id: "order_date", value: orderDate, onChange: (e) => setOrderDate(e.target.value), required: true, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador' })] })] }), _jsxs("div", { className: "mb-6 border p-4 rounded-md bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Agregar Productos" }), _jsx(PurchaseOrderItemsImport, { products: products, onImport: addImportedItems, size: "sm", disabled: isEditing && formData.status !== 'borrador' })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { htmlFor: "product_search", className: "block text-sm font-medium text-gray-700 mb-1", children: "Buscar Producto" }), _jsxs("div", { className: "relative", children: [_jsx("input", { ref: productSearchInputRef, type: "text", id: "product_search", placeholder: "Buscar por nombre o SKU...", value: productSearchTerm, onChange: (e) => setProductSearchTerm(e.target.value), onKeyDownCapture: (e) => {
                                                                // Evitar que atajos/handlers globales bloqueen la escritura en este campo
                                                                e.stopPropagation();
                                                            }, onKeyDown: (e) => {
                                                                // Bloquear burbujeo hacia handlers globales
                                                                e.stopPropagation();
                                                            }, onBeforeInput: (e) => {
                                                                // Aislar del documento para que no se intercepten teclas
                                                                e.stopPropagation();
                                                            }, autoComplete: "off", className: "w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador' }), productSearchTerm && filteredProducts.length > 0 && (_jsx("div", { className: "absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto", children: filteredProducts.map(product => (_jsxs("div", { className: "px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0", onClick: () => {
                                                                    setCurrentItem(prev => ({
                                                                        ...prev,
                                                                        product_id: product.id,
                                                                        unit_price: product.purchase_price || 0
                                                                    }));
                                                                    setProductSearchTerm(product.name);
                                                                }, children: [_jsx("div", { className: "font-medium", children: product.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", product.sku] })] }, product.id))) }))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "quantity", className: "block text-sm font-medium text-gray-700 mb-1", children: "Cantidad" }), _jsx("input", { type: "number", id: "quantity", name: "quantity", value: currentItem.quantity, onChange: handleItemInputChange, min: "1", step: "1", className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador' })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "unit_price", className: "block text-sm font-medium text-gray-700 mb-1", children: "Precio Unitario" }), _jsx("input", { type: "number", id: "unit_price", name: "unit_price", value: currentItem.unit_price, onChange: handleItemInputChange, min: "0", step: "0.01", className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", disabled: isEditing && formData.status !== 'borrador' })] })] }), _jsx("div", { className: "mt-4 flex justify-end", children: _jsxs("button", { type: "button", onClick: addItemToOrder, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50", disabled: (isEditing && formData.status !== 'borrador') || !currentItem.product_id, children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Agregar a la Orden"] }) })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Productos en la Orden" }), orderItems.length === 0 ? (_jsxs("div", { className: "bg-gray-50 dark:bg-gray-800 rounded-md p-8 text-center", children: [_jsx("i", { className: "fas fa-shopping-cart text-gray-300 dark:text-gray-600 text-4xl mb-2" }), _jsx("p", { className: "text-gray-500 dark:text-gray-400", children: "No hay productos agregados a la orden" })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Precio Unit." }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Total" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Acciones" })] }) }), _jsxs("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: [orderItems.map((item, index) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [_jsx("div", { className: "font-medium", children: item.product_name }), _jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", item.product_sku] })] }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: formatCurrency(item.unit_price) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: formatCurrency(item.total_price) }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: (formData.status === 'borrador' || !isEditing) && (_jsx("button", { type: "button", onClick: () => removeItemFromOrder(index), className: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus:outline-none rounded-md p-1", title: "Eliminar", children: _jsx("i", { className: "fas fa-trash" }) })) })] }, index))), _jsxs("tr", { className: "bg-gray-50 dark:bg-gray-700", children: [_jsx("td", { colSpan: 3, className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: "Total:" }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-bold dark:text-gray-300", children: formatCurrency(calculateTotal()) }), _jsx("td", {})] })] })] }) }))] }), _jsxs("div", { className: "mt-6 flex justify-end space-x-3", children: [_jsx(Link, { to: "/ordenes-compra", className: "px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400", children: "Cancelar" }), (!isEditing || formData.status === 'borrador') && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "submit", className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50", disabled: isSaving || orderItems.length === 0, children: [_jsx("i", { className: "fas fa-save mr-2" }), "Guardar como Borrador"] }), _jsxs("button", { type: "button", onClick: (e) => handleSubmit(e, false), className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50", disabled: isSaving || orderItems.length === 0, children: [_jsx("i", { className: "fas fa-paper-plane mr-2" }), "Enviar Orden"] })] }))] })] }) }))] }));
};
export default PurchaseOrderForm;
