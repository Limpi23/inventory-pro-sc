import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import PrintableOrder from '../components/PrintableOrder';
const PurchaseOrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [order, setOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isReceivingItems, setIsReceivingItems] = useState(false);
    const [receivedItems, setReceivedItems] = useState({});
    const [receivingError, setReceivingError] = useState({});
    const [printFormat, setPrintFormat] = useState({ value: 'letter', label: 'Carta' });
    const [showPrintOptions, setShowPrintOptions] = useState(false);
    const printRef = useRef(null);
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
            if (orderError)
                throw orderError;
            // Cast defensivo: el resultado de supabase se tipa como any/unknown
            // Aseguramos estructura mínima para evitar fallo de tipos en TS
            const normalized = {
                id: orderData.id,
                supplier_id: orderData.supplier_id,
                warehouse_id: orderData.warehouse_id,
                order_date: orderData.order_date,
                status: orderData.status,
                total_amount: orderData.total_amount ?? 0,
                created_at: orderData.created_at ?? new Date().toISOString(),
                updated_at: orderData.updated_at ?? orderData.created_at ?? new Date().toISOString(),
                supplier: {
                    id: orderData?.supplier?.id || '',
                    name: orderData?.supplier?.name || 'Desconocido',
                    contact_name: orderData?.supplier?.contact_name || '',
                    phone: orderData?.supplier?.phone || '',
                    email: orderData?.supplier?.email || '',
                    address: orderData?.supplier?.address || ''
                },
                warehouse: {
                    id: orderData?.warehouse?.id || '',
                    name: orderData?.warehouse?.name || 'Principal',
                    location: orderData?.warehouse?.location || ''
                }
            };
            setOrder(normalized);
            // Obtener los items de la orden
            const { data: itemsData, error: itemsError } = await client.from('purchase_order_items')
                .select(`
          *,
          product:products(id, name, sku)
        `)
                .eq('purchase_order_id', id);
            if (itemsError)
                throw itemsError;
            // Al obtener los items, agregar order_id si falta
            const itemsWithOrderId = (itemsData || []).map((item) => ({
                ...item,
                order_id: item.purchase_order_id || id
            }));
            setOrderItems(itemsWithOrderId);
            // Inicializar el objeto de cantidades recibidas
            const initialReceivedItems = {};
            itemsWithOrderId.forEach(item => {
                initialReceivedItems[item.id] = 0;
            });
            setReceivedItems(initialReceivedItems);
        }
        catch (err) {
            console.error('Error al cargar detalles de la orden:', err);
            setError(err.message);
        }
        finally {
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
            if (error)
                throw error;
            toast.success('Orden cancelada correctamente');
            fetchOrderDetails();
        }
        catch (err) {
            console.error('Error al cancelar la orden:', err);
            toast.error('Error al cancelar la orden: ' + err.message);
        }
    };
    // Función para cancelar el modo de recepción
    const handleCancelReceiving = () => {
        // Si estamos en la ruta específica de recepción, volvemos a la vista de detalle
        if (location.pathname.includes('/recibir')) {
            navigate(`/ordenes-compra/${id}`);
        }
        else {
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
        const initialReceivedItems = {};
        orderItems.forEach(item => {
            initialReceivedItems[item.id] = 0;
        });
        setReceivedItems(initialReceivedItems);
        setReceivingError({});
        setIsReceivingItems(true);
    };
    const handleReceiveQuantityChange = (itemId, quantity, maxQuantity) => {
        if (quantity < 0)
            quantity = 0;
        if (quantity > maxQuantity)
            quantity = maxQuantity;
        setReceivedItems(prev => ({
            ...prev,
            [itemId]: quantity
        }));
        // Limpiar error si es que había
        if (receivingError[itemId]) {
            setReceivingError(prev => {
                const newErrors = { ...prev };
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
                if (!item)
                    throw new Error(`Ítem no encontrado: ${itemId}`);
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
            if (receiptError)
                throw receiptError;
            // Actualizar cantidades recibidas en los ítems de la orden
            for (const [itemId, receivedQty] of Object.entries(receivedItems)) {
                if (receivedQty <= 0)
                    continue;
                const item = orderItems.find(i => i.id === itemId);
                if (!item)
                    continue;
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
                if (updateError)
                    throw updateError;
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
            if (orderUpdateError)
                throw orderUpdateError;
            toast.success('Mercancía recibida correctamente');
            setIsReceivingItems(false);
            // Recargar datos
            fetchOrderDetails();
            // Mostrar opciones de impresión
            handleShowPrintOptions();
        }
        catch (err) {
            console.error('Error al registrar recepción:', err);
            toast.error('Error al registrar recepción: ' + err.message);
        }
    };
    const calculateRemainingItems = (item) => {
        return item.quantity - (item.received_quantity || 0);
    };
    const calculateOrderProgress = () => {
        if (!orderItems.length)
            return 0;
        const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const receivedItems = orderItems.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
        return (receivedItems / totalItems) * 100;
    };
    // Formatear moneda
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2
        }).format(amount);
    };
    // Formatear fecha
    const formatDate = (dateString) => {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date(dateString).toLocaleDateString('es-CO', options);
    };
    // Renderizar el badge de estado
    const renderStatusBadge = (status) => {
        const statusConfig = {
            'borrador': { color: 'bg-gray-100 text-gray-800', icon: 'fa-pencil', text: 'Borrador' },
            'enviada': { color: 'bg-blue-100 text-blue-800', icon: 'fa-paper-plane', text: 'Enviada' },
            'recibida_parcialmente': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-truck-loading', text: 'Recibida Parcialmente' },
            'completada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Completada' },
            'cancelada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Cancelada' }
        };
        const config = statusConfig[status] || statusConfig.borrador;
        return (_jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`, children: [_jsx("i", { className: `fas ${config.icon} mr-1` }), config.text] }));
    };
    // Función para mostrar las opciones de impresión
    const handleShowPrintOptions = () => {
        setShowPrintOptions(true);
    };
    // Función para cambiar el formato de impresión
    const handlePrintFormatChange = (format) => {
        setPrintFormat(format);
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    if (error || !order) {
        return (_jsxs("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: [_jsx("p", { children: error || 'Orden no encontrada' }), _jsx(Link, { to: "/ordenes-compra", className: "text-red-700 hover:text-red-900 underline mt-2 inline-block", children: "Volver a la lista de \u00F3rdenes" })] }));
    }
    // Determinar si estamos en la ruta de recepción
    const isReceivingRoute = location.pathname.includes('/recibir');
    // Si estamos en la ruta de recepción pero no tenemos activo el modo, activarlo
    if (isReceivingRoute && !isReceivingItems) {
        setIsReceivingItems(true);
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ordenes-compra", className: "inline-flex items-center text-blue-600 hover:text-blue-800 mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a \u00D3rdenes de Compra"] }), _jsx("h1", { className: "text-2xl font-semibold", children: location.pathname.includes('/recibir') ?
                                    `Recibir Mercancía - Orden #${id}` :
                                    `Orden de Compra #${id}` })] }), _jsxs("div", { className: "space-x-3 mt-3 md:mt-0", children: [_jsxs("button", { onClick: handleShowPrintOptions, className: "px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir"] }), order.status === 'borrador' && (_jsxs(Link, { to: `/ordenes-compra/editar/${id}`, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400", children: [_jsx("i", { className: "fas fa-edit mr-2" }), "Editar"] })), ['enviada', 'recibida_parcialmente'].includes(order.status) && (_jsxs("button", { onClick: handleReceiveItems, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400", children: [_jsx("i", { className: "fas fa-truck-loading mr-2" }), "Recibir Mercanc\u00EDa"] })), ['borrador', 'enviada'].includes(order.status) && (_jsxs("button", { onClick: handleCancelOrder, className: "px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Cancelar Orden"] }))] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Estado" }), _jsx("div", { className: "mt-1", children: renderStatusBadge(order.status) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Fecha de Orden" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: formatDate(order.order_date) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Total" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-gray-900", children: formatCurrency(order.total_amount) })] })] }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsxs("div", { className: "mt-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h3", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Progreso de recepci\u00F3n" }), _jsxs("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: [Math.round(calculateOrderProgress()), "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2", children: _jsx("div", { className: "bg-green-500 h-2 rounded-full", style: { width: `${calculateOrderProgress()}%` } }) })] })), _jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3 dark:text-gray-200", children: "Productos" }), isReceivingItems ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Ordenados" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Recibidos" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Pendientes" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cantidad a Recibir" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: orderItems.map(item => {
                                                        return (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [_jsx("div", { className: "font-medium", children: item.product.name }), _jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", item.product.sku] })] }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: item.received_quantity || 0 }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: calculateRemainingItems(item) }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("button", { type: "button", onClick: () => handleReceiveQuantityChange(item.id, (receivedItems[item.id] || 0) - 1, calculateRemainingItems(item)), className: "px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-l-md hover:bg-gray-300 dark:hover:bg-gray-500", disabled: calculateRemainingItems(item) === 0, children: _jsx("i", { className: "fas fa-minus" }) }), _jsx("input", { type: "number", value: receivedItems[item.id] || 0, onChange: (e) => handleReceiveQuantityChange(item.id, parseInt(e.target.value) || 0, calculateRemainingItems(item)), className: "w-16 text-center border-t border-b border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 py-1", min: "0", max: calculateRemainingItems(item), disabled: calculateRemainingItems(item) === 0 }), _jsx("button", { type: "button", onClick: () => handleReceiveQuantityChange(item.id, (receivedItems[item.id] || 0) + 1, calculateRemainingItems(item)), className: "px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-r-md hover:bg-gray-300 dark:hover:bg-gray-500", disabled: calculateRemainingItems(item) === 0 || (receivedItems[item.id] || 0) >= calculateRemainingItems(item), children: _jsx("i", { className: "fas fa-plus" }) })] }), receivingError[item.id] && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: receivingError[item.id] }))] }) })] }, item.id));
                                                    }) })] }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Precio Unit." }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Total" }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Recibidos" }))] }) }), _jsxs("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: [orderItems.map(item => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [_jsx("div", { className: "font-medium", children: item.product.name }), _jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", item.product.sku] })] }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: formatCurrency(item.unit_price) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: formatCurrency(item.total_price) }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsx("td", { className: "py-3 px-4 text-sm text-right", children: _jsxs("span", { className: item.received_quantity === item.quantity ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400', children: [item.received_quantity || 0, " / ", item.quantity] }) }))] }, item.id))), _jsxs("tr", { className: "bg-gray-50 dark:bg-gray-700", children: [_jsx("td", { colSpan: 3, className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: "Total:" }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-bold dark:text-gray-300", children: formatCurrency(order.total_amount) }), ['recibida_parcialmente', 'completada'].includes(order.status) && _jsx("td", {})] })] })] }) })), isReceivingItems && (_jsxs("div", { className: "mt-4 flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: handleCancelReceiving, className: "px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400", children: "Cancelar" }), _jsxs("button", { type: "button", onClick: handleSaveReceived, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400", children: [_jsx("i", { className: "fas fa-save mr-2" }), "Guardar Recepci\u00F3n"] })] }))] })] }), _jsxs("div", { children: [_jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3 dark:text-gray-200", children: "Informaci\u00F3n del Proveedor" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Nombre" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.name })] }), order.supplier.contact_name && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Contacto" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.contact_name })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [order.supplier.phone && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Tel\u00E9fono" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.phone })] })), order.supplier.email && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Email" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.email })] }))] }), order.supplier.address && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Direcci\u00F3n" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.address })] }))] }), _jsx("div", { className: "mt-4", children: _jsxs(Link, { to: `/proveedores/${order.supplier.id}/compras`, className: "text-blue-600 hover:text-blue-800 text-sm flex items-center", children: [_jsx("i", { className: "fas fa-history mr-1" }), "Ver historial de compras"] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3", children: "Almac\u00E9n de Destino" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Nombre" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: order.warehouse.name })] }), order.warehouse.location && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Ubicaci\u00F3n" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: order.warehouse.location })] }))] })] })] })] }), showPrintOptions && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-md", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Opciones de Impresi\u00F3n" }), _jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Seleccione el formato de impresi\u00F3n:" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { onClick: () => handlePrintFormatChange({ value: 'letter', label: 'Carta' }), className: `px-4 py-2 border rounded-md ${printFormat.value === 'letter'
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`, children: [_jsx("i", { className: "fas fa-file-alt mr-2" }), "Carta"] }), _jsxs("button", { onClick: () => handlePrintFormatChange({ value: 'roll', label: 'Rollo' }), className: `px-4 py-2 border rounded-md ${printFormat.value === 'roll'
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`, children: [_jsx("i", { className: "fas fa-receipt mr-2" }), "Rollo"] })] })] }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { onClick: handleClosePrintOptions, className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400", children: "Cancelar" }), _jsxs("button", { onClick: handlePrint, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir"] })] })] }) })), _jsx("div", { style: { display: 'none' }, children: _jsx("div", { ref: printRef, children: _jsx(PrintableOrder, { order: order, orderItems: orderItems, format: printFormat.value, formatCurrency: formatCurrency, formatDate: formatDate }) }) })] }));
};
export default PurchaseOrderDetail;
