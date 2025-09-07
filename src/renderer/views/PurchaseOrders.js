import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
const PurchaseOrders = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0], // Últimos 3 meses
        end: new Date().toISOString().split('T')[0] // Hoy
    });
    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    useEffect(() => {
        fetchOrders();
    }, [dateRange, statusFilter]);
    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            let query = client.from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(name),
          warehouse:warehouses(name),
          items:purchase_order_items(count)
        `)
                .gte('order_date', dateRange.start)
                .lte('order_date', dateRange.end)
                .order('order_date', { ascending: false });
            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            const formattedOrders = (data || []).map((order) => ({
                id: order.id,
                order_date: order.order_date,
                status: order.status,
                total_amount: order.total_amount || 0,
                supplier_name: order.supplier?.name || 'Desconocido',
                warehouse_name: order.warehouse?.name || 'Desconocido',
                items_count: order.items?.length || 0,
                created_at: order.created_at
            }));
            setOrders(formattedOrders);
        }
        catch (err) {
            console.error('Error cargando órdenes de compra:', err);
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({
            ...prev,
            [name]: value
        }));
        setCurrentPage(1);
    };
    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };
    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };
    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setDateRange({
            start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        });
        setCurrentPage(1);
    };
    // Filtrar órdenes por término de búsqueda
    const filteredOrders = orders.filter(order => order.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()));
    // Calcular paginación
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    // Cambiar de página
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    // Formatear moneda
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2
        }).format(amount);
    };
    // Formatear estado con colores
    const getStatusBadge = (status) => {
        let colorClass = '';
        let icon = '';
        switch (status.toLowerCase()) {
            case 'draft':
            case 'borrador':
                colorClass = 'bg-gray-100 text-gray-800';
                icon = 'fas fa-pencil-alt';
                break;
            case 'sent':
            case 'enviada':
                colorClass = 'bg-blue-100 text-blue-800';
                icon = 'fas fa-paper-plane';
                break;
            case 'partially_received':
            case 'recibida_parcialmente':
                colorClass = 'bg-yellow-100 text-yellow-800';
                icon = 'fas fa-truck-loading';
                break;
            case 'completed':
            case 'completada':
                colorClass = 'bg-green-100 text-green-800';
                icon = 'fas fa-check-circle';
                break;
            case 'cancelled':
            case 'cancelada':
                colorClass = 'bg-red-100 text-red-800';
                icon = 'fas fa-ban';
                break;
            default:
                colorClass = 'bg-gray-100 text-gray-800';
                icon = 'fas fa-question-circle';
        }
        return (_jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`, children: [_jsx("i", { className: `${icon} mr-1` }), status] }));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "\u00D3rdenes de Compra" }), _jsxs(Link, { to: "/ordenes-compra/nueva", className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Orden"] })] }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "searchTerm", className: "block text-sm font-medium text-gray-700 mb-1", children: "Buscar" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", id: "searchTerm", placeholder: "Buscar por proveedor, almac\u00E9n...", value: searchTerm, onChange: handleSearch, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "status", className: "block text-sm font-medium text-gray-700 mb-1", children: "Estado" }), _jsxs("select", { id: "status", value: statusFilter, onChange: handleStatusFilterChange, className: "w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "enviada", children: "Enviada" }), _jsx("option", { value: "recibida_parcialmente", children: "Recibida parcialmente" }), _jsx("option", { value: "completada", children: "Completada" }), _jsx("option", { value: "cancelada", children: "Cancelada" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "start", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Inicial" }), _jsx("input", { type: "date", id: "start", name: "start", value: dateRange.start, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "end", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Final" }), _jsx("input", { type: "date", id: "end", name: "end", value: dateRange.end, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsx("div", { className: "mb-4", children: _jsxs("button", { onClick: clearFilters, className: "px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 inline-flex items-center", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Limpiar Filtros"] }) }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Orden" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Proveedor" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Almac\u00E9n" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Estado" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Total" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentOrders.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "py-6 text-center text-sm text-gray-500", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("i", { className: "fas fa-shopping-cart text-gray-300 text-4xl mb-2" }), _jsx("p", { children: "No hay \u00F3rdenes de compra disponibles" }), searchTerm && (_jsxs("p", { className: "text-xs mt-1", children: ["No se encontraron resultados para \"", searchTerm, "\""] }))] }) }) })) : (currentOrders.map((order) => (_jsxs("tr", { className: "hover:bg-gray-50 transition-colors", children: [_jsx("td", { className: "py-3 px-4 text-sm font-medium", children: _jsxs(Link, { to: `/ordenes-compra/${order.id}`, className: "text-blue-600 hover:text-blue-800 hover:underline", children: ["# ", order.id.slice(0, 8), "..."] }) }), _jsx("td", { className: "py-3 px-4 text-sm", children: order.supplier_name }), _jsx("td", { className: "py-3 px-4 text-sm", children: new Date(order.order_date).toLocaleDateString() }), _jsx("td", { className: "py-3 px-4 text-sm", children: order.warehouse_name }), _jsx("td", { className: "py-3 px-4 text-sm", children: getStatusBadge(order.status) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: formatCurrency(order.total_amount) }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs("div", { className: "flex items-center justify-center space-x-2", children: [_jsx(Link, { to: `/ordenes-compra/${order.id}`, className: "text-blue-600 hover:text-blue-800 focus:outline-none rounded-md p-1", title: "Ver detalles", children: _jsx("i", { className: "fas fa-eye" }) }), order.status !== 'completada' && order.status !== 'cancelada' && (_jsx(Link, { to: `/ordenes-compra/${order.id}/recibir`, className: "text-green-600 hover:text-green-800 focus:outline-none rounded-md p-1", title: "Recibir mercanc\u00EDa", children: _jsx("i", { className: "fas fa-truck-loading" }) })), order.status === 'borrador' && (_jsx(Link, { to: `/ordenes-compra/${order.id}/editar`, className: "text-yellow-600 hover:text-yellow-800 focus:outline-none rounded-md p-1", title: "Editar", children: _jsx("i", { className: "fas fa-edit" }) }))] }) })] }, order.id)))) })] }), filteredOrders.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, filteredOrders.length), " de ", filteredOrders.length, " \u00F3rdenes"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("button", { onClick: () => paginate(currentPage - 1), disabled: currentPage === 1, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                                let pageNumber;
                                                if (totalPages <= 5) {
                                                    pageNumber = i + 1;
                                                }
                                                else if (currentPage <= 3) {
                                                    pageNumber = i + 1;
                                                }
                                                else if (currentPage >= totalPages - 2) {
                                                    pageNumber = totalPages - 4 + i;
                                                }
                                                else {
                                                    pageNumber = currentPage - 2 + i;
                                                }
                                                return (_jsx("button", { onClick: () => paginate(pageNumber), className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === pageNumber
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: pageNumber }, pageNumber));
                                            }), _jsx("button", { onClick: () => paginate(currentPage + 1), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] })] }));
};
export default PurchaseOrders;
