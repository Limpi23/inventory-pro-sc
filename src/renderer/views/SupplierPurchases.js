import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useParams, Link } from 'react-router-dom';
const SupplierPurchases = () => {
    const { id } = useParams();
    const [supplier, setSupplier] = useState(null);
    const [purchases, setPurchases] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [purchaseItems, setPurchaseItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Primer día del año actual
        end: new Date().toISOString().split('T')[0] // Hoy
    });
    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    useEffect(() => {
        if (id) {
            fetchSupplier();
            fetchPurchases();
        }
    }, [id, dateRange]);
    useEffect(() => {
        if (selectedPurchase) {
            fetchPurchaseItems(selectedPurchase);
        }
    }, [selectedPurchase]);
    const fetchSupplier = async () => {
        try {
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
        catch (err) {
            console.error('Error cargando proveedor:', err);
            setError(err.message);
        }
    };
    const fetchPurchases = async () => {
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('purchase_orders')
                .select(`
          *,
          warehouse:warehouses(name),
          items:purchase_order_items(count)
        `)
                .eq('supplier_id', id)
                .gte('order_date', dateRange.start)
                .lte('order_date', dateRange.end)
                .order('order_date', { ascending: false });
            if (error)
                throw error;
            const formattedPurchases = (data || []).map((p) => ({
                id: p.id,
                order_date: p.order_date,
                status: p.status,
                total_amount: p.total_amount || 0,
                created_at: p.created_at,
                items_count: p.items?.length || 0,
                warehouse_name: p.warehouse?.name || 'Desconocido'
            }));
            setPurchases(formattedPurchases);
            setIsLoading(false);
            // Si hay compras y no hay ninguna seleccionada, seleccionar la primera
            if (formattedPurchases.length > 0 && !selectedPurchase) {
                setSelectedPurchase(formattedPurchases[0].id);
            }
            else if (formattedPurchases.length === 0) {
                setSelectedPurchase(null);
                setPurchaseItems([]);
            }
        }
        catch (err) {
            console.error('Error cargando compras:', err);
            setError(err.message);
            setIsLoading(false);
        }
    };
    const fetchPurchaseItems = async (purchaseId) => {
        try {
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('purchase_order_items')
                .select(`
          *,
          product:products(name, sku)
        `)
                .eq('purchase_order_id', purchaseId);
            if (error)
                throw error;
            const formattedItems = (data || []).map((item) => ({
                id: item.id,
                product_name: item.product?.name || 'Producto desconocido',
                product_sku: item.product?.sku || '-',
                quantity: item.quantity,
                unit_price: item.unit_price || 0,
                total_price: item.total_price || 0
            }));
            setPurchaseItems(formattedItems);
        }
        catch (err) {
            console.error('Error cargando items de compra:', err);
            setError(err.message);
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
    // Calcular paginación
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPurchases = purchases.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(purchases.length / itemsPerPage);
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
        switch (status.toLowerCase()) {
            case 'completed':
            case 'completado':
                colorClass = 'bg-green-100 text-green-800';
                break;
            case 'pending':
            case 'pendiente':
                colorClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 'cancelled':
            case 'cancelado':
                colorClass = 'bg-red-100 text-red-800';
                break;
            default:
                colorClass = 'bg-gray-100 text-gray-800';
        }
        return (_jsx("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`, children: status }));
    };
    const contactInfo = supplier?.contact_info || {};
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsxs("div", { children: [_jsxs(Link, { to: "/proveedores", className: "inline-flex items-center text-blue-600 hover:text-blue-800 mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Proveedores"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Historial de Compras" }), supplier && (_jsxs("div", { className: "mt-1 text-gray-500", children: ["Proveedor: ", _jsx("span", { className: "font-medium text-gray-700", children: supplier.name }), contactInfo.contact_person && (_jsxs("span", { className: "ml-2", children: ["\u2022 Contacto: ", contactInfo.contact_person] })), contactInfo.phone && (_jsxs("span", { className: "ml-2", children: ["\u2022 Tel: ", contactInfo.phone] }))] }))] }) }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsxs("div", { className: "mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "start", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Inicial" }), _jsx("input", { type: "date", id: "start", name: "start", value: dateRange.start, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "end", className: "block text-sm font-medium text-gray-700 mb-1", children: "Fecha Final" }), _jsx("input", { type: "date", id: "end", name: "end", value: dateRange.end, onChange: handleDateChange, className: "w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsx("div", { className: "flex items-end", children: _jsxs(Link, { to: `/ordenes-compra/nueva?supplier=${id}`, className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Orden de Compra"] }) })] }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-5 gap-8", children: [_jsxs("div", { className: "lg:col-span-2 overflow-x-auto", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "\u00D3rdenes de Compra" }), purchases.length === 0 ? (_jsxs("div", { className: "bg-gray-50 rounded-md p-8 text-center", children: [_jsx("i", { className: "fas fa-shopping-cart text-gray-300 text-4xl mb-2" }), _jsx("p", { className: "text-gray-500", children: "No hay \u00F3rdenes de compra en el per\u00EDodo seleccionado" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-hidden border border-gray-200 rounded-md", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Fecha" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Estado" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Total" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentPurchases.map((purchase) => (_jsxs("tr", { className: `hover:bg-gray-50 transition-colors cursor-pointer ${selectedPurchase === purchase.id ? 'bg-blue-50' : ''}`, onClick: () => setSelectedPurchase(purchase.id), children: [_jsxs("td", { className: "py-3 px-4 text-sm", children: [_jsx("div", { className: "font-medium", children: new Date(purchase.order_date).toLocaleDateString() }), _jsx("div", { className: "text-xs text-gray-500", children: purchase.warehouse_name })] }), _jsx("td", { className: "py-3 px-4 text-sm", children: getStatusBadge(purchase.status) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: formatCurrency(purchase.total_amount) })] }, purchase.id))) })] }) }), purchases.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, purchases.length), " de ", purchases.length, " \u00F3rdenes"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("button", { onClick: () => paginate(currentPage - 1), disabled: currentPage === 1, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
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
                                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] }), _jsxs("div", { className: "lg:col-span-3", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Detalles de la Orden" }), !selectedPurchase ? (_jsxs("div", { className: "bg-gray-50 rounded-md p-8 text-center", children: [_jsx("i", { className: "fas fa-receipt text-gray-300 text-4xl mb-2" }), _jsx("p", { className: "text-gray-500", children: "Seleccione una orden para ver sus detalles" })] })) : purchaseItems.length === 0 ? (_jsxs("div", { className: "bg-gray-50 rounded-md p-8 text-center", children: [_jsx("i", { className: "fas fa-box-open text-gray-300 text-4xl mb-2" }), _jsx("p", { className: "text-gray-500", children: "Esta orden no tiene productos" })] })) : (_jsx("div", { className: "overflow-hidden border border-gray-200 rounded-md", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Precio Unit." }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Total" })] }) }), _jsxs("tbody", { className: "bg-white divide-y divide-gray-200", children: [purchaseItems.map((item) => (_jsxs("tr", { className: "hover:bg-gray-50 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm", children: [_jsx("div", { className: "font-medium", children: item.product_name }), _jsxs("div", { className: "text-xs text-gray-500", children: ["SKU: ", item.product_sku] })] }), _jsx("td", { className: "py-3 px-4 text-sm text-right", children: item.quantity }), _jsx("td", { className: "py-3 px-4 text-sm text-right", children: formatCurrency(item.unit_price) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: formatCurrency(item.total_price) })] }, item.id))), _jsxs("tr", { className: "bg-gray-50", children: [_jsx("td", { colSpan: 3, className: "py-2 px-4 text-sm text-right font-medium", children: "Total:" }), _jsx("td", { className: "py-2 px-4 text-sm text-right font-bold", children: formatCurrency(purchaseItems.reduce((sum, item) => sum + item.total_price, 0)) })] })] })] }) })), selectedPurchase && (_jsx("div", { className: "mt-4 flex justify-end", children: _jsxs(Link, { to: `/ordenes-compra/${selectedPurchase}`, className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center", children: [_jsx("i", { className: "fas fa-eye mr-2" }), "Ver Orden Completa"] }) }))] })] }))] })] }));
};
export default SupplierPurchases;
