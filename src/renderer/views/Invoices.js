import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../lib/auth';
import { formatDateString } from '../lib/dateUtils';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
const Invoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [invoicesPerPage] = useState(10);
    const [upcomingDueInvoices, setUpcomingDueInvoices] = useState([]);
    const [showUpcomingAlert, setShowUpcomingAlert] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const { settings } = useCompanySettings();
    const currency = useCurrency();
    const { hasPermission, user } = useAuth();
    const canViewInvoices = hasPermission('invoices', 'view');
    const canCreateInvoices = hasPermission('invoices', 'create');
    const canEditInvoices = hasPermission('invoices', 'edit');
    const canDeleteInvoices = hasPermission('invoices', 'delete');
    const roleName = (user?.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || user?.role_id === 1;
    const hasActionPermissions = isAdmin && (canViewInvoices || canEditInvoices || canDeleteInvoices);
    useEffect(() => {
        fetchInvoices();
    }, []);
    useEffect(() => {
        if (selectedInvoice) {
            fetchInvoiceItems(selectedInvoice.id);
        }
    }, [selectedInvoice]);
    useEffect(() => {
        // Detectar cotizaciones próximas a vencer (en los próximos 7 días)
        const checkUpcomingDueInvoices = () => {
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);
            const upcoming = invoices.filter(invoice => {
                if (invoice.status !== 'emitida' || !invoice.due_date)
                    return false;
                const dueDate = new Date(invoice.due_date);
                return dueDate > today && dueDate <= nextWeek;
            });
            setUpcomingDueInvoices(upcoming);
        };
        checkUpcomingDueInvoices();
    }, [invoices]);
    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, identification_number),
          warehouse:warehouses(id, name)
        `)
                .order('invoice_date', { ascending: false });
            if (error)
                throw error;
            // Actualizar el estado de cotizaciones vencidas
            const today = new Date();
            const updatedInvoices = (data || []).map((invoice) => {
                if (invoice.status === 'emitida' && invoice.due_date) {
                    const dueDate = new Date(invoice.due_date);
                    if (dueDate < today) {
                        return { ...invoice, status: 'vencida' };
                    }
                }
                return invoice;
            });
            // Actualizar cotizaciones vencidas en la base de datos
            const overdueInvoices = updatedInvoices.filter((invoice) => invoice.status === 'vencida' && data?.find((i) => i.id === invoice.id)?.status !== 'vencida');
            if (overdueInvoices.length > 0) {
                for (const invoice of overdueInvoices) {
                    await client
                        .from('invoices')
                        .update({
                        status: 'vencida',
                        updated_at: new Date().toISOString()
                    })
                        .eq('id', invoice.id);
                }
                if (overdueInvoices.length === 1) {
                    toast.error(`La cotización ${overdueInvoices[0].invoice_number} ha vencido`);
                }
                else {
                    toast.error(`${overdueInvoices.length} cotizaciones han vencido`);
                }
            }
            setInvoices(updatedInvoices);
        }
        catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error(`Error al cargar cotizaciones: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchInvoiceItems = async (invoiceId) => {
        try {
            setDrawerLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('invoice_items')
                .select(`
          *,
          product:products(name, sku)
        `)
                .eq('invoice_id', invoiceId);
            if (error)
                throw error;
            setInvoiceItems(data || []);
        }
        catch (error) {
            console.error('Error al cargar items de cotización:', error.message);
            toast.error(`Error al cargar detalles de cotización: ${error.message}`);
        }
        finally {
            setDrawerLoading(false);
        }
    };
    const handleInvoiceRowClick = (invoice) => {
        if (!canViewInvoices)
            return;
        setSelectedInvoice(invoice);
        setIsDrawerOpen(true);
    };
    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setTimeout(() => {
            setSelectedInvoice(null);
            setInvoiceItems([]);
        }, 300);
    };
    // Filtrar facturas basadas en el término de búsqueda y filtro de estado
    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch = (invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer?.identification_number?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    // Calcular la paginación
    const indexOfLastInvoice = currentPage * invoicesPerPage;
    const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
    const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
    const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);
    const handleDeleteInvoice = async (id) => {
        if (!isAdmin || !canDeleteInvoices) {
            toast.error('No tienes permiso para anular cotizaciones.');
            return;
        }
        if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const client = await supabase.getClient();
            // En vez de eliminar, anulamos la cotización
            const { error } = await client
                .from('invoices')
                .update({
                status: 'anulada',
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error)
                throw error;
            toast.success('Cotización anulada correctamente');
            fetchInvoices();
        }
        catch (error) {
            console.error('Error al anular cotización:', error.message);
            toast.error(`Error al anular cotización: ${error.message}`);
        }
    };
    // Calcular los días restantes hasta la fecha de vencimiento
    const getDaysRemaining = (dueDate) => {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    // Formateo centralizado
    const formatCurrency = (amount) => currency.format(amount);
    const formatDate = (dateString) => {
        return formatDateString(dateString, currency.settings.locale);
    };
    // Renderizar el badge de estado
    const renderStatusBadge = (status) => {
        const statusConfig = {
            'borrador': { color: 'bg-gray-100 text-gray-800', icon: 'fa-pencil', text: 'Borrador' },
            'emitida': { color: 'bg-blue-100 text-blue-800', icon: 'fa-paper-plane', text: 'Emitida' },
            'pagada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Pagada' },
            'vencida': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-exclamation-circle', text: 'Vencida' },
            'anulada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Anulada' }
        };
        const config = statusConfig[status] || statusConfig.borrador;
        return (_jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`, children: [_jsx("i", { className: `fas ${config.icon} mr-1` }), config.text] }));
    };
    // Nueva función para obtener la clase del badge según el estado
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'borrador':
                return 'bg-gray-100 text-gray-800';
            case 'emitida':
                return 'bg-blue-100 text-blue-800';
            case 'pagada':
                return 'bg-green-100 text-green-800';
            case 'vencida':
                return 'bg-yellow-100 text-yellow-800';
            case 'anulada':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    // Nueva función para obtener el texto del estado
    const getStatusText = (status) => {
        const statusMap = {
            'borrador': 'Borrador',
            'emitida': 'Emitida',
            'pagada': 'Pagada',
            'vencida': 'Vencida',
            'anulada': 'Anulada'
        };
        return statusMap[status] || 'Desconocido';
    };
    // Filtro rápido para mostrar solo cotizaciones próximas a vencer
    const filterUpcomingDue = () => {
        setStatusFilter('emitida');
        const upcomingIds = upcomingDueInvoices.map(invoice => invoice.invoice_number);
        setSearchTerm(upcomingIds.length > 0 ? upcomingIds[0] ?? '' : '');
    };
    return (_jsxs("div", { className: "space-y-6 relative", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Ventas"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Gesti\u00F3n de Cotizaciones" })] }), canCreateInvoices && (_jsxs(Link, { to: "/ventas/facturas/nueva", className: "mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), " Nueva Cotizaci\u00F3n"] }))] }), upcomingDueInvoices.length > 0 && showUpcomingAlert && (_jsxs("div", { className: "bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("i", { className: "fas fa-exclamation-triangle text-amber-500 mr-3 text-lg" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-amber-800", children: "Cotizaciones pr\u00F3ximas a vencer" }), _jsx("p", { className: "text-amber-700", children: upcomingDueInvoices.length === 1
                                            ? `Hay 1 cotización que vencerá en los próximos 7 días`
                                            : `Hay ${upcomingDueInvoices.length} cotizaciones que vencerán en los próximos 7 días` })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: filterUpcomingDue, className: "px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-sm", children: "Ver cotizaciones" }), _jsx("button", { onClick: () => setShowUpcomingAlert(false), className: "text-amber-500 hover:text-amber-700", children: _jsx("i", { className: "fas fa-times" }) })] })] })), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsx("div", { className: "p-4 border-b", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Lista de Cotizaciones" }), _jsxs("div", { className: "flex flex-col md:flex-row gap-3", children: [_jsxs("div", { className: "relative", children: [_jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "pl-10 pr-4 py-2 border rounded-md w-full", children: [_jsx("option", { value: "all", children: "Todos los estados" }), _jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "emitida", children: "Emitida" }), _jsx("option", { value: "pagada", children: "Pagada" }), _jsx("option", { value: "vencida", children: "Vencida" }), _jsx("option", { value: "anulada", children: "Anulada" })] }), _jsx("i", { className: "fas fa-filter absolute left-3 top-3 text-gray-400" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Buscar cotizaci\u00F3n...", className: "pl-10 pr-4 py-2 border rounded-md w-full", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) }), _jsx("i", { className: "fas fa-search absolute left-3 top-3 text-gray-400" })] })] })] }) }), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : currentInvoices.length === 0 ? (_jsxs("div", { className: "p-8 text-center", children: [_jsx("i", { className: "fas fa-file-invoice text-gray-300 text-5xl mb-4" }), _jsx("p", { className: "text-gray-500", children: searchTerm || statusFilter !== 'all'
                                    ? 'No se encontraron cotizaciones que coincidan con la búsqueda.'
                                    : 'No hay cotizaciones registradas. ¡Crea tu primera cotización!' })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cotizaci\u00F3n" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cliente" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Fecha" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Estado" }), hasActionPermissions && (_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acciones" }))] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentInvoices.map((invoice) => (_jsxs("tr", { className: "hover:bg-gray-50 cursor-pointer", onClick: () => handleInvoiceRowClick(invoice), children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium text-blue-600", children: invoice.invoice_number }), invoice.due_date && (_jsxs("div", { className: `text-xs ${getDaysRemaining(invoice.due_date) < 3 ? 'text-red-500 font-bold' : 'text-gray-500'}`, children: ["Vence: ", formatDate(invoice.due_date)] }))] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: invoice.customer?.name }), _jsx("div", { className: "text-xs text-gray-500", children: invoice.customer?.identification_number })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatDate(invoice.invoice_date) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: formatCurrency(invoice.total_amount) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: renderStatusBadge(invoice.status) }), hasActionPermissions && (_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", onClick: (e) => e.stopPropagation(), children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", className: "h-8 w-8 p-0", children: [_jsx("span", { className: "sr-only", children: "Abrir men\u00FA" }), _jsx("i", { className: "fas fa-ellipsis-v" })] }) }), _jsxs(DropdownMenuContent, { align: "end", children: [canViewInvoices && (_jsxs(DropdownMenuItem, { onClick: () => handleInvoiceRowClick(invoice), children: [_jsx("i", { className: "fas fa-eye mr-2" }), " Ver detalles"] })), canEditInvoices && invoice.status === 'borrador' && (_jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: `/ventas/facturas/editar/${invoice.id}`, children: [_jsx("i", { className: "fas fa-edit mr-2" }), " Editar"] }) })), canDeleteInvoices && invoice.status !== 'anulada' && invoice.status !== 'pagada' && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => handleDeleteInvoice(invoice.id), className: "text-red-600", children: [_jsx("i", { className: "fas fa-times-circle mr-2" }), " Anular"] })] }))] })] }) }))] }, invoice.id))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "px-6 py-4 border-t flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstInvoice + 1, " a ", Math.min(indexOfLastInvoice, filteredInvoices.length), " de ", filteredInvoices.length, " cotizaciones"] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(prev - 1, 1)), disabled: currentPage === 1, className: `px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`, children: "Anterior" }), Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (_jsx("button", { onClick: () => setCurrentPage(page), className: `px-3 py-1 rounded-md ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`, children: page }, page))), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(prev + 1, totalPages)), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`, children: "Siguiente" })] })] }))] }))] }), isDrawerOpen && selectedInvoice && (_jsx("div", { className: "fixed inset-0 overflow-hidden z-50", children: _jsxs("div", { className: "absolute inset-0 overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity", onClick: closeDrawer }), _jsx("div", { className: "fixed inset-y-0 right-0 pl-10 max-w-full flex", children: _jsxs("div", { className: "w-screen max-w-md transform transition-all ease-in-out duration-500 sm:duration-700 bg-white shadow-xl flex flex-col", children: [_jsxs("div", { className: "flex-1 flex flex-col overflow-y-auto", children: [_jsxs("div", { className: "py-6 px-4 bg-blue-600 sm:px-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-medium text-white", children: ["Cotizaci\u00F3n #", selectedInvoice.invoice_number] }), _jsx("div", { className: "ml-3 h-7 flex items-center", children: _jsxs("button", { type: "button", className: "bg-blue-600 rounded-md text-blue-200 hover:text-white focus:outline-none", onClick: closeDrawer, children: [_jsx("span", { className: "sr-only", children: "Cerrar panel" }), _jsx("i", { className: "fas fa-times text-xl" })] }) })] }), _jsx("div", { className: "mt-1", children: _jsx("p", { className: "text-sm text-blue-100", children: formatDate(selectedInvoice.invoice_date) }) })] }), _jsx("div", { className: "flex-1 py-6 px-4 sm:px-6", children: _jsxs("div", { className: "flex flex-col space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Estado" }), _jsx("div", { className: "mt-1", children: renderStatusBadge(selectedInvoice.status) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Cliente" }), _jsx("div", { className: "mt-1 text-sm text-gray-900 font-medium", children: selectedInvoice.customer?.name }), _jsx("div", { className: "text-sm text-gray-500", children: selectedInvoice.customer?.identification_number })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Almac\u00E9n" }), _jsx("div", { className: "mt-1 text-sm text-gray-900", children: selectedInvoice.warehouse?.name || 'No especificado' })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500 mb-2", children: "Productos" }), drawerLoading ? (_jsx("div", { className: "flex justify-center py-4", children: _jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" }) })) : (_jsx("div", { className: "border rounded-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Prod" }), _jsx("th", { className: "px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase", children: "Cant" }), _jsx("th", { className: "px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase", children: "Total" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: invoiceItems.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 text-sm text-gray-900", children: _jsx("div", { className: "truncate w-32", children: item.product?.name }) }), _jsx("td", { className: "px-3 py-2 text-sm text-gray-500 text-right", children: item.quantity }), _jsx("td", { className: "px-3 py-2 text-sm text-gray-900 text-right font-medium", children: formatCurrency(item.total_price) })] }, item.id))) }), _jsx("tfoot", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 2, className: "px-3 py-2 text-sm font-medium text-gray-900 text-right", children: "Total:" }), _jsx("td", { className: "px-3 py-2 text-sm font-bold text-gray-900 text-right", children: formatCurrency(selectedInvoice.total_amount) })] }) })] }) }))] }), selectedInvoice.notes && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: "Notas" }), _jsx("div", { className: "mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md", children: selectedInvoice.notes })] }))] }) })] }), _jsx("div", { className: "flex-shrink-0 px-4 py-4 flex justify-end space-x-2 bg-gray-50 border-t", children: _jsx(Link, { to: `/ventas/facturas/${selectedInvoice.id}`, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium", children: "Ver Detalle Completo" }) })] }) })] }) }))] }));
};
export default Invoices;
