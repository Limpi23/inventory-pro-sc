import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../hooks/useCurrency';
import { formatDateString } from '../lib/dateUtils';
const PurchaseOrderList = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const ordersPerPage = 10;
    const currency = useCurrency();
    useEffect(() => {
        fetchOrders();
    }, [currentPage, searchTerm, statusFilter]);
    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            let query = client.from('purchase_orders')
                .select(`
          id,
          supplier_id,
          order_date,
          status,
          total_amount,
          created_at,
          updated_at,
          supplier:suppliers(name),
          warehouse:warehouses(name),
          items_count:purchase_order_items(count)
        `, { count: 'exact' });
            // Aplicar filtros
            if (searchTerm) {
                // Hacemos una consulta independiente para encontrar proveedores por nombre
                let proveedoresIds = [];
                try {
                    // Primero buscamos proveedores cuyo nombre coincida
                    const { data: proveedores } = await client.from('suppliers')
                        .select('id')
                        .ilike('name', `%${searchTerm}%`);
                    if (proveedores && proveedores.length > 0) {
                        proveedoresIds = proveedores.map(p => p.id);
                    }
                }
                catch (err) {
                    console.error("Error al buscar proveedores:", err);
                }
                // Ahora configuramos el filtro incluyendo IDs y supplier_id si encontramos proveedores
                if (proveedoresIds.length > 0) {
                    // Si hay proveedores, buscamos por ID de orden o ID de proveedor
                    query = query.or(`id.ilike.%${searchTerm}%,supplier_id.in.(${proveedoresIds.join(',')})`);
                }
                else {
                    // Si no hay proveedores, solo buscamos por ID de orden
                    query = query.or(`id.ilike.%${searchTerm}%`);
                }
            }
            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }
            // Ordenar por fecha de creación (más reciente primero)
            query = query.order('created_at', { ascending: false });
            // Paginación
            const from = (currentPage - 1) * ordersPerPage;
            const to = from + ordersPerPage - 1;
            query = query.range(from, to);
            const { data, error, count } = await query;
            if (error)
                throw error;
            // Transformar los datos al formato esperado por PurchaseOrder
            const formattedData = transformOrderData(data || []);
            setOrders(formattedData || []);
            setTotalPages(count ? Math.ceil(count / ordersPerPage) : 1);
        }
        catch (err) {
            console.error('Error al cargar órdenes de compra:', err);
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const transformOrderData = (data) => {
        if (!data)
            return [];
        return data.map(item => {
            // Extraer el nombre del proveedor, con manejo seguro de tipos
            let supplierName = 'Sin nombre';
            if (Array.isArray(item.supplier) && item.supplier.length > 0) {
                supplierName = item.supplier[0]?.name || 'Sin nombre';
            }
            // Extraer el nombre del almacén, con manejo seguro de tipos
            let warehouseName = 'Sin ubicación';
            if (Array.isArray(item.warehouse) && item.warehouse.length > 0) {
                warehouseName = item.warehouse[0]?.name || 'Sin ubicación';
            }
            // Extraer el conteo de ítems, con manejo seguro de tipos
            let itemsCount = 0;
            if (Array.isArray(item.items_count) && item.items_count.length > 0 && item.items_count[0]) {
                const count = item.items_count[0].count;
                if (count !== undefined && count !== null) {
                    itemsCount = Number(count);
                }
            }
            return {
                ...item,
                supplier: { name: supplierName },
                warehouse: { name: warehouseName },
                items_count: itemsCount
            };
        });
    };
    const handleStatusFilterChange = (status) => {
        setStatusFilter(status);
        setCurrentPage(1);
    };
    const refreshOrders = () => {
        fetchOrders();
    };
    // Formatear moneda
    const formatCurrency = (amount) => currency.format(amount);
    // Formatear fecha
    const formatDate = (dateString) => {
        return formatDateString(dateString, currency.settings.locale);
    };
    // Renderizar el badge de estado
    const renderStatusBadge = (status) => {
        let badgeClass = '';
        let text = '';
        switch (status) {
            case 'completada':
                badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                text = 'completada';
                break;
            case 'recibida_parcialmente':
                badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                text = 'recibida_parcialmente';
                break;
            default:
                badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
                text = status;
        }
        return (_jsx("span", { className: `px-2.5 py-0.5 rounded-full text-xs ${badgeClass}`, children: text }));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "\u00D3rdenes de Compra" }), _jsxs(Link, { to: "/ordenes-compra/nueva", className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Orden"] })] }), _jsxs("div", { className: "bg-white dark:bg-gray-800 !dark:bg-gray-800 rounded-lg shadow-md p-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Buscar" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Buscar por proveedor...", className: "w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Estado" }), _jsxs("select", { value: statusFilter, onChange: (e) => handleStatusFilterChange(e.target.value), className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2", children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "enviada", children: "Enviada" }), _jsx("option", { value: "recibida_parcialmente", children: "Recibida Parcialmente" }), _jsx("option", { value: "completada", children: "Completada" }), _jsx("option", { value: "cancelada", children: "Cancelada" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Fecha Inicial" }), _jsx("input", { type: "date", className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Fecha Final" }), _jsx("input", { type: "date", className: "w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md px-3 py-2" })] })] }), _jsx("div", { className: "mt-4", children: _jsxs("button", { type: "button", onClick: () => {
                                setSearchTerm('');
                                setStatusFilter('');
                                setCurrentPage(1);
                            }, className: "flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Limpiar Filtros"] }) })] }), _jsx("div", { className: "bg-white dark:bg-gray-800 !dark:bg-gray-800 rounded-lg shadow-md overflow-hidden", children: isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : error ? (_jsxs("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: [_jsx("p", { children: error }), _jsx("button", { onClick: refreshOrders, className: "text-red-700 hover:text-red-900 underline mt-2", children: "Intentar nuevamente" })] })) : orders.length === 0 ? (_jsxs("div", { className: "text-center py-10", children: [_jsx("div", { className: "text-gray-400 dark:text-gray-500 mb-3", children: _jsx("i", { className: "fas fa-file-invoice text-5xl" }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: "No se encontraron \u00F3rdenes" }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 mt-1", children: searchTerm || statusFilter
                                ? 'Intenta con otros filtros de búsqueda'
                                : 'Crea tu primera orden de compra para comenzar' }), !searchTerm && !statusFilter && (_jsxs(Link, { to: "/ordenes-compra/nueva", className: "inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Orden"] }))] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto dark:bg-gray-800 !dark:bg-gray-800", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700 !dark:bg-gray-800", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-100 dark:bg-gray-700 !dark:bg-gray-700", children: [_jsx("th", { scope: "col", className: "px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "ORDEN" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "PROVEEDOR" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "FECHA" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "ALMAC\u00C9N" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "ESTADO" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "TOTAL" }), _jsx("th", { scope: "col", className: "px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "ACCIONES" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 !dark:bg-gray-800", children: orders.map((order) => (_jsxs("tr", { className: "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700", children: [_jsx("td", { className: "px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsxs("div", { className: "text-sm font-medium text-blue-600 dark:text-blue-400", children: ["#", order.id.substring(0, 8), "..."] }) }), _jsx("td", { className: "px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsx("div", { className: "text-sm font-medium text-gray-900 dark:text-gray-300", children: order.supplier.name || 'Sin proveedor' }) }), _jsx("td", { className: "px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: formatDate(order.order_date) }) }), _jsx("td", { className: "px-4 py-4 bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsx("div", { className: "text-sm text-gray-900 dark:text-gray-300", children: order.warehouse.name }) }), _jsx("td", { className: "px-4 py-4 text-center bg-white dark:bg-gray-800 dark:text-gray-300", children: renderStatusBadge(order.status) }), _jsx("td", { className: "px-4 py-4 text-right bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsx("div", { className: "text-sm font-medium text-gray-900 dark:text-gray-300", children: formatCurrency(order.total_amount) }) }), _jsx("td", { className: "px-4 py-4 text-right bg-white dark:bg-gray-800 dark:text-gray-300", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Link, { to: `/ordenes-compra/${order.id}`, className: "text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300", title: "Ver detalles", children: _jsx("i", { className: "fas fa-eye" }) }), order.status === 'borrador' && (_jsx(Link, { to: `/ordenes-compra/editar/${order.id}`, className: "text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300", title: "Editar", children: _jsx("i", { className: "fas fa-edit" }) })), ['enviada', 'recibida_parcialmente'].includes(order.status) && (_jsx(Link, { to: `/ordenes-compra/${order.id}/recibir`, className: "text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300", title: "Recibir mercanc\u00EDa", children: _jsx("i", { className: "fas fa-truck-loading" }) }))] }) })] }, order.id))) })] }) }), totalPages > 1 && (_jsx("div", { className: "bg-white dark:bg-gray-800 !dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700", children: _jsxs("div", { className: "hidden sm:flex-1 sm:flex sm:items-center sm:justify-between", children: [_jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: ["Mostrando ", _jsx("span", { className: "font-medium", children: (currentPage - 1) * ordersPerPage + 1 }), " a ", ' ', _jsx("span", { className: "font-medium", children: Math.min(currentPage * ordersPerPage, totalPages * ordersPerPage) }), " de", ' ', _jsx("span", { className: "font-medium", children: totalPages * ordersPerPage }), " resultados"] }) }), _jsx("div", { children: _jsxs("nav", { className: "relative z-0 inline-flex rounded-md shadow-sm -space-x-px", "aria-label": "Pagination", children: [_jsx("button", { onClick: () => setCurrentPage(currentPage - 1), disabled: currentPage === 1, className: `relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${currentPage === 1
                                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), Array.from({ length: totalPages }).map((_, index) => (_jsx("button", { onClick: () => setCurrentPage(index + 1), className: `relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${currentPage === index + 1
                                                        ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-700 text-blue-600 dark:text-blue-300'
                                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`, children: index + 1 }, index))), _jsx("button", { onClick: () => setCurrentPage(currentPage + 1), disabled: currentPage === totalPages, className: `relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium ${currentPage === totalPages
                                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] }) })] }) }))] })) })] }));
};
export default PurchaseOrderList;
