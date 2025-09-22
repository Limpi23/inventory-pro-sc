import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useRef } from 'react';
import InventoryInitialImport from '../components/inventory/InventoryInitialImport';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import { useReactToPrint } from 'react-to-print';
const InventoryGeneral = () => {
    const [inventory, setInventory] = useState([]);
    const [movements, setMovements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('current');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState('csv');
    const [showExportOptions, setShowExportOptions] = useState(false);
    // Fila expandida para ver existencias por ubicación
    const [expandedKey, setExpandedKey] = useState(null);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [locationsByRow, setLocationsByRow] = useState({});
    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    // Refs para la impresión
    const printComponentRef = useRef(null);
    useEffect(() => {
        fetchInventory();
    }, []);
    const fetchInventory = async () => {
        try {
            setIsLoading(true);
            // Obtener el inventario actual
            const client = await supabase.getClient();
            const { data: inventoryData, error: inventoryError } = await client.from('current_stock')
                .select('*')
                .order('product_name');
            if (inventoryError)
                throw inventoryError;
            setInventory(inventoryData || []);
            setIsLoading(false);
        }
        catch (err) {
            console.error('Error cargando inventario:', err);
            setError(err.message);
            setIsLoading(false);
        }
    };
    const fetchProductHistory = async (productId) => {
        setIsLoading(true);
        try {
            const client = await supabase.getClient();
            const { data: movementsData, error: movementsError } = await client.from('stock_movements')
                .select(`
          id,
          movement_date,
          quantity,
          reference,
          product:products(name),
          warehouse:warehouses(name),
          movement_type:movement_types(description, code)
        `)
                .eq('product_id', productId)
                .order('movement_date', { ascending: false });
            if (movementsError)
                throw movementsError;
            const formattedMovements = (movementsData || []).map((m) => ({
                id: m.id,
                product_name: m.product?.name || 'Desconocido',
                warehouse_name: m.warehouse?.name || 'Desconocido',
                movement_date: m.movement_date,
                movement_type: {
                    description: m.movement_type?.description || 'Desconocido',
                    code: m.movement_type?.code || ''
                },
                quantity: m.quantity,
                reference: m.reference
            }));
            setMovements(formattedMovements);
            setActiveTab('history');
        }
        catch (err) {
            console.error('Error cargando historial:', err);
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    // Cargar existencias por ubicación para una fila (producto + almacén)
    const loadLocationsForRow = async (productId, warehouseId, cacheKey) => {
        try {
            setLocationsLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('current_stock_by_location')
                .select('*')
                .eq('product_id', productId)
                .eq('warehouse_id', warehouseId);
            if (error)
                throw error;
            const rows = data || [];
            // Resolver nombres de ubicaciones
            const ids = Array.from(new Set(rows.map(r => r.location_id).filter((v) => !!v)));
            let namesMap = {};
            if (ids.length > 0) {
                const { data: locs, error: locErr } = await client
                    .from('locations')
                    .select('id, name')
                    .in('id', ids);
                if (locErr)
                    throw locErr;
                namesMap = (locs || []).reduce((acc, l) => { acc[l.id] = l.name; return acc; }, {});
            }
            const mapped = rows
                .map(r => ({
                location_id: r.location_id ?? null,
                location_name: r.location_id ? (namesMap[r.location_id] || r.location_id) : 'Sin ubicación',
                current_quantity: Number(r.current_quantity ?? 0)
            }))
                // Orden: primero con nombre (no nulos), luego sin ubicación
                .sort((a, b) => {
                if (a.location_id && b.location_id)
                    return a.location_name.localeCompare(b.location_name);
                if (a.location_id && !b.location_id)
                    return -1;
                if (!a.location_id && b.location_id)
                    return 1;
                return 0;
            });
            setLocationsByRow(prev => ({ ...prev, [cacheKey]: mapped }));
        }
        catch (e) {
            console.error('Error cargando existencias por ubicación:', e);
            setError(e.message || 'No se pudieron cargar las ubicaciones');
        }
        finally {
            setLocationsLoading(false);
        }
    };
    const toggleLocations = (item) => {
        const key = `${item.product_id}|${item.warehouse_id}`;
        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(key);
        // Cargar si no está en caché
        if (!locationsByRow[key]) {
            loadLocationsForRow(item.product_id, item.warehouse_id, key);
        }
    };
    const clearFilters = () => {
        setSelectedProduct(null);
        setSelectedWarehouse(null);
        setSearchTerm('');
        setCurrentPage(1);
    };
    // Filtrar inventario por producto, almacén y término de búsqueda
    const filteredInventory = inventory.filter(item => {
        if (selectedProduct && item.product_id !== selectedProduct)
            return false;
        if (selectedWarehouse && item.warehouse_id !== selectedWarehouse)
            return false;
        if (searchTerm && !item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !(item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())))
            return false;
        return true;
    });
    // Calcular paginación
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredInventory.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
    // Cambiar de página
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    // Manejo de la impresión usando react-to-print
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: `Inventario para Conteo Físico - ${new Date().toLocaleDateString()}`,
        onAfterPrint: () => {
            console.log('Impresión completada');
        }
    });
    // Función para abrir las opciones de exportación
    const openExportOptions = () => {
        setShowExportOptions(true);
    };
    // Función para cerrar las opciones de exportación
    const closeExportOptions = () => {
        setShowExportOptions(false);
    };
    // Función para exportar inventario a CSV para conteo físico
    const exportToCSV = (format) => {
        try {
            setIsExporting(true);
            let headers;
            let dataRows;
            if (format === 'physical') {
                // Formato para conteo físico con más columnas para la verificación
                headers = [
                    'Producto',
                    'SKU',
                    'Almacén',
                    'Cantidad en Sistema',
                    'Cantidad Física',
                    'Diferencia',
                    'Observaciones',
                    'Responsable de Conteo',
                    'Fecha de Conteo'
                ];
                dataRows = filteredInventory.map(item => [
                    item.product_name,
                    item.sku || '',
                    item.warehouse_name,
                    item.current_quantity.toString(),
                    '', // Campo para cantidad física (para completar durante conteo)
                    '', // Campo para diferencia (para completar durante conteo)
                    '', // Campo para observaciones
                    '', // Campo para responsable de conteo
                    '' // Campo para fecha de conteo
                ]);
            }
            else {
                // Formato básico CSV
                headers = [
                    'Producto',
                    'SKU',
                    'Almacén',
                    'Cantidad'
                ];
                dataRows = filteredInventory.map(item => [
                    item.product_name,
                    item.sku || '',
                    item.warehouse_name,
                    item.current_quantity.toString()
                ]);
            }
            // Usar PapaParse para crear el CSV correctamente con manejo de comillas y caracteres especiales
            const csv = Papa.unparse({
                fields: headers,
                data: dataRows
            });
            // Crear un blob y URL para descargar
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            // Crear elemento de enlace para descarga
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
            const fileName = format === 'physical'
                ? `conteo_fisico_inventario_${date}.csv`
                : `inventario_${date}.csv`;
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            // Simular clic y eliminar el enlace
            link.click();
            document.body.removeChild(link);
            // Cerrar el modal de opciones
            closeExportOptions();
        }
        catch (err) {
            console.error('Error al exportar inventario:', err);
            setError('Error al generar el archivo CSV: ' + err.message);
        }
        finally {
            setIsExporting(false);
        }
    };
    return (_jsxs("div", { className: "space-y-6 inventory-report-container", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Inventario General" }), _jsxs("div", { className: "flex space-x-3", children: [_jsx(InventoryInitialImport, { trigger: _jsxs("button", { className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 flex items-center", children: [_jsx("i", { className: "fas fa-file-import mr-2" }), "Importar Inventario Inicial"] }), onImported: () => {
                                    // Refrescar inventario tras importaci3n
                                    fetchInventory();
                                    setActiveTab('current');
                                } }), _jsxs("button", { onClick: openExportOptions, className: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center", children: [_jsx("i", { className: "fas fa-file-export mr-2" }), "Exportar Inventario"] }), _jsxs("button", { onClick: handlePrint, className: "px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 flex items-center", children: [_jsx("i", { className: "fas fa-print mr-2" }), "Imprimir para Conteo F\u00EDsico"] })] })] }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsxs("div", { className: "mb-6 flex flex-col md:flex-row md:items-center gap-4", children: [_jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => setActiveTab('current'), className: `px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'current'
                                            ? 'bg-blue-500 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: "Inventario Actual" }), _jsx("button", { onClick: () => setActiveTab('history'), className: `px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                                            ? 'bg-blue-500 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: "Historial de Movimientos" })] }), _jsxs("div", { className: "relative flex-grow", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", placeholder: "Buscar por nombre o SKU...", value: searchTerm, onChange: (e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1); // Reset a la primera página cuando se busca
                                        }, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }), (selectedProduct || selectedWarehouse || searchTerm) && (_jsxs("button", { onClick: clearFilters, className: "px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap", children: [_jsx("i", { className: "fas fa-times mr-2" }), "Limpiar Filtros"] }))] }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : activeTab === 'current' ? (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Producto" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "SKU" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Almac\u00E9n" }), _jsx("th", { className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Cantidad" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: currentItems.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "py-6 text-center text-sm text-gray-500", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("i", { className: "fas fa-box-open text-gray-300 text-4xl mb-2" }), _jsx("p", { children: "No hay datos de inventario disponibles" }), searchTerm && (_jsxs("p", { className: "text-xs mt-1", children: ["No se encontraron resultados para \"", searchTerm, "\""] }))] }) }) })) : (currentItems.map((item) => {
                                            const rowKey = `${item.product_id}|${item.warehouse_id}`;
                                            const isExpanded = expandedKey === rowKey;
                                            const rows = locationsByRow[rowKey] || [];
                                            return (_jsxs(React.Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50 transition-colors", children: [_jsx("td", { className: "py-3 px-4 text-sm", children: _jsx("a", { href: "#", className: "text-blue-600 hover:text-blue-800 hover:underline font-medium", onClick: (e) => {
                                                                        e.preventDefault();
                                                                        setSelectedProduct(item.product_id);
                                                                        setCurrentPage(1);
                                                                    }, children: item.product_name }) }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-500", children: item.sku || '-' }), _jsx("td", { className: "py-3 px-4 text-sm", children: _jsx("a", { href: "#", className: "text-blue-600 hover:text-blue-800 hover:underline", onClick: (e) => {
                                                                        e.preventDefault();
                                                                        setSelectedWarehouse(item.warehouse_id);
                                                                        setCurrentPage(1);
                                                                    }, children: item.warehouse_name }) }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: _jsx("span", { className: `
                              ${item.current_quantity > 0 ? 'text-green-600' : 'text-red-600'}
                              ${item.current_quantity === 0 ? 'text-yellow-600' : ''}
                           `, children: item.current_quantity }) }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs("div", { className: "inline-flex items-center gap-2", children: [_jsxs("button", { onClick: () => toggleLocations(item), className: "text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 rounded-md px-2 py-1", "aria-expanded": isExpanded, "aria-controls": `loc-${rowKey}`, title: isExpanded ? 'Ocultar ubicaciones' : 'Ver ubicaciones', children: [_jsx("i", { className: `fas ${isExpanded ? 'fa-chevron-up' : 'fa-map-marker-alt'} mr-1` }), isExpanded ? 'Ocultar ubicaciones' : 'Ver ubicaciones'] }), _jsxs("button", { onClick: () => fetchProductHistory(item.product_id), className: "text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-md px-2 py-1", children: [_jsx("i", { className: "fas fa-history mr-1" }), "Ver Historial"] })] }) })] }, `${item.product_id}-${item.warehouse_id}`), isExpanded && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "bg-gray-50 px-4 py-3", id: `loc-${rowKey}`, children: locationsLoading && rows.length === 0 ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx("i", { className: "fas fa-spinner animate-spin" }), "Cargando ubicaciones..."] })) : rows.length === 0 ? (_jsx("div", { className: "text-sm text-gray-600", children: "No hay existencias distribuidas por ubicaci\u00F3n." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-[400px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500", children: [_jsx("th", { className: "py-2 pr-4", children: "Ubicaci\u00F3n" }), _jsx("th", { className: "py-2 text-right", children: "Cantidad" })] }) }), _jsx("tbody", { children: rows.map(r => (_jsxs("tr", { className: "border-t border-gray-200", children: [_jsx("td", { className: "py-2 pr-4", children: r.location_name }), _jsx("td", { className: "py-2 text-right font-medium", children: r.current_quantity })] }, r.location_id ?? 'null'))) })] }) })) }) }))] }, `row-${rowKey}`));
                                        })) })] }), filteredInventory.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, filteredInventory.length), " de ", filteredInventory.length, " items"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("button", { onClick: () => paginate(currentPage - 1), disabled: currentPage === 1, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                                // Si hay más de 5 páginas, mostrar racionalmente las páginas cercanas a la actual
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
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] })) : (_jsxs("div", { className: "overflow-x-auto", children: [_jsx("h2", { className: "text-lg font-medium mb-4", children: selectedProduct ?
                                    `Historial de: ${inventory.find(i => i.product_id === selectedProduct)?.product_name}` :
                                    'Historial de Movimientos' }), _jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Producto" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "SKU" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Almac\u00E9n" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider", children: "Stock" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: movements.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "py-6 text-center text-sm text-gray-500 dark:text-gray-400", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("i", { className: "fas fa-history text-gray-300 dark:text-gray-600 text-4xl mb-2" }), _jsx("p", { children: "No hay movimientos disponibles" })] }) }) })) : (movements.map((movement) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: [new Date(movement.movement_date).toLocaleDateString(), _jsx("span", { className: "text-xs text-gray-500 dark:text-gray-400 ml-1", children: new Date(movement.movement_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), _jsx("td", { className: "py-3 px-4 text-sm", children: _jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${movement.movement_type.code.startsWith('IN_')
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`, children: [movement.movement_type.code.startsWith('IN_') ?
                                                                _jsx("i", { className: "fas fa-arrow-up mr-1" }) :
                                                                _jsx("i", { className: "fas fa-arrow-down mr-1" }), movement.movement_type.description] }) }), _jsx("td", { className: "py-3 px-4 text-sm font-medium dark:text-gray-300", children: movement.product_name }), _jsx("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: movement.warehouse_name }), _jsx("td", { className: "py-3 px-4 text-sm text-right font-medium", children: _jsxs("span", { className: movement.movement_type.code.startsWith('IN_') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400', children: [movement.movement_type.code.startsWith('IN_') ? '+' : '-', movement.quantity] }) })] }, movement.id)))) })] })] }))] }), showExportOptions && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md", children: [_jsx("h3", { className: "text-lg font-semibold mb-4 dark:text-gray-200", children: "Opciones de Exportaci\u00F3n" }), _jsxs("div", { className: "mb-6 space-y-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", id: "csv-standard", name: "export-format", checked: exportFormat === 'csv', onChange: () => setExportFormat('csv'), className: "h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded" }), _jsx("label", { htmlFor: "csv-standard", className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Inventario Simple (CSV)" }), _jsx("span", { className: "text-xs text-gray-500 dark:text-gray-400", children: "- Lista b\u00E1sica del inventario actual" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", id: "csv-physical", name: "export-format", checked: exportFormat === 'physical', onChange: () => setExportFormat('physical'), className: "h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded" }), _jsx("label", { htmlFor: "csv-physical", className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Formato para Conteo F\u00EDsico (CSV)" }), _jsx("span", { className: "text-xs text-gray-500 dark:text-gray-400", children: "- Incluye columnas para registrar conteo" })] })] }), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { onClick: closeExportOptions, className: "px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500", children: "Cancelar" }), _jsxs("button", { onClick: () => exportToCSV(exportFormat), disabled: isExporting, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center", children: [isExporting ? (_jsx("span", { className: "inline-block animate-spin mr-2", children: _jsx("i", { className: "fas fa-spinner" }) })) : (_jsx("i", { className: "fas fa-download mr-2" })), "Exportar"] })] })] }) })), _jsx("div", { style: { display: 'none' }, children: _jsxs("div", { ref: printComponentRef, className: "p-6", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Formulario de Conteo F\u00EDsico de Inventario" }), _jsxs("p", { className: "text-gray-600", children: ["Fecha de impresi\u00F3n: ", new Date().toLocaleDateString()] })] }), _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-100", children: [_jsx("th", { className: "border border-gray-300 px-4 py-2 text-left", children: "Producto" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-left", children: "SKU" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-left", children: "Almac\u00E9n" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-right", children: "Cant. Sistema" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-center", children: "Cant. F\u00EDsica" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-center", children: "Diferencia" }), _jsx("th", { className: "border border-gray-300 px-4 py-2 text-center", children: "Observaciones" })] }) }), _jsx("tbody", { children: filteredInventory.map((item, index) => (_jsxs("tr", { className: index % 2 === 0 ? 'bg-gray-50' : 'bg-white', children: [_jsx("td", { className: "border border-gray-300 px-4 py-3", children: item.product_name }), _jsx("td", { className: "border border-gray-300 px-4 py-3", children: item.sku || '-' }), _jsx("td", { className: "border border-gray-300 px-4 py-3", children: item.warehouse_name }), _jsx("td", { className: "border border-gray-300 px-4 py-3 text-right", children: item.current_quantity }), _jsx("td", { className: "border border-gray-300 px-4 py-3", style: { minWidth: '100px' } }), _jsx("td", { className: "border border-gray-300 px-4 py-3", style: { minWidth: '100px' } }), _jsx("td", { className: "border border-gray-300 px-4 py-3", style: { minWidth: '150px' } })] }, `${item.product_id}-${item.warehouse_id}`))) })] }), _jsxs("div", { className: "mt-8", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: "Responsable del conteo:" }), _jsx("div", { className: "mt-2 border-b border-gray-400 h-8" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold", children: "Supervisor:" }), _jsx("div", { className: "mt-2 border-b border-gray-400 h-8" })] })] }), _jsxs("div", { className: "mt-6", children: [_jsx("p", { className: "font-semibold", children: "Fecha de conteo:" }), _jsx("div", { className: "mt-2 border-b border-gray-400 h-8" })] }), _jsxs("div", { className: "mt-6", children: [_jsx("p", { className: "font-semibold", children: "Observaciones generales:" }), _jsx("div", { className: "mt-2 border border-gray-400 h-24 p-2" })] })] })] }) }), _jsx("style", { children: `
        @media print {
          body * {
            visibility: hidden;
          }
          .inventory-report-container,
          .inventory-report-container * {
            visibility: visible;
          }
          .inventory-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print,
          .no-print * {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
        }
      ` })] }));
};
export default InventoryGeneral;
