import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
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
    const currency = useCurrency();
    const { hasPermission, user } = useAuth();
    const [selectedOrderSummary, setSelectedOrderSummary] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [drawerError, setDrawerError] = useState(null);
    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const canViewOrders = hasPermission('purchase_orders', 'view');
    const canEditOrders = hasPermission('purchase_orders', 'edit');
    const roleName = (user?.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || user?.role_id === 1;
    const canManageOrders = isAdmin || canEditOrders;
    const showActionsColumn = canViewOrders;
    useEffect(() => {
        if (!canViewOrders) {
            setIsLoading(false);
            return;
        }
        fetchOrders();
    }, [dateRange, statusFilter, canViewOrders]);
    const fetchOrders = async () => {
        if (!canViewOrders)
            return;
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
    const handleOrderRowClick = (order) => {
        if (!canViewOrders)
            return;
        setSelectedOrderSummary(order);
        setSelectedOrder(null);
        setOrderItems([]);
        setDrawerError(null);
        setIsDrawerOpen(true);
        fetchOrderPreview(order.id, order);
    };
    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setTimeout(() => {
            setSelectedOrderSummary(null);
            setSelectedOrder(null);
            setOrderItems([]);
            setDrawerError(null);
        }, 250);
    };
    const fetchOrderPreview = async (orderId, summary) => {
        try {
            setDrawerLoading(true);
            setDrawerError(null);
            const client = await supabase.getClient();
            const { data: orderData, error: orderError } = await client
                .from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(id, name, contact_info),
          warehouse:warehouses(id, name, location)
        `)
                .eq('id', orderId)
                .single();
            if (orderError)
                throw orderError;
            const { data: itemsData, error: itemsError } = await client
                .from('purchase_order_items')
                .select(`
          id,
          product_id,
          quantity,
          received_quantity,
          unit_price,
          total_price,
          product:products(name, sku)
        `)
                .eq('purchase_order_id', orderId);
            if (itemsError)
                throw itemsError;
            const baseSummary = summary || selectedOrderSummary;
            const normalizedOrder = {
                id: orderData.id,
                order_date: orderData.order_date,
                status: orderData.status,
                total_amount: orderData.total_amount ?? 0,
                supplier_name: orderData?.supplier?.name || baseSummary?.supplier_name || 'Desconocido',
                warehouse_name: orderData?.warehouse?.name || baseSummary?.warehouse_name || 'Desconocido',
                items_count: baseSummary?.items_count ?? (itemsData?.length ?? 0),
                created_at: orderData.created_at,
                supplier: orderData?.supplier || null,
                warehouse: orderData?.warehouse || null,
                notes: orderData?.notes || null,
                updated_at: orderData?.updated_at || orderData?.created_at,
            };
            setSelectedOrder(normalizedOrder);
            setOrderItems((itemsData || []));
        }
        catch (err) {
            console.error('Error al cargar vista previa de orden:', err);
            setDrawerError(err.message || 'No se pudo cargar la orden seleccionada');
            toast.error(`Error al cargar la orden: ${err.message || err}`);
        }
        finally {
            setDrawerLoading(false);
        }
    };
    const handleCancelOrder = async (orderId) => {
        if (!canManageOrders) {
            toast.error('No tienes permiso para cancelar órdenes de compra.');
            return;
        }
        const confirmed = confirm('¿Está seguro que desea cancelar esta orden de compra? Esta acción no se puede deshacer.');
        if (!confirmed) {
            return;
        }
        try {
            const client = await supabase.getClient();
            const { error: updateError } = await client
                .from('purchase_orders')
                .update({ status: 'cancelada', updated_at: new Date().toISOString() })
                .eq('id', orderId);
            if (updateError)
                throw updateError;
            toast.success('Orden cancelada correctamente');
            fetchOrders();
            if (selectedOrderSummary?.id === orderId) {
                fetchOrderPreview(orderId, selectedOrderSummary);
            }
        }
        catch (err) {
            console.error('Error al cancelar orden:', err);
            toast.error(`Error al cancelar orden: ${err.message || err}`);
        }
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
    const formatCurrency = (amount) => currency.format(amount);
    const formatDateLong = (dateString) => {
        if (!dateString)
            return '';
        return new Date(dateString).toLocaleDateString(currency.settings.locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
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
    if (!canViewOrders) {
        return (_jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsx("h1", { className: "text-xl font-semibold text-gray-800 mb-2", children: "\u00D3rdenes de Compra" }), _jsx("p", { className: "text-gray-600", children: "No tienes permisos para ver las \u00F3rdenes de compra." })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "\u00D3rdenes de Compra" }), canManageOrders && (_jsxs(Link, { to: "/ordenes-compra/nueva", className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Orden"] }))] }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "searchTerm", className: "block text-sm font-medium text-gray-700 mb-1", children: "Buscar" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", id: "searchTerm", placeholder: "Buscar por proveedor, almac\u00E9n...", value: searchTerm, onChange: handleSearch, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "status", className: "block text-sm font-medium text-gray-700 mb-1", children: "Estado" }), _jsxs("select", { id: "status", value: statusFilter, onChange: handleStatusFilterChange, className: "w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "enviada", children: "Enviada" }), _jsx("option", { value: "recibida_parcialmente", children: "Recibida parcialmente" }), _jsx("option", { value: "completada", children: "Completada" }), _jsx("option", { value: "cancelada", children: "Cancelada" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "start", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Inicial" }), _jsx("input", { type: "date", id: "start", name: "start", value: dateRange.start, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "end", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Final" }), _jsx("input", { type: "date", id: "end", name: "end", value: dateRange.end, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsx("div", { className: "mb-4", children: _jsxs("button", { onClick: clearFilters, className: "px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 inline-flex items-center", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Limpiar Filtros"] }) }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Orden" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Proveedor" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Almac\u00E9n" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Estado" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Total" }), showActionsColumn && (_jsx("th", { className: "text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Acciones" }))] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentOrders.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "py-6 text-center text-sm text-gray-500", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("i", { className: "fas fa-shopping-cart text-gray-300 text-4xl mb-2" }), _jsx("p", { children: "No hay \u00F3rdenes de compra disponibles" }), searchTerm && (_jsxs("p", { className: "text-xs mt-1", children: ["No se encontraron resultados para \"", searchTerm, "\""] }))] }) }) })) : (currentOrders.map((order) => (_jsxs("tr", { className: "hover:bg-gray-50 transition-colors cursor-pointer", onClick: () => handleOrderRowClick(order), children: [_jsx("td", { className: "py-3 px-4 text-sm font-medium", children: _jsxs(Link, { to: `/ordenes-compra/${order.id}`, className: "text-blue-600 hover:text-blue-800 hover:underline", onClick: (e) => e.stopPropagation(), children: ["# ", order.id.slice(0, 8), "..."] }) }), _jsx("td", { className: "py-3 px-4 text-sm", children: order.supplier_name }), _jsx("td", { className: "py-3 px-4 text-sm", children: new Date(order.order_date).toLocaleDateString() }), _jsx("td", { className: "py-3 px-4 text-sm", children: order.warehouse_name }), _jsx("td", { className: "py-3 px-4 text-sm", children: getStatusBadge(order.status) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: formatCurrency(order.total_amount) }), showActionsColumn && (_jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-8 px-2", onClick: (e) => e.stopPropagation(), children: [_jsx("i", { className: "fas fa-ellipsis-v mr-2" }), "Acciones"] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "min-w-[200px]", onClick: (e) => e.stopPropagation(), children: [canViewOrders && (_jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: `/ordenes-compra/${order.id}`, className: "flex items-center gap-2 w-full", onClick: (e) => e.stopPropagation(), children: [_jsx("i", { className: "fas fa-eye text-muted-foreground" }), _jsx("span", { children: "Ver detalle" })] }) })), canManageOrders && ['enviada', 'recibida_parcialmente'].includes(order.status) && (_jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: `/ordenes-compra/${order.id}/recibir`, className: "flex items-center gap-2 w-full", onClick: (e) => e.stopPropagation(), children: [_jsx("i", { className: "fas fa-truck-loading text-green-600" }), _jsx("span", { children: "Registrar recepci\u00F3n" })] }) })), canManageOrders && order.status === 'borrador' && (_jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: `/ordenes-compra/${order.id}/editar`, className: "flex items-center gap-2 w-full", onClick: (e) => e.stopPropagation(), children: [_jsx("i", { className: "fas fa-edit text-yellow-600" }), _jsx("span", { children: "Editar" })] }) })), canManageOrders && ['borrador', 'enviada'].includes(order.status) && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: (event) => {
                                                                                    event.stopPropagation();
                                                                                    handleCancelOrder(order.id);
                                                                                }, className: "text-red-600 focus:text-red-700", children: [_jsx("i", { className: "fas fa-ban" }), _jsx("span", { children: "Cancelar orden" })] })] }))] })] }) }))] }, order.id)))) })] }), filteredOrders.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, filteredOrders.length), " de ", filteredOrders.length, " \u00F3rdenes"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("button", { onClick: () => paginate(currentPage - 1), disabled: currentPage === 1, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
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
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] }), canViewOrders && (_jsxs("div", { className: `fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-50 flex flex-col`, children: [_jsxs("div", { className: "p-4 border-b border-gray-200 flex justify-between items-center", children: [_jsx("h2", { className: "text-lg font-medium", children: "Vista previa de orden de compra" }), _jsx("button", { onClick: closeDrawer, className: "text-gray-500 hover:text-gray-700", children: _jsx("i", { className: "fas fa-times" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: drawerLoading ? (_jsx("div", { className: "flex justify-center items-center h-full", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : drawerError ? (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg", children: _jsx("p", { children: drawerError }) })) : selectedOrder ? (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-white rounded-lg border shadow-sm p-6", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500", children: "Orden" }), _jsxs("h3", { className: "text-xl font-semibold", children: ["#", selectedOrder.id] })] }), _jsx("div", { children: getStatusBadge(selectedOrder.status) })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Proveedor" }), _jsx("p", { className: "font-semibold text-gray-900", children: selectedOrder.supplier?.name || selectedOrder.supplier_name }), selectedOrder.supplier?.contact_info?.contact_name && (_jsxs("p", { className: "text-sm text-gray-600", children: ["Contacto: ", selectedOrder.supplier.contact_info.contact_name] })), (selectedOrder.supplier?.contact_info?.phone || selectedOrder.supplier?.contact_info?.email) && (_jsxs("p", { className: "text-sm text-gray-600", children: [selectedOrder.supplier?.contact_info?.phone, selectedOrder.supplier?.contact_info?.phone && selectedOrder.supplier?.contact_info?.email && ' | ', selectedOrder.supplier?.contact_info?.email] })), selectedOrder.supplier?.contact_info?.address && (_jsx("p", { className: "text-sm text-gray-600", children: selectedOrder.supplier.contact_info.address }))] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-gray-500", children: "Informaci\u00F3n" }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Fecha: ", formatDateLong(selectedOrder.order_date)] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Almac\u00E9n: ", selectedOrder.warehouse?.name || selectedOrder.warehouse_name] }), selectedOrder.updated_at && (_jsxs("p", { className: "text-sm text-gray-600", children: ["Actualizado: ", formatDateLong(selectedOrder.updated_at)] }))] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Link, { to: `/ordenes-compra/${selectedOrder.id}`, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-flex items-center gap-2", onClick: closeDrawer, children: [_jsx("i", { className: "fas fa-external-link-alt" }), "Ver detalle completo"] }), canManageOrders && ['enviada', 'recibida_parcialmente'].includes(selectedOrder.status) && (_jsxs(Link, { to: `/ordenes-compra/${selectedOrder.id}/recibir`, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 inline-flex items-center gap-2", onClick: closeDrawer, children: [_jsx("i", { className: "fas fa-truck-loading" }), "Registrar recepci\u00F3n"] })), canManageOrders && ['borrador', 'enviada'].includes(selectedOrder.status) && (_jsxs("button", { onClick: () => handleCancelOrder(selectedOrder.id), className: "px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 inline-flex items-center gap-2", children: [_jsx("i", { className: "fas fa-ban" }), "Cancelar orden"] }))] })] }) }), _jsxs("div", { className: "bg-white rounded-lg border shadow-sm p-6", children: [_jsx("h3", { className: "font-medium text-gray-700 mb-4", children: "Resumen del inventario" }), orderItems.length > 0 ? ((() => {
                                            const totalOrdered = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                                            const totalReceived = orderItems.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
                                            const totalPending = Math.max(totalOrdered - totalReceived, 0);
                                            return (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-gray-50 rounded-md p-4", children: [_jsx("p", { className: "text-xs uppercase text-gray-500", children: "Total ordenado" }), _jsx("p", { className: "text-lg font-semibold", children: totalOrdered })] }), _jsxs("div", { className: "bg-green-50 rounded-md p-4", children: [_jsx("p", { className: "text-xs uppercase text-green-600", children: "Total recibido" }), _jsx("p", { className: "text-lg font-semibold text-green-700", children: totalReceived })] }), _jsxs("div", { className: "bg-yellow-50 rounded-md p-4", children: [_jsx("p", { className: "text-xs uppercase text-yellow-600", children: "Pendiente por recibir" }), _jsx("p", { className: "text-lg font-semibold text-yellow-700", children: totalPending })] })] }));
                                        })()) : (_jsx("p", { className: "text-sm text-gray-600", children: "No hay productos asociados a esta orden." }))] }), _jsxs("div", { className: "bg-white rounded-lg border shadow-sm", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h3", { className: "font-medium text-gray-700", children: "Detalle de productos" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Producto" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Cantidad" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Recibido" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pendiente" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: orderItems.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-6 text-sm text-center text-gray-500", children: "No se encontraron productos para esta orden." }) })) : (orderItems.map((item) => {
                                                            const received = item.received_quantity || 0;
                                                            const pending = Math.max((item.quantity || 0) - received, 0);
                                                            return (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("div", { className: "font-medium text-gray-900", children: item.product?.name || 'Producto sin nombre' }), item.product?.sku && (_jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.product.sku] }))] }), _jsx("td", { className: "px-4 py-3 text-right text-sm", children: item.quantity }), _jsx("td", { className: "px-4 py-3 text-right text-sm text-green-700", children: received }), _jsx("td", { className: `px-4 py-3 text-right text-sm ${pending === 0 ? 'text-gray-500' : 'text-yellow-600'}`, children: pending }), _jsx("td", { className: "px-4 py-3 text-right text-sm font-medium", children: formatCurrency(item.total_price) })] }, item.id));
                                                        })) })] }) }), _jsx("div", { className: "p-4 border-t flex justify-end", children: _jsxs("div", { className: "w-full sm:w-64 space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm text-gray-600", children: [_jsx("span", { children: "Total ordenado:" }), _jsx("span", { children: formatCurrency(orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0)) })] }), _jsxs("div", { className: "flex justify-between text-base font-semibold text-gray-900", children: [_jsx("span", { children: "Total factura:" }), _jsx("span", { children: formatCurrency(selectedOrder.total_amount) })] })] }) })] }), selectedOrder.notes && (_jsxs("div", { className: "bg-white rounded-lg border shadow-sm p-6", children: [_jsx("h3", { className: "font-medium text-gray-700 mb-2", children: "Notas" }), _jsx("p", { className: "text-sm text-gray-700 whitespace-pre-line", children: selectedOrder.notes })] }))] })) : (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsx("p", { className: "text-sm text-gray-500", children: "Selecciona una orden para ver su vista previa." }) })) })] }))] }));
};
export default PurchaseOrders;
