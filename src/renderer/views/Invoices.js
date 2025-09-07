import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import useCompanySettings from '../hooks/useCompanySettings';
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
    useEffect(() => {
        fetchInvoices();
    }, []);
    useEffect(() => {
        if (selectedInvoice) {
            fetchInvoiceItems(selectedInvoice.id);
        }
    }, [selectedInvoice]);
    useEffect(() => {
        // Detectar facturas próximas a vencer (en los próximos 7 días)
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
            const { data, error } = await supabase
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, identification_number),
          warehouse:warehouses(id, name)
        `)
                .order('invoice_date', { ascending: false });
            if (error)
                throw error;
            // Actualizar el estado de facturas vencidas
            const today = new Date();
            const updatedInvoices = (data || []).map(invoice => {
                if (invoice.status === 'emitida' && invoice.due_date) {
                    const dueDate = new Date(invoice.due_date);
                    if (dueDate < today) {
                        return { ...invoice, status: 'vencida' };
                    }
                }
                return invoice;
            });
            // Actualizar facturas vencidas en la base de datos
            const overdueInvoices = updatedInvoices.filter(invoice => invoice.status === 'vencida' && data?.find(i => i.id === invoice.id)?.status !== 'vencida');
            if (overdueInvoices.length > 0) {
                for (const invoice of overdueInvoices) {
                    await supabase
                        .from('invoices')
                        .update({
                        status: 'vencida',
                        updated_at: new Date().toISOString()
                    })
                        .eq('id', invoice.id);
                }
                if (overdueInvoices.length === 1) {
                    toast.error(`La factura ${overdueInvoices[0].invoice_number} ha vencido`);
                }
                else {
                    toast.error(`${overdueInvoices.length} facturas han vencido`);
                }
            }
            setInvoices(updatedInvoices);
        }
        catch (error) {
            console.error('Error al cargar facturas:', error.message);
            toast.error(`Error al cargar facturas: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchInvoiceItems = async (invoiceId) => {
        try {
            setDrawerLoading(true);
            const { data, error } = await supabase
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
            console.error('Error al cargar items de factura:', error.message);
            toast.error(`Error al cargar detalles: ${error.message}`);
        }
        finally {
            setDrawerLoading(false);
        }
    };
    const handleInvoiceRowClick = (invoice) => {
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
        if (!confirm('¿Está seguro que desea anular esta factura? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            // En vez de eliminar, anulamos la factura
            const { error } = await supabase
                .from('invoices')
                .update({
                status: 'anulada',
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error)
                throw error;
            toast.success('Factura anulada correctamente');
            fetchInvoices();
        }
        catch (error) {
            console.error('Error al anular factura:', error.message);
            toast.error(`Error al anular factura: ${error.message}`);
        }
    };
    // Calcular los días restantes hasta la fecha de vencimiento
    const getDaysRemaining = (dueDate) => {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    // Formatear moneda
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };
    // Formatear fecha
    const formatDate = (dateString) => {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date(dateString).toLocaleDateString('es-CO', options);
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
    // Filtro rápido para mostrar solo facturas próximas a vencer
    const filterUpcomingDue = () => {
        setStatusFilter('emitida');
        const upcomingIds = upcomingDueInvoices.map(invoice => invoice.invoice_number);
        setSearchTerm(upcomingIds.length > 0 ? upcomingIds[0] ?? '' : '');
    };
    return (_jsxs("div", { className: "space-y-6 relative", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Ventas"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Gesti\u00F3n de Facturas" })] }), _jsxs(Link, { to: "/ventas/facturas/nueva", className: "mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), " Nueva Factura"] })] }), upcomingDueInvoices.length > 0 && showUpcomingAlert && (_jsxs("div", { className: "bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("i", { className: "fas fa-exclamation-triangle text-amber-500 mr-3 text-lg" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-amber-800", children: "Facturas pr\u00F3ximas a vencer" }), _jsx("p", { className: "text-amber-700", children: upcomingDueInvoices.length === 1
                                            ? `Hay 1 factura que vencerá en los próximos 7 días`
                                            : `Hay ${upcomingDueInvoices.length} facturas que vencerán en los próximos 7 días` })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: filterUpcomingDue, className: "px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-sm", children: "Ver facturas" }), _jsx("button", { onClick: () => setShowUpcomingAlert(false), className: "text-amber-500 hover:text-amber-700", children: _jsx("i", { className: "fas fa-times" }) })] })] })), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsx("div", { className: "p-4 border-b", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Lista de Facturas" }), _jsxs("div", { className: "flex flex-col md:flex-row gap-3", children: [_jsxs("div", { className: "relative", children: [_jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "pl-10 pr-4 py-2 border rounded-md w-full", children: [_jsx("option", { value: "all", children: "Todos los estados" }), _jsx("option", { value: "borrador", children: "Borrador" }), _jsx("option", { value: "emitida", children: "Emitida" }), _jsx("option", { value: "pagada", children: "Pagada" }), _jsx("option", { value: "vencida", children: "Vencida" }), _jsx("option", { value: "anulada", children: "Anulada" })] }), _jsx("i", { className: "fas fa-filter absolute left-3 top-3 text-gray-400" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Buscar factura...", className: "pl-10 pr-4 py-2 border rounded-md w-full", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) }), _jsx("i", { className: "fas fa-search absolute left-3 top-3 text-gray-400" })] })] })] }) }), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : currentInvoices.length === 0 ? (_jsxs("div", { className: "p-8 text-center", children: [_jsx("i", { className: "fas fa-file-invoice text-gray-300 text-5xl mb-4" }), _jsx("p", { className: "text-gray-500", children: searchTerm || statusFilter !== 'all'
                                    ? 'No se encontraron facturas que coincidan con la búsqueda.'
                                    : 'No hay facturas registradas. ¡Registra tu primera factura!' })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Factura" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cliente" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Fecha" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Estado" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentInvoices.map((invoice) => {
                                                // Calcular días restantes para facturas emitidas
                                                const daysRemaining = invoice.due_date && invoice.status === 'emitida'
                                                    ? getDaysRemaining(invoice.due_date)
                                                    : null;
                                                // Determinar si esta factura está próxima a vencer (menos de 7 días)
                                                const isUpcomingDue = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
                                                return (_jsxs("tr", { className: `hover:bg-gray-50 ${isUpcomingDue ? 'bg-amber-50' : ''} cursor-pointer`, onClick: () => handleInvoiceRowClick(invoice), children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium text-gray-900", children: invoice.invoice_number }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Almac\u00E9n: ", invoice.warehouse?.name] })] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium text-gray-900", children: invoice.customer?.name }), invoice.customer?.identification_number && (_jsxs("div", { className: "text-sm text-gray-500", children: ["ID: ", invoice.customer.identification_number] }))] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "text-sm text-gray-900", children: formatDate(invoice.invoice_date) }), invoice.due_date && (_jsxs("div", { className: `text-sm ${isUpcomingDue ? 'text-amber-600 font-medium' : 'text-gray-500'}`, children: ["Vence: ", formatDate(invoice.due_date), isUpcomingDue && (_jsx("span", { className: "ml-1 text-xs font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded", children: daysRemaining === 1 ? '¡Mañana!' : `${daysRemaining} días` }))] }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium text-gray-900", children: formatCurrency(invoice.total_amount) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: renderStatusBadge(invoice.status) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx(Link, { to: `/ventas/facturas/${invoice.id}`, className: "text-blue-600 hover:text-blue-900", title: "Ver detalle", children: _jsx("i", { className: "fas fa-eye" }) }), invoice.status === 'borrador' && (_jsx(Link, { to: `/ventas/facturas/editar/${invoice.id}`, className: "text-yellow-600 hover:text-yellow-900", title: "Editar", children: _jsx("i", { className: "fas fa-edit" }) })), invoice.status !== 'anulada' && (_jsx("button", { onClick: (e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteInvoice(invoice.id);
                                                                        }, className: "text-red-600 hover:text-red-900", title: "Anular", children: _jsx("i", { className: "fas fa-ban" }) })), _jsx(Link, { to: `/ventas/facturas/${invoice.id}`, className: "text-green-600 hover:text-green-900", title: "Imprimir", children: _jsx("i", { className: "fas fa-print" }) })] }) })] }, invoice.id));
                                            }) })] }) }), totalPages > 1 && (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between border-t", children: [_jsx("div", { className: "hidden sm:block", children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Mostrando ", _jsx("span", { className: "font-medium", children: indexOfFirstInvoice + 1 }), " a", ' ', _jsx("span", { className: "font-medium", children: Math.min(indexOfLastInvoice, filteredInvoices.length) }), ' ', "de ", _jsx("span", { className: "font-medium", children: filteredInvoices.length }), " facturas"] }) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(prev - 1, 1)), disabled: currentPage === 1, className: `px-3 py-1 rounded-md ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(prev + 1, totalPages)), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md ${currentPage === totalPages
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] }), _jsxs("div", { className: `fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-50 flex flex-col`, children: [_jsxs("div", { className: "p-4 border-b border-gray-200 flex justify-between items-center", children: [_jsx("h2", { className: "text-lg font-medium", children: "Vista Previa de Factura" }), _jsx("button", { onClick: closeDrawer, className: "text-gray-500 hover:text-gray-700", children: _jsx("i", { className: "fas fa-times" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: drawerLoading ? (_jsx("div", { className: "flex justify-center items-center h-full", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : selectedInvoice ? (_jsxs("div", { className: "space-y-6 print:p-0 print:shadow-none", children: [_jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm border", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center", children: [_jsx("div", { children: settings.logoUrl ? (_jsx("img", { src: settings.logoUrl, alt: settings.name || "Logo", className: "h-16 object-contain mb-4 md:mb-0" })) : (_jsx("h1", { className: "text-xl font-bold text-gray-800 mb-2", children: settings.name || "Empresa" })) }), _jsxs("div", { className: "bg-blue-50 p-4 rounded-md text-right", children: [_jsx("h2", { className: "text-lg font-bold text-blue-800 mb-1", children: "FACTURA" }), _jsxs("p", { className: "text-md font-semibold text-blue-700", children: ["# ", selectedInvoice.invoice_number] }), _jsx("div", { className: `mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedInvoice.status)}`, children: getStatusText(selectedInvoice.status) })] })] }), _jsx("hr", { className: "my-6" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-gray-500 font-medium mb-2", children: "Cliente" }), _jsx("p", { className: "font-semibold", children: selectedInvoice.customer?.name }), _jsxs("p", { children: [selectedInvoice.customer?.identification_type, ": ", selectedInvoice.customer?.identification_number] }), _jsx("p", { children: selectedInvoice.customer?.address }), _jsxs("p", { children: [selectedInvoice.customer?.phone, " | ", selectedInvoice.customer?.email] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-gray-500 font-medium mb-2", children: "Informaci\u00F3n de la Factura" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("p", { className: "text-gray-600", children: "Fecha de Emisi\u00F3n:" }), _jsx("p", { className: "font-medium", children: formatDate(selectedInvoice.invoice_date) }), selectedInvoice.due_date && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-gray-600", children: "Fecha de Vencimiento:" }), _jsx("p", { className: "font-medium", children: formatDate(selectedInvoice.due_date) })] })), _jsx("p", { className: "text-gray-600", children: "Almac\u00E9n:" }), _jsx("p", { className: "font-medium", children: selectedInvoice.warehouse?.name }), selectedInvoice.payment_method && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-gray-600", children: "M\u00E9todo de Pago:" }), _jsx("p", { className: "font-medium", children: selectedInvoice.payment_method })] }))] })] })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm border overflow-hidden", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h3", { className: "font-medium", children: "Detalle de Productos" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Producto" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Cantidad" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Precio Unit." }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Impuesto" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: invoiceItems.map((item) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("div", { className: "font-medium", children: item.product?.name }), _jsxs("div", { className: "text-sm text-gray-500", children: ["SKU: ", item.product?.sku] })] }), _jsx("td", { className: "px-4 py-3 text-right", children: item.quantity }), _jsx("td", { className: "px-4 py-3 text-right", children: formatCurrency(item.unit_price) }), _jsx("td", { className: "px-4 py-3 text-right", children: formatCurrency(item.tax_amount) }), _jsx("td", { className: "px-4 py-3 text-right font-medium", children: formatCurrency(item.total_price) })] }, item.id))) })] }) })] }), _jsx("div", { className: "bg-white p-6 rounded-lg shadow-sm border", children: _jsx("div", { className: "flex justify-end", children: _jsxs("div", { className: "w-full md:w-64", children: [_jsxs("div", { className: "flex justify-between py-2", children: [_jsx("span", { className: "text-gray-600", children: "Subtotal:" }), _jsx("span", { children: formatCurrency(selectedInvoice.subtotal ?? 0) })] }), (selectedInvoice.discount_amount ?? 0) > 0 && (_jsxs("div", { className: "flex justify-between py-2", children: [_jsx("span", { className: "text-gray-600", children: "Descuento:" }), _jsxs("span", { children: ["-", formatCurrency(selectedInvoice.discount_amount ?? 0)] })] })), _jsxs("div", { className: "flex justify-between py-2", children: [_jsx("span", { className: "text-gray-600", children: "Impuestos:" }), _jsx("span", { children: formatCurrency(selectedInvoice.tax_amount ?? 0) })] }), _jsxs("div", { className: "flex justify-between py-2 font-bold text-lg border-t border-gray-200 mt-2 pt-2", children: [_jsx("span", { children: "Total:" }), _jsx("span", { children: formatCurrency(selectedInvoice.total_amount) })] })] }) }) }), selectedInvoice.notes && (_jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm border", children: [_jsx("h3", { className: "font-medium mb-2", children: "Notas" }), _jsx("p", { className: "text-gray-700", children: selectedInvoice.notes })] })), _jsxs("div", { className: "text-center text-gray-500 text-sm mt-8", children: [_jsxs("p", { children: [settings.name ? `${settings.name} - ` : '', settings.taxId ? `NIT: ${settings.taxId}` : ''] }), _jsx("p", { children: settings.address }), _jsxs("p", { children: [settings.phone && `Tel: ${settings.phone}`, settings.email && settings.phone && ' | ', settings.email && `Email: ${settings.email}`] }), settings.footerText && _jsx("p", { className: "mt-2", children: settings.footerText })] })] })) : (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-gray-500", children: [_jsx("i", { className: "fas fa-file-invoice text-6xl mb-4" }), _jsx("p", { children: "Seleccione una factura para ver su detalle" })] })) }), _jsx("div", { className: "p-4 border-t border-gray-200", children: _jsxs("div", { className: "flex justify-between", children: [_jsxs(Link, { to: selectedInvoice ? `/ventas/facturas/${selectedInvoice.id}` : '#', className: `px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${!selectedInvoice ? 'opacity-50 cursor-not-allowed' : ''}`, onClick: (e) => !selectedInvoice && e.preventDefault(), children: [_jsx("i", { className: "fas fa-external-link-alt mr-2" }), " Ver Completo"] }), _jsx("button", { onClick: closeDrawer, className: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors", children: "Cerrar" })] }) })] }), isDrawerOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-40", onClick: closeDrawer }))] }));
};
export default Invoices;
