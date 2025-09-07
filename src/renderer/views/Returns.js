import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
const Returns = () => {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [returnsPerPage] = useState(10);
    useEffect(() => {
        fetchReturns();
    }, []);
    const fetchReturns = async () => {
        try {
            setLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client.from('returns')
                .select(`
          *,
          invoice:invoices(id, invoice_number, customer_id, customer:customers(id, name, identification_number))
        `)
                .order('return_date', { ascending: false });
            if (error)
                throw error;
            setReturns(data || []);
        }
        catch (error) {
            console.error('Error al cargar devoluciones:', error.message);
            toast.error(`Error al cargar devoluciones: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    // Filtrar devoluciones basadas en el término de búsqueda y filtro de estado
    const filteredReturns = returns.filter(ret => {
        const matchesSearch = (ret.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ret.invoice?.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ret.invoice?.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ret.reason?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || ret.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    // Calcular la paginación
    const indexOfLastReturn = currentPage * returnsPerPage;
    const indexOfFirstReturn = indexOfLastReturn - returnsPerPage;
    const currentReturns = filteredReturns.slice(indexOfFirstReturn, indexOfLastReturn);
    const totalPages = Math.ceil(filteredReturns.length / returnsPerPage);
    const handleUpdateReturnStatus = async (id, newStatus) => {
        if (!confirm(`¿Está seguro que desea cambiar el estado de esta devolución a "${newStatus}"?`)) {
            return;
        }
        try {
            const client = await supabase.getClient();
            const { error } = await client.from('returns')
                .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error)
                throw error;
            toast.success(`Estado de devolución actualizado a ${newStatus}`);
            fetchReturns();
        }
        catch (error) {
            console.error('Error al actualizar estado de devolución:', error.message);
            toast.error(`Error al actualizar estado: ${error.message}`);
        }
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
            'pendiente': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock', text: 'Pendiente' },
            'procesada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Procesada' },
            'rechazada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Rechazada' }
        };
        const config = statusConfig[status] || statusConfig.pendiente;
        return (_jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`, children: [_jsx("i", { className: `fas ${config.icon} mr-1` }), config.text] }));
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Ventas"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Devoluciones" })] }), _jsxs(Link, { to: "/ventas/devoluciones/nueva", className: "mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), " Nueva Devoluci\u00F3n"] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsx("div", { className: "p-4 border-b", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [_jsx("h2", { className: "text-lg font-medium", children: "Lista de Devoluciones" }), _jsxs("div", { className: "flex flex-col md:flex-row gap-3", children: [_jsxs("div", { className: "relative", children: [_jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "pl-10 pr-4 py-2 border rounded-md w-full", children: [_jsx("option", { value: "all", children: "Todos los estados" }), _jsx("option", { value: "pendiente", children: "Pendiente" }), _jsx("option", { value: "procesada", children: "Procesada" }), _jsx("option", { value: "rechazada", children: "Rechazada" })] }), _jsx("i", { className: "fas fa-filter absolute left-3 top-3 text-gray-400" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Buscar devoluci\u00F3n...", className: "pl-10 pr-4 py-2 border rounded-md w-full", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) }), _jsx("i", { className: "fas fa-search absolute left-3 top-3 text-gray-400" })] })] })] }) }), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : currentReturns.length === 0 ? (_jsxs("div", { className: "p-8 text-center", children: [_jsx("i", { className: "fas fa-exchange-alt text-gray-300 text-5xl mb-4" }), _jsx("p", { className: "text-gray-500", children: searchTerm || statusFilter !== 'all'
                                    ? 'No se encontraron devoluciones que coincidan con la búsqueda.'
                                    : 'No hay devoluciones registradas. ¡Registra tu primera devolución!' })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Factura/Cliente" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Fecha" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Motivo" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Monto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Estado" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentReturns.map((ret) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { className: "font-medium text-gray-900", children: ["Factura: ", ret.invoice?.invoice_number] }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Cliente: ", ret.invoice?.customer?.name] })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-900", children: formatDate(ret.return_date) }) }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "text-sm text-gray-900 max-w-xs truncate", children: ret.reason }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium text-gray-900", children: formatCurrency(ret.total_amount) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: renderStatusBadge(ret.status) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx(Link, { to: `/ventas/devoluciones/${ret.id}`, className: "text-blue-600 hover:text-blue-900", title: "Ver detalle", children: _jsx("i", { className: "fas fa-eye" }) }), ret.status === 'pendiente' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleUpdateReturnStatus(ret.id, 'procesada'), className: "text-green-600 hover:text-green-900", title: "Aprobar", children: _jsx("i", { className: "fas fa-check" }) }), _jsx("button", { onClick: () => handleUpdateReturnStatus(ret.id, 'rechazada'), className: "text-red-600 hover:text-red-900", title: "Rechazar", children: _jsx("i", { className: "fas fa-times" }) })] })), _jsx(Link, { to: `/ventas/devoluciones/imprimir/${ret.id}`, className: "text-green-600 hover:text-green-900", title: "Imprimir", children: _jsx("i", { className: "fas fa-print" }) })] }) })] }, ret.id))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between border-t", children: [_jsx("div", { className: "hidden sm:block", children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Mostrando ", _jsx("span", { className: "font-medium", children: indexOfFirstReturn + 1 }), " a", ' ', _jsx("span", { className: "font-medium", children: Math.min(indexOfLastReturn, filteredReturns.length) }), ' ', "de ", _jsx("span", { className: "font-medium", children: filteredReturns.length }), " devoluciones"] }) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(prev - 1, 1)), disabled: currentPage === 1, className: `px-3 py-1 rounded-md ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(prev + 1, totalPages)), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md ${currentPage === totalPages
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] })] }));
};
export default Returns;
