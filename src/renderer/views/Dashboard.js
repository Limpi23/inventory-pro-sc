import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const currency = useCurrency();
    const [stats, setStats] = useState([
        { title: 'Total Productos', value: '0', icon: 'fas fa-box', color: 'bg-primary' },
        { title: 'Ventas del Mes', value: currency.format(0), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
        { title: 'Productos Agotados', value: '0', icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
        { title: 'Movimientos Hoy', value: '0', icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
    ]);
    const [recentMovements, setRecentMovements] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [lowStockProducts, setLowStockProducts] = useState([]);
    useEffect(() => {
        fetchDashboardData();
    }, []);
    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const client = await supabase.getClient();
            // Fetch total products count
            const { count: productsCount, error: productsError } = await client
                .from('products')
                .select('*', { count: 'exact', head: true });
            if (productsError)
                throw productsError;
            // Fetch monthly sales total
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const { data: monthlySales, error: salesError } = await client
                .from('invoices')
                .select('total_amount')
                .gte('invoice_date', firstDayOfMonth.toISOString())
                .in('status', ['emitida', 'pagada']);
            if (salesError)
                throw salesError;
            const monthlyTotal = monthlySales?.reduce((sum, invoice) => sum + (Number(invoice?.total_amount) || 0), 0) || 0;
            // Fetch low stock products count
            const { data: lowStockCount, error: lowStockError } = await client
                .from('current_stock')
                .select('product_id')
                .lte('current_quantity', 5);
            if (lowStockError)
                throw lowStockError;
            const uniqueLowStockProducts = [...new Set(lowStockCount?.map(item => item.product_id) || [])];
            // Fetch today's movements count
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const { count: movementsCount, error: movementsError } = await client
                .from('stock_movements')
                .select('*', { count: 'exact', head: true })
                .gte('movement_date', startOfDay.toISOString());
            if (movementsError)
                throw movementsError;
            // Update stats
            const updatedStats = [
                { title: 'Total Productos', value: productsCount?.toString() || '0', icon: 'fas fa-box', color: 'bg-primary' },
                { title: 'Ventas del Mes', value: formatCurrency(monthlyTotal), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
                { title: 'Productos Agotados', value: uniqueLowStockProducts.length.toString(), icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
                { title: 'Movimientos Hoy', value: movementsCount?.toString() || '0', icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
            ];
            setStats(updatedStats);
            // Fetch recent movements
            const { data: movements, error: recentMovementsError } = await client
                .from('stock_movements')
                .select(`
          id,
          quantity,
          movement_date,
          movement_type_id,
          product_id,
          warehouse_id
        `)
                .order('movement_date', { ascending: false })
                .limit(5);
            if (recentMovementsError)
                throw recentMovementsError;
            // Si tenemos movimientos, obtenemos los detalles adicionales necesarios
            if (movements && movements.length > 0) {
                // Obtener IDs únicos de productos, almacenes y tipos de movimiento
                const productIds = [...new Set(movements.map(m => m.product_id))];
                const warehouseIds = [...new Set(movements.map(m => m.warehouse_id))];
                const movementTypeIds = [...new Set(movements.map(m => m.movement_type_id))];
                // Obtener detalles de productos
                const { data: products, error: productsError } = await client
                    .from('products')
                    .select('id, name, sku')
                    .in('id', productIds);
                if (productsError)
                    throw productsError;
                // Obtener detalles de almacenes
                const { data: warehouses, error: warehousesError } = await client
                    .from('warehouses')
                    .select('id, name')
                    .in('id', warehouseIds);
                if (warehousesError)
                    throw warehousesError;
                // Obtener detalles de tipos de movimiento
                const { data: movementTypes, error: movementTypesError } = await client
                    .from('movement_types')
                    .select('id, code, description')
                    .in('id', movementTypeIds);
                if (movementTypesError)
                    throw movementTypesError;
                // Crear mapas para búsqueda rápida
                const productMap = new Map(products?.map((p) => [p.id, p]));
                const warehouseMap = new Map(warehouses?.map((w) => [w.id, w]));
                const movementTypeMap = new Map(movementTypes?.map((mt) => [mt.id, mt]));
                // Formatear los datos de movimientos correctamente
                const formattedMovements = movements.map((movement) => {
                    const product = productMap.get(movement.product_id);
                    const warehouse = warehouseMap.get(movement.warehouse_id);
                    const movementType = movementTypeMap.get(movement.movement_type_id);
                    return {
                        id: movement.id,
                        quantity: Number(movement.quantity),
                        movement_date: movement.movement_date,
                        movement_type_id: movement.movement_type_id,
                        product: {
                            name: product?.name || 'Desconocido'
                        },
                        warehouse: {
                            name: warehouse?.name || 'Desconocido'
                        },
                        movement_type: {
                            code: movementType?.code || '',
                            description: movementType?.description || ''
                        }
                    };
                });
                setRecentMovements(formattedMovements);
            }
            else {
                setRecentMovements([]);
            }
            // Fetch top 5 products by movement quantity
            try {
                // Intentar usar la función RPC
                const { data: topProductsData, error: topProductsError } = await client
                    .rpc('get_top_selling_products', { limit_count: 5 })
                    .select('*');
                if (topProductsError) {
                    // Fallback - consultar movimientos y productos directamente
                    // debug silenciado
                    // Obtener todos los productos primero
                    const { data: products, error: productsError } = await client
                        .from('products')
                        .select('id, name, sku');
                    if (productsError)
                        throw productsError;
                    // Mapeo de productos para acceso rápido
                    const productMap = new Map(products?.map((p) => [p.id, p]) || []);
                    // Obtener movimientos de salida
                    const { data: outMovements, error: movementsError } = await client
                        .from('stock_movements')
                        .select(`
              product_id,
              quantity,
              movement_type_id
            `)
                        .in('movement_type_id', [2, 4, 6, 8]) // IDs para movimientos de salida
                        .limit(500);
                    if (movementsError)
                        throw movementsError;
                    // Agregar cantidades por producto
                    const productQuantityMap = {};
                    outMovements?.forEach((movement) => {
                        const productId = movement.product_id;
                        if (!productQuantityMap[productId]) {
                            productQuantityMap[productId] = 0;
                        }
                        productQuantityMap[productId] += Number(movement.quantity) || 0;
                    });
                    // Crear array de productos más vendidos
                    const topProductsList = [];
                    Object.entries(productQuantityMap).forEach(([productId, totalQuantity]) => {
                        const product = productMap.get(productId);
                        if (product) {
                            topProductsList.push({
                                id: productId,
                                name: product.name,
                                sku: product.sku || 'Sin SKU',
                                totalQuantity
                            });
                        }
                    });
                    // Ordenar y limitar a los 5 más vendidos
                    const sortedProducts = topProductsList
                        .sort((a, b) => b.totalQuantity - a.totalQuantity)
                        .slice(0, 5);
                    setTopProducts(sortedProducts);
                }
                else {
                    // Si la función RPC funcionó correctamente
                    const formattedTopProducts = topProductsData?.map((item) => ({
                        id: item.product_id,
                        name: item.product_name,
                        sku: item.sku || 'Sin SKU',
                        totalQuantity: Number(item.total_quantity)
                    }));
                    setTopProducts(formattedTopProducts);
                }
            }
            catch (error) {
                setTopProducts([]);
            }
            // Fetch low stock products detail
            try {
                // Obtener productos con stock bajo directamente
                const { data: lowStockItems, error: lowStockItemsError } = await client
                    .from('current_stock')
                    .select(`
            product_id,
            product_name,
            sku,
            warehouse_id,
            warehouse_name,
            current_quantity
          `)
                    .lte('current_quantity', 5)
                    .order('current_quantity', { ascending: true })
                    .limit(5);
                if (lowStockItemsError) {
                    throw lowStockItemsError;
                }
                // Si los datos de la vista no tienen toda la información, obtener los detalles de los productos
                if (lowStockItems && lowStockItems.length > 0 &&
                    (lowStockItems[0].product_name === null || lowStockItems[0].sku === null)) {
                    const productIds = lowStockItems.map((item) => item.product_id);
                    // Obtener detalles completos de los productos
                    const { data: productDetails, error: productDetailsError } = await client
                        .from('products')
                        .select('id, name, sku')
                        .in('id', productIds);
                    if (productDetailsError)
                        throw productDetailsError;
                    const productMap = new Map(productDetails?.map((p) => [p.id, p]) || []);
                    // Formatear los datos con la información completa de productos
                    const formattedLowStock = lowStockItems.map((item) => {
                        const product = productMap.get(item.product_id);
                        return {
                            current_quantity: Number(item.current_quantity),
                            product: {
                                id: item.product_id,
                                name: product?.name || item.product_name || 'Desconocido',
                                sku: product?.sku || item.sku || 'Sin SKU'
                            },
                            warehouse: {
                                name: item.warehouse_name || 'Desconocido'
                            }
                        };
                    });
                    setLowStockProducts(formattedLowStock);
                }
                else {
                    // Si la vista ya tiene toda la información necesaria
                    const formattedLowStock = lowStockItems.map((item) => ({
                        current_quantity: Number(item.current_quantity),
                        product: {
                            id: item.product_id,
                            name: item.product_name || 'Desconocido',
                            sku: item.sku || 'Sin SKU'
                        },
                        warehouse: {
                            name: item.warehouse_name || 'Desconocido'
                        }
                    }));
                    setLowStockProducts(formattedLowStock);
                }
            }
            catch (error) {
                setLowStockProducts([]);
            }
        }
        catch (error) {
            toast.error('Error al cargar los datos del dashboard');
        }
        finally {
            setLoading(false);
        }
    };
    const formatCurrency = (amount) => currency.format(amount);
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat(currency.settings.locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };
    const getMovementTypeLabel = (movementType) => {
        if (!movementType)
            return { label: 'Desconocido', className: 'bg-gray-100 text-gray-800' };
        const isInput = movementType.code.startsWith('IN');
        return {
            label: isInput ? 'Entrada' : 'Salida',
            className: isInput ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        };
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-2xl font-semibold text-gray-900 dark:text-white", children: "Dashboard" }), _jsx("span", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Panel de Control" })] }), loading ? (_jsx("div", { className: "flex justify-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: stats.map((stat, index) => (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: stat.title }), _jsx("div", { className: `${stat.color} text-white p-2 rounded-lg`, children: _jsx("i", { className: `${stat.icon} text-xl` }) })] }), _jsx(CardContent, { children: _jsx("div", { className: "text-2xl font-bold", children: stat.value }) })] }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Productos M\u00E1s Vendidos" }), _jsx(CardDescription, { children: "Los productos con mayor rotaci\u00F3n de salida" })] }), _jsx(CardContent, { children: topProducts.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay suficientes datos para mostrar productos populares" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { className: "text-right", children: "Cantidad Total" })] }) }), _jsx(TableBody, { children: topProducts.map((product) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("div", { className: "font-medium", children: product.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", product.sku] })] }), _jsx(TableCell, { className: "text-right font-medium", children: product.totalQuantity })] }, product.id))) })] })) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Productos Con Bajo Stock" }), _jsx(CardDescription, { children: "Productos que requieren reposici\u00F3n inmediata" })] }), _jsx(CardContent, { children: lowStockProducts.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay productos con bajo stock actualmente" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { className: "text-right", children: "Stock" })] }) }), _jsx(TableBody, { children: lowStockProducts.map((item, index) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("div", { className: "font-medium", children: item.product?.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.product?.sku] })] }), _jsx(TableCell, { children: item.warehouse?.name }), _jsx(TableCell, { className: "text-right", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${item.current_quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`, children: item.current_quantity }) })] }, index))) })] })) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Movimientos Recientes" }), _jsx(CardDescription, { children: "Los \u00FAltimos movimientos de inventario registrados en el sistema." })] }), _jsx(CardContent, { children: recentMovements.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay movimientos recientes registrados" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Tipo" }), _jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "Cantidad" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { children: "Fecha" })] }) }), _jsx(TableBody, { children: recentMovements.map((movement) => {
                                                const typeInfo = getMovementTypeLabel(movement.movement_type);
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${typeInfo.className}`, children: typeInfo.label }) }), _jsx(TableCell, { children: movement.product?.name }), _jsx(TableCell, { children: movement.quantity }), _jsx(TableCell, { children: movement.warehouse?.name }), _jsx(TableCell, { children: formatDate(movement.movement_date) })] }, movement.id));
                                            }) })] })) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsx(Link, { to: "/productos", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-plus-circle text-primary" }), _jsx("span", { children: "Nuevo Producto" })] }) }), _jsx(Link, { to: "/inventario", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-arrow-down text-green-600" }), _jsx("span", { children: "Registrar Entrada" })] }) }), _jsx(Link, { to: "/inventario", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-arrow-up text-orange-500" }), _jsx("span", { children: "Registrar Salida" })] }) }), _jsx(Link, { to: "/ventas/facturas/nueva", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-file-invoice-dollar text-blue-500" }), _jsx("span", { children: "Nueva Venta" })] }) })] })] }))] }));
};
export default Dashboard;
