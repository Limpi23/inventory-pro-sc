import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
const ReturnDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [returnData, setReturnData] = useState(null);
    const [returnItems, setReturnItems] = useState([]);
    useEffect(() => {
        if (id) {
            fetchReturnDetails();
        }
    }, [id]);
    const fetchReturnDetails = async () => {
        try {
            setLoading(true);
            // Obtener datos de la devolución
            const { data: returnData, error: returnError } = await supabase
                .from('returns')
                .select(`
          *,
          invoice:invoices(
            id, 
            invoice_number, 
            invoice_date, 
            customer_id, 
            customer:customers(id, name, identification_number, phone, email)
          )
        `)
                .eq('id', id)
                .single();
            if (returnError)
                throw returnError;
            if (!returnData) {
                throw new Error('Devolución no encontrada');
            }
            setReturnData(returnData);
            // Obtener items de la devolución
            const { data: itemsData, error: itemsError } = await supabase
                .from('return_items')
                .select(`
          *,
          product:products(id, name, sku)
        `)
                .eq('return_id', id);
            if (itemsError)
                throw itemsError;
            setReturnItems(itemsData || []);
        }
        catch (error) {
            console.error('Error al cargar detalles de devolución:', error.message);
            toast.error(`Error al cargar detalles: ${error.message}`);
            navigate('/ventas/devoluciones');
        }
        finally {
            setLoading(false);
        }
    };
    const handleUpdateStatus = async (newStatus) => {
        if (!returnData || !id)
            return;
        if (!confirm(`¿Está seguro que desea cambiar el estado de esta devolución a "${newStatus}"?`)) {
            return;
        }
        try {
            setLoading(true);
            const { error } = await supabase
                .from('returns')
                .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error)
                throw error;
            toast.success(`Estado de devolución actualizado a ${newStatus}`);
            fetchReturnDetails();
        }
        catch (error) {
            console.error('Error al actualizar estado de devolución:', error.message);
            toast.error(`Error al actualizar estado: ${error.message}`);
        }
        finally {
            setLoading(false);
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas/devoluciones", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Devoluciones"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Detalle de Devoluci\u00F3n" })] }), returnData && returnData.status === 'pendiente' && (_jsxs("div", { className: "flex space-x-2 mt-4 md:mt-0", children: [_jsxs("button", { onClick: () => handleUpdateStatus('procesada'), className: "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2", disabled: loading, children: [_jsx("i", { className: "fas fa-check" }), _jsx("span", { children: "Aprobar" })] }), _jsxs("button", { onClick: () => handleUpdateStatus('rechazada'), className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-2", disabled: loading, children: [_jsx("i", { className: "fas fa-times" }), _jsx("span", { children: "Rechazar" })] })] }))] }), loading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : !returnData ? (_jsx("div", { className: "bg-white rounded-lg shadow-md p-8 text-center", children: _jsx("p", { className: "text-gray-500", children: "No se encontr\u00F3 la devoluci\u00F3n solicitada." }) })) : (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("div", { className: "p-6 border-b", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Informaci\u00F3n de la Devoluci\u00F3n" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Estado" }), _jsx("p", { className: "mb-3", children: renderStatusBadge(returnData.status) }), _jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Fecha de Devoluci\u00F3n" }), _jsx("p", { className: "mb-3", children: formatDate(returnData.return_date) }), _jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Total Devuelto" }), _jsx("p", { className: "mb-3 font-medium", children: formatCurrency(returnData.total_amount) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Factura Relacionada" }), _jsx("p", { className: "mb-3", children: _jsx(Link, { to: `/ventas/facturas/${returnData.invoice?.id}`, className: "text-blue-600 hover:text-blue-800", children: returnData.invoice?.invoice_number }) }), _jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Fecha de Factura" }), _jsx("p", { className: "mb-3", children: formatDate(returnData.invoice?.invoice_date || '') }), _jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Cliente" }), _jsx("p", { className: "mb-3", children: returnData.invoice?.customer?.name })] })] })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Motivo de la Devoluci\u00F3n" }), _jsx("p", { className: "whitespace-pre-wrap", children: returnData.reason }), returnData.notes && (_jsxs("div", { className: "mt-4", children: [_jsx("h3", { className: "font-medium mb-2", children: "Notas Adicionales" }), _jsx("p", { className: "whitespace-pre-wrap text-gray-700", children: returnData.notes })] }))] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Productos Devueltos" }), returnItems.length === 0 ? (_jsx("p", { className: "text-gray-500", children: "No hay productos en esta devoluci\u00F3n." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Precio Unit." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cantidad" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Subtotal" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Motivo Espec\u00EDfico" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: returnItems.map((item) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium", children: item.product?.name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.product?.sku] })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: formatCurrency(item.unit_price ?? 0) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: item.quantity }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: formatCurrency(item.total_price ?? 0) }), _jsx("td", { className: "px-6 py-4", children: item.reason || _jsx("span", { className: "text-gray-400", children: "Sin especificar" }) })] }, item.id))) }), _jsx("tfoot", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, className: "px-6 py-4 text-right font-medium", children: "Total:" }), _jsx("td", { className: "px-6 py-4 font-bold", children: formatCurrency(returnData.total_amount) }), _jsx("td", {})] }) })] }) }))] }) })] }))] }));
};
export default ReturnDetail;
