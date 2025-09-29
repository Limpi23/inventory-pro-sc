import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { productService, locationsService, categoriesService } from "../../lib/supabase";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
const REQUIRED_COLUMNS = ['name'];
const OPTIONAL_BUT_VALIDATED_COLUMNS = ['sku', 'category', 'category_id', 'location', 'location_id', 'min_stock', 'max_stock', 'purchase_price', 'sale_price', 'tax_rate', 'status'];
const SUPPORTED_COLUMNS = [...new Set([...REQUIRED_COLUMNS, ...OPTIONAL_BUT_VALIDATED_COLUMNS, 'description', 'barcode'])];
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
    const parseFile = async (file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'csv') {
            const parseResult = await new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => resolve(results),
                    error: (error) => reject(error)
                });
            });
            const parseErrors = (parseResult.errors || []).map((err) => {
                const rowInfo = typeof err.row === 'number' ? ` (fila aproximada ${err.row + 1})` : '';
                return `Error al leer el archivo${rowInfo}: ${err.message}`;
            }).filter(Boolean);
            return {
                rows: parseResult.data,
                fields: parseResult.meta?.fields || [],
                errors: parseErrors
            };
        }
        if (extension === 'xlsx' || extension === 'xls') {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return { rows: [], fields: [], errors: ['El archivo Excel no contiene hojas válidas.'] };
            }
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: false });
            const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
            return { rows, fields, errors: [] };
        }
        return { rows: [], fields: [], errors: ['Formato de archivo no soportado. Usa CSV o Excel (.xlsx).'] };
    };
    const processCSV = async () => {
        if (!fileData)
            return;
        setIsUploading(true);
        setUploadResult(null);
        try {
            const { rows, fields, errors: parseErrors } = await parseFile(fileData);
            const missingRequired = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
            const unknownColumns = fields.filter((column) => column && !SUPPORTED_COLUMNS.includes(column));
            const errors = [];
            if (missingRequired.length > 0) {
                errors.push(`Faltan columnas obligatorias: ${missingRequired.join(', ')}`);
            }
            if (unknownColumns.length > 0) {
                errors.push(`Columnas desconocidas en el archivo: ${unknownColumns.join(', ')}. Verifica que los encabezados coincidan con la plantilla.`);
            }
            if (parseErrors.length > 0) {
                errors.push(...parseErrors);
            }
            if (errors.length > 0) {
                setUploadResult({ success: 0, errors: errors.length, errorMessages: errors });
                return;
            }
            // Obtener todos los SKUs ya existentes en la base de datos (en lotes)
            const existingProducts = await (productService.getAllAll ? productService.getAllAll() : productService.getAll());
            // Cargar categorías y ubicaciones para mapear por nombre
            const [allCategories, allLocations] = await Promise.all([
                categoriesService.getAll(),
                locationsService.getAll()
            ]);
            const categoryById = new Set(allCategories.map((c) => c.id));
            const categoryByName = new Map();
            allCategories.forEach((c) => {
                if (c?.name)
                    categoryByName.set(String(c.name).toLowerCase().trim(), c.id);
            });
            const locationByName = new Map();
            allLocations.forEach((l) => {
                if (l?.name)
                    locationByName.set(String(l.name).toLowerCase().trim(), l.id);
            });
            const locationIds = new Set(allLocations.map((l) => l.id));
            const existingSkus = new Set(existingProducts.map((p) => (p.sku || '').trim()).filter(Boolean));
            // Validar y procesar los datos
            const products = rows;
            const validProducts = [];
            let successCount = 0;
            const seenSkus = new Set();
            for (let i = 0; i < products.length; i++) {
                try {
                    const row = products[i];
                    const sku = (row.sku || '').trim();
                    const name = (row.name || '').toString().trim();
                    const rowNumber = i + 2; // header is row 1
                    if (!name) {
                        errors.push(`Fila ${rowNumber}: El nombre del producto es obligatorio.`);
                        continue;
                    }
                    // Validar duplicados en el archivo
                    if (sku && seenSkus.has(sku)) {
                        errors.push(`Fila ${rowNumber}: SKU duplicado en el archivo: ${sku}`);
                        continue;
                    }
                    // Validar duplicados en la base de datos
                    if (sku && existingSkus.has(sku)) {
                        errors.push(`Fila ${rowNumber}: SKU ya registrado en la base de datos: ${sku}`);
                        continue;
                    }
                    // Transformar los datos al formato esperado
                    const rawCategoryId = (row.category_id || '').trim();
                    const rawCategoryName = (row.category || '').toString().trim();
                    let category_id = null;
                    if (rawCategoryId) {
                        if (UUID_REGEX.test(rawCategoryId)) {
                            if (!categoryById.has(rawCategoryId)) {
                                errors.push(`Fila ${rowNumber}: La categoría con id ${rawCategoryId} no existe en el sistema.`);
                                continue;
                            }
                            category_id = rawCategoryId;
                        }
                        else {
                            const match = categoryByName.get(rawCategoryId.toLowerCase());
                            if (match) {
                                category_id = match;
                            }
                            else {
                                errors.push(`Fila ${rowNumber}: La categoría "${rawCategoryId}" no existe en el sistema.`);
                                continue;
                            }
                        }
                    }
                    else if (rawCategoryName) {
                        const match = categoryByName.get(rawCategoryName.toLowerCase());
                        if (match) {
                            category_id = match;
                        }
                        else {
                            errors.push(`Fila ${rowNumber}: La categoría "${rawCategoryName}" no existe en el sistema.`);
                            continue;
                        }
                    }
                    let location_id = (row.location_id || '').trim() || null;
                    const locationName = row.location ? String(row.location).trim() : '';
                    if (location_id && !UUID_REGEX.test(location_id)) {
                        errors.push(`Fila ${rowNumber}: El valor de location_id no es un UUID válido.`);
                        continue;
                    }
                    if (location_id && !locationIds.has(location_id)) {
                        errors.push(`Fila ${rowNumber}: La ubicación con id ${location_id} no existe en el sistema.`);
                        continue;
                    }
                    if (!location_id && row.location) {
                        const match = locationByName.get(locationName.toLowerCase());
                        if (match) {
                            location_id = match;
                        }
                        else {
                            errors.push(`Fila ${rowNumber}: La ubicación "${locationName}" no existe en el sistema.`);
                            continue;
                        }
                    }
                    const numericValues = {};
                    let rowHasValidationError = false;
                    for (const field of NUMBER_FIELDS) {
                        const rawValue = row[field.key];
                        if (rawValue === undefined || rawValue === null || rawValue === '') {
                            if (!field.allowEmpty) {
                                errors.push(`Fila ${rowNumber}: El campo ${field.label} es obligatorio.`);
                                rowHasValidationError = true;
                            }
                            numericValues[field.key] = field.allowEmpty ? null : 0;
                            continue;
                        }
                        const value = Number(String(rawValue).replace(/,/g, '.'));
                        if (Number.isNaN(value)) {
                            errors.push(`Fila ${rowNumber}: El campo ${field.label} contiene un valor numérico inválido (${rawValue}).`);
                            rowHasValidationError = true;
                            continue;
                        }
                        if (field.min !== undefined && value < field.min) {
                            errors.push(`Fila ${rowNumber}: El campo ${field.label} no puede ser menor que ${field.min}.`);
                            rowHasValidationError = true;
                            continue;
                        }
                        numericValues[field.key] = value;
                    }
                    const minStockValue = typeof numericValues.min_stock === 'number' ? numericValues.min_stock : 0;
                    const maxStockValue = typeof numericValues.max_stock === 'number' ? numericValues.max_stock : null;
                    if (maxStockValue !== null && maxStockValue < minStockValue) {
                        errors.push(`Fila ${rowNumber}: El stock máximo no puede ser menor que el stock mínimo.`);
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
                        category_id,
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
                    errors.push(`Fila ${i + 2}: ${error?.message || 'Error desconocido procesando la fila.'}`);
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
                        const messageParts = [error?.message, error?.details, error?.hint]
                            .filter(Boolean)
                            .map((part) => part.trim());
                        const formatted = messageParts.length > 0 ? messageParts.join(' - ') : 'Error desconocido al crear el producto.';
                        const skuInfo = entry.sku ? ` (SKU ${entry.sku})` : '';
                        errors.push(`Fila ${entry.rowNumber}${skuInfo}: ${formatted}`);
                    }
                }
            }
            setUploadResult({
                success: successCount,
                errors: errors.length,
                errorMessages: errors
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
        const headers = ['name', 'description', 'sku', 'barcode', 'category', 'category_id', 'location', 'location_id', 'min_stock', 'max_stock', 'purchase_price', 'sale_price', 'tax_rate', 'status'];
        const rows = [
            {
                name: 'Producto 1',
                description: 'Descripción del producto 1',
                sku: 'ABC123',
                barcode: '123456789',
                category: 'Categoría Principal',
                category_id: '9e91d103-7c4c-472d-9566-981274a13ff4',
                location: 'Pasillo A - Estante 1',
                location_id: '',
                min_stock: 10,
                max_stock: 100,
                purchase_price: 15000,
                sale_price: 20000,
                tax_rate: 19,
                status: 'active'
            },
            {
                name: 'Producto 2',
                description: 'Descripción del producto 2',
                sku: 'DEF456',
                barcode: '987654321',
                category: 'Otra Categoría',
                category_id: '',
                location: 'Bodega - Rack 2',
                location_id: '',
                min_stock: 5,
                max_stock: 50,
                purchase_price: 25000,
                sale_price: 35000,
                tax_rate: 19,
                status: 'active'
            }
        ];
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
        const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'plantilla_productos.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    return (_jsxs(Dialog, { open: isOpen, onOpenChange: setIsOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: size, className: className, children: [_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", fill: "currentColor", className: "mr-2", viewBox: "0 0 16 16", children: [_jsx("path", { d: "M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" }), _jsx("path", { d: "M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" })] }), "Importar Productos"] }) }), _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Importar Productos Masivamente" }) }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsx("p", { className: "text-sm text-gray-500", children: "Sube un archivo CSV con los productos que deseas importar. Aseg\u00FArate de que el archivo tenga las columnas correctas." }), _jsx(Button, { variant: "outline", onClick: downloadTemplate, className: "w-full", children: "Descargar Plantilla CSV" }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsx("label", { htmlFor: "file-upload", className: "text-sm font-medium", children: "Seleccionar archivo CSV" }), _jsx("input", { id: "file-upload", type: "file", accept: ".csv,.xlsx,.xls", onChange: handleFileChange, className: "border border-gray-300 rounded-md p-2 text-sm" })] }), uploadResult && (_jsxs(Alert, { variant: uploadResult.success > 0 ? "default" : "destructive", children: [_jsx(AlertTitle, { children: "Resultado de la importaci\u00F3n" }), _jsxs(AlertDescription, { children: [_jsxs("p", { children: ["Productos importados: ", uploadResult.success] }), _jsxs("p", { children: ["Errores: ", uploadResult.errors] }), uploadResult.errorMessages.length > 0 && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-red-600 dark:text-red-300", children: "Detalles del error:" }), _jsx("ul", { className: "mt-1 text-xs pl-5 list-disc space-y-1", children: uploadResult.errorMessages.slice(0, 5).map((error, index) => (_jsx("li", { children: error }, index))) }), uploadResult.errorMessages.length > 5 && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Mostrando 5 de ", uploadResult.errorMessages.length, " errores. Usa el desplegable para ver todos."] }))] }), _jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer font-medium", children: "Ver lista completa de errores" }), _jsx("ul", { className: "mt-2 text-xs pl-5 list-disc space-y-1 max-h-48 overflow-auto", children: uploadResult.errorMessages.map((error, index) => (_jsx("li", { children: error }, index))) })] })] }))] })] }))] }), _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "outline", onClick: () => setIsOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: processCSV, disabled: !fileData || isUploading, children: isUploading ? 'Importando...' : 'Importar Productos' })] })] })] }));
};
export default ProductImport;
