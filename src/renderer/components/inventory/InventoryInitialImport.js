import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { stockMovementService, productService, warehousesService, locationsService, serialsService } from '../../lib/supabase';
// CSV columns we support
// standard: sku | product_id | product_name | warehouse_id | warehouse | location_id | location | quantity | reference | movement_date
// serialized: sku | product_id | serial_id | serial_code | vin | engine_number | year | color | warehouse_id | warehouse | location_id | location | acquired_at | reference
const InventoryInitialImport = ({ onImported, trigger }) => {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errors, setErrors] = useState([]);
    const [preview, setPreview] = useState([]);
    const [mode, setMode] = useState('standard');
    const templateCSV = useMemo(() => {
        if (mode === 'serialized') {
            return [
                'sku,serial_code,vin,engine_number,year,color,warehouse,location,acquired_at,reference',
                'DE191033,ABC12345,1HGBH41JXMN109186,ENG987654,2024,Negro,Almacen Central,Pasillo A - Estante 1,2025-09-01,Importación inicial',
            ].join('\n');
        }
        return [
            'sku,warehouse,location,quantity,reference,movement_date',
            'DE191033,Almacen Central,Pasillo A - Estante 1,3,Inventario inicial,2025-09-01',
        ].join('\n');
    }, [mode]);
    const downloadTemplate = () => {
        const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = mode === 'serialized' ? 'plantilla_inventario_inicial_serial.csv' : 'plantilla_inventario_inicial.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    const parseCSV = async () => {
        if (!file)
            return;
        setIsProcessing(true);
        setErrors([]);
        setPreview([]);
        try {
            const results = await new Promise((resolve, reject) => {
                Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
            });
            const rows = results.data;
            // Preload maps
            const [products, warehouses, locs] = await Promise.all([
                productService.getAllAll(),
                warehousesService.getAll(),
                locationsService.getAll(),
            ]);
            const bySku = new Map(products.map((p) => [String(p.sku || '').trim().toLowerCase(), p]));
            const whByName = new Map(warehouses.map((w) => [String(w.name || '').trim().toLowerCase(), w.id]));
            const locByName = new Map(locs.map((l) => [String(l.name || '').trim().toLowerCase(), l.id]));
            const out = [];
            const errs = [];
            if (mode === 'serialized') {
                for (let i = 0; i < rows.length; i++) {
                    const r = rows[i];
                    const sku = String(r.sku || '').trim().toLowerCase();
                    const product = bySku.get(sku);
                    if (!product) {
                        errs.push(`Fila ${i + 2}: SKU no encontrado: ${r.sku}`);
                        continue;
                    }
                    const warehouse_id = r.warehouse_id || whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
                    const location_id = r.location_id || locByName.get(String(r.location || '').trim().toLowerCase()) || null;
                    if (!warehouse_id) {
                        errs.push(`Fila ${i + 2}: almacén requerido`);
                        continue;
                    }
                    const serial_code = String(r.serial_code || '').trim();
                    if (!serial_code) {
                        errs.push(`Fila ${i + 2}: serial_code requerido`);
                        continue;
                    }
                    const row = {
                        product_id: product.id,
                        warehouse_id,
                        location_id,
                        serial_code,
                        vin: r.vin || null,
                        engine_number: r.engine_number || null,
                        year: r.year ? Number(r.year) : null,
                        color: r.color || null,
                        acquired_at: r.acquired_at || new Date().toISOString(),
                        reference: r.reference || 'INICIAL',
                    };
                    out.push(row);
                }
            }
            else {
                for (let i = 0; i < rows.length; i++) {
                    const r = rows[i];
                    const sku = String(r.sku || '').trim().toLowerCase();
                    const product = bySku.get(sku);
                    if (!product) {
                        errs.push(`Fila ${i + 2}: SKU no encontrado: ${r.sku}`);
                        continue;
                    }
                    const warehouse_id = r.warehouse_id || whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
                    const location_id = r.location_id || locByName.get(String(r.location || '').trim().toLowerCase()) || null;
                    const quantity = Number(r.quantity || 0);
                    if (!warehouse_id) {
                        errs.push(`Fila ${i + 2}: almacén requerido`);
                        continue;
                    }
                    if (!(quantity > 0)) {
                        errs.push(`Fila ${i + 2}: cantidad inválida`);
                        continue;
                    }
                    const movement_date = r.movement_date || new Date().toISOString();
                    out.push({ product_id: product.id, warehouse_id, location_id, quantity, reference: r.reference || 'INICIAL', movement_date });
                }
            }
            setPreview(out);
            setErrors(errs);
        }
        catch (e) {
            setErrors([e.message || 'Error al parsear CSV']);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const doImport = async () => {
        if (!preview.length)
            return;
        setIsProcessing(true);
        try {
            const typeId = await stockMovementService.getInboundInitialTypeId();
            let created = 0;
            if (mode === 'serialized') {
                // Create serials then movements of quantity 1 linked to serial_id
                // 1) insert serials
                const serials = preview.map((r) => ({
                    product_id: r.product_id,
                    serial_code: r.serial_code,
                    vin: r.vin || null,
                    engine_number: r.engine_number || null,
                    year: r.year || null,
                    color: r.color || null,
                    warehouse_id: r.warehouse_id || null,
                    location_id: r.location_id || null,
                    status: 'in_stock',
                    acquired_at: r.acquired_at || new Date().toISOString(),
                }));
                const inserted = await serialsService.createMany(serials);
                // Index by serial_code
                const byCode = new Map(inserted.map((s) => [s.serial_code, s]));
                const moves = preview.map((r) => ({
                    product_id: r.product_id,
                    warehouse_id: r.warehouse_id,
                    location_id: r.location_id || null,
                    serial_id: byCode.get(r.serial_code)?.id || null,
                    quantity: 1,
                    movement_type_id: typeId,
                    reference: r.reference || 'INICIAL',
                    related_id: null,
                    movement_date: r.acquired_at || new Date().toISOString(),
                    notes: 'Importación inicial serializada',
                }));
                created = await stockMovementService.createBatch(moves);
            }
            else {
                const moves = preview.map((r) => ({
                    product_id: r.product_id,
                    warehouse_id: r.warehouse_id,
                    location_id: r.location_id || null,
                    quantity: r.quantity,
                    movement_type_id: typeId,
                    reference: r.reference || 'INICIAL',
                    related_id: null,
                    movement_date: r.movement_date || new Date().toISOString(),
                    notes: 'Importación inicial',
                }));
                created = await stockMovementService.createBatch(moves);
            }
            onImported?.({ created, errors: [] });
            setOpen(false);
        }
        catch (e) {
            setErrors([e.message || 'Error al importar inventario']);
        }
        finally {
            setIsProcessing(false);
        }
    };
    return (_jsxs("div", { children: [trigger ? (_jsx("div", { onClick: () => setOpen(true), children: trigger })) : (_jsx("button", { onClick: () => setOpen(true), className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700", children: "Importar Inventario Inicial" })), open && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Importar Inventario Inicial" }), _jsx("button", { className: "text-gray-500 hover:text-gray-700", onClick: () => setOpen(false), children: "\u00D7" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("label", { className: "text-sm font-medium", children: "Modo:" }), _jsxs("label", { className: "inline-flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'standard', onChange: () => setMode('standard') }), _jsx("span", { children: "Est\u00E1ndar (por cantidad)" })] }), _jsxs("label", { className: "inline-flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'serialized', onChange: () => setMode('serialized') }), _jsx("span", { children: "Serializado (por unidad)" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200", onClick: downloadTemplate, children: "Descargar plantilla CSV" }), _jsxs("label", { className: "px-3 py-2 bg-white border rounded-md cursor-pointer hover:bg-gray-50", children: [_jsx("input", { type: "file", accept: ".csv", className: "hidden", onChange: (e) => setFile(e.target.files?.[0] || null) }), "Seleccionar archivo CSV"] }), _jsx("button", { disabled: !file || isProcessing, onClick: parseCSV, className: "px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50", children: "Validar" })] }), !!errors.length && (_jsxs("div", { className: "bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm", children: [_jsx("p", { className: "font-medium mb-1", children: "Errores de validaci\u00F3n:" }), _jsx("ul", { className: "list-disc pl-5 space-y-1 max-h-40 overflow-auto", children: errors.map((e, i) => _jsx("li", { children: e }, i)) })] })), !!preview.length && (_jsxs("div", { className: "border rounded p-3 max-h-60 overflow-auto text-sm", children: [_jsxs("p", { className: "font-medium mb-2", children: ["Vista previa (", preview.length, " filas)"] }), _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { children: _jsx("tr", { children: Object.keys(preview[0]).map((k) => (_jsx("th", { className: "text-left text-xs font-semibold text-gray-500 pr-4 py-1", children: k }, k))) }) }), _jsx("tbody", { children: preview.slice(0, 50).map((row, idx) => (_jsx("tr", { className: "border-t", children: Object.keys(preview[0]).map((k) => (_jsx("td", { className: "pr-4 py-1", children: String(row[k] ?? '') }, k))) }, idx))) })] }), preview.length > 50 && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Mostrando primeras 50 filas." }))] }))] }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { className: "px-3 py-2 bg-gray-200 rounded-md", onClick: () => setOpen(false), children: "Cancelar" }), _jsx("button", { disabled: !preview.length || isProcessing, onClick: doImport, className: "px-3 py-2 bg-green-600 text-white rounded-md disabled:opacity-50", children: isProcessing ? 'Importando...' : 'Importar' })] })] }) }))] }));
};
export default InventoryInitialImport;
