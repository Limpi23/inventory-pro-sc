import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
const Reports = () => {
    const [activeReport, setActiveReport] = useState('sales');
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    const [salesData, setSalesData] = useState([]);
    const [purchasesData, setPurchasesData] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState(null);
    // Estadísticas
    const [stats, setStats] = useState({
        totalAmount: 0,
        count: 0,
        avgAmount: 0,
        minAmount: 0,
        maxAmount: 0
    });
    useEffect(() => {
        fetchWarehouses();
    }, []);
    useEffect(() => {
        if (activeReport === 'sales') {
            fetchSalesReport();
        }
        else {
            fetchPurchasesReport();
        }
    }, [activeReport, filters]);
    const fetchWarehouses = async () => {
        try {
            const client = await supabase.getClient();
            const { data, error } = await client.from('warehouses')
                .select('id, name')
                .order('name');
            if (error)
                throw error;
            setWarehouses(data || []);
        }
        catch (err) {
            console.error('Error cargando almacenes:', err);
            setError('Error cargando almacenes: ' + err.message);
        }
    };
    const fetchSalesReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const client = await supabase.getClient();
            let query = client.from('invoices')
                .select(`
          id,
          invoice_number,
          invoice_date,
          status,
          total_amount,
          customer:customers(name),
          warehouse:warehouses(name)
        `)
                .gte('invoice_date', filters.startDate)
                .lte('invoice_date', filters.endDate)
                .order('invoice_date', { ascending: false });
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.warehouse_id) {
                query = query.eq('warehouse_id', filters.warehouse_id);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            const formattedData = (data || []).map((invoice) => ({
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date,
                customer_name: invoice.customer?.name || 'Desconocido',
                status: invoice.status,
                warehouse_name: invoice.warehouse?.name || 'Desconocido',
                total_amount: invoice.total_amount || 0
            }));
            setSalesData(formattedData);
            // Calcular estadísticas
            if (formattedData.length > 0) {
                const total = formattedData.reduce((sum, item) => sum + item.total_amount, 0);
                const count = formattedData.length;
                const avg = total / count;
                const min = Math.min(...formattedData.map(item => item.total_amount));
                const max = Math.max(...formattedData.map(item => item.total_amount));
                setStats({
                    totalAmount: total,
                    count,
                    avgAmount: avg,
                    minAmount: min,
                    maxAmount: max
                });
            }
            else {
                setStats({
                    totalAmount: 0,
                    count: 0,
                    avgAmount: 0,
                    minAmount: 0,
                    maxAmount: 0
                });
            }
        }
        catch (err) {
            console.error('Error cargando reporte de ventas:', err);
            setError('Error cargando reporte de ventas: ' + err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const fetchPurchasesReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const client = await supabase.getClient();
            let query = client.from('purchase_orders')
                .select(`
          id,
          order_date,
          status,
          total_amount,
          supplier:suppliers(name),
          warehouse:warehouses(name)
        `)
                .gte('order_date', filters.startDate)
                .lte('order_date', filters.endDate)
                .order('order_date', { ascending: false });
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.warehouse_id) {
                query = query.eq('warehouse_id', filters.warehouse_id);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            const formattedData = (data || []).map((order) => ({
                id: order.id,
                order_date: order.order_date,
                supplier_name: order.supplier?.name || 'Desconocido',
                status: order.status,
                warehouse_name: order.warehouse?.name || 'Desconocido',
                total_amount: order.total_amount || 0
            }));
            setPurchasesData(formattedData);
            // Calcular estadísticas
            if (formattedData.length > 0) {
                const total = formattedData.reduce((sum, item) => sum + item.total_amount, 0);
                const count = formattedData.length;
                const avg = total / count;
                const min = Math.min(...formattedData.map(item => item.total_amount));
                const max = Math.max(...formattedData.map(item => item.total_amount));
                setStats({
                    totalAmount: total,
                    count,
                    avgAmount: avg,
                    minAmount: min,
                    maxAmount: max
                });
            }
            else {
                setStats({
                    totalAmount: 0,
                    count: 0,
                    avgAmount: 0,
                    minAmount: 0,
                    maxAmount: 0
                });
            }
        }
        catch (err) {
            console.error('Error cargando reporte de compras:', err);
            setError('Error cargando reporte de compras: ' + err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const exportToCSV = () => {
        try {
            setIsExporting(true);
            const data = activeReport === 'sales' ? salesData : purchasesData;
            let headers;
            let dataRows;
            if (activeReport === 'sales') {
                headers = [
                    'Número de Factura',
                    'Fecha',
                    'Cliente',
                    'Estado',
                    'Almacén',
                    'Total'
                ];
                dataRows = data.map(item => [
                    item.invoice_number,
                    item.invoice_date,
                    item.customer_name,
                    item.status,
                    item.warehouse_name,
                    item.total_amount.toString()
                ]);
            }
            else {
                headers = [
                    'ID',
                    'Fecha',
                    'Proveedor',
                    'Estado',
                    'Almacén',
                    'Total'
                ];
                dataRows = data.map(item => [
                    item.id,
                    item.order_date,
                    item.supplier_name,
                    item.status,
                    item.warehouse_name,
                    item.total_amount.toString()
                ]);
            }
            // Añadir estadísticas al final
            dataRows.push([]);
            dataRows.push(['Resumen', '', '', '', '', '']);
            dataRows.push(['Total registros', stats.count.toString(), '', '', '', '']);
            dataRows.push(['Total monto', stats.totalAmount.toString(), '', '', '', '']);
            dataRows.push(['Promedio', stats.avgAmount.toString(), '', '', '', '']);
            dataRows.push(['Mínimo', stats.minAmount.toString(), '', '', '', '']);
            dataRows.push(['Máximo', stats.maxAmount.toString(), '', '', '', '']);
            // Usar PapaParse para crear el CSV correctamente con manejo de comillas y caracteres especiales
            const csv = Papa.unparse({
                fields: headers,
                data: dataRows
            });
            // Crear un blob y URL para descargar
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            // Crear elemento de enlace para descarga
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
            const fileName = activeReport === 'sales'
                ? `reporte_ventas_${date}.csv`
                : `reporte_compras_${date}.csv`;
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            // Simular clic y eliminar el enlace
            link.click();
            document.body.removeChild(link);
        }
        catch (err) {
            console.error('Error al exportar reporte:', err);
            setError('Error al generar el archivo CSV: ' + err.message);
        }
        finally {
            setIsExporting(false);
        }
    };
    // Formatear moneda
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2
        }).format(amount);
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Reportes" }), _jsxs("button", { onClick: exportToCSV, disabled: isExporting || isLoading, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center", children: [isExporting ? (_jsx("span", { className: "inline-block animate-spin mr-2", children: _jsx("i", { className: "fas fa-spinner" }) })) : (_jsx("i", { className: "fas fa-file-csv mr-2" })), "Exportar a CSV"] })] }), _jsx("div", { className: "border-b border-gray-200 dark:border-gray-700 mb-4", children: _jsxs("nav", { className: "flex space-x-8", "aria-label": "Tabs", children: [_jsx("button", { onClick: () => setActiveReport('sales'), className: `py-3 px-1 border-b-2 font-medium text-sm ${activeReport === 'sales'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`, children: "Reporte de Ventas" }), _jsx("button", { onClick: () => setActiveReport('purchases'), className: `py-3 px-1 border-b-2 font-medium text-sm ${activeReport === 'purchases'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`, children: "Reporte de Compras" })] }) }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4 dark:text-gray-200", children: "Filtros" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "startDate", className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Fecha Inicio" }), _jsx("input", { type: "date", id: "startDate", name: "startDate", value: filters.startDate, onChange: handleFilterChange, className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "endDate", className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Fecha Fin" }), _jsx("input", { type: "date", id: "endDate", name: "endDate", value: filters.endDate, onChange: handleFilterChange, className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "status", className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Estado" }), _jsxs("select", { id: "status", name: "status", value: filters.status || '', onChange: handleFilterChange, className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Todos los estados" }), activeReport === 'sales' ? (_jsxs(_Fragment, { children: [_jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "emitida", children: "Emitida" }), _jsx("option", { value: "pagada", children: "Pagada" }), _jsx("option", { value: "anulada", children: "Anulada" })] })) : (_jsxs(_Fragment, { children: [_jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "enviada", children: "Enviada" }), _jsx("option", { value: "recibida_parcialmente", children: "Recibida parcialmente" }), _jsx("option", { value: "completada", children: "Completada" }), _jsx("option", { value: "cancelada", children: "Cancelada" })] }))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "warehouse_id", className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Almac\u00E9n" }), _jsxs("select", { id: "warehouse_id", name: "warehouse_id", value: filters.warehouse_id || '', onChange: handleFilterChange, className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Todos los almacenes" }), warehouses.map(warehouse => (_jsx("option", { value: warehouse.id, children: warehouse.name }, warehouse.id)))] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-xs text-blue-500 dark:text-blue-300 uppercase font-semibold", children: "Total" }), _jsx("div", { className: "text-2xl font-bold text-blue-700 dark:text-blue-200", children: formatCurrency(stats.totalAmount) })] }), _jsxs("div", { className: "bg-green-50 dark:bg-green-900 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-xs text-green-500 dark:text-green-300 uppercase font-semibold", children: "Registros" }), _jsx("div", { className: "text-2xl font-bold text-green-700 dark:text-green-200", children: stats.count })] }), _jsxs("div", { className: "bg-purple-50 dark:bg-purple-900 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-xs text-purple-500 dark:text-purple-300 uppercase font-semibold", children: "Promedio" }), _jsx("div", { className: "text-2xl font-bold text-purple-700 dark:text-purple-200", children: formatCurrency(stats.avgAmount) })] }), _jsxs("div", { className: "bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-xs text-yellow-500 dark:text-yellow-300 uppercase font-semibold", children: "M\u00EDnimo" }), _jsx("div", { className: "text-2xl font-bold text-yellow-700 dark:text-yellow-200", children: formatCurrency(stats.minAmount) })] }), _jsxs("div", { className: "bg-red-50 dark:bg-red-900 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-xs text-red-500 dark:text-red-300 uppercase font-semibold", children: "M\u00E1ximo" }), _jsx("div", { className: "text-2xl font-bold text-red-700 dark:text-red-200", children: formatCurrency(stats.maxAmount) })] })] }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [activeReport === 'sales' ? (_jsxs(_Fragment, { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Factura" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Cliente" })] })) : (_jsxs(_Fragment, { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Orden #" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Proveedor" })] })), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Estado" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Almac\u00E9n" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Total" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: activeReport === 'sales' ? (salesData.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-6 text-center text-sm text-gray-500 dark:text-gray-400", children: "No hay datos para el per\u00EDodo seleccionado" }) })) : (salesData.map(invoice => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700", children: [_jsx("td", { className: "py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400", children: invoice.invoice_number }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: new Date(invoice.invoice_date).toLocaleDateString() }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: invoice.customer_name }), _jsx("td", { className: "py-3 px-4", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${invoice.status === 'emitida' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                invoice.status === 'pagada' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                    invoice.status === 'anulada' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`, children: invoice.status }) }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: invoice.warehouse_name }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: formatCurrency(invoice.total_amount) })] }, invoice.id))))) : (purchasesData.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-6 text-center text-sm text-gray-500 dark:text-gray-400", children: "No hay datos para el per\u00EDodo seleccionado" }) })) : (purchasesData.map(order => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700", children: [_jsxs("td", { className: "py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400", children: ["#", order.id.substring(0, 8), "..."] }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: new Date(order.order_date).toLocaleDateString() }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: order.supplier_name }), _jsx("td", { className: "py-3 px-4", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${order.status === 'enviada' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                order.status === 'completada' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                    order.status === 'cancelada' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                        order.status === 'recibida_parcialmente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`, children: order.status }) }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900 dark:text-gray-300", children: order.warehouse_name }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium dark:text-gray-300", children: formatCurrency(order.total_amount) })] }, order.id))))) })] }) }))] }));
};
export default Reports;
