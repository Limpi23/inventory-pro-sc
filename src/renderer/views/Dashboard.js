import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
import { OutOfStockModal } from '../components/OutOfStockModal';
const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const currency = useCurrency();
    const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
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
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            // Execute independent queries in parallel
            const [productsResult, salesResult, lowStockCountResult, movementsCountResult, recentMovementsResult, topProductsResult, lowStockDetailResult] = await Promise.all([
                // 1. Total products count
                client.from('products').select('*', { count: 'exact', head: true }),
                // 2. Monthly sales (fetch total_amount only)
                client.from('invoices')
                    .select('total_amount')
                    .gte('invoice_date', firstDayOfMonth.toISOString())
                    .in('status', ['emitida', 'pagada']),
                // 3. Low stock count (unique products)
                client.from('current_stock')
                    .select('product_id')
                    .lte('current_quantity', 0),
                // 4. Today's movements count
                client.from('stock_movements')
                    .select('*', { count: 'exact', head: true })
                    .gte('movement_date', startOfDay.toISOString()),
                // 5. Recent movements with joins
                client.from('stock_movements')
                    .select(`
            id,
            quantity,
            movement_date,
            movement_type_id,
            product:products(name, sku),
            warehouse:warehouses(name),
            movement_type:movement_types(code, description)
          `)
                    .order('created_at', { ascending: false })
                    .limit(5),
                // 6. Top products (RPC or query)
                client.rpc('get_top_products', { limit_count: 5 }),
                // 7. Low stock detail
                client.from('current_stock')
                    .select('current_quantity, product_id, product_name, sku, warehouse_name')
                    .lte('current_quantity', 0)
                    .order('current_quantity', { ascending: true })
                    .limit(5)
            ]);
            // Process Results
            // Stats
            const productsCount = productsResult.count || 0;
            const monthlyTotal = salesResult.data?.reduce((sum, invoice) => sum + (Number(invoice?.total_amount) || 0), 0) || 0;
            const uniqueLowStockProducts = [...new Set(lowStockCountResult.data?.map((item) => item.product_id) || [])];
            const movementsCount = movementsCountResult.count || 0;
            setStats([
                { title: 'Total Productos', value: productsCount.toString(), icon: 'fas fa-box', color: 'bg-primary' },
                { title: 'Ventas del Mes', value: formatCurrency(monthlyTotal), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
                { title: 'Productos Agotados', value: uniqueLowStockProducts.length.toString(), icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
                { title: 'Movimientos Hoy', value: movementsCount.toString(), icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
            ]);
            // Recent Movements
            if (recentMovementsResult.data) {
                const formattedMovements = recentMovementsResult.data.map((m) => ({
                    id: m.id,
                    quantity: Number(m.quantity),
                    movement_date: m.movement_date,
                    movement_type_id: m.movement_type_id,
                    product: { name: m.product?.name || 'Desconocido' },
                    warehouse: { name: m.warehouse?.name || 'Desconocido' },
                    movement_type: {
                        code: m.movement_type?.code || '',
                        description: m.movement_type?.description || ''
                    }
                }));
                setRecentMovements(formattedMovements);
            }
            else {
                setRecentMovements([]);
            }
            // Top Products
            if (topProductsResult.data) {
                setTopProducts(topProductsResult.data.map((item) => ({
                    id: item.product_id,
                    name: item.product_name,
                    sku: item.sku || 'Sin SKU',
                    totalQuantity: Number(item.total_quantity)
                })));
            }
            else {
                // Fallback or empty if RPC fails
                setTopProducts([]);
            }
            // Low Stock Detail
            if (lowStockDetailResult.data) {
                const formattedLowStock = lowStockDetailResult.data.map((item) => ({
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
            else {
                setLowStockProducts([]);
            }
        }
        catch (error) {
            console.error('Dashboard error:', error);
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-2xl font-semibold text-gray-900 dark:text-white", children: "Dashboard" }), _jsx("span", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Panel de Control" })] }), loading ? (_jsx("div", { className: "flex justify-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: stats.map((stat, index) => (_jsxs(Card, { className: `${stat.title === 'Productos Agotados' ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`, onClick: () => {
                                if (stat.title === 'Productos Agotados') {
                                    setShowOutOfStockModal(true);
                                }
                            }, children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: stat.title }), _jsx("div", { className: `${stat.color} text-white p-2 rounded-lg`, children: _jsx("i", { className: `${stat.icon} text-xl` }) })] }), _jsx(CardContent, { children: _jsx("div", { className: "text-2xl font-bold", children: stat.value }) })] }, index))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Productos M\u00E1s Vendidos" }), _jsx(CardDescription, { children: "Los productos con mayor rotaci\u00F3n de salida" })] }), _jsx(CardContent, { children: topProducts.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay suficientes datos para mostrar productos populares" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { className: "text-right", children: "Cantidad Total" })] }) }), _jsx(TableBody, { children: topProducts.map((product) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("div", { className: "font-medium", children: product.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", product.sku] })] }), _jsx(TableCell, { className: "text-right font-medium", children: product.totalQuantity })] }, product.id))) })] })) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Productos Con Bajo Stock" }), _jsx(CardDescription, { children: "Productos que requieren reposici\u00F3n inmediata" })] }), _jsx(CardContent, { children: lowStockProducts.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay productos con bajo stock actualmente" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { className: "text-right", children: "Stock" })] }) }), _jsx(TableBody, { children: lowStockProducts.map((item, index) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("div", { className: "font-medium", children: item.product?.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.product?.sku] })] }), _jsx(TableCell, { children: item.warehouse?.name }), _jsx(TableCell, { className: "text-right", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${item.current_quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`, children: item.current_quantity }) })] }, index))) })] })) })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Movimientos Recientes" }), _jsx(CardDescription, { children: "Los \u00FAltimos movimientos de inventario registrados en el sistema." })] }), _jsx(CardContent, { children: recentMovements.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "No hay movimientos recientes registrados" })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Tipo" }), _jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "Cantidad" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { children: "Fecha" })] }) }), _jsx(TableBody, { children: recentMovements.map((movement) => {
                                                const typeInfo = getMovementTypeLabel(movement.movement_type);
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${typeInfo.className}`, children: typeInfo.label }) }), _jsx(TableCell, { children: movement.product?.name }), _jsx(TableCell, { children: movement.quantity }), _jsx(TableCell, { children: movement.warehouse?.name }), _jsx(TableCell, { children: formatDate(movement.movement_date) })] }, movement.id));
                                            }) })] })) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsx(Link, { to: "/productos", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-plus-circle text-primary" }), _jsx("span", { children: "Nuevo Producto" })] }) }), _jsx(Link, { to: "/inventario", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-arrow-down text-green-600" }), _jsx("span", { children: "Registrar Entrada" })] }) }), _jsx(Link, { to: "/inventario", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-arrow-up text-orange-500" }), _jsx("span", { children: "Registrar Salida" })] }) }), _jsx(Link, { to: "/ventas/facturas/nueva", className: "w-full", children: _jsxs(Button, { className: "flex items-center gap-2 w-full", variant: "outline", children: [_jsx("i", { className: "fas fa-file-invoice-dollar text-blue-500" }), _jsx("span", { children: "Nueva Venta" })] }) })] })] })), _jsx(OutOfStockModal, { isOpen: showOutOfStockModal, onClose: () => setShowOutOfStockModal(false) })] }));
};
export default Dashboard;
