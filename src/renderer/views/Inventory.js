import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [movementTypes, setMovementTypes] = useState([]);
    const [stockMovements, setStockMovements] = useState([]);
    const [currentStock, setCurrentStock] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false); // Estado separado para envío del formulario
    const [error, setError] = useState(null);
    // Formulario de entrada/salida
    const [productId, setProductId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isEntry, setIsEntry] = useState(true);
    // Nuevos estados para transferencias
    const [isTransfer, setIsTransfer] = useState(false);
    const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
    // Ubicaciones
    const [locations, setLocations] = useState([]);
    const [locationId, setLocationId] = useState('');
    const [destinationLocations, setDestinationLocations] = useState([]);
    const [destinationLocationId, setDestinationLocationId] = useState('');
    // Estado para búsqueda de productos
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    // Estados para la lista de productos (carrito)
    const [movementItems, setMovementItems] = useState([]);
    const [globalReference, setGlobalReference] = useState('');
    const [globalNotes, setGlobalNotes] = useState('');
    useEffect(() => {
        async function fetchData() {
            try {
                const client = await supabase.getClient();
                // Cargar productos
                const { data: productsData, error: productsError } = await client
                    .from('products')
                    .select('*');
                if (productsError)
                    throw productsError;
                setProducts(productsData || []);
                // Cargar almacenes
                const { data: warehousesData, error: warehousesError } = await client
                    .from('warehouses')
                    .select('*');
                if (warehousesError)
                    throw warehousesError;
                setWarehouses(warehousesData || []);
                // Cargar tipos de movimiento
                const { data: movementTypesData, error: movementTypesError } = await client
                    .from('movement_types')
                    .select('*');
                if (movementTypesError)
                    throw movementTypesError;
                setMovementTypes(movementTypesData || []);
                // Cargar movimientos recientes (incluyendo ubicación)
                const { data: movementsData, error: movementsError } = await client
                    .from('stock_movements')
                    .select(`
            *,
            product:products(id, name),
            warehouse:warehouses(id, name),
            location:locations(id, name),
            movement_type:movement_types(id, code, description)
          `)
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (movementsError)
                    throw movementsError;
                setStockMovements(movementsData || []);
                // Cargar stock actual
                const { data: stockData, error: stockError } = await client
                    .from('current_stock')
                    .select('*');
                if (stockError)
                    throw stockError;
                setCurrentStock(stockData || []);
                setIsLoading(false);
            }
            catch (err) {
                console.error('Error cargando datos:', err);
                setError(err.message);
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);
    // Cargar ubicaciones cuando cambie el almacén origen
    useEffect(() => {
        (async () => {
            try {
                const client = await supabase.getClient();
                if (warehouseId) {
                    // Mostrar ubicaciones del almacén seleccionado y también las no asignadas (warehouse_id NULL)
                    const { data, error } = await client
                        .from('locations')
                        .select('*')
                        .or(`warehouse_id.eq.${warehouseId},warehouse_id.is.null`)
                        .eq('active', true)
                        .order('name');
                    if (error)
                        throw error;
                    setLocations(data || []);
                }
                else {
                    setLocations([]);
                }
                // Reset selección al cambiar almacén
                setLocationId('');
            }
            catch (e) {
                console.error('Error cargando ubicaciones:', e);
            }
        })();
    }, [warehouseId]);
    // Cargar ubicaciones cuando cambie el almacén destino (transferencias)
    useEffect(() => {
        (async () => {
            try {
                const client = await supabase.getClient();
                if (destinationWarehouseId) {
                    // Para transferencias, incluir ubicaciones del almacén destino y también las no asignadas
                    const { data, error } = await client
                        .from('locations')
                        .select('*')
                        .or(`warehouse_id.eq.${destinationWarehouseId},warehouse_id.is.null`)
                        .eq('active', true)
                        .order('name');
                    if (error)
                        throw error;
                    setDestinationLocations(data || []);
                }
                else {
                    setDestinationLocations([]);
                }
                setDestinationLocationId('');
            }
            catch (e) {
                console.error('Error cargando ubicaciones destino:', e);
            }
        })();
    }, [destinationWarehouseId]);
    // Filtrar productos basado en búsqueda (nombre o SKU)
    const filteredProducts = products.filter((product) => {
        const searchLower = productSearchTerm.toLowerCase();
        const nameMatch = product.name.toLowerCase().includes(searchLower);
        const skuMatch = product.sku?.toLowerCase().includes(searchLower);
        return nameMatch || skuMatch;
    });
    // Función para seleccionar un producto
    const handleSelectProduct = (product) => {
        setProductId(product.id);
        setProductSearchTerm(product.sku ? `${product.name} (${product.sku})` : product.name);
        setShowProductDropdown(false);
    };
    // Función para manejar cambios en el tipo de movimiento
    const handleMovementTypeChange = (type) => {
        if (type === 'entry') {
            setIsEntry(true);
            setIsTransfer(false);
        }
        else if (type === 'exit') {
            setIsEntry(false);
            setIsTransfer(false);
        }
        else {
            // Transferencia
            setIsEntry(false); // Empezamos con salida del almacén origen
            setIsTransfer(true);
        }
        // Limpiar la lista cuando se cambia el tipo de movimiento
        setMovementItems([]);
    };
    // Función para agregar producto a la lista
    const handleAddToList = (e) => {
        e.preventDefault();
        // Validaciones
        if (!productId || !warehouseId || !locationId) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }
        if (isTransfer && (!destinationWarehouseId || !destinationLocationId)) {
            alert('Por favor completa el almacén y ubicación de destino');
            return;
        }
        if (isTransfer && destinationWarehouseId === warehouseId) {
            alert('El almacén de destino debe ser diferente al de origen');
            return;
        }
        // Buscar nombres para mostrar
        const product = products.find(p => p.id === productId);
        const warehouse = warehouses.find(w => w.id === warehouseId);
        const location = locations.find(l => l.id === locationId);
        const destWarehouse = isTransfer ? warehouses.find(w => w.id === destinationWarehouseId) : undefined;
        const destLocation = isTransfer ? destinationLocations.find(l => l.id === destinationLocationId) : undefined;
        if (!product || !warehouse || !location) {
            alert('Error al obtener información del producto, almacén o ubicación');
            return;
        }
        // Crear item para la lista
        const newItem = {
            tempId: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            locationId: location.id,
            locationName: location.name,
            quantity: quantity,
            destinationWarehouseId: destWarehouse?.id,
            destinationWarehouseName: destWarehouse?.name,
            destinationLocationId: destLocation?.id,
            destinationLocationName: destLocation?.name,
        };
        // Agregar a la lista
        setMovementItems([...movementItems, newItem]);
        // Limpiar formulario para agregar otro producto
        setProductId('');
        setProductSearchTerm('');
        setLocationId('');
        setQuantity(1);
        if (isTransfer) {
            setDestinationLocationId('');
        }
    };
    // Función para eliminar un producto de la lista
    const handleRemoveFromList = (tempId) => {
        setMovementItems(movementItems.filter(item => item.tempId !== tempId));
    };
    // Función para guardar todos los movimientos
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (movementItems.length === 0) {
            alert('Agrega al menos un producto a la lista antes de guardar');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const client = await supabase.getClient();
            // Validar stock para salidas y transferencias (en paralelo)
            if (!isEntry || isTransfer) {
                const stockChecks = movementItems.map(async (item) => {
                    const { data: stockData } = await client
                        .from('current_stock_by_location')
                        .select('current_quantity')
                        .eq('product_id', item.productId)
                        .eq('warehouse_id', item.warehouseId)
                        .eq('location_id', item.locationId)
                        .maybeSingle();
                    const currentQty = Number(stockData?.current_quantity ?? 0);
                    if (item.quantity > currentQty) {
                        throw new Error(`Stock insuficiente para ${item.productName}. Solo hay ${currentQty} unidades disponibles.`);
                    }
                });
                await Promise.all(stockChecks);
            }
            // Preparar movimientos para inserción masiva
            const movementsToInsert = [];
            // Obtener tipos de movimiento necesarios una sola vez
            let outMovementType;
            let inMovementType;
            let standardMovementType;
            if (isTransfer) {
                outMovementType = movementTypes.find((t) => t.code === 'OUT_TRANSFER');
                inMovementType = movementTypes.find((t) => t.code === 'IN_TRANSFER');
                if (!outMovementType || !inMovementType) {
                    throw new Error('Tipos de movimiento de transferencia no encontrados');
                }
            }
            else {
                const typeCode = isEntry ? 'IN_PURCHASE' : 'OUT_SALE';
                standardMovementType = movementTypes.find((t) => t.code === typeCode);
                if (!standardMovementType) {
                    throw new Error('Tipo de movimiento no encontrado');
                }
            }
            // Construir array de movimientos
            for (const item of movementItems) {
                if (isTransfer) {
                    const transferId = crypto.randomUUID();
                    // Salida
                    movementsToInsert.push({
                        product_id: item.productId,
                        warehouse_id: item.warehouseId,
                        location_id: item.locationId,
                        quantity: item.quantity,
                        movement_type_id: outMovementType.id,
                        movement_date: new Date(date).toISOString(),
                        reference: globalReference || `Transferencia a ${item.destinationWarehouseName}`,
                        notes: globalNotes || null,
                        related_id: transferId
                    });
                    // Entrada
                    movementsToInsert.push({
                        product_id: item.productId,
                        warehouse_id: item.destinationWarehouseId,
                        location_id: item.destinationLocationId,
                        quantity: item.quantity,
                        movement_type_id: inMovementType.id,
                        movement_date: new Date(date).toISOString(),
                        reference: globalReference || `Transferencia desde ${item.warehouseName}`,
                        notes: globalNotes || null,
                        related_id: transferId
                    });
                }
                else {
                    // Entrada/Salida normal
                    movementsToInsert.push({
                        product_id: item.productId,
                        warehouse_id: item.warehouseId,
                        location_id: item.locationId,
                        quantity: item.quantity,
                        movement_type_id: standardMovementType.id,
                        movement_date: new Date(date).toISOString(),
                        reference: globalReference || null,
                        notes: globalNotes || null
                    });
                }
            }
            // Inserción masiva
            if (movementsToInsert.length > 0) {
                const { error: insertError } = await client
                    .from('stock_movements')
                    .insert(movementsToInsert);
                if (insertError)
                    throw insertError;
            }
            // Recargar datos
            const { data: updatedMovements } = await client
                .from('stock_movements')
                .select(`
          *,
          product:products(id, name),
          warehouse:warehouses(id, name),
          location:locations(id, name),
          movement_type:movement_types(id, code, description)
        `)
                .order('created_at', { ascending: false })
                .limit(10);
            setStockMovements(updatedMovements || []);
            const { data: updatedStock } = await client
                .from('current_stock')
                .select('*');
            setCurrentStock(updatedStock || []);
            // Reset form y lista
            setMovementItems([]);
            setQuantity(1);
            setGlobalReference('');
            setGlobalNotes('');
            setDestinationWarehouseId('');
            setLocationId('');
            setDestinationLocationId('');
            setProductId('');
            setProductSearchTerm('');
            const itemCount = movementItems.length;
            alert(isTransfer
                ? `${itemCount} transferencia${itemCount > 1 ? 's' : ''} registrada${itemCount > 1 ? 's' : ''} correctamente`
                : `${itemCount} ${isEntry ? 'entrada' : 'salida'}${itemCount > 1 ? 's' : ''} registrada${itemCount > 1 ? 's' : ''} correctamente`);
        }
        catch (err) {
            console.error('Error:', err);
            setError(err.message);
            alert('Error: ' + err.message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (isLoading && !products.length) {
        return _jsx("div", { children: "Cargando..." });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Control de Inventario" }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "md:col-span-2 bg-white p-6 rounded-lg shadow", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h2", { className: "text-xl font-semibold mb-1", children: "Registrar Movimiento" }), _jsx("p", { className: "text-gray-500 text-sm", children: isTransfer
                                            ? 'Registra transferencias de productos entre almacenes'
                                            : isEntry
                                                ? 'Registra entradas de productos en el inventario'
                                                : 'Registra salidas de productos del inventario' })] }), _jsxs("div", { className: "mb-4 flex space-x-2", children: [_jsx("button", { onClick: () => handleMovementTypeChange('entry'), className: `px-4 py-2 rounded-md text-sm ${isEntry && !isTransfer
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 text-gray-700'}`, children: "Entrada" }), _jsx("button", { onClick: () => handleMovementTypeChange('exit'), className: `px-4 py-2 rounded-md text-sm ${!isEntry && !isTransfer
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 text-gray-700'}`, children: "Salida" }), _jsx("button", { onClick: () => handleMovementTypeChange('transfer'), className: `px-4 py-2 rounded-md text-sm ${isTransfer
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-700'}`, children: "Transferencia" })] }), _jsxs("form", { onSubmit: handleAddToList, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Producto * (buscar por nombre o SKU)" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400 text-sm" }) }), _jsx("input", { type: "text", value: productSearchTerm, onChange: (e) => {
                                                                    setProductSearchTerm(e.target.value);
                                                                    setShowProductDropdown(true);
                                                                    if (!e.target.value) {
                                                                        setProductId('');
                                                                    }
                                                                }, onFocus: () => setShowProductDropdown(true), onBlur: () => {
                                                                    // Delay para permitir click en opciones
                                                                    setTimeout(() => setShowProductDropdown(false), 200);
                                                                }, placeholder: "Escribe nombre o SKU del producto...", className: "w-full pl-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true }), showProductDropdown && productSearchTerm && (_jsx("div", { className: "absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto", children: filteredProducts.length > 0 ? (filteredProducts.map((product) => (_jsxs("div", { onClick: () => handleSelectProduct(product), className: "px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0", children: [_jsx("div", { className: "font-medium text-gray-900", children: product.name }), product.sku && (_jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", product.sku] }))] }, product.id)))) : (_jsx("div", { className: "px-3 py-2 text-sm text-gray-500 text-center", children: "No se encontraron productos" })) })), productId && !showProductDropdown && (_jsxs("div", { className: "mt-1 text-xs text-green-600 flex items-center", children: [_jsx("i", { className: "fas fa-check-circle mr-1" }), "Producto seleccionado"] }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: isTransfer ? 'Almacén Origen *' : 'Almacén *' }), _jsxs("select", { value: warehouseId, onChange: (e) => setWarehouseId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Selecciona un almac\u00E9n" }), warehouses.map((warehouse) => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: isTransfer ? 'Ubicación Origen *' : 'Ubicación *' }), _jsxs("select", { value: locationId, onChange: (e) => setLocationId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, disabled: !warehouseId, children: [_jsx("option", { value: "", children: warehouseId ? 'Selecciona una ubicación' : 'Selecciona primero un almacén' }), locations.map((loc) => (_jsx("option", { value: loc.id, children: loc.name }, loc.id)))] })] }), isTransfer && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Almac\u00E9n Destino *" }), _jsxs("select", { value: destinationWarehouseId, onChange: (e) => setDestinationWarehouseId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Selecciona un almac\u00E9n de destino" }), warehouses
                                                        .filter((w) => w.id !== warehouseId) // Filtrar el almacén origen
                                                        .map((warehouse) => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] })), isTransfer && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ubicaci\u00F3n Destino *" }), _jsxs("select", { value: destinationLocationId, onChange: (e) => setDestinationLocationId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, disabled: !destinationWarehouseId, children: [_jsx("option", { value: "", children: destinationWarehouseId ? 'Selecciona una ubicación' : 'Selecciona primero un almacén' }), destinationLocations.map((loc) => (_jsx("option", { value: loc.id, children: loc.name }, loc.id)))] })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Cantidad *" }), _jsx("input", { type: "number", min: "0.01", step: "0.01", value: quantity, onChange: (e) => setQuantity(Number(e.target.value)), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha *" }), _jsx("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true })] })] }), _jsx("div", { className: "pt-4", children: _jsxs("button", { type: "submit", className: "px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Agregar a la lista"] }) })] }), movementItems.length > 0 && (_jsxs("div", { className: "mt-6 border-t pt-4", children: [_jsxs("h3", { className: "text-lg font-semibold mb-3", children: ["Productos en la lista (", movementItems.length, ")"] }), _jsx("div", { className: "overflow-x-auto mb-4", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Producto" }), isTransfer ? (_jsxs(_Fragment, { children: [_jsx("th", { className: "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Origen" }), _jsx("th", { className: "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Destino" })] })) : (_jsx("th", { className: "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Almac\u00E9n / Ubicaci\u00F3n" })), _jsx("th", { className: "px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase", children: "Cantidad" }), _jsx("th", { className: "px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase", children: "Acci\u00F3n" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: movementItems.map((item) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-3 py-2 text-sm", children: [_jsx("div", { className: "font-medium", children: item.productName }), item.productSku && (_jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.productSku] }))] }), isTransfer ? (_jsxs(_Fragment, { children: [_jsxs("td", { className: "px-3 py-2 text-sm", children: [_jsx("div", { children: item.warehouseName }), _jsx("div", { className: "text-xs text-gray-500", children: item.locationName })] }), _jsxs("td", { className: "px-3 py-2 text-sm", children: [_jsx("div", { children: item.destinationWarehouseName }), _jsx("div", { className: "text-xs text-gray-500", children: item.destinationLocationName })] })] })) : (_jsxs("td", { className: "px-3 py-2 text-sm", children: [_jsx("div", { children: item.warehouseName }), _jsx("div", { className: "text-xs text-gray-500", children: item.locationName })] })), _jsx("td", { className: "px-3 py-2 text-sm text-right font-medium", children: item.quantity }), _jsx("td", { className: "px-3 py-2 text-center", children: _jsx("button", { onClick: () => handleRemoveFromList(item.tempId), className: "text-red-600 hover:text-red-800 text-sm", title: "Eliminar de la lista", children: _jsx("i", { className: "fas fa-trash" }) }) })] }, item.tempId))) })] }) }), _jsxs("div", { className: "space-y-3 mb-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Referencia (opcional)" }), _jsx("input", { type: "text", value: globalReference, onChange: (e) => setGlobalReference(e.target.value), placeholder: "N\u00FAmero de factura, orden, etc.", className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Notas (opcional)" }), _jsx("textarea", { value: globalNotes, onChange: (e) => setGlobalNotes(e.target.value), placeholder: "Notas adicionales para todos los movimientos...", className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", rows: 2 })] })] }), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: () => setMovementItems([]), className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50", disabled: isSubmitting, children: "Cancelar" }), _jsxs("button", { onClick: handleSubmit, disabled: isSubmitting, className: "px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center", children: [isSubmitting && (_jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" })), "Guardar Movimientos"] })] })] }))] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Movimientos Recientes" }), _jsx("div", { className: "space-y-4", children: stockMovements.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm text-center py-4", children: "No hay movimientos registrados" })) : (stockMovements.map((movement) => (_jsxs("div", { className: "border-b border-gray-100 pb-3 last:border-0", children: [_jsxs("div", { className: "flex justify-between items-start mb-1", children: [_jsx("span", { className: `text-xs font-semibold px-2 py-0.5 rounded ${movement.movement_type?.code.startsWith('IN')
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'}`, children: movement.movement_type?.description || movement.movement_type?.code }), _jsx("span", { className: "text-xs text-gray-500", children: new Date(movement.movement_date).toLocaleDateString() })] }), _jsx("div", { className: "font-medium text-sm mb-1", children: movement.product?.name }), _jsxs("div", { className: "flex justify-between text-xs text-gray-500", children: [_jsx("span", { children: movement.warehouse?.name }), _jsxs("span", { className: "font-semibold text-gray-700", children: [movement.quantity, " u."] })] }), movement.reference && (_jsxs("div", { className: "text-xs text-gray-400 mt-1 truncate", children: ["Ref: ", movement.reference] }))] }, movement.id)))) })] })] })] }));
};
export default Inventory;
