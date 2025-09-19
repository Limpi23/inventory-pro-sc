import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getSupabaseClient, warehousesService } from '../../lib/supabase';
export default function LocationImport({ onImportComplete, className, size = 'default' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [fileData, setFileData] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileData(e.target.files[0]);
            setUploadResult(null);
        }
    };
    const downloadTemplate = async () => {
        try {
            const XLSX = await import('xlsx');
            const header = [
                ['name', 'description', 'warehouse_id', 'active'],
            ];
            const rows = [
                ['Pasillo A - Estante 1', 'Zona frontal de la tienda', '', true],
                ['Bodega - Rack 2', 'Estante superior', '', true],
            ];
            const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_ubicaciones.xlsx');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        catch (e) {
            // Fallback: CSV
            const headers = 'name,description,warehouse_id,active\n';
            const sample = 'Pasillo A - Estante 1,Zona frontal de la tienda,,true\nBodega - Rack 2,Estante superior,,true\n';
            const csvContent = headers + sample;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_ubicaciones.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };
    const processFile = async () => {
        if (!fileData)
            return;
        setIsUploading(true);
        setUploadResult(null);
        try {
            const name = fileData.name.toLowerCase();
            let rows = [];
            if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                const XLSX = await import('xlsx');
                const buf = await fileData.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            }
            else if (name.endsWith('.csv')) {
                const Papa = await import('papaparse');
                const parseResult = await new Promise((resolve, reject) => {
                    Papa.parse(fileData, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results),
                        error: (error) => reject(error),
                    });
                });
                rows = parseResult.data || [];
            }
            else {
                throw new Error('Formato no soportado. Usa .xlsx, .xls o .csv');
            }
            // Mapear almacenes por nombre e id (para permitir warehouse o warehouse_id)
            const warehouses = await warehousesService.getAll();
            const byName = new Map();
            warehouses.forEach(w => { if (w.name)
                byName.set(w.name.toLowerCase(), w.id); });
            const supabase = await getSupabaseClient();
            const errors = [];
            const valid = [];
            let successCount = 0;
            for (let i = 0; i < rows.length; i++) {
                try {
                    const r = rows[i];
                    const name = (r.name || '').trim();
                    if (!name) {
                        errors.push(`Fila ${i + 2}: el nombre es obligatorio`);
                        continue;
                    }
                    let warehouse_id = (r.warehouse_id || '').trim() || null;
                    if (!warehouse_id && r.warehouse) {
                        const match = byName.get(String(r.warehouse).toLowerCase().trim());
                        if (match)
                            warehouse_id = match;
                    }
                    const active = String(r.active || 'true').toLowerCase();
                    const loc = {
                        name,
                        description: r.description ? String(r.description) : undefined,
                        warehouse_id,
                        active: active === 'true' || active === '1' || active === 'yes' || active === 'si',
                    };
                    valid.push(loc);
                }
                catch (e) {
                    errors.push(`Fila ${i + 2}: ${e.message || 'Error desconocido'}`);
                }
            }
            // Inserción por lotes
            for (let i = 0; i < valid.length; i += 100) {
                const batch = valid.slice(i, i + 100);
                try {
                    const { data, error } = await supabase
                        .from('locations')
                        .insert(batch)
                        .select('id');
                    if (error)
                        throw error;
                    successCount += (data?.length || 0);
                }
                catch (e) {
                    errors.push(e.message || 'Error al insertar lote');
                }
            }
            setUploadResult({ success: successCount, errors: errors.length, errorMessages: errors });
            if (successCount > 0)
                onImportComplete();
        }
        catch (e) {
            setUploadResult({ success: 0, errors: 1, errorMessages: [e.message || 'Error al procesar el archivo'] });
        }
        finally {
            setIsUploading(false);
        }
    };
    return (_jsxs(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { variant: "outline", size: size, className: className, children: "Importar Ubicaciones" }) }), _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Importar Ubicaciones" }) }), _jsxs("div", { className: "space-y-4 py-2", children: [_jsx("p", { className: "text-sm text-gray-500", children: "Sube un archivo con columnas: name, description, warehouse_id (opcional), active (true/false). Tambi\u00E9n puedes usar la columna \"warehouse\" con el nombre del almac\u00E9n." }), _jsx(Button, { variant: "outline", className: "w-full", onClick: downloadTemplate, children: "Descargar Plantilla Excel" }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsx("label", { htmlFor: "file-upload-locations", className: "text-sm font-medium", children: "Seleccionar archivo (.xlsx, .xls, .csv)" }), _jsx("input", { id: "file-upload-locations", type: "file", accept: ".xlsx,.xls,.csv", onChange: handleFileChange, className: "border border-gray-300 rounded-md p-2 text-sm" })] }), uploadResult && (_jsxs(Alert, { variant: uploadResult.success > 0 ? 'default' : 'destructive', children: [_jsx(AlertTitle, { children: "Resultado de la importaci\u00F3n" }), _jsxs(AlertDescription, { children: [_jsxs("p", { children: ["Ubicaciones importadas: ", uploadResult.success] }), _jsxs("p", { children: ["Errores: ", uploadResult.errors] }), uploadResult.errorMessages.length > 0 && (_jsx("div", { className: "mt-2", children: _jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer font-medium", children: "Ver detalles de errores" }), _jsx("ul", { className: "mt-2 text-xs pl-5 list-disc", children: uploadResult.errorMessages.map((msg, i) => (_jsx("li", { children: msg }, i))) })] }) }))] })] }))] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setIsOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: processFile, disabled: !fileData || isUploading, children: isUploading ? 'Importando...' : 'Importar' })] })] })] }));
}
