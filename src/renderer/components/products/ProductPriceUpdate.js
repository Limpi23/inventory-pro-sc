import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { productService } from '../../lib/supabase';
import Papa from 'papaparse';
const ProductPriceUpdate = ({ open, onClose, onUpdateComplete }) => {
    const [fileData, setFileData] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState(null);
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileData(e.target.files[0]);
            setResult(null);
        }
    };
    const downloadTemplate = async () => {
        // Obtener productos actuales
        const products = await productService.getAll();
        const headers = 'sku,precio_compra,precio_venta\n';
        const rows = products.map((p) => `${p.sku || ''},,`).join('\n');
        const csvContent = headers + rows;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'plantilla_actualizacion_precios.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const processCSV = async () => {
        if (!fileData)
            return;
        setIsUploading(true);
        setResult(null);
        try {
            const parseResult = await new Promise((resolve, reject) => {
                Papa.parse(fileData, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => resolve(results),
                    error: (error) => reject(error)
                });
            });
            const products = await productService.getAll();
            const skuMap = new Map(products.map((p) => [(p.sku || '').trim(), p]));
            const updates = [];
            const errors = [];
            let successCount = 0;
            for (let i = 0; i < parseResult.data.length; i++) {
                const row = parseResult.data[i];
                const sku = (row.sku || '').trim();
                const compra = row.precio_compra;
                const venta = row.precio_venta;
                if (!sku) {
                    errors.push(`Fila ${i + 2}: El código (SKU) es obligatorio.`);
                    continue;
                }
                if (!skuMap.has(sku)) {
                    errors.push(`Fila ${i + 2}: El código (SKU) ${sku} no existe.`);
                    continue;
                }
                // Validar formato decimal 0.00
                const decimalRegex = /^\d+(\.\d{1,2})?$/;
                if (compra && !decimalRegex.test(compra)) {
                    errors.push(`Fila ${i + 2}: El precio de compra debe tener formato 0.00`);
                    continue;
                }
                if (venta && !decimalRegex.test(venta)) {
                    errors.push(`Fila ${i + 2}: El precio de venta debe tener formato 0.00`);
                    continue;
                }
                updates.push({ sku, compra: compra ? parseFloat(compra) : null, venta: venta ? parseFloat(venta) : null });
            }
            // Actualizar productos
            for (const upd of updates) {
                try {
                    const prod = skuMap.get(upd.sku);
                    const updateData = {};
                    if (upd.compra !== null)
                        updateData.purchase_price = upd.compra;
                    if (upd.venta !== null)
                        updateData.sale_price = upd.venta;
                    if (Object.keys(updateData).length > 0) {
                        await productService.update(prod.id, updateData);
                        successCount++;
                    }
                }
                catch (e) {
                    errors.push(`SKU ${upd.sku}: Error al actualizar (${e.message || 'Error desconocido'})`);
                }
            }
            setResult({ success: successCount, errors: errors.length, errorMessages: errors });
            if (successCount > 0)
                onUpdateComplete();
        }
        catch (error) {
            setResult({ success: 0, errors: 1, errorMessages: [error.message || 'Error al procesar el archivo'] });
        }
        finally {
            setIsUploading(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Actualizar Precios Masivos" }) }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsx("p", { className: "text-sm text-gray-500", children: "Descarga la plantilla, ed\u00EDtala con los nuevos precios y vuelve a subirla. Solo se actualizar\u00E1n los productos cuyo c\u00F3digo (SKU) exista." }), _jsx(Button, { variant: "outline", onClick: downloadTemplate, className: "w-full", children: "Descargar Plantilla CSV" }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsx("label", { htmlFor: "file-upload-precios", className: "text-sm font-medium", children: "Seleccionar archivo CSV" }), _jsx("input", { id: "file-upload-precios", type: "file", accept: ".csv", onChange: handleFileChange, className: "border border-gray-300 rounded-md p-2 text-sm" })] }), result && (_jsxs(Alert, { variant: result.success > 0 ? 'default' : 'destructive', children: [_jsx(AlertTitle, { children: "Resultado de la actualizaci\u00F3n" }), _jsxs(AlertDescription, { children: [_jsxs("p", { children: ["Productos actualizados: ", result.success] }), _jsxs("p", { children: ["Errores: ", result.errors] }), result.errorMessages.length > 0 && (_jsx("div", { className: "mt-2", children: _jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer font-medium", children: "Ver detalles de errores" }), _jsx("ul", { className: "mt-2 text-xs pl-5 list-disc", children: result.errorMessages.map((error, index) => (_jsx("li", { children: error }, index))) })] }) }))] })] }))] }), _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "outline", onClick: onClose, children: "Cancelar" }), _jsx(Button, { onClick: processCSV, disabled: !fileData || isUploading, children: isUploading ? 'Actualizando...' : 'Actualizar Precios' })] })] }) }));
};
export default ProductPriceUpdate;
