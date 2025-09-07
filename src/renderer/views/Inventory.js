import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [movementTypes, setMovementTypes] = useState([]);
    const [stockMovements, setStockMovements] = useState([]);
    const [currentStock, setCurrentStock] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
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
                // Cargar movimientos recientes
                const { data: movementsData, error: movementsError } = await client
                    .from('stock_movements')
                    .select(`
            *,
            product:products(id, name),
            warehouse:warehouses(id, name),
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
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const client = await supabase.getClient();
            if (!productId || !warehouseId) {
                throw new Error('Selecciona un producto y un almacén');
            }
            // Validación adicional para transferencias
            if (isTransfer && (!destinationWarehouseId || destinationWarehouseId === warehouseId)) {
                throw new Error('Selecciona un almacén de destino diferente al de origen');
            }
            // Para salidas o transferencias, verificar stock disponible
            if (!isEntry || isTransfer) {
                const { data: stockData } = await client
                    .from('current_stock')
                    .select('current_quantity')
                    .eq('product_id', productId)
                    .eq('warehouse_id', warehouseId)
                    .single();
                const currentQty = Number(stockData?.current_quantity ?? 0);
                if (quantity > currentQty) {
                    throw new Error(`Stock insuficiente. Solo hay ${currentQty} unidades disponibles.`);
                }
            }
            if (isTransfer) {
                // Crear movimiento de salida del almacén origen
                const outMovementType = movementTypes.find((t) => t.code === 'OUT_TRANSFER');
                if (!outMovementType) {
                    throw new Error('Tipo de movimiento de salida por transferencia no encontrado');
                }
                // Generar un ID de transferencia para relacionar ambos movimientos
                const transferId = crypto.randomUUID();
                const { error: outError } = await client
                    .from('stock_movements')
                    .insert({
                    product_id: productId,
                    warehouse_id: warehouseId,
                    quantity: quantity,
                    movement_type_id: outMovementType.id,
                    movement_date: new Date(date).toISOString(),
                    reference: reference || `Transferencia a ${warehouses.find(w => w.id === destinationWarehouseId)?.name}`,
                    notes: notes || null,
                    related_id: transferId
                });
                if (outError)
                    throw outError;
                // Crear movimiento de entrada en el almacén destino
                const inMovementType = movementTypes.find((t) => t.code === 'IN_TRANSFER');
                if (!inMovementType) {
                    throw new Error('Tipo de movimiento de entrada por transferencia no encontrado');
                }
                const { error: inError } = await client
                    .from('stock_movements')
                    .insert({
                    product_id: productId,
                    warehouse_id: destinationWarehouseId,
                    quantity: quantity,
                    movement_type_id: inMovementType.id,
                    movement_date: new Date(date).toISOString(),
                    reference: reference || `Transferencia desde ${warehouses.find(w => w.id === warehouseId)?.name}`,
                    notes: notes || null,
                    related_id: transferId
                });
                if (inError)
                    throw inError;
            }
            else {
                // Código existente para entradas y salidas normales
                // Buscar ID del tipo de movimiento
                const typeCode = isEntry ? 'IN_PURCHASE' : 'OUT_SALE';
                const movementType = movementTypes.find((t) => t.code === typeCode);
                if (!movementType) {
                    throw new Error('Tipo de movimiento no encontrado');
                }
                // Crear movimiento
                const { error: insertError } = await client
                    .from('stock_movements')
                    .insert({
                    product_id: productId,
                    warehouse_id: warehouseId,
                    quantity: quantity,
                    movement_type_id: movementType.id,
                    movement_date: new Date(date).toISOString(),
                    reference: reference || null,
                    notes: notes || null
                });
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
          movement_type:movement_types(id, code, description)
        `)
                .order('created_at', { ascending: false })
                .limit(10);
            setStockMovements(updatedMovements || []);
            const { data: updatedStock } = await client
                .from('current_stock')
                .select('*');
            setCurrentStock(updatedStock || []);
            // Reset form
            setQuantity(1);
            setReference('');
            setNotes('');
            setDestinationWarehouseId(''); // Resetear almacén destino
            alert(isTransfer
                ? 'Transferencia registrada correctamente'
                : `${isEntry ? 'Entrada' : 'Salida'} registrada correctamente`);
        }
        catch (err) {
            console.error('Error:', err);
            setError(err.message);
        }
        finally {
            setIsLoading(false);
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
                                            : 'bg-gray-200 text-gray-700'}`, children: "Transferencia" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Producto *" }), _jsxs("select", { value: productId, onChange: (e) => setProductId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Selecciona un producto" }), products.map((product) => (_jsxs("option", { value: product.id, children: [product.name, " ", product.sku ? `(${product.sku})` : ''] }, product.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: isTransfer ? 'Almacén Origen *' : 'Almacén *' }), _jsxs("select", { value: warehouseId, onChange: (e) => setWarehouseId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Selecciona un almac\u00E9n" }), warehouses.map((warehouse) => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] })] }), isTransfer && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Almac\u00E9n Destino *" }), _jsxs("select", { value: destinationWarehouseId, onChange: (e) => setDestinationWarehouseId(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Selecciona un almac\u00E9n de destino" }), warehouses
                                                        .filter((w) => w.id !== warehouseId) // Filtrar el almacén origen
                                                        .map((warehouse) => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Cantidad *" }), _jsx("input", { type: "number", min: "0.01", step: "0.01", value: quantity, onChange: (e) => setQuantity(Number(e.target.value)), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha *" }), _jsx("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", required: true })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Referencia (opcional)" }), _jsx("input", { type: "text", value: reference, onChange: (e) => setReference(e.target.value), placeholder: "N\u00FAmero de factura, orden, etc.", className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Notas (opcional)" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Informaci\u00F3n adicional sobre este movimiento", className: "w-full rounded-md border border-gray-300 px-3 py-2 text-sm", rows: 3 })] }), _jsx("div", { className: "pt-4", children: _jsx("button", { type: "submit", className: `px-4 py-2 rounded-md text-white text-sm ${isTransfer
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-blue-600 hover:bg-blue-700'}`, disabled: isLoading, children: isLoading ? 'Procesando...' : isTransfer
                                                ? 'Registrar Transferencia'
                                                : `Registrar ${isEntry ? 'Entrada' : 'Salida'}` }) })] })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-xl font-semibold mb-3", children: "Stock Actual" }), _jsx("div", { className: "max-h-[400px] overflow-y-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2", children: "Producto" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2", children: "Almac\u00E9n" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2", children: "Cantidad" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: currentStock.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "py-2 text-center text-sm text-gray-500", children: "No hay datos de inventario" }) })) : (currentStock.map((item, index) => (_jsxs("tr", { children: [_jsx("td", { className: "py-2 text-sm", children: item.product_name }), _jsx("td", { className: "py-2 text-sm", children: item.warehouse_name }), _jsx("td", { className: "py-2 text-sm text-right font-medium", children: item.current_quantity })] }, index)))) })] }) })] })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow mt-6", children: [_jsx("h2", { className: "text-xl font-semibold mb-3", children: "Movimientos Recientes" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Tipo" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Almac\u00E9n" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Referencia" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: stockMovements.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-4 text-center text-sm text-gray-500", children: "No hay movimientos recientes" }) })) : (stockMovements.map((movement) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 px-4 text-sm", children: new Date(movement.movement_date).toLocaleDateString() }), _jsx("td", { className: "py-3 px-4 text-sm", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${movement.movement_type?.code?.startsWith('IN_')
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'}`, children: movement.movement_type?.description || 'Desconocido' }) }), _jsx("td", { className: "py-3 px-4 text-sm", children: movement.product?.name }), _jsx("td", { className: "py-3 px-4 text-sm", children: movement.warehouse?.name }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: movement.quantity }), _jsx("td", { className: "py-3 px-4 text-sm", children: movement.reference || '-' })] }, movement.id)))) })] }) })] })] }));
};
export default Inventory;
