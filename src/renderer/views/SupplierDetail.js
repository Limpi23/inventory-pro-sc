import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
const SupplierDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [supplier, setSupplier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const load = async () => {
            try {
                if (!id) {
                    setError('Proveedor no encontrado');
                    return;
                }
                const client = await supabase.getClient();
                const { data, error } = await client
                    .from('suppliers')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (error)
                    throw error;
                setSupplier(data);
            }
            catch (e) {
                setError(e.message || 'Error cargando proveedor');
            }
            finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);
    const contact = supplier?.contact_info || {};
    if (loading) {
        return (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    if (error) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Link, { to: "/proveedores", className: "text-blue-600 hover:text-blue-800 inline-flex items-center", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Proveedores"] }), _jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md", children: error })] }));
    }
    if (!supplier) {
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Link, { to: "/proveedores", className: "text-blue-600 hover:text-blue-800 inline-flex items-center", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Proveedores"] }), _jsx("div", { className: "text-gray-600", children: "Proveedor no encontrado" })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/proveedores", className: "text-blue-600 hover:text-blue-800 inline-flex items-center", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Proveedores"] }), _jsx("h1", { className: "text-2xl font-semibold mt-2", children: supplier.name })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Link, { to: `/proveedores/${supplier.id}/compras`, className: "px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700", children: [_jsx("i", { className: "fas fa-shopping-cart mr-1" }), " Compras"] }), _jsxs("button", { onClick: () => navigate(`/ordenes-compra/nueva?supplier=${supplier.id}`), className: "px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700", children: [_jsx("i", { className: "fas fa-plus mr-1" }), " Nueva Orden de Compra"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Contacto" }), _jsxs("div", { className: "space-y-2 text-sm", children: [contact.contact_person && (_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Contacto: " }), contact.contact_person] })), contact.email && (_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Email: " }), _jsx("a", { href: `mailto:${contact.email}`, className: "text-blue-600 hover:underline", children: contact.email })] })), contact.phone && (_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Tel\u00E9fono: " }), contact.phone] }))] })] }), _jsxs("div", { className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Direcci\u00F3n" }), _jsxs("div", { className: "space-y-2 text-sm", children: [contact.address && (_jsx("div", { children: contact.address })), _jsx("div", { className: "text-gray-500", children: [contact.city, contact.state, contact.zip].filter(Boolean).join(', ') }), contact.country && (_jsx("div", { className: "text-gray-500", children: contact.country }))] })] })] }), contact.notes && (_jsxs("div", { className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow", children: [_jsx("h2", { className: "text-lg font-medium mb-2", children: "Notas" }), _jsx("p", { className: "text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line", children: contact.notes })] }))] }));
};
export default SupplierDetail;
