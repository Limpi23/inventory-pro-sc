import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { productService, locationsService } from "../../lib/supabase";
import Papa from 'papaparse';
const REQUIRED_COLUMNS = ['name'];
const OPTIONAL_BUT_VALIDATED_COLUMNS = ['sku', 'location', 'location_id', 'min_stock', 'max_stock', 'purchase_price', 'sale_price', 'tax_rate', 'status'];
const SUPPORTED_COLUMNS = Array.from(new Set([...REQUIRED_COLUMNS, ...OPTIONAL_BUT_VALIDATED_COLUMNS, 'description', 'barcode', 'category_id']));
const NUMBER_FIELDS = [
    { key: 'min_stock', label: 'Stock mínimo', allowEmpty: true, min: 0 },
    { key: 'max_stock', label: 'Stock máximo', allowEmpty: true, min: 0 },
    { key: 'purchase_price', label: 'Precio de compra', allowEmpty: true, min: 0 },
    { key: 'sale_price', label: 'Precio de venta', allowEmpty: true, min: 0 },
    { key: 'tax_rate', label: 'Impuesto', allowEmpty: true, min: 0 }
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ProductImport = ({ onImportComplete, className, size = 'default' }) => {
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
    const processCSV = async () => {
        if (!fileData)
            return;
        setIsUploading(true);
        setUploadResult(null);
        try {
            // Parsear el archivo CSV
            const parseResult = await new Promise((resolve, reject) => {
                Papa.parse(fileData, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => resolve(results),
                    error: (error) => reject(error)
                });
            });
            const parseErrors = (parseResult.errors || []).map((err) => {
                const rowInfo = typeof err.row === 'number' ? ` (fila aproximada ${err.row + 1})` : '';
                return `Error al leer el CSV${rowInfo}: ${err.message}`;
            }).filter(Boolean);
            const csvFields = parseResult.meta?.fields || [];
            const missingRequired = REQUIRED_COLUMNS.filter((column) => !csvFields.includes(column));
            const unknownColumns = csvFields.filter((column) => column && !SUPPORTED_COLUMNS.includes(column));
            const errors = [];
            if (missingRequired.length > 0) {
                errors.push(`Faltan columnas obligatorias: ${missingRequired.join(', ')}`);
            }
            if (unknownColumns.length > 0) {
                errors.push(`Columnas desconocidas en el CSV: ${unknownColumns.join(', ')}. Verifica que los encabezados coincidan con la plantilla.`);
            }
            if (parseErrors.length > 0) {
                errors.push(...parseErrors);
            }
            if (errors.length > 0) {
                setUploadResult({ success: 0, errors: errors.length, errorMessages: errors });
                return;
            }
            // Obtener SKUs ya existentes en la base de datos
            const existingProducts = await productService.getAll();
            // Cargar ubicaciones para mapear por nombre -> id si el archivo trae 'location'
            const allLocations = await locationsService.getAll();
            const locationByName = new Map();
            allLocations.forEach((l) => {
                if (l?.name)
                    locationByName.set(String(l.name).toLowerCase().trim(), l.id);
            });
            const existingSkus = new Set(existingProducts.map((p) => (p.sku || '').trim()).filter(Boolean));
            // Validar y procesar los datos
            const products = parseResult.data;
            const rowErrors = [];
            const validProducts = [];
            let successCount = 0;
            const seenSkus = new Set();
            for (let i = 0; i < products.length; i++) {
                try {
                    const row = products[i];
                    const sku = (row.sku || '').trim();
                    const name = (row.name || '').toString().trim();
                    const rowNumber = i + 2;
                    if (!name) {
                        rowErrors.push(`Fila ${rowNumber}: El nombre del producto es obligatorio.`);
                        continue;
                    }
                    // Validar duplicados en el archivo
                    if (sku && seenSkus.has(sku)) {
                        rowErrors.push(`Fila ${rowNumber}: SKU duplicado en el archivo: ${sku}`);
                        continue;
                    }
                    // Validar duplicados en la base de datos
                    if (sku && existingSkus.has(sku)) {
                        rowErrors.push(`Fila ${rowNumber}: SKU ya registrado en la base de datos: ${sku}`);
                        continue;
                    }
                    // Transformar los datos al formato esperado
                    let location_id = (row.location_id || '').trim() || null;
                    const locationName = row.location ? String(row.location).trim() : '';
                    if (location_id && !UUID_REGEX.test(location_id)) {
                        rowErrors.push(`Fila ${rowNumber}: El valor de location_id no es un UUID válido.`);
                        continue;
                    }
                    if (!location_id && row.location) {
                        const match = locationByName.get(locationName.toLowerCase());
                        if (match) {
                            location_id = match;
                        }
                        else {
                            rowErrors.push(`Fila ${rowNumber}: La ubicación "${locationName}" no existe en el sistema.`);
                            continue;
                        }
                    }
                    const numericValues = {};
                    let rowHasValidationError = false;
                    for (const field of NUMBER_FIELDS) {
                        const rawValue = row[field.key];
                        if (rawValue === undefined || rawValue === null || rawValue === '') {
                            if (!field.allowEmpty) {
                                rowErrors.push(`Fila ${rowNumber}: El campo ${field.label} es obligatorio.`);
                                rowHasValidationError = true;
                            }
                            numericValues[field.key] = field.allowEmpty ? null : 0;
                            continue;
                        }
                        const value = Number(String(rawValue).replace(/,/g, '.'));
                        if (Number.isNaN(value)) {
                            rowErrors.push(`Fila ${rowNumber}: El campo ${field.label} contiene un valor numérico inválido (${rawValue}).`);
                            rowHasValidationError = true;
                            continue;
                        }
                        if (field.min !== undefined && value < field.min) {
                            rowErrors.push(`Fila ${rowNumber}: El campo ${field.label} no puede ser menor que ${field.min}.`);
                            rowHasValidationError = true;
                            continue;
                        }
                        numericValues[field.key] = value;
                    }
                    const minStockValue = typeof numericValues.min_stock === 'number' ? numericValues.min_stock : 0;
                    const maxStockValue = typeof numericValues.max_stock === 'number' ? numericValues.max_stock : null;
                    if (maxStockValue !== null && maxStockValue < minStockValue) {
                        rowErrors.push(`Fila ${rowNumber}: El stock máximo no puede ser menor que el stock mínimo.`);
                        continue;
                    }
                    if (rowHasValidationError) {
                        continue;
                    }
                    const productData = {
                        name,
                        description: row.description || '',
                        sku: sku,
                        barcode: row.barcode || '',
                        category_id: row.category_id || null,
                        location_id,
                        min_stock: numericValues.min_stock ?? 0,
                        max_stock: numericValues.max_stock,
                        purchase_price: numericValues.purchase_price ?? 0,
                        sale_price: numericValues.sale_price ?? 0,
                        tax_rate: numericValues.tax_rate ?? 0,
                        status: row.status || 'active'
                    };
                    validProducts.push({ rowNumber, data: productData, sku });
                    if (sku) {
                        seenSkus.add(sku);
                    }
                }
                catch (error) {
                    rowErrors.push(`Fila ${i + 2}: ${error?.message || 'Error desconocido procesando la fila.'}`);
                }
            }
            // Intentar crear todos los productos en lote
            if (validProducts.length > 0) {
                for (const entry of validProducts) {
                    try {
                        await productService.create(entry.data);
                        successCount += 1;
                        if (entry.data.sku) {
                            existingSkus.add(entry.data.sku);
                        }
                    }
                    catch (error) {
                        const messageParts = [error?.message, error?.details, error?.hint].filter(Boolean).map((part) => part.trim());
                        const formatted = messageParts.length > 0 ? messageParts.join(' - ') : 'Error desconocido al crear el producto.';
                        const skuInfo = entry.sku ? ` (SKU ${entry.sku})` : '';
                        rowErrors.push(`Fila ${entry.rowNumber}${skuInfo}: ${formatted}`);
                    }
                }
            }
            setUploadResult({
                success: successCount,
                errors: rowErrors.length,
                errorMessages: rowErrors
            });
            if (successCount > 0) {
                onImportComplete();
            }
        }
        catch (error) {
            setUploadResult({
                success: 0,
                errors: 1,
                errorMessages: [error.message || 'Error al procesar el archivo']
            });
        }
        finally {
            setIsUploading(false);
        }
    };
    const downloadTemplate = () => {
        const headers = "name,description,sku,barcode,category_id,location_id,location,min_stock,max_stock,purchase_price,sale_price,tax_rate,status\n";
        const sampleData = "Producto 1,Descripción del producto 1,ABC123,123456789,9e91d103-7c4c-472d-9566-981274a13ff4,,Pasillo A - Estante 1,10,100,15000,20000,19,active\n" +
            "Producto 2,Descripción del producto 2,DEF456,987654321,,,Bodega - Rack 2,5,50,25000,35000,19,active\n";
        const csvContent = headers + sampleData;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'plantilla_productos.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    return (_jsxs(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: size, className: className, children: [_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", fill: "currentColor", className: "mr-2", viewBox: "0 0 16 16", children: [_jsx("path", { d: "M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" }), _jsx("path", { d: "M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" })] }), "Importar Productos"] }) }), _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Importar Productos Masivamente" }) }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsx("p", { className: "text-sm text-gray-500", children: "Sube un archivo CSV con los productos que deseas importar. Aseg\u00FArate de que el archivo tenga las columnas correctas." }), _jsx(Button, { variant: "outline", onClick: downloadTemplate, className: "w-full", children: "Descargar Plantilla CSV" }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsx("label", { htmlFor: "file-upload", className: "text-sm font-medium", children: "Seleccionar archivo CSV" }), _jsx("input", { id: "file-upload", type: "file", accept: ".csv", onChange: handleFileChange, className: "border border-gray-300 rounded-md p-2 text-sm" })] }), uploadResult && (_jsxs(Alert, { variant: uploadResult.success > 0 ? "default" : "destructive", children: [_jsx(AlertTitle, { children: "Resultado de la importaci\u00F3n" }), _jsxs(AlertDescription, { children: [_jsxs("p", { children: ["Productos importados: ", uploadResult.success] }), _jsxs("p", { children: ["Errores: ", uploadResult.errors] }), uploadResult.errorMessages.length > 0 && (_jsx("div", { className: "mt-2", children: _jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer font-medium", children: "Ver detalles de errores" }), _jsx("ul", { className: "mt-2 text-xs pl-5 list-disc", children: uploadResult.errorMessages.map((error, index) => (_jsx("li", { children: error }, index))) })] }) }))] })] }))] }), _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "outline", onClick: () => setIsOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: processCSV, disabled: !fileData || isUploading, children: isUploading ? 'Importando...' : 'Importar Productos' })] })] })] }));
};
export default ProductImport;
