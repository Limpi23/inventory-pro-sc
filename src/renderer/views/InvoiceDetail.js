import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../lib/auth';
const InvoiceDetail = () => {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [printFormat, setPrintFormat] = useState('letter');
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const { settings } = useCompanySettings();
    const currency = useCurrency();
    const location = useLocation();
    const { user } = useAuth();
    const roleName = (user?.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || user?.role_id === 1;
    const [isGeneratingSale, setIsGeneratingSale] = useState(false);
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const shouldAutoGenerateSale = searchParams.get('generar-venta') === '1';
    const attemptedAutoSaleRef = useRef(false);
    const letterPrintRef = useRef(null);
    const rollPrintRef = useRef(null);
    const fetchInvoiceDetails = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch invoice with customer and warehouse data
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, identification_type, identification_number, address, phone, email),
          warehouse:warehouses(id, name, location)
        `)
                .eq('id', id)
                .single();
            if (invoiceError)
                throw invoiceError;
            if (invoiceData) {
                setInvoice(invoiceData);
                // Fetch invoice items with product data
                const { data: itemsData, error: itemsError } = await supabase
                    .from('invoice_items')
                    .select(`
            *,
            product:products(name, sku)
          `)
                    .eq('invoice_id', id)
                    .order('id');
                if (itemsError)
                    throw itemsError;
                if (itemsData) {
                    setInvoiceItems(itemsData);
                }
            }
        }
        catch (err) {
            console.error('Error fetching invoice details:', err);
            setError(`Error al cargar los detalles de la cotización: ${err.message}`);
        }
        finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        fetchInvoiceDetails();
    }, [fetchInvoiceDetails]);
    const handleCancelInvoice = async () => {
        if (!isAdmin) {
            toast.error('Solo un administrador puede anular una cotización.');
            return;
        }
        if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                status: 'anulada',
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error)
                throw error;
            // If invoice was previously emitted, reverse stock movements
            if (invoice?.status === 'emitida') {
                // Create reverse stock movements
                const stockMovements = invoiceItems.map(item => ({
                    product_id: item.product_id,
                    warehouse_id: invoice.warehouse.id,
                    quantity: item.quantity,
                    movement_type_id: 3, // Entrada por ajuste (asumimos que es el ID para IN_ADJUST)
                    reference: `Anulación Cotización ${invoice.invoice_number}`,
                    related_id: invoice.id,
                    movement_date: new Date().toISOString(),
                    notes: `Anulación de cotización #${invoice.invoice_number}`
                }));
                const { error: movementError } = await supabase
                    .from('stock_movements')
                    .insert(stockMovements);
                if (movementError) {
                    console.error('Error registrando movimientos de inventario para anulación:', movementError);
                    // No interrumpimos el proceso por errores en los movimientos
                }
            }
            toast.success('Cotización anulada correctamente');
            // Refresh the invoice details
            fetchInvoiceDetails();
        }
        catch (err) {
            console.error('Error anulando cotización:', err);
            toast.error(`Error al anular cotización: ${err.message}`);
        }
    };
    const handleGenerateSale = useCallback(async (options) => {
        if (!invoice) {
            toast.error('No se encontró la cotización a convertir.');
            return;
        }
        if (!isAdmin) {
            toast.error('Solo un administrador puede generar una venta desde la cotización.');
            return;
        }
        if (isGeneratingSale) {
            return;
        }
        if (invoice.status === 'anulada') {
            toast.error('No se puede generar una venta a partir de una cotización anulada.');
            return;
        }
        if (invoice.sales_order_id || invoice.status === 'pagada') {
            toast.success('Esta cotización ya tiene una venta generada.');
            return;
        }
        if (invoiceItems.length === 0) {
            toast.error('La cotización no tiene productos para generar una venta.');
            return;
        }
        if (!invoice.customer?.id) {
            toast.error('La cotización no tiene un cliente asociado.');
            return;
        }
        if (!invoice.warehouse?.id) {
            toast.error('La cotización no tiene un almacén asociado.');
            return;
        }
        if (!options?.skipConfirmation) {
            const confirmed = confirm('¿Deseas generar una venta a partir de esta cotización? Se actualizará el estado a pagada y se registrará la salida de inventario si aún no existe.');
            if (!confirmed) {
                return;
            }
        }
        try {
            setIsGeneratingSale(true);
            const orderDate = new Date().toISOString().split('T')[0];
            const { data: salesOrder, error: salesOrderError } = await supabase
                .from('sales_orders')
                .insert({
                customer_id: invoice.customer.id,
                warehouse_id: invoice.warehouse.id,
                order_date: orderDate,
                status: 'completada',
                total_amount: invoice.total_amount ?? 0
            })
                .select()
                .single();
            if (salesOrderError)
                throw salesOrderError;
            try {
                const saleItemsPayload = invoiceItems.map(item => ({
                    sales_order_id: salesOrder.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price
                }));
                if (saleItemsPayload.length > 0) {
                    const { error: salesItemsError } = await supabase
                        .from('sales_order_items')
                        .insert(saleItemsPayload);
                    if (salesItemsError)
                        throw salesItemsError;
                }
            }
            catch (itemsError) {
                await supabase.from('sales_orders').delete().eq('id', salesOrder.id);
                throw itemsError;
            }
            const { data: existingMovements, error: movementCheckError } = await supabase
                .from('stock_movements')
                .select('id')
                .eq('related_id', invoice.id)
                .eq('movement_type_id', 2);
            if (movementCheckError) {
                console.error('Error verificando movimientos de inventario:', movementCheckError);
            }
            if (!existingMovements || existingMovements.length === 0) {
                const stockMovements = invoiceItems.map(item => ({
                    product_id: item.product_id,
                    warehouse_id: invoice.warehouse.id,
                    quantity: item.quantity,
                    movement_type_id: 2,
                    reference: `Cotización ${invoice.invoice_number}`,
                    related_id: invoice.id,
                    movement_date: new Date().toISOString(),
                    notes: `Venta generada desde cotización #${invoice.invoice_number}`
                }));
                if (stockMovements.length > 0) {
                    const { error: movementError } = await supabase
                        .from('stock_movements')
                        .insert(stockMovements);
                    if (movementError) {
                        console.error('Error registrando movimientos de inventario:', movementError);
                        toast.error('La venta se generó, pero hubo un error registrando el inventario.');
                    }
                }
            }
            const { error: updateInvoiceError } = await supabase
                .from('invoices')
                .update({
                status: 'pagada',
                updated_at: new Date().toISOString(),
                sales_order_id: salesOrder.id
            })
                .eq('id', invoice.id);
            if (updateInvoiceError)
                throw updateInvoiceError;
            toast.success('Venta generada correctamente a partir de la cotización.');
            fetchInvoiceDetails();
            if (shouldAutoGenerateSale) {
                const params = new URLSearchParams(location.search);
                params.delete('generar-venta');
                const newSearch = params.toString();
                window.history.replaceState({}, '', `${location.pathname}${newSearch ? `?${newSearch}` : ''}`);
            }
        }
        catch (err) {
            console.error('Error al generar la venta:', err);
            toast.error(`Error al generar la venta: ${err.message || err}`);
        }
        finally {
            setIsGeneratingSale(false);
        }
    }, [invoice, invoiceItems, isAdmin, isGeneratingSale, fetchInvoiceDetails, shouldAutoGenerateSale, location.pathname, location.search]);
    useEffect(() => {
        if (!invoice)
            return;
        if (!shouldAutoGenerateSale)
            return;
        if (attemptedAutoSaleRef.current)
            return;
        attemptedAutoSaleRef.current = true;
        handleGenerateSale();
    }, [invoice, shouldAutoGenerateSale, handleGenerateSale]);
    const handlePrint = useReactToPrint({
        contentRef: printFormat === 'letter' ? letterPrintRef : rollPrintRef,
        documentTitle: `Cotización-${invoice?.invoice_number || 'Desconocida'}`,
        onAfterPrint: () => {
            setShowPrintDialog(false);
            toast.success('Cotización enviada a impresión correctamente');
        },
    });
    const formatDate = (dateString) => {
        if (!dateString)
            return '';
        return new Date(dateString).toLocaleDateString(currency.settings.locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
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
    if (loading) {
        return (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    if (error) {
        return (_jsxs("div", { className: "bg-red-50 border-l-4 border-red-500 p-4 mb-4", children: [_jsx("p", { className: "text-red-700", children: error }), _jsx(Link, { to: "/ventas/facturas", className: "text-blue-600 hover:text-blue-800 mt-2 inline-block", children: "Volver a Cotizaciones" })] }));
    }
    if (!invoice) {
        return (_jsxs("div", { className: "text-center py-10", children: [_jsx("p", { className: "text-gray-500", children: "Cotizaci\u00F3n no encontrada" }), _jsx(Link, { to: "/ventas/facturas", className: "text-blue-600 hover:text-blue-800 mt-2 inline-block", children: "Volver a Cotizaciones" })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/ventas/facturas", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Cotizaciones"] }), _jsxs("h1", { className: "text-2xl font-semibold", children: ["Cotizaci\u00F3n #", invoice.invoice_number, _jsx("span", { className: `ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.status)}`, children: getStatusText(invoice.status) })] })] }), _jsxs("div", { className: "mt-4 md:mt-0 flex flex-wrap gap-2 justify-end", children: [isAdmin && invoice.status !== 'anulada' && invoice.status !== 'pagada' && !invoice.sales_order_id && (_jsx("button", { onClick: () => handleGenerateSale(), disabled: isGeneratingSale, className: "px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center disabled:opacity-70", children: isGeneratingSale ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner fa-spin mr-2" }), "Generando..."] })) : (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-cash-register mr-2" }), "Generar venta"] })) })), invoice.status !== 'anulada' && (_jsxs("button", { onClick: () => setShowPrintDialog(true), className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir"] })), isAdmin && (invoice.status === 'borrador' || invoice.status === 'emitida') && (_jsxs(_Fragment, { children: [invoice.status === 'borrador' && (_jsxs(Link, { to: `/ventas/facturas/editar/${invoice.id}`, className: "px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center", children: [_jsx("i", { className: "fas fa-edit mr-2" }), "Editar"] })), _jsxs("button", { onClick: handleCancelInvoice, className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center", children: [_jsx("i", { className: "fas fa-times-circle mr-2" }), "Anular"] })] }))] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 p-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4 border-b pb-2", children: "Informaci\u00F3n de Cotizaci\u00F3n" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "N\u00FAmero:" }), _jsx("div", { className: "font-medium", children: invoice.invoice_number })] }), _jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Fecha de emisi\u00F3n:" }), _jsx("div", { children: formatDate(invoice.invoice_date) })] }), invoice.due_date && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Fecha de vencimiento:" }), _jsx("div", { children: formatDate(invoice.due_date) })] })), _jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Estado:" }), _jsx("div", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.status)}`, children: getStatusText(invoice.status) })] }), invoice.sales_order_id && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Venta generada:" }), _jsx("div", { className: "font-medium break-words", children: invoice.sales_order_id })] })), _jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "M\u00E9todo de pago:" }), _jsx("div", { className: "capitalize", children: invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado' })] }), _jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Almac\u00E9n:" }), _jsx("div", { children: invoice.warehouse.name || 'No especificado' })] })] })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium mb-4 border-b pb-2", children: "Informaci\u00F3n de Cliente" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Cliente:" }), _jsx("div", { className: "font-medium", children: invoice.customer.name })] }), invoice.customer.identification_type && invoice.customer.identification_number && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Identificaci\u00F3n:" }), _jsxs("div", { children: [invoice.customer.identification_type, ": ", invoice.customer.identification_number] })] })), invoice.customer.address && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Direcci\u00F3n:" }), _jsx("div", { children: invoice.customer.address })] })), invoice.customer.phone && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Tel\u00E9fono:" }), _jsx("div", { children: invoice.customer.phone })] })), invoice.customer.email && (_jsxs("div", { className: "grid grid-cols-2", children: [_jsx("div", { className: "text-gray-600", children: "Email:" }), _jsx("div", { children: invoice.customer.email })] }))] })] })] }), _jsxs("div", { className: "p-6 border-t", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: "Productos" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Cantidad" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Precio Unit." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Descuento" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "IVA" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: invoiceItems.map((item) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium", children: item.product.name }), _jsxs("div", { className: "text-sm text-gray-500", children: ["SKU: ", item.product.sku] })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: item.quantity }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: currency.format(item.unit_price) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: item.discount_percent !== undefined && item.discount_percent > 0 && (_jsxs("div", { className: "text-xs", children: ["Desc: ", item.discount_percent, "%"] })) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { children: [item.tax_rate, "%"] }), _jsx("div", { className: "text-sm text-gray-500", children: currency.format(item.tax_amount) })] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: currency.format(item.total_price) })] }, item.id))) })] }) })] }), _jsx("div", { className: "p-6 border-t flex justify-end", children: _jsxs("div", { className: "w-full md:w-1/3 space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Subtotal:" }), _jsx("span", { children: currency.format(invoice.subtotal) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Descuentos:" }), _jsx("span", { children: currency.format(invoice.discount_amount) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "IVA:" }), _jsx("span", { children: currency.format(invoice.tax_amount) })] }), _jsxs("div", { className: "flex justify-between font-bold text-lg", children: [_jsx("span", { children: "Total:" }), _jsx("span", { children: currency.format(invoice.total_amount) })] })] }) }), invoice.notes && (_jsxs("div", { className: "p-6 border-t", children: [_jsx("h2", { className: "text-lg font-medium mb-2", children: "Notas" }), _jsx("p", { className: "text-gray-700 whitespace-pre-line", children: invoice.notes })] }))] }), showPrintDialog && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Seleccione formato de impresi\u00F3n" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "radio", value: "letter", checked: printFormat === 'letter', onChange: () => setPrintFormat('letter'), className: "h-4 w-4 text-blue-600" }), _jsx("span", { children: "Formato Carta" })] }), _jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "radio", value: "roll", checked: printFormat === 'roll', onChange: () => setPrintFormat('roll'), className: "h-4 w-4 text-blue-600" }), _jsx("span", { children: "Formato Rollo" })] })] }), _jsxs("div", { className: "flex justify-end mt-6 space-x-2", children: [_jsx("button", { onClick: () => setShowPrintDialog(false), className: "px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50", children: "Cancelar" }), _jsx("button", { onClick: handlePrint, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Imprimir" })] })] }) })), _jsxs("div", { className: "hidden", children: [_jsxs("div", { ref: letterPrintRef, className: "p-8 bg-white min-h-[11in] w-[8.5in] text-black", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "COTIZACI\u00D3N" }), _jsx("p", { className: "text-xl", children: invoice.invoice_number })] }), _jsxs("div", { className: "grid grid-cols-2 gap-6 mb-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: "Informaci\u00F3n de Empresa" }), _jsx("p", { children: settings.name }), _jsxs("p", { children: ["NIT: ", settings.taxId] }), _jsx("p", { children: settings.address }), _jsxs("p", { children: ["Tel: ", settings.phone] }), settings.email && _jsx("p", { children: settings.email }), settings.website && _jsx("p", { children: settings.website })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: "Informaci\u00F3n de Cliente" }), _jsx("p", { children: _jsx("strong", { children: invoice.customer.name }) }), invoice.customer.identification_type && invoice.customer.identification_number && (_jsxs("p", { children: [invoice.customer.identification_type, ": ", invoice.customer.identification_number] })), invoice.customer.address && _jsxs("p", { children: ["Direcci\u00F3n: ", invoice.customer.address] }), invoice.customer.phone && _jsxs("p", { children: ["Tel\u00E9fono: ", invoice.customer.phone] }), invoice.customer.email && _jsxs("p", { children: ["Email: ", invoice.customer.email] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: "Detalles de Cotizaci\u00F3n" }), _jsxs("div", { className: "grid grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: "Fecha de emisi\u00F3n:" }), " ", formatDate(invoice.invoice_date)] }), invoice.due_date && (_jsxs("p", { children: [_jsx("strong", { children: "Fecha de vencimiento:" }), " ", formatDate(invoice.due_date)] }))] }), _jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: "Estado:" }), " ", getStatusText(invoice.status)] }), _jsxs("p", { children: [_jsx("strong", { children: "M\u00E9todo de pago:" }), " ", invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'] })] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: "Productos" }), _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-100", children: [_jsx("th", { className: "border p-2 text-left", children: "Producto" }), _jsx("th", { className: "border p-2 text-right", children: "Cant." }), _jsx("th", { className: "border p-2 text-right", children: "Precio Unit." }), _jsx("th", { className: "border p-2 text-right", children: "Desc." }), _jsx("th", { className: "border p-2 text-right", children: "IVA" }), _jsx("th", { className: "border p-2 text-right", children: "Total" })] }) }), _jsx("tbody", { children: invoiceItems.map((item) => (_jsxs("tr", { children: [_jsxs("td", { className: "border p-2 text-left", children: [_jsx("div", { children: item.product.name }), _jsxs("div", { className: "text-xs", children: ["SKU: ", item.product.sku] })] }), _jsx("td", { className: "border p-2 text-right", children: item.quantity }), _jsx("td", { className: "border p-2 text-right", children: currency.format(item.unit_price) }), _jsx("td", { className: "border p-2 text-right", children: item.discount_percent !== undefined && item.discount_percent > 0 && (_jsxs("div", { className: "text-xs", children: ["Desc: ", item.discount_percent, "%"] })) }), _jsx("td", { className: "border p-2 text-right", children: currency.format(item.tax_amount) }), _jsx("td", { className: "border p-2 text-right font-medium", children: currency.format(item.total_price) })] }, item.id))) })] })] }), _jsx("div", { className: "flex justify-end mb-6", children: _jsxs("div", { className: "w-1/3", children: [_jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "Subtotal:" }), _jsx("span", { children: currency.format(invoice.subtotal) })] }), _jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "Descuentos:" }), _jsx("span", { children: currency.format(invoice.discount_amount) })] }), _jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "IVA:" }), _jsx("span", { children: currency.format(invoice.tax_amount) })] }), _jsxs("div", { className: "flex justify-between py-1 font-bold border-t pt-2", children: [_jsx("span", { children: "Total:" }), _jsx("span", { children: currency.format(invoice.total_amount) })] })] }) }), invoice.notes && (_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-lg font-bold mb-2", children: "Notas" }), _jsx("p", { className: "whitespace-pre-line", children: invoice.notes })] })), _jsxs("div", { className: "text-center text-sm mt-10", children: [_jsx("p", { children: "Gracias por su compra" }), _jsx("p", { children: "Este documento tiene validez como comprobante fiscal de acuerdo a las normas vigentes." }), _jsx("p", { children: settings.footerText }), _jsx("p", { children: new Date().toLocaleDateString(currency.settings.locale) })] })] }), _jsxs("div", { ref: rollPrintRef, className: "p-3 bg-white w-[80mm] text-black text-sm", children: [_jsxs("div", { className: "text-center mb-4", children: [_jsx("h1", { className: "font-bold", children: settings.name.toUpperCase() }), _jsxs("p", { children: ["NIT: ", settings.taxId] }), _jsx("p", { children: settings.address }), _jsxs("p", { children: ["Tel: ", settings.phone] }), _jsx("hr", { className: "my-2" }), _jsxs("h2", { className: "font-bold", children: ["COTIZACI\u00D3N ", invoice.invoice_number] }), _jsxs("p", { children: ["Fecha: ", formatDate(invoice.invoice_date)] }), invoice.due_date && _jsxs("p", { children: ["Vencimiento: ", formatDate(invoice.due_date)] })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("p", { children: [_jsx("strong", { children: "Cliente:" }), " ", invoice.customer.name] }), invoice.customer.identification_type && invoice.customer.identification_number && (_jsxs("p", { children: [_jsxs("strong", { children: [invoice.customer.identification_type, ":"] }), " ", invoice.customer.identification_number] })), invoice.customer.phone && _jsxs("p", { children: [_jsx("strong", { children: "Tel:" }), " ", invoice.customer.phone] })] }), _jsx("hr", { className: "my-2" }), _jsx("div", { className: "mb-4", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b", children: [_jsx("th", { className: "text-left py-1", children: "Producto" }), _jsx("th", { className: "text-right py-1", children: "Cant" }), _jsx("th", { className: "text-right py-1", children: "Total" })] }) }), _jsx("tbody", { children: invoiceItems.map((item) => (_jsxs("tr", { className: "border-b", children: [_jsxs("td", { className: "py-1", children: [_jsx("div", { children: item.product.name }), _jsxs("div", { className: "text-xs", children: [currency.format(item.unit_price), " x ", item.quantity] }), item.discount_percent !== undefined && item.discount_percent > 0 && (_jsxs("div", { className: "text-xs", children: ["Desc: ", item.discount_percent, "%"] }))] }), _jsx("td", { className: "py-1 text-right", children: item.quantity }), _jsx("td", { className: "py-1 text-right", children: currency.format(item.total_price) })] }, item.id))) })] }) }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "Subtotal:" }), _jsx("span", { children: currency.format(invoice.subtotal) })] }), _jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "Descuentos:" }), _jsx("span", { children: currency.format(invoice.discount_amount) })] }), _jsxs("div", { className: "flex justify-between py-1", children: [_jsx("span", { children: "IVA:" }), _jsx("span", { children: currency.format(invoice.tax_amount) })] }), _jsxs("div", { className: "flex justify-between py-1 font-bold border-t border-b", children: [_jsx("span", { children: "TOTAL:" }), _jsx("span", { children: currency.format(invoice.total_amount) })] }), _jsx("div", { className: "pt-1", children: _jsxs("p", { children: ["M\u00E9todo de pago: ", invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'] }) })] }), invoice.notes && (_jsx("div", { className: "mb-4 text-xs", children: _jsx("p", { className: "whitespace-pre-line", children: invoice.notes }) })), _jsxs("div", { className: "text-center text-xs mb-4", children: [_jsx("p", { children: "*** Gracias por su compra ***" }), _jsx("p", { children: settings.footerText }), _jsx("p", { children: new Date().toLocaleDateString(currency.settings.locale) })] }), _jsx("div", { className: "text-center", children: _jsx("p", { children: "--------------------------------" }) })] })] })] }));
};
export default InvoiceDetail;
