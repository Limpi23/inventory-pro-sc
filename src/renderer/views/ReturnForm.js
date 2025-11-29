import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLocalDateISOString } from '../lib/dateUtils';
import { toast } from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';
const ReturnForm = () => {
    const navigate = useNavigate();
    const currency = useCurrency();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [returnItems, setReturnItems] = useState([]);
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    useEffect(() => {
        fetchInvoices();
    }, []);
    useEffect(() => {
        if (selectedInvoice) {
            fetchInvoiceItems(selectedInvoice.id);
        }
        else {
            setInvoiceItems([]);
            setReturnItems([]);
        }
    }, [selectedInvoice]);
    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client.from('invoices')
                .select(`
          *,
          customer:customers(id, name, identification_number),
          warehouse:warehouses(id, name)
        `)
                .in('status', ['emitida', 'pagada'])
                .order('invoice_date', { ascending: false });
            if (error)
                throw error;
            setInvoices(data || []);
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
            setLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client.from('invoice_items')
                .select(`
          *,
          product:products(id, name, sku)
        `)
                .eq('invoice_id', invoiceId);
            if (error)
                throw error;
            setInvoiceItems(data || []);
        }
        catch (error) {
            console.error('Error al cargar items de factura:', error.message);
            toast.error(`Error al cargar items de factura: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const handleInvoiceSelect = (invoice) => {
        setSelectedInvoice(invoice);
        setSearchTerm('');
    };
    const handleQuantityChange = (itemId, productId, value) => {
        const quantity = parseFloat(value);
        const invoiceItem = invoiceItems.find(item => item.id === itemId);
        if (!invoiceItem)
            return;
        if (isNaN(quantity) || quantity <= 0) {
            setReturnItems(prevItems => prevItems.filter(item => item.invoice_item_id !== itemId));
            return;
        }
        if (quantity > invoiceItem.quantity) {
            toast.error(`No puede devolver más de ${invoiceItem.quantity} unidades`);
            return;
        }
        const existingItemIndex = returnItems.findIndex(item => item.invoice_item_id === itemId);
        if (existingItemIndex >= 0) {
            const updatedItems = [...returnItems];
            updatedItems[existingItemIndex].quantity = quantity;
            setReturnItems(updatedItems);
        }
        else {
            setReturnItems([
                ...returnItems,
                {
                    invoice_item_id: itemId,
                    product_id: productId,
                    quantity: quantity,
                    reason: ''
                }
            ]);
        }
    };
    const handleItemReasonChange = (itemId, value) => {
        const existingItemIndex = returnItems.findIndex(item => item.invoice_item_id === itemId);
        if (existingItemIndex >= 0) {
            const updatedItems = [...returnItems];
            updatedItems[existingItemIndex].reason = value;
            setReturnItems(updatedItems);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedInvoice) {
            toast.error('Debe seleccionar una factura');
            return;
        }
        if (returnItems.length === 0) {
            toast.error('Debe seleccionar al menos un producto para devolver');
            return;
        }
        if (!reason.trim()) {
            toast.error('Debe ingresar el motivo general de la devolución');
            return;
        }
        try {
            setSubmitting(true);
            // Calcular el monto total de la devolución
            const totalAmount = returnItems.reduce((sum, item) => {
                const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
                return sum + (invoiceItem ? (invoiceItem.unit_price ?? 0) * item.quantity : 0);
            }, 0);
            // Crear la devolución
            const returnData = {
                invoice_id: selectedInvoice.id,
                return_date: getLocalDateISOString(),
                reason: reason,
                notes: notes || undefined,
                items: returnItems
            };
            // Insertar la devolución en la base de datos
            const client = await supabase.getClient();
            const { data: returnRecord, error: returnError } = await client.from('returns')
                .insert([{
                    invoice_id: returnData.invoice_id,
                    return_date: returnData.return_date,
                    reason: returnData.reason,
                    notes: returnData.notes,
                    total_amount: totalAmount,
                    status: 'pendiente'
                }])
                .select('id')
                .single();
            if (returnError)
                throw returnError;
            if (!returnRecord?.id) {
                throw new Error('No se pudo crear la devolución');
            }
            // Insertar los items de la devolución
            const returnItemsData = returnItems.map(item => {
                const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
                return {
                    return_id: returnRecord.id,
                    invoice_item_id: item.invoice_item_id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: invoiceItem?.unit_price ?? 0,
                    total_price: (invoiceItem?.unit_price ?? 0) * item.quantity,
                    reason: item.reason
                };
            });
            const { error: itemsError } = await client.from('return_items')
                .insert(returnItemsData);
            if (itemsError)
                throw itemsError;
            toast.success('Devolución registrada correctamente');
            navigate('/ventas/devoluciones');
        }
        catch (error) {
            console.error('Error al crear devolución:', error.message);
            toast.error(`Error al crear devolución: ${error.message}`);
        }
        finally {
            setSubmitting(false);
        }
    };
    // Formatear fecha con la configuración de moneda/locale
    const formatDate = (dateString) => {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        return new Date(dateString).toLocaleDateString(currency.settings.locale, options);
    };
    // Calcular el subtotal de la devolución
    const getReturnSubtotal = () => {
        return returnItems.reduce((sum, item) => {
            const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
            return sum + (invoiceItem ? (invoiceItem.unit_price ?? 0) * item.quantity : 0);
        }, 0);
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsxs("div", { children: [_jsxs(Link, { to: "/ventas/devoluciones", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Devoluciones"] }), _jsx("h1", { className: "text-2xl font-semibold", children: "Nueva Devoluci\u00F3n" })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsx("div", { className: "p-6", children: _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Seleccionar Factura" }), !selectedInvoice ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Buscar por n\u00FAmero de factura o cliente...", className: "w-full pl-10 pr-4 py-2 border rounded-md", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) }), _jsx("i", { className: "fas fa-search absolute left-3 top-3 text-gray-400" })] }), loading ? (_jsx("div", { className: "flex justify-center py-4", children: _jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" }) })) : (_jsx("div", { className: "border rounded-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Factura" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cliente" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Fecha" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Acci\u00F3n" })] }) }), _jsxs("tbody", { className: "bg-white divide-y divide-gray-200", children: [invoices
                                                                    .filter(invoice => searchTerm === '' ||
                                                                    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                                    .slice(0, 5)
                                                                    .map((invoice) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: invoice.invoice_number }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: invoice.customer?.name }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: formatDate(invoice.invoice_date) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: currency.format(invoice.total_amount) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { type: "button", onClick: () => handleInvoiceSelect(invoice), className: "px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm", children: "Seleccionar" }) })] }, invoice.id))), invoices.filter(invoice => searchTerm === '' ||
                                                                    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No se encontraron facturas que coincidan con la b\u00FAsqueda" }) }))] })] }) }))] })) : (_jsx("div", { className: "bg-gray-50 p-4 rounded-md", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-medium", children: ["Factura seleccionada: ", selectedInvoice.invoice_number] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Cliente: ", selectedInvoice.customer?.name] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Fecha: ", formatDate(selectedInvoice.invoice_date)] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Total: ", currency.format(selectedInvoice.total_amount)] })] }), _jsx("button", { type: "button", onClick: () => setSelectedInvoice(null), className: "px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm", children: "Cambiar factura" })] }) }))] }), selectedInvoice && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Motivo de la Devoluci\u00F3n" }), _jsx("textarea", { placeholder: "Ingrese el motivo general de la devoluci\u00F3n", className: "w-full px-4 py-2 border rounded-md", rows: 3, value: reason, onChange: (e) => setReason(e.target.value), required: true })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Notas Adicionales (Opcional)" }), _jsx("textarea", { placeholder: "Informaci\u00F3n adicional sobre la devoluci\u00F3n", className: "w-full px-4 py-2 border rounded-md", rows: 2, value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Productos a Devolver" }), loading ? (_jsx("div", { className: "flex justify-center py-4", children: _jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" }) })) : invoiceItems.length === 0 ? (_jsx("div", { className: "text-center py-4 text-gray-500", children: "Esta factura no tiene productos" })) : (_jsx("div", { className: "border rounded-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Precio Unit." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cant. Original" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cant. a Devolver" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Motivo Espec\u00EDfico" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: invoiceItems.map((item) => {
                                                                const returnItem = returnItems.find(ri => ri.invoice_item_id === item.id);
                                                                return (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "font-medium", children: item.product?.name }), _jsx("div", { className: "text-xs text-gray-500", children: item.product?.sku })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: currency.format(item.unit_price ?? 0) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: item.quantity }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("input", { type: "number", min: "0", max: item.quantity, step: "1", className: "w-20 px-2 py-1 border rounded-md", value: returnItem?.quantity || '', onChange: (e) => handleQuantityChange(item.id, item.product_id, e.target.value) }) }), _jsx("td", { className: "px-6 py-4", children: _jsx("input", { type: "text", placeholder: "Motivo espec\u00EDfico (opcional)", className: "w-full px-2 py-1 border rounded-md", value: returnItem?.reason || '', onChange: (e) => handleItemReasonChange(item.id, e.target.value), disabled: !returnItem }) })] }, item.id));
                                                            }) })] }) }))] }), returnItems.length > 0 && (_jsxs("div", { className: "bg-gray-50 p-4 rounded-md", children: [_jsx("h3", { className: "font-medium mb-2", children: "Resumen de la Devoluci\u00F3n" }), _jsx("div", { className: "flex justify-between items-center", children: _jsxs("div", { children: [_jsxs("p", { children: ["Cantidad de productos: ", returnItems.length] }), _jsxs("p", { children: ["Total a devolver: ", currency.format(getReturnSubtotal())] })] }) })] })), _jsxs("div", { className: "flex justify-end space-x-4 mt-6", children: [_jsx(Link, { to: "/ventas/devoluciones", className: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50", children: "Cancelar" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed", disabled: submitting || returnItems.length === 0 || !reason.trim(), children: submitting ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white" }), _jsx("span", { children: "Procesando..." })] })) : (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-save" }), _jsx("span", { children: "Registrar Devoluci\u00F3n" })] })) })] })] }))] }) }) })] }));
};
export default ReturnForm;
