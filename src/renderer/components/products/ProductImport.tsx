import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { productService, locationsService, categoriesService } from "../../lib/supabase";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ProductImportProps {
  onImportComplete: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

const REQUIRED_COLUMNS = ['name'];
const OPTIONAL_BUT_VALIDATED_COLUMNS = ['sku', 'category', 'category_id', 'location', 'location_id', 'min_stock', 'max_stock', 'purchase_price', 'sale_price', 'tax_rate', 'status'];
const SUPPORTED_COLUMNS = [...new Set([...REQUIRED_COLUMNS, ...OPTIONAL_BUT_VALIDATED_COLUMNS, 'description', 'barcode'])];
const NUMBER_FIELDS: Array<{ key: string; label: string; allowEmpty?: boolean; min?: number }> = [
  { key: 'min_stock', label: 'Stock mínimo', allowEmpty: true, min: 0 },
  { key: 'max_stock', label: 'Stock máximo', allowEmpty: true, min: 0 },
  { key: 'purchase_price', label: 'Precio de compra', allowEmpty: true, min: 0 },
  { key: 'sale_price', label: 'Precio de venta', allowEmpty: true, min: 0 },
  { key: 'tax_rate', label: 'Impuesto', allowEmpty: true, min: 0 }
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ProductImport: React.FC<ProductImportProps> = ({ onImportComplete, className, size = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fileData, setFileData] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    errors: number;
    errorMessages: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileData(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const parseFile = async (file: File): Promise<{ rows: any[]; fields: string[]; errors: string[] }> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
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
      }).filter(Boolean) as string[];

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
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', blankrows: false }) as Array<Record<string, any>>;
      const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { rows, fields, errors: [] };
    }

    return { rows: [], fields: [], errors: ['Formato de archivo no soportado. Usa CSV o Excel (.xlsx).'] };
  };

  const processCSV = async () => {
  if (!fileData) return;
    
    setIsUploading(true);
    setUploadResult(null);
    
    try {
  const { rows, fields, errors: parseErrors } = await parseFile(fileData);
      
      const missingRequired = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
      const unknownColumns = fields.filter((column) => column && !SUPPORTED_COLUMNS.includes(column));

      const errors: string[] = [];
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
      const categoryById = new Set((allCategories as any[]).map((c: any) => c.id));
      const categoryByName = new Map<string, string>();
      (allCategories as any[]).forEach((c: any) => {
        if (c?.name) categoryByName.set(String(c.name).toLowerCase().trim(), c.id);
      });
      const locationByName = new Map<string, string>();
      (allLocations as any[]).forEach((l: any) => {
        if (l?.name) locationByName.set(String(l.name).toLowerCase().trim(), l.id);
      });
      const locationIds = new Set((allLocations as any[]).map((l: any) => l.id));
      const existingSkus = new Set((existingProducts as any[]).map((p: any) => (p.sku || '').trim()).filter(Boolean));
      
      // Validar y procesar los datos
      const products = rows;
  const validProducts: Array<{ rowNumber: number; data: any; sku?: string }> = [];
      let successCount = 0;
  const seenSkus = new Set<string>();
      
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
          let category_id: string | null = null;
          if (rawCategoryId) {
            if (UUID_REGEX.test(rawCategoryId)) {
              if (!categoryById.has(rawCategoryId)) {
                errors.push(`Fila ${rowNumber}: La categoría con id ${rawCategoryId} no existe en el sistema.`);
                continue;
              }
              category_id = rawCategoryId;
            } else {
              const match = categoryByName.get(rawCategoryId.toLowerCase());
              if (match) {
                category_id = match;
              } else {
                errors.push(`Fila ${rowNumber}: La categoría "${rawCategoryId}" no existe en el sistema.`);
                continue;
              }
            }
          } else if (rawCategoryName) {
            const match = categoryByName.get(rawCategoryName.toLowerCase());
            if (match) {
              category_id = match;
            } else {
              errors.push(`Fila ${rowNumber}: La categoría "${rawCategoryName}" no existe en el sistema.`);
              continue;
            }
          }

          let location_id: string | null = (row.location_id || '').trim() || null;
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
            } else {
              errors.push(`Fila ${rowNumber}: La ubicación "${locationName}" no existe en el sistema.`);
              continue;
            }
          }

          const numericValues: Record<string, number | null> = {};
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
        } catch (error: any) {
          errors.push(`Fila ${i + 2}: ${error?.message || 'Error desconocido procesando la fila.'}`);
        }
      }
      
      // Intentar crear todos los productos en lote
      if (validProducts.length > 0) {
        for (const entry of validProducts) {
          try {
            await productService.create(entry.data as any);
            successCount += 1;
            if (entry.data.sku) {
              existingSkus.add(entry.data.sku);
            }
          } catch (error: any) {
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
    } catch (error: any) {
      setUploadResult({
        success: 0,
        errors: 1,
        errorMessages: [error.message || 'Error al procesar el archivo']
      });
    } finally {
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className={className}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
          </svg>
          Importar Productos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Productos Masivamente</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500">
            Sube un archivo CSV con los productos que deseas importar. Asegúrate de que el archivo tenga las columnas correctas.
          </p>
          
          <Button 
            variant="outline" 
            onClick={downloadTemplate} 
            className="w-full"
          >
            Descargar Plantilla CSV
          </Button>
          
          <div className="flex flex-col space-y-2">
            <label htmlFor="file-upload" className="text-sm font-medium">
              Seleccionar archivo CSV
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
          
          {uploadResult && (
            <Alert variant={uploadResult.success > 0 ? "default" : "destructive"}>
              <AlertTitle>Resultado de la importación</AlertTitle>
              <AlertDescription>
                <p>Productos importados: {uploadResult.success}</p>
                <p>Errores: {uploadResult.errors}</p>
                
                {uploadResult.errorMessages.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-300">Detalles del error:</p>
                      <ul className="mt-1 text-xs pl-5 list-disc space-y-1">
                        {uploadResult.errorMessages.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                      {uploadResult.errorMessages.length > 5 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Mostrando 5 de {uploadResult.errorMessages.length} errores. Usa el desplegable para ver todos.
                        </p>
                      )}
                    </div>
                    <details>
                      <summary className="cursor-pointer font-medium">Ver lista completa de errores</summary>
                      <ul className="mt-2 text-xs pl-5 list-disc space-y-1 max-h-48 overflow-auto">
                        {uploadResult.errorMessages.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
          >
            Cancelar
          </Button>
          
          <Button 
            onClick={processCSV} 
            disabled={!fileData || isUploading}
          >
            {isUploading ? 'Importando...' : 'Importar Productos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductImport; 