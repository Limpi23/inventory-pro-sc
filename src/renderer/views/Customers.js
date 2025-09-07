import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [customersPerPage] = useState(10);
    useEffect(() => {
        fetchCustomers();
    }, []);
    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name');
            if (error)
                throw error;
            setCustomers(data || []);
        }
        catch (error) {
            console.error('Error al cargar clientes:', error.message);
            toast.error(`Error al cargar clientes: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    // Filtrar clientes basados en el término de búsqueda
    const filteredCustomers = customers.filter(customer => customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.identification_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()));
    // Calcular la paginación
    const indexOfLastCustomer = currentPage * customersPerPage;
    const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
    const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
    const totalPages = Math.ceil(filteredCustomers.length / customersPerPage);
    const handleDeleteCustomer = async (id) => {
        if (!confirm('¿Está seguro que desea eliminar este cliente? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            // Primero verificamos si el cliente tiene facturas asociadas
            const { data: invoices, error: invoicesError } = await supabase
                .from('invoices')
                .select('id')
                .eq('customer_id', id)
                .limit(1);
            if (invoicesError)
                throw invoicesError;
            if (invoices && invoices.length > 0) {
                toast.error('No se puede eliminar el cliente porque tiene facturas asociadas.');
                return;
            }
            // Si no tiene facturas, procedemos a eliminar
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
            toast.success('Cliente eliminado correctamente');
            fetchCustomers();
        }
        catch (error) {
            console.error('Error al eliminar cliente:', error.message);
            toast.error(`Error al eliminar cliente: ${error.message}`);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Ventas"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Gesti\u00F3n de Clientes" })] }), _jsxs(Link, { to: "/ventas/clientes/nuevo", className: "mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), " Nuevo Cliente"] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsx("div", { className: "p-4 border-b", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsx("h2", { className: "text-lg font-medium", children: "Lista de Clientes" }), _jsxs("div", { className: "mt-3 md:mt-0 relative", children: [_jsx("input", { type: "text", placeholder: "Buscar cliente...", className: "pl-10 pr-4 py-2 border rounded-md w-full md:w-64", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) }), _jsx("i", { className: "fas fa-search absolute left-3 top-3 text-gray-400" })] })] }) }), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : currentCustomers.length === 0 ? (_jsxs("div", { className: "p-8 text-center", children: [_jsx("i", { className: "fas fa-users text-gray-300 text-5xl mb-4" }), _jsx("p", { className: "text-gray-500", children: searchTerm
                                    ? 'No se encontraron clientes que coincidan con la búsqueda.'
                                    : 'No hay clientes registrados. ¡Agrega tu primer cliente!' })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Nombre" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Identificaci\u00F3n" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Contacto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Direcci\u00F3n" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Estado" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentCustomers.map((customer) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium text-gray-900", children: customer.name }), customer.contact_name && (_jsx("div", { className: "text-sm text-gray-500", children: customer.contact_name }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: customer.identification_type && customer.identification_number && (_jsxs("div", { className: "text-sm text-gray-900", children: [customer.identification_type, ": ", customer.identification_number] })) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [customer.email && (_jsx("div", { className: "text-sm text-gray-900", children: customer.email })), customer.phone && (_jsx("div", { className: "text-sm text-gray-500", children: customer.phone }))] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [customer.address && (_jsx("div", { className: "text-sm text-gray-900", children: customer.address })), customer.city && (_jsxs("div", { className: "text-sm text-gray-500", children: [customer.city, customer.state ? `, ${customer.state}` : ''] }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.is_active
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'}`, children: [_jsx("i", { className: `fas ${customer.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-1` }), customer.is_active ? 'Activo' : 'Inactivo'] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx(Link, { to: `/ventas/clientes/${customer.id}`, className: "text-blue-600 hover:text-blue-900", title: "Ver detalle", children: _jsx("i", { className: "fas fa-eye" }) }), _jsx(Link, { to: `/ventas/clientes/editar/${customer.id}`, className: "text-yellow-600 hover:text-yellow-900", title: "Editar", children: _jsx("i", { className: "fas fa-edit" }) }), _jsx("button", { onClick: () => handleDeleteCustomer(customer.id), className: "text-red-600 hover:text-red-900", title: "Eliminar", children: _jsx("i", { className: "fas fa-trash-alt" }) })] }) })] }, customer.id))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "px-4 py-3 flex items-center justify-between border-t", children: [_jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Mostrando ", _jsx("span", { className: "font-medium", children: indexOfFirstCustomer + 1 }), " a", ' ', _jsx("span", { className: "font-medium", children: Math.min(indexOfLastCustomer, filteredCustomers.length) }), ' ', "de ", _jsx("span", { className: "font-medium", children: filteredCustomers.length }), " clientes"] }) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(prev - 1, 1)), disabled: currentPage === 1, className: `px-3 py-1 rounded-md ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(prev + 1, totalPages)), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md ${currentPage === totalPages
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] })] }));
};
export default Customers;
