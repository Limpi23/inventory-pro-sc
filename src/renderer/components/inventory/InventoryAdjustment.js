import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
const InventoryAdjustment = ({ isOpen, onClose, onAdjustmentComplete }) => {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [locations, setLocations] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState(null);
    const [newQuantity, setNewQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingStock, setIsLoadingStock] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);
    useEffect(() => {
        if (selectedWarehouseId) {
            loadLocations(selectedWarehouseId);
        }
        else {
            setLocations([]);
            setSelectedLocationId('');
        }
    }, [selectedWarehouseId]);
    useEffect(() => {
        if (selectedProductId && selectedWarehouseId && selectedLocationId) {
            loadCurrentStock();
        }
        else {
            setCurrentQuantity(null);
        }
    }, [selectedProductId, selectedWarehouseId, selectedLocationId]);
    const loadData = async () => {
        try {
            const client = await supabase.getClient();
            const [productsRes, warehousesRes] = await Promise.all([
                client.from('products').select('id, name, sku').order('name'),
                client.from('warehouses').select('id, name').order('name')
            ]);
            if (productsRes.error)
                throw productsRes.error;
            if (warehousesRes.error)
                throw warehousesRes.error;
            setProducts(productsRes.data || []);
            setWarehouses(warehousesRes.data || []);
        }
        catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos');
        }
    };
    const loadLocations = async (warehouseId) => {
        try {
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('locations')
                .select('id, name, warehouse_id')
                .eq('warehouse_id', warehouseId)
                .order('name');
            if (error)
                throw error;
            setLocations(data || []);
        }
        catch (error) {
            console.error('Error loading locations:', error);
            toast.error('Error al cargar ubicaciones');
        }
    };
    const loadCurrentStock = async () => {
        try {
            setIsLoadingStock(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('current_stock_by_location')
                .select('current_quantity')
                .eq('product_id', selectedProductId)
                .eq('warehouse_id', selectedWarehouseId)
                .eq('location_id', selectedLocationId)
                .maybeSingle();
            if (error)
                throw error;
            const qty = data?.current_quantity ?? 0;
            setCurrentQuantity(Number(qty));
        }
        catch (error) {
            console.error('Error loading current stock:', error);
            setCurrentQuantity(0);
        }
        finally {
            setIsLoadingStock(false);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProductId || !selectedWarehouseId || !selectedLocationId) {
            toast.error('Por favor complete todos los campos requeridos');
            return;
        }
        const newQty = parseFloat(newQuantity);
        if (isNaN(newQty) || newQty < 0) {
            toast.error('La nueva cantidad debe ser un número válido mayor o igual a 0');
            return;
        }
        if (!reason.trim()) {
            toast.error('Por favor indique la razón del ajuste');
            return;
        }
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            // Llamar a la función RPC que ajusta el inventario directamente
            const { error } = await client.rpc('adjust_inventory_direct', {
                p_product_id: selectedProductId,
                p_warehouse_id: selectedWarehouseId,
                p_location_id: selectedLocationId,
                p_new_quantity: newQty,
                p_reason: reason.trim()
            });
            if (error)
                throw error;
            const difference = newQty - (currentQuantity || 0);
            toast.success(`Ajuste realizado correctamente. Diferencia: ${difference > 0 ? '+' : ''}${difference}`);
            // Reset form
            setSelectedProductId('');
            setSelectedWarehouseId('');
            setSelectedLocationId('');
            setCurrentQuantity(null);
            setNewQuantity('');
            setReason('');
            setProductSearchTerm('');
            onAdjustmentComplete();
            onClose();
        }
        catch (error) {
            console.error('Error adjusting inventory:', error);
            toast.error(error.message || 'Error al ajustar inventario');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleCancel = () => {
        setSelectedProductId('');
        setSelectedWarehouseId('');
        setSelectedLocationId('');
        setCurrentQuantity(null);
        setNewQuantity('');
        setReason('');
        setProductSearchTerm('');
        onClose();
    };
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())));
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsx("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: "Ajuste de Inventario" }), _jsx("button", { onClick: handleCancel, className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx("i", { className: "fas fa-times text-xl" }) })] }), _jsx("div", { className: "mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md", children: _jsxs("div", { className: "flex items-start", children: [_jsx("i", { className: "fas fa-exclamation-triangle text-yellow-600 dark:text-yellow-500 mt-0.5 mr-2" }), _jsxs("div", { className: "text-sm text-yellow-800 dark:text-yellow-200", children: [_jsx("p", { className: "font-semibold", children: "Ajuste Directo de Inventario" }), _jsx("p", { className: "mt-1", children: "Esta funci\u00F3n ajusta directamente las cantidades sin generar movimientos. Use solo para corregir descuadres o inconsistencias del inventario." })] })] }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: ["Producto ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: productSearchTerm, onChange: (e) => {
                                                    setProductSearchTerm(e.target.value);
                                                    setShowProductDropdown(true);
                                                    if (!e.target.value) {
                                                        setSelectedProductId('');
                                                    }
                                                }, onFocus: () => setShowProductDropdown(true), placeholder: "Buscar por nombre o SKU...", className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" }), showProductDropdown && productSearchTerm && (_jsx("div", { className: "absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto", children: filteredProducts.length === 0 ? (_jsx("div", { className: "px-3 py-2 text-sm text-gray-500 dark:text-gray-400", children: "No se encontraron productos" })) : (filteredProducts.map((product) => (_jsxs("div", { onClick: () => {
                                                        setSelectedProductId(product.id);
                                                        setProductSearchTerm(`${product.name} ${product.sku ? `(${product.sku})` : ''}`);
                                                        setShowProductDropdown(false);
                                                    }, className: "px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm", children: [_jsx("div", { className: "font-medium text-gray-900 dark:text-white", children: product.name }), product.sku && (_jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", product.sku] }))] }, product.id)))) }))] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: ["Almac\u00E9n ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("select", { value: selectedWarehouseId, onChange: (e) => setSelectedWarehouseId(e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white", required: true, children: [_jsx("option", { value: "", children: "Seleccione un almac\u00E9n" }), warehouses.map((wh) => (_jsx("option", { value: wh.id, children: wh.name }, wh.id)))] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: ["Ubicaci\u00F3n ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("select", { value: selectedLocationId, onChange: (e) => setSelectedLocationId(e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white", required: true, disabled: !selectedWarehouseId, children: [_jsx("option", { value: "", children: "Seleccione una ubicaci\u00F3n" }), locations.map((loc) => (_jsx("option", { value: loc.id, children: loc.name }, loc.id)))] })] }), currentQuantity !== null && (_jsx("div", { className: "p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Cantidad Actual en Sistema:" }), _jsx("span", { className: "text-lg font-bold text-blue-600 dark:text-blue-400", children: isLoadingStock ? (_jsx("i", { className: "fas fa-spinner fa-spin" })) : (currentQuantity) })] }) })), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: ["Nueva Cantidad ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "number", step: "0.01", min: "0", value: newQuantity, onChange: (e) => setNewQuantity(e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white", placeholder: "Ingrese la cantidad correcta", required: true }), newQuantity && currentQuantity !== null && (_jsxs("p", { className: `mt-1 text-sm ${parseFloat(newQuantity) > currentQuantity
                                            ? 'text-green-600 dark:text-green-400'
                                            : parseFloat(newQuantity) < currentQuantity
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-gray-600 dark:text-gray-400'}`, children: ["Diferencia: ", parseFloat(newQuantity) > currentQuantity ? '+' : '', (parseFloat(newQuantity) - currentQuantity).toFixed(2)] }))] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: ["Raz\u00F3n del Ajuste ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), rows: 3, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white", placeholder: "Explique la raz\u00F3n del ajuste (ej: conteo f\u00EDsico, error de registro, producto da\u00F1ado, etc.)", required: true })] }), _jsxs("div", { className: "flex gap-3 pt-4", children: [_jsx("button", { type: "button", onClick: handleCancel, className: "flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", disabled: isLoading, children: "Cancelar" }), _jsx("button", { type: "submit", className: "flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed", disabled: isLoading || !selectedProductId || !selectedWarehouseId || !selectedLocationId, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner fa-spin mr-2" }), "Procesando..."] })) : (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Aplicar Ajuste"] })) })] })] })] }) }) }));
};
export default InventoryAdjustment;
