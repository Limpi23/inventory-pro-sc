import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
const PurchaseOrderItemsImport = ({ products, onImport, className, size = 'default', disabled }) => {
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
            const header = [['sku', 'quantity', 'unit_price']];
            const rows = [
                ['ABC123', 5, 15000],
                ['DEF456', 2, 25000]
            ];
            const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_items_orden_compra.xlsx');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        catch (e) {
            // Fallback a CSV si no está disponible xlsx
            const headers = "sku,quantity,unit_price\n";
            const sample = "ABC123,5,15000\nDEF456,2,25000\n";
            const csv = headers + sample;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_items_orden_compra.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    const processCSV = async () => {
        if (!fileData)
            return;
        setIsUploading(true);
        setUploadResult(null);
        try {
            let rows = [];
            const name = (fileData.name || '').toLowerCase();
            if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                const XLSX = await import('xlsx');
                const buf = await fileData.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            }
            else {
                const parseResult = await new Promise((resolve, reject) => {
                    Papa.parse(fileData, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results),
                        error: (error) => reject(error)
                    });
                });
                rows = parseResult.data;
            }
            const productsBySku = new Map();
            for (const p of products) {
                if (p.sku)
                    productsBySku.set(String(p.sku).trim().toLowerCase(), p);
            }
            const errors = [];
            const aggregated = new Map();
            rows.forEach((row, idx) => {
                const line = idx + 2; // considering header
                const rawSku = (row.sku ?? '').toString().trim();
                if (!rawSku) {
                    errors.push(`Fila ${line}: Falta sku`);
                    return;
                }
                const skuKey = rawSku.toLowerCase();
                const found = productsBySku.get(skuKey);
                if (!found) {
                    errors.push(`Fila ${line}: SKU no encontrado en catálogo: ${rawSku}`);
                    return;
                }
                const qtyNum = Number(row.quantity);
                if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
                    errors.push(`Fila ${line}: Cantidad inválida: ${row.quantity}`);
                    return;
                }
                const unit = row.unit_price !== undefined && row.unit_price !== '' ? Number(row.unit_price) : (found.purchase_price ?? 0);
                if (!Number.isFinite(unit) || unit < 0) {
                    errors.push(`Fila ${line}: Precio unitario inválido: ${row.unit_price}`);
                    return;
                }
                const existing = aggregated.get(found.id);
                if (existing) {
                    existing.quantity += qtyNum;
                    existing.unit_price = unit; // última define
                }
                else {
                    aggregated.set(found.id, {
                        product_id: found.id,
                        product_name: found.name,
                        product_sku: found.sku,
                        quantity: qtyNum,
                        unit_price: unit
                    });
                }
            });
            const items = Array.from(aggregated.values());
            setUploadResult({
                success: items.length,
                errors: errors.length,
                errorMessages: errors
            });
            if (items.length > 0) {
                onImport(items);
            }
        }
        catch (error) {
            setUploadResult({ success: 0, errors: 1, errorMessages: [error.message || 'Error al procesar el archivo'] });
        }
        finally {
            setIsUploading(false);
        }
    };
    return (_jsxs(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: size, className: className, disabled: disabled, children: [_jsx("i", { className: "fas fa-file-upload mr-2" }), " Importar CSV"] }) }), _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Importar Productos a la Orden" }) }), _jsxs("div", { className: "space-y-4 py-2", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Formato: sku, quantity, unit_price (opcional). Si no incluyes unit_price, se usa el precio de compra del producto." }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "outline", onClick: downloadTemplate, children: "Descargar plantilla" }) }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsx("label", { htmlFor: "file-upload-po", className: "text-sm font-medium", children: "Archivo Excel o CSV" }), _jsx("input", { id: "file-upload-po", type: "file", accept: ".xlsx,.xls,.csv", onChange: handleFileChange, className: "border border-gray-300 rounded-md p-2 text-sm" })] }), uploadResult && (_jsxs(Alert, { variant: uploadResult.success > 0 ? 'default' : 'destructive', children: [_jsx(AlertTitle, { children: "Resumen" }), _jsxs(AlertDescription, { children: [_jsxs("p", { children: ["Items v\u00E1lidos: ", uploadResult.success] }), _jsxs("p", { children: ["Errores: ", uploadResult.errors] }), uploadResult.errorMessages.length > 0 && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "cursor-pointer font-medium", children: "Ver detalles" }), _jsx("ul", { className: "mt-2 text-xs pl-5 list-disc", children: uploadResult.errorMessages.map((e, i) => (_jsx("li", { children: e }, i))) })] }))] })] }))] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setIsOpen(false), children: "Cerrar" }), _jsx(Button, { onClick: processCSV, disabled: !fileData || isUploading, children: isUploading ? 'Procesando…' : 'Importar' })] })] })] }));
};
export default PurchaseOrderItemsImport;
