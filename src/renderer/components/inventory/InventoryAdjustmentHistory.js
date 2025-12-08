import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
const InventoryAdjustmentHistory = ({ isOpen, onClose }) => {
    const [adjustments, setAdjustments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (isOpen) {
            loadAdjustments();
        }
    }, [isOpen]);
    const loadAdjustments = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const client = await supabase.getClient();
            const { data, error: fetchError } = await client
                .from('inventory_adjustments_history')
                .select('*')
                .order('adjusted_at', { ascending: false })
                .limit(100);
            if (fetchError)
                throw fetchError;
            setAdjustments(data || []);
        }
        catch (err) {
            console.error('Error loading adjustments:', err);
            setError(err.message || 'Error al cargar el historial de ajustes');
        }
        finally {
            setIsLoading(false);
        }
    };
    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
        }
        catch {
            return dateString;
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsx("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: "Historial de Ajustes de Inventario" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx("i", { className: "fas fa-times text-xl" }) })] }), _jsx("div", { className: "mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md", children: _jsxs("div", { className: "flex items-start", children: [_jsx("i", { className: "fas fa-info-circle text-blue-600 dark:text-blue-500 mt-0.5 mr-2" }), _jsxs("div", { className: "text-sm text-blue-800 dark:text-blue-200", children: [_jsx("p", { className: "font-semibold", children: "Registro de Auditor\u00EDa" }), _jsx("p", { className: "mt-1", children: "Este historial muestra todos los ajustes directos realizados en el inventario. Solo los ajustes realizados por el super administrador aparecen aqu\u00ED." })] })] }) }), error && (_jsx("div", { className: "mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md", children: _jsx("p", { className: "text-sm text-red-800 dark:text-red-200", children: error }) })), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-12", children: _jsxs("div", { className: "text-center", children: [_jsx("i", { className: "fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" }), _jsx("p", { className: "text-gray-600 dark:text-gray-400", children: "Cargando historial..." })] }) })) : adjustments.length === 0 ? (_jsx("div", { className: "flex justify-center items-center py-12", children: _jsxs("div", { className: "text-center", children: [_jsx("i", { className: "fas fa-clipboard-list text-4xl text-gray-300 mb-4" }), _jsx("p", { className: "text-gray-600 dark:text-gray-400", children: "No hay ajustes registrados" })] }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Fecha/Hora" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Almac\u00E9n" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Ubicaci\u00F3n" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Cant. Anterior" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Cant. Nueva" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Diferencia" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Raz\u00F3n" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Ajustado Por" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: adjustments.map((adj) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700", children: [_jsx("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap", children: formatDate(adj.adjusted_at) }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: [_jsx("div", { className: "font-medium", children: adj.product_name }), adj.sku && (_jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["SKU: ", adj.sku] }))] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: adj.warehouse_name }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: adj.location_name }), _jsx("td", { className: "px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap", children: adj.previous_quantity }), _jsx("td", { className: "px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap font-medium", children: adj.new_quantity }), _jsxs("td", { className: `px-4 py-3 text-sm text-right font-bold whitespace-nowrap ${adj.difference > 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : adj.difference < 0
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-gray-600 dark:text-gray-400'}`, children: [adj.difference > 0 ? '+' : '', adj.difference] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: _jsx("div", { className: "max-w-xs truncate", title: adj.reason, children: adj.reason }) }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: [_jsx("div", { className: "font-medium", children: adj.adjusted_by_name }), _jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: adj.adjusted_by_email })] })] }, adj.id))) })] }) })), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors", children: "Cerrar" }) })] }) }) }));
};
export default InventoryAdjustmentHistory;
