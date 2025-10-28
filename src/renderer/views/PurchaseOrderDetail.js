import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase, logAppEvent } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import PrintableOrder from '../components/PrintableOrder';
import { useCurrency } from '../hooks/useCurrency';
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
    // Selección de ubicación para recepción
    const [receiveLocations, setReceiveLocations] = useState([]);
    const [receiveLocationId, setReceiveLocationId] = useState('');
    // Estados para gestión de seriales
    const [serializedItems, setSerializedItems] = useState({});
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
    // Cargar ubicaciones del almacén de la orden para recepción
    useEffect(() => {
        (async () => {
            try {
                const whId = order?.warehouse_id;
                if (!whId) {
                    setReceiveLocations([]);
                    setReceiveLocationId('');
                    return;
                }
                const client = await supabase.getClient();
                const { data, error } = await client
                    .from('locations')
                    .select('id, name')
                    .eq('warehouse_id', whId)
                    .order('name');
                if (error)
                    throw error;
                setReceiveLocations(data?.map(l => ({ id: l.id, name: l.name })) || []);
                if (!data || !data.find(l => l.id === receiveLocationId)) {
                    setReceiveLocationId('');
                }
            }
            catch (e) {
                console.error('Error cargando ubicaciones para recepción:', e);
                setReceiveLocations([]);
                setReceiveLocationId('');
            }
        })();
    }, [order?.warehouse_id, isReceivingItems]);
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
                    contact_info: orderData?.supplier?.contact_info || {}
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
          product:products(id, name, sku, tracking_method)
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
            // Log de cancelación
            await logAppEvent('purchase_order.cancel', 'purchase_order', id, null);
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
    // Funciones para manejar seriales
    const handleAddSerial = (itemId) => {
        setSerializedItems(prev => ({
            ...prev,
            [itemId]: [
                ...(prev[itemId] || []),
                { serial_code: '', vin: '', engine_number: '', year: undefined, color: '' }
            ]
        }));
    };
    const handleRemoveSerial = (itemId, index) => {
        setSerializedItems(prev => ({
            ...prev,
            [itemId]: (prev[itemId] || []).filter((_, i) => i !== index)
        }));
    };
    const handleSerialChange = (itemId, index, field, value) => {
        setSerializedItems(prev => {
            const serials = [...(prev[itemId] || [])];
            serials[index] = {
                ...serials[index],
                [field]: value
            };
            return {
                ...prev,
                [itemId]: serials
            };
        });
    };
    const handleSaveReceived = async () => {
        // Validar que al menos un ítem haya sido recibido
        const hasReceivedItems = Object.values(receivedItems).some(qty => qty > 0);
        if (!hasReceivedItems) {
            toast.error('Debe ingresar al menos una cantidad recibida');
            return;
        }
        // Validar seriales para productos serializados
        for (const [itemId, qty] of Object.entries(receivedItems)) {
            if (qty <= 0)
                continue;
            const item = orderItems.find(i => i.id === itemId);
            if (!item)
                continue;
            if (item.product.tracking_method === 'serialized') {
                const serials = serializedItems[itemId] || [];
                // Validar que haya el número correcto de seriales
                if (serials.length !== qty) {
                    toast.error(`El producto "${item.product.name}" requiere ${qty} seriales, pero solo has ingresado ${serials.length}`);
                    return;
                }
                // Validar que todos los seriales tengan serial_code
                for (let i = 0; i < serials.length; i++) {
                    if (!serials[i].serial_code || serials[i].serial_code.trim() === '') {
                        toast.error(`El serial #${i + 1} del producto "${item.product.name}" requiere un código de serie`);
                        return;
                    }
                }
                // Validar que no haya códigos duplicados dentro del mismo producto
                const serialCodes = serials.map(s => s.serial_code.trim());
                const uniqueCodes = new Set(serialCodes);
                if (uniqueCodes.size !== serialCodes.length) {
                    toast.error(`Hay códigos de serie duplicados para el producto "${item.product.name}"`);
                    return;
                }
            }
        }
        // Validar ubicación
        if (!receiveLocationId) {
            toast.error('Selecciona una ubicación de destino');
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
            // Registrar movimientos de stock (IN_PURCHASE) con ubicación
            const { data: mt, error: mtError } = await client
                .from('movement_types')
                .select('id, code')
                .eq('code', 'IN_PURCHASE')
                .single();
            if (mtError)
                throw mtError;
            const movementTypeId = mt?.id;
            if (!movementTypeId)
                throw new Error('Tipo de movimiento IN_PURCHASE no disponible');
            const movementDate = new Date().toISOString();
            const stockMovements = Object.entries(receivedItems)
                .filter(([_, qty]) => qty > 0)
                .map(([itemId, receivedQty]) => {
                const item = orderItems.find(i => i.id === itemId);
                if (!item)
                    return null;
                return {
                    product_id: item.product_id,
                    warehouse_id: order?.warehouse_id,
                    location_id: receiveLocationId,
                    quantity: receivedQty,
                    movement_type_id: movementTypeId,
                    movement_date: movementDate,
                    reference: `Recepción orden #${id}`,
                    notes: null
                };
            })
                .filter(Boolean);
            if (stockMovements.length) {
                const { error: smError } = await client
                    .from('stock_movements')
                    .insert(stockMovements);
                if (smError)
                    throw smError;
            }
            // Insertar seriales para productos serializados
            for (const [itemId, serials] of Object.entries(serializedItems)) {
                const item = orderItems.find(i => i.id === itemId);
                if (!item || item.product.tracking_method !== 'serialized')
                    continue;
                const serialRecords = serials.map(serial => ({
                    product_id: item.product_id,
                    serial_code: serial.serial_code,
                    vin: serial.vin || null,
                    engine_number: serial.engine_number || null,
                    year: serial.year || null,
                    color: serial.color || null,
                    warehouse_id: order?.warehouse_id,
                    location_id: receiveLocationId,
                    status: 'in_stock',
                    purchase_order_id: id
                }));
                if (serialRecords.length > 0) {
                    const { error: serialError } = await client
                        .from('product_serials')
                        .insert(serialRecords);
                    if (serialError)
                        throw serialError;
                }
            }
            // Actualizar cantidades recibidas en los ítems de la orden
            for (const [itemId, receivedQty] of Object.entries(receivedItems)) {
                const qtyNum = receivedQty;
                if (qtyNum <= 0)
                    continue;
                const item = orderItems.find(i => i.id === itemId);
                if (!item)
                    continue;
                const newReceivedQty = (item.received_quantity || 0) + qtyNum;
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
            // Log de recepción
            await logAppEvent('purchase_order.receive', 'purchase_order', id, { received_count: Object.values(receivedItems).filter(q => q > 0).length, total_received: Object.values(receivedItems).reduce((a, b) => a + b, 0), location_id: receiveLocationId, new_status: newStatus });
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
    // Moneda y formato centralizado (muestra en Bs u otra moneda configurada)
    const { format: formatCurrency, settings: currencySettings } = useCurrency();
    // Formatear fecha
    const formatDate = (dateString) => {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date(dateString).toLocaleDateString(currencySettings.locale || 'es-BO', options);
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
                                    `Orden de Compra #${id}` })] }), _jsxs("div", { className: "space-x-3 mt-3 md:mt-0", children: [_jsxs("button", { onClick: handleShowPrintOptions, className: "px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir"] }), order.status === 'borrador' && (_jsxs(Link, { to: `/ordenes-compra/editar/${id}`, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400", children: [_jsx("i", { className: "fas fa-edit mr-2" }), "Editar"] })), ['enviada', 'recibida_parcialmente'].includes(order.status) && (_jsxs("button", { onClick: handleReceiveItems, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400", children: [_jsx("i", { className: "fas fa-truck-loading mr-2" }), "Recibir Mercanc\u00EDa"] })), ['borrador', 'enviada'].includes(order.status) && (_jsxs("button", { onClick: handleCancelOrder, className: "px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Cancelar Orden"] }))] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Estado" }), _jsx("div", { className: "mt-1", children: renderStatusBadge(order.status) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Fecha de Orden" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: formatDate(order.order_date) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Total" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-gray-900", children: formatCurrency(order.total_amount) })] })] }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsxs("div", { className: "mt-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h3", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Progreso de recepci\u00F3n" }), _jsxs("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: [Math.round(calculateOrderProgress()), "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2", children: _jsx("div", { className: "bg-green-500 h-2 rounded-full", style: { width: `${calculateOrderProgress()}%` } }) })] })), _jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3 dark:text-gray-200", children: "Productos" }), isReceivingItems ? (_jsxs("div", { children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Ubicaci\u00F3n Destino *" }), _jsxs("select", { value: receiveLocationId, onChange: (e) => setReceiveLocationId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", disabled: !receiveLocations.length, children: [_jsx("option", { value: "", children: receiveLocations.length ? 'Selecciona una ubicación' : 'No hay ubicaciones disponibles' }), receiveLocations.map((loc) => (_jsx("option", { value: loc.id, children: loc.name }, loc.id)))] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Ordenados" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Recibidos" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Pendientes" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cantidad a Recibir" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: orderItems.map(item => {
                                                                const isSerializedProduct = item.product.tracking_method === 'serialized';
                                                                const receivedQty = receivedItems[item.id] || 0;
                                                                const itemSerials = serializedItems[item.id] || [];
                                                                return (_jsxs(React.Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [_jsx("div", { className: "font-medium", children: item.product.name }), _jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", item.product.sku] }), isSerializedProduct && (_jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1", children: "Serializado" }))] }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: item.received_quantity || 0 }), _jsx("td", { className: "py-3 px-4 text-sm text-center dark:text-gray-300", children: calculateRemainingItems(item) }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("button", { type: "button", onClick: () => {
                                                                                                            const newQty = receivedQty - 1;
                                                                                                            handleReceiveQuantityChange(item.id, newQty, calculateRemainingItems(item));
                                                                                                            // Ajustar seriales si es necesario
                                                                                                            if (isSerializedProduct && itemSerials.length > newQty) {
                                                                                                                handleRemoveSerial(item.id, itemSerials.length - 1);
                                                                                                            }
                                                                                                        }, className: "px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-l-md hover:bg-gray-300 dark:hover:bg-gray-500", disabled: calculateRemainingItems(item) === 0, children: _jsx("i", { className: "fas fa-minus" }) }), _jsx("input", { type: "number", value: receivedQty, onChange: (e) => {
                                                                                                            const newQty = parseInt(e.target.value) || 0;
                                                                                                            handleReceiveQuantityChange(item.id, newQty, calculateRemainingItems(item));
                                                                                                            // Ajustar seriales automáticamente
                                                                                                            if (isSerializedProduct) {
                                                                                                                const currentSerialCount = itemSerials.length;
                                                                                                                if (newQty > currentSerialCount) {
                                                                                                                    // Agregar seriales faltantes
                                                                                                                    for (let i = currentSerialCount; i < newQty; i++) {
                                                                                                                        handleAddSerial(item.id);
                                                                                                                    }
                                                                                                                }
                                                                                                                else if (newQty < currentSerialCount) {
                                                                                                                    // Remover seriales sobrantes
                                                                                                                    for (let i = currentSerialCount - 1; i >= newQty; i--) {
                                                                                                                        handleRemoveSerial(item.id, i);
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                        }, className: "w-16 text-center border-t border-b border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 py-1", min: "0", max: calculateRemainingItems(item), disabled: calculateRemainingItems(item) === 0 }), _jsx("button", { type: "button", onClick: () => {
                                                                                                            const newQty = receivedQty + 1;
                                                                                                            handleReceiveQuantityChange(item.id, newQty, calculateRemainingItems(item));
                                                                                                            // Agregar serial automáticamente si es serializado
                                                                                                            if (isSerializedProduct) {
                                                                                                                handleAddSerial(item.id);
                                                                                                            }
                                                                                                        }, className: "px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-r-md hover:bg-gray-300 dark:hover:bg-gray-500", disabled: calculateRemainingItems(item) === 0 || receivedQty >= calculateRemainingItems(item), children: _jsx("i", { className: "fas fa-plus" }) })] }), receivingError[item.id] && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: receivingError[item.id] }))] }) })] }), isSerializedProduct && receivedQty > 0 && (_jsx("tr", { className: "bg-gray-50 dark:bg-gray-900", children: _jsx("td", { colSpan: 5, className: "py-3 px-4", children: _jsxs("div", { className: "space-y-2", children: [_jsxs("h4", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: ["Informaci\u00F3n de Seriales (", itemSerials.length, " de ", receivedQty, " requeridos)"] }), itemSerials.map((serial, idx) => (_jsxs("div", { className: "grid grid-cols-6 gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700", children: [_jsxs("div", { className: "col-span-6 sm:col-span-1", children: [_jsxs("label", { className: "block text-xs font-medium text-gray-600 dark:text-gray-400", children: ["Serial #", idx + 1, " *"] }), _jsx("input", { type: "text", value: serial.serial_code, onChange: (e) => handleSerialChange(item.id, idx, 'serial_code', e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "C\u00F3digo", required: true })] }), _jsxs("div", { className: "col-span-6 sm:col-span-1", children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 dark:text-gray-400", children: "VIN" }), _jsx("input", { type: "text", value: serial.vin || '', onChange: (e) => handleSerialChange(item.id, idx, 'vin', e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "VIN" })] }), _jsxs("div", { className: "col-span-6 sm:col-span-1", children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 dark:text-gray-400", children: "Motor" }), _jsx("input", { type: "text", value: serial.engine_number || '', onChange: (e) => handleSerialChange(item.id, idx, 'engine_number', e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "Motor" })] }), _jsxs("div", { className: "col-span-6 sm:col-span-1", children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 dark:text-gray-400", children: "A\u00F1o" }), _jsx("input", { type: "number", value: serial.year || '', onChange: (e) => handleSerialChange(item.id, idx, 'year', parseInt(e.target.value) || 0), className: "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "A\u00F1o", min: "1900", max: "2100" })] }), _jsxs("div", { className: "col-span-6 sm:col-span-1", children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 dark:text-gray-400", children: "Color" }), _jsx("input", { type: "text", value: serial.color || '', onChange: (e) => handleSerialChange(item.id, idx, 'color', e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm", placeholder: "Color" })] }), _jsx("div", { className: "col-span-6 sm:col-span-1 flex items-end", children: _jsx("button", { type: "button", onClick: () => {
                                                                                                            handleRemoveSerial(item.id, idx);
                                                                                                            handleReceiveQuantityChange(item.id, receivedQty - 1, calculateRemainingItems(item));
                                                                                                        }, className: "w-full px-2 py-1.5 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-300 dark:border-red-700", children: "Eliminar" }) })] }, idx)))] }) }) }))] }, item.id));
                                                            }) })] }) })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Precio Unit." }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Total" }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Recibidos" }))] }) }), _jsxs("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: [orderItems.map(item => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [_jsx("div", { className: "font-medium", children: item.product.name }), _jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", item.product.sku] })] }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-right dark:text-gray-300", children: formatCurrency(item.unit_price) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: formatCurrency(item.total_price) }), ['recibida_parcialmente', 'completada'].includes(order.status) && (_jsx("td", { className: "py-3 px-4 text-sm text-right", children: _jsxs("span", { className: item.received_quantity === item.quantity ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400', children: [item.received_quantity || 0, " / ", item.quantity] }) }))] }, item.id))), _jsxs("tr", { className: "bg-gray-50 dark:bg-gray-700", children: [_jsx("td", { colSpan: 3, className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: "Total:" }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-bold dark:text-gray-300", children: formatCurrency(order.total_amount) }), ['recibida_parcialmente', 'completada'].includes(order.status) && _jsx("td", {})] })] })] }) })), isReceivingItems && (_jsxs("div", { className: "mt-4 flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: handleCancelReceiving, className: "px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400", children: "Cancelar" }), _jsxs("button", { type: "button", onClick: handleSaveReceived, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400", children: [_jsx("i", { className: "fas fa-save mr-2" }), "Guardar Recepci\u00F3n"] })] }))] })] }), _jsxs("div", { children: [_jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3 dark:text-gray-200", children: "Informaci\u00F3n del Proveedor" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Nombre" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.name })] }), order.supplier.contact_info?.contact_name && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Contacto" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.contact_info.contact_name })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [order.supplier.contact_info?.phone && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Tel\u00E9fono" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.contact_info.phone })] })), order.supplier.contact_info?.email && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Email" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.contact_info.email })] }))] }), order.supplier.contact_info?.address && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500 dark:text-gray-400", children: "Direcci\u00F3n" }), _jsx("p", { className: "mt-1 text-sm text-gray-900 dark:text-gray-300", children: order.supplier.contact_info.address })] }))] }), _jsx("div", { className: "mt-4", children: _jsxs(Link, { to: `/proveedores/${order.supplier.id}/compras`, className: "text-blue-600 hover:text-blue-800 text-sm flex items-center", children: [_jsx("i", { className: "fas fa-history mr-1" }), "Ver historial de compras"] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-lg font-medium mb-3", children: "Almac\u00E9n de Destino" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Nombre" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: order.warehouse.name })] }), order.warehouse.location && (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Ubicaci\u00F3n" }), _jsx("p", { className: "mt-1 text-sm text-gray-900", children: order.warehouse.location })] }))] })] })] })] }), showPrintOptions && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-4xl shadow-lg", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Opciones de Impresi\u00F3n" }), _jsx("button", { onClick: handleClosePrintOptions, className: "text-gray-500 hover:text-gray-700", children: _jsx("i", { className: "fas fa-times" }) })] }), _jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Seleccione el formato de impresi\u00F3n:" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { onClick: () => handlePrintFormatChange({ value: 'letter', label: 'Carta' }), className: `px-4 py-2 border rounded-md ${printFormat.value === 'letter'
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`, children: [_jsx("i", { className: "fas fa-file-alt mr-2" }), "Carta"] }), _jsxs("button", { onClick: () => handlePrintFormatChange({ value: 'roll', label: 'Rollo' }), className: `px-4 py-2 border rounded-md ${printFormat.value === 'roll'
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`, children: [_jsx("i", { className: "fas fa-receipt mr-2" }), "Rollo"] })] })] }), _jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Vista previa (en la aplicaci\u00F3n)" }), _jsx("div", { className: "border rounded-md bg-gray-50 p-3 h-[500px] overflow-auto", children: _jsx("div", { className: "bg-white mx-auto", children: _jsx(PrintableOrder, { order: order, orderItems: orderItems, format: printFormat.value, formatCurrency: formatCurrency, formatDate: formatDate }) }) }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Nota: Windows puede mostrar \u201CEsta aplicaci\u00F3n no admite la vista previa de impresi\u00F3n\u201D. Usa esta vista previa integrada para revisar el documento antes de imprimir." })] }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { onClick: handleClosePrintOptions, className: "px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200", children: "Cancelar" }), _jsxs("button", { onClick: handlePrint, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir"] })] })] }) })), _jsx("div", { style: { display: 'none' }, children: _jsx("div", { ref: printRef, children: _jsx(PrintableOrder, { order: order, orderItems: orderItems, format: printFormat.value, formatCurrency: formatCurrency, formatDate: formatDate }) }) })] }));
};
export default PurchaseOrderDetail;
