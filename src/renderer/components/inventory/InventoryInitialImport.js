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
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState(null);
    const [errors, setErrors] = useState([]);
    const [preview, setPreview] = useState([]);
    const [mode, setMode] = useState('standard');
    const templateData = useMemo(() => {
        if (mode === 'serialized') {
            const header = ['sku', 'serial_code', 'vin', 'engine_number', 'year', 'color', 'warehouse', 'location', 'acquired_at', 'reference'];
            const sample = ['DE191033', 'ABC12345', '1HGBH41JXMN109186', 'ENG987654', '2024', 'Negro', 'Almacen Central', 'Pasillo A - Estante 1', '2025-09-01', 'Importación inicial'];
            return {
                aoa: [header, sample],
                csv: `${header.join(',')}\n${sample.join(',')}`,
                filename: 'plantilla_inventario_inicial_serial',
            };
        }
        const header = ['sku', 'warehouse', 'location', 'quantity', 'reference', 'movement_date'];
        const sample = ['DE191033', 'Almacen Central', 'Pasillo A - Estante 1', '3', 'Inventario inicial', '2025-09-01'];
        return {
            aoa: [header, sample],
            csv: `${header.join(',')}\n${sample.join(',')}`,
            filename: 'plantilla_inventario_inicial',
        };
    }, [mode]);
    const downloadTemplate = async () => {
        try {
            const XLSX = await import('xlsx');
            const ws = XLSX.utils.aoa_to_sheet(templateData.aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
            XLSX.writeFile(wb, `${templateData.filename}.xlsx`);
        }
        catch (err) {
            console.warn('xlsx no disponible, exportando CSV', err);
            const blob = new Blob([templateData.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${templateData.filename}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };
    const parseFile = async () => {
        if (!file)
            return;
        setProgress(0);
        setProgressMessage(null);
        setIsProcessing(true);
        setErrors([]);
        setPreview([]);
        try {
            const filename = file.name?.toLowerCase() || '';
            let rows = [];
            if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
                const XLSX = await import('xlsx');
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
            }
            else if (filename.endsWith('.csv')) {
                const results = await new Promise((resolve, reject) => {
                    Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
                });
                rows = results.data;
            }
            else {
                throw new Error('Formato no soportado. Usa un archivo .xlsx, .xls o .csv');
            }
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
            const normalizeRow = (input) => {
                return Object.entries(input || {}).reduce((acc, [key, value]) => {
                    const cleanKey = String(key || '').trim().toLowerCase();
                    if (!cleanKey)
                        return acc;
                    acc[cleanKey] = value;
                    return acc;
                }, {});
            };
            const coerceDate = (value) => {
                const toResult = (date) => {
                    if (!date || isNaN(date.getTime()))
                        return null;
                    const iso = date.toISOString();
                    return { iso, dateOnly: iso.slice(0, 10) };
                };
                if (!value)
                    return null;
                if (value instanceof Date) {
                    return toResult(value);
                }
                if (typeof value === 'number') {
                    const excelEpoch = Date.UTC(1899, 11, 30);
                    const millis = excelEpoch + value * 24 * 60 * 60 * 1000;
                    return toResult(new Date(millis));
                }
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (!trimmed)
                        return null;
                    const isoCandidate = new Date(trimmed);
                    if (!isNaN(isoCandidate.getTime()))
                        return toResult(isoCandidate);
                    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (match) {
                        const [, day, month, year] = match;
                        return toResult(new Date(Number(year), Number(month) - 1, Number(day)));
                    }
                }
                return null;
            };
            const sanitizeRows = rows
                .map((row) => ({ original: row, normalized: normalizeRow(row) }))
                .filter(({ normalized }) => Object.values(normalized).some((value) => String(value ?? '').trim().length));
            if (!sanitizeRows.length) {
                setErrors(['El archivo está vacío o no pudimos leer filas válidas.']);
                return;
            }
            const headerSet = new Set();
            sanitizeRows.forEach(({ normalized }) => {
                Object.keys(normalized).forEach((key) => {
                    if (key)
                        headerSet.add(key);
                });
            });
            const formatErrors = [];
            const ensureColumns = (columns, modeLabel) => {
                const missing = columns.filter((col) => !headerSet.has(col));
                if (missing.length) {
                    formatErrors.push(`Faltan columnas obligatorias para el modo ${modeLabel}: ${missing.map((col) => `“${col}”`).join(', ')}.`);
                }
            };
            const ensureAny = (columns, message) => {
                if (!columns.some((col) => headerSet.has(col))) {
                    formatErrors.push(message);
                }
            };
            if (mode === 'serialized') {
                ensureColumns(['sku', 'serial_code'], 'serializado');
                ensureAny(['warehouse', 'warehouse_id'], 'Agrega la columna “warehouse” o “warehouse_id” para indicar el almacén.');
            }
            else {
                ensureColumns(['sku', 'quantity'], 'estándar');
                ensureAny(['warehouse', 'warehouse_id'], 'Agrega la columna “warehouse” o “warehouse_id” para indicar el almacén.');
            }
            if (formatErrors.length) {
                setErrors(formatErrors);
                return;
            }
            if (mode === 'serialized') {
                for (let i = 0; i < sanitizeRows.length; i++) {
                    const { normalized: r, original } = sanitizeRows[i];
                    const rowNumber = i + 2;
                    const rawSku = String(r.sku ?? '').trim();
                    if (!rawSku) {
                        errs.push(`Fila ${rowNumber}: "sku" requerido.`);
                        continue;
                    }
                    const sku = rawSku.toLowerCase();
                    const product = bySku.get(sku);
                    const displaySku = (original?.sku ?? original?.SKU ?? r.sku ?? '').toString().trim();
                    if (!product) {
                        errs.push(`Fila ${rowNumber}: SKU no encontrado: ${displaySku || rawSku}`);
                        continue;
                    }
                    let warehouse_id = null;
                    let location_id = null;
                    const warehouseIdRaw = r.warehouse_id;
                    if (warehouseIdRaw !== undefined && warehouseIdRaw !== null && String(warehouseIdRaw).trim() !== '') {
                        const parsed = Number(warehouseIdRaw);
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                            errs.push(`Fila ${rowNumber}: "warehouse_id" debe ser un número válido.`);
                            continue;
                        }
                        warehouse_id = parsed;
                    }
                    else {
                        warehouse_id = whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
                    }
                    if (!warehouse_id) {
                        errs.push(`Fila ${rowNumber}: almacén requerido`);
                        continue;
                    }
                    const locationIdRaw = r.location_id;
                    if (locationIdRaw !== undefined && locationIdRaw !== null && String(locationIdRaw).trim() !== '') {
                        const parsedLoc = Number(locationIdRaw);
                        if (!Number.isFinite(parsedLoc) || parsedLoc <= 0) {
                            errs.push(`Fila ${rowNumber}: "location_id" debe ser un número válido.`);
                            continue;
                        }
                        location_id = parsedLoc;
                    }
                    else {
                        location_id = locByName.get(String(r.location || '').trim().toLowerCase()) || null;
                    }
                    const serial_code = String(r.serial_code || '').trim();
                    if (!serial_code) {
                        errs.push(`Fila ${rowNumber}: serial_code requerido`);
                        continue;
                    }
                    let year = null;
                    if (r.year !== undefined && String(r.year ?? '').trim() !== '') {
                        const parsedYear = Number(r.year);
                        if (!Number.isFinite(parsedYear)) {
                            errs.push(`Fila ${rowNumber}: "year" debe ser numérico.`);
                            continue;
                        }
                        year = parsedYear;
                    }
                    const parsedAcquired = coerceDate(r.acquired_at);
                    if (r.acquired_at && !parsedAcquired) {
                        errs.push(`Fila ${rowNumber}: "acquired_at" no tiene un formato de fecha válido.`);
                        continue;
                    }
                    const row = {
                        product_id: product.id,
                        product_sku: product.sku ?? rawSku,
                        product_name: product.name ?? (displaySku || rawSku),
                        warehouse_id,
                        location_id,
                        serial_code,
                        vin: r.vin || null,
                        engine_number: r.engine_number || null,
                        year,
                        color: r.color || null,
                        acquired_at: parsedAcquired?.iso || new Date().toISOString(),
                        reference: r.reference || 'INICIAL',
                    };
                    out.push(row);
                }
            }
            else {
                for (let i = 0; i < sanitizeRows.length; i++) {
                    const { normalized: r, original } = sanitizeRows[i];
                    const rowNumber = i + 2;
                    const rawSku = String(r.sku ?? '').trim();
                    if (!rawSku) {
                        errs.push(`Fila ${rowNumber}: "sku" requerido.`);
                        continue;
                    }
                    const sku = rawSku.toLowerCase();
                    const product = bySku.get(sku);
                    const displaySku = (original?.sku ?? original?.SKU ?? r.sku ?? '').toString().trim();
                    if (!product) {
                        errs.push(`Fila ${rowNumber}: SKU no encontrado: ${displaySku || rawSku}`);
                        continue;
                    }
                    let warehouse_id = null;
                    const warehouseIdRaw = r.warehouse_id;
                    if (warehouseIdRaw !== undefined && warehouseIdRaw !== null && String(warehouseIdRaw).trim() !== '') {
                        const parsed = Number(warehouseIdRaw);
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                            errs.push(`Fila ${rowNumber}: "warehouse_id" debe ser un número válido.`);
                            continue;
                        }
                        warehouse_id = parsed;
                    }
                    else {
                        warehouse_id = whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
                    }
                    if (!warehouse_id) {
                        errs.push(`Fila ${rowNumber}: almacén requerido`);
                        continue;
                    }
                    let location_id = null;
                    const locationIdRaw = r.location_id;
                    if (locationIdRaw !== undefined && locationIdRaw !== null && String(locationIdRaw).trim() !== '') {
                        const parsedLoc = Number(locationIdRaw);
                        if (!Number.isFinite(parsedLoc) || parsedLoc <= 0) {
                            errs.push(`Fila ${rowNumber}: "location_id" debe ser un número válido.`);
                            continue;
                        }
                        location_id = parsedLoc;
                    }
                    else {
                        location_id = locByName.get(String(r.location || '').trim().toLowerCase()) || null;
                    }
                    const quantityRaw = r.quantity;
                    const quantity = Number(quantityRaw);
                    if (!Number.isFinite(quantity) || quantity <= 0) {
                        errs.push(`Fila ${rowNumber}: "quantity" debe ser un número mayor que 0.`);
                        continue;
                    }
                    const parsedMovementDate = coerceDate(r.movement_date);
                    if (r.movement_date && !parsedMovementDate) {
                        errs.push(`Fila ${rowNumber}: "movement_date" no tiene un formato de fecha válido.`);
                        continue;
                    }
                    const movement_date = parsedMovementDate?.dateOnly || new Date().toISOString().slice(0, 10);
                    out.push({
                        product_id: product.id,
                        product_sku: product.sku ?? rawSku,
                        product_name: product.name ?? (displaySku || rawSku),
                        warehouse_id,
                        location_id,
                        quantity,
                        reference: r.reference || 'INICIAL',
                        movement_date,
                    });
                }
            }
            setPreview(out);
            setErrors(errs);
        }
        catch (e) {
            setErrors([e.message || 'Error al procesar el archivo']);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleFileChange = (event) => {
        const nextFile = event.target.files?.[0] || null;
        setFile(nextFile);
        setPreview([]);
        setErrors([]);
        setProgress(0);
        setProgressMessage(null);
    };
    const doImport = async () => {
        if (!preview.length)
            return;
        setProgress(0);
        setProgressMessage('Preparando importación...');
        setIsProcessing(true);
        setErrors([]);
        try {
            const typeId = await stockMovementService.getInboundInitialTypeId();
            let created = 0;
            if (mode === 'serialized') {
                setProgressMessage('Creando seriales...');
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
                const inserted = await serialsService.createMany(serials, {
                    onProgress: (processed, total) => {
                        if (total > 0) {
                            const percent = Math.round((processed / total) * 50);
                            setProgress(percent);
                        }
                        else {
                            setProgress(50);
                        }
                    },
                });
                const byCode = new Map(inserted.map((s) => [s.serial_code, s]));
                setProgressMessage('Generando movimientos...');
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
                created = await stockMovementService.createBatch(moves, {
                    onProgress: (processed, total) => {
                        if (total > 0) {
                            const percent = 50 + Math.round((processed / total) * 50);
                            setProgress(Math.min(100, percent));
                        }
                        else {
                            setProgress(100);
                        }
                    },
                });
            }
            else {
                setProgressMessage('Generando movimientos...');
                const moves = preview.map((r) => ({
                    product_id: r.product_id,
                    warehouse_id: r.warehouse_id,
                    location_id: r.location_id || null,
                    quantity: r.quantity,
                    movement_type_id: typeId,
                    reference: r.reference || 'INICIAL',
                    related_id: null,
                    movement_date: r.movement_date || new Date().toISOString().slice(0, 10),
                    notes: 'Importación inicial',
                }));
                created = await stockMovementService.createBatch(moves, {
                    onProgress: (processed, total) => {
                        if (total > 0) {
                            const percent = Math.round((processed / total) * 100);
                            setProgress(percent);
                        }
                        else {
                            setProgress(100);
                        }
                    },
                });
            }
            setProgress(100);
            setProgressMessage('Importación completada');
            onImported?.({ created, errors: [] });
            setFile(null);
            setPreview([]);
            setErrors([]);
            setOpen(false);
        }
        catch (e) {
            setErrors([e.message || 'Error al importar inventario']);
        }
        finally {
            setIsProcessing(false);
            setTimeout(() => {
                setProgress(0);
                setProgressMessage(null);
            }, 300);
        }
    };
    return (_jsxs("div", { children: [trigger ? (_jsx("div", { onClick: () => setOpen(true), children: trigger })) : (_jsx("button", { onClick: () => setOpen(true), className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700", children: "Importar Inventario Inicial" })), open && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Importar Inventario Inicial" }), _jsx("button", { className: "text-gray-500 hover:text-gray-700", onClick: () => setOpen(false), children: "\u00D7" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("label", { className: "text-sm font-medium", children: "Modo:" }), _jsxs("label", { className: "inline-flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'standard', onChange: () => setMode('standard') }), _jsx("span", { children: "Est\u00E1ndar (por cantidad)" })] }), _jsxs("label", { className: "inline-flex items-center gap-2", children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'serialized', onChange: () => setMode('serialized') }), _jsx("span", { children: "Serializado (por unidad)" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200", onClick: downloadTemplate, children: "Descargar plantilla Excel" }), _jsxs("label", { className: "px-3 py-2 bg-white border rounded-md cursor-pointer hover:bg-gray-50", children: [_jsx("input", { type: "file", accept: ".xlsx,.xls,.csv", className: "hidden", onChange: handleFileChange }), "Seleccionar archivo (.xlsx / .xls / .csv)"] }), _jsx("button", { disabled: !file || isProcessing, onClick: parseFile, className: "px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50", children: "Validar" })] }), _jsx("p", { className: "text-xs text-gray-500", children: mode === 'serialized'
                                        ? 'En la columna “acquired_at” usa la fecha en la que se recibió cada unidad (formato YYYY-MM-DD o dd/mm/aaaa). Si la dejas vacía registraremos la fecha de hoy.'
                                        : 'En la columna “movement_date” usa la fecha en la que el stock entró al inventario (formato YYYY-MM-DD o dd/mm/aaaa). Si la dejas vacía registraremos la fecha de hoy.' }), isProcessing && progressMessage && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-gray-500", children: [_jsx("span", { children: progressMessage }), _jsx("span", { children: `${Math.min(progress, 100)}%` })] }), _jsx("div", { className: "h-2 w-full rounded-full bg-gray-100", children: _jsx("div", { className: "h-2 rounded-full bg-indigo-600 transition-all", style: { width: `${Math.min(progress, 100)}%` } }) })] })), !!errors.length && (_jsxs("div", { className: "bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm", children: [_jsx("p", { className: "font-medium mb-1", children: "Errores de validaci\u00F3n:" }), _jsx("ul", { className: "list-disc pl-5 space-y-1 max-h-40 overflow-auto", children: errors.map((e, i) => _jsx("li", { children: e }, i)) })] })), !!preview.length && (_jsxs("div", { className: "border rounded p-3 max-h-60 overflow-auto text-sm", children: [_jsxs("p", { className: "font-medium mb-2", children: ["Vista previa (", preview.length, " filas)"] }), _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { children: _jsx("tr", { children: Object.keys(preview[0]).map((k) => (_jsx("th", { className: "text-left text-xs font-semibold text-gray-500 pr-4 py-1", children: k }, k))) }) }), _jsx("tbody", { children: preview.slice(0, 50).map((row, idx) => (_jsx("tr", { className: "border-t", children: Object.keys(preview[0]).map((k) => (_jsx("td", { className: "pr-4 py-1", children: String(row[k] ?? '') }, k))) }, idx))) })] }), preview.length > 50 && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Mostrando primeras 50 filas." }))] }))] }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { className: "px-3 py-2 bg-gray-200 rounded-md", onClick: () => setOpen(false), children: "Cancelar" }), _jsx("button", { disabled: !preview.length || isProcessing, onClick: doImport, className: "px-3 py-2 bg-green-600 text-white rounded-md disabled:opacity-50", children: isProcessing ? 'Importando...' : 'Importar' })] })] }) }))] }));
};
export default InventoryInitialImport;
