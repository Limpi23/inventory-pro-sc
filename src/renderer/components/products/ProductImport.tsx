import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { productService } from "../../lib/supabase";
import Papa from 'papaparse';

interface ProductImportProps {
  onImportComplete: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

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

  const processCSV = async () => {
    if (!fileData) return;
    
    setIsUploading(true);
    setUploadResult(null);
    
    try {
      // Parsear el archivo CSV
      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileData, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results),
          error: (error) => reject(error)
        });
      });
      
      // Obtener SKUs ya existentes en la base de datos
  const existingProducts = await productService.getAll();
      const existingSkus = new Set((existingProducts as any[]).map((p: any) => (p.sku || '').trim()).filter(Boolean));
      
      // Validar y procesar los datos
      const products = parseResult.data;
      const errors: string[] = [];
      const validProducts = [];
      let successCount = 0;
      const seenSkus = new Set<string>();
      
      for (let i = 0; i < products.length; i++) {
        try {
          const row = products[i];
          const sku = (row.sku || '').trim();
          
          // Validaciones básicas
          if (!row.name) {
            errors.push(`Fila ${i + 2}: El nombre del producto es obligatorio`);
            continue;
          }
          
          // Validar duplicados en el archivo
          if (sku && seenSkus.has(sku)) {
            errors.push(`Fila ${i + 2}: SKU duplicado en el archivo: ${sku}`);
            continue;
          }
          seenSkus.add(sku);
          
          // Validar duplicados en la base de datos
          if (sku && existingSkus.has(sku)) {
            errors.push(`Fila ${i + 2}: SKU ya registrado en la base de datos: ${sku}`);
            continue;
          }
          
          // Transformar los datos al formato esperado
          const productData = {
            name: row.name,
            description: row.description || '',
            sku: sku,
            barcode: row.barcode || '',
            category_id: row.category_id || null,
            min_stock: parseFloat(row.min_stock) || 0,
            max_stock: parseFloat(row.max_stock) || null,
            purchase_price: parseFloat(row.purchase_price) || 0,
            sale_price: parseFloat(row.sale_price) || 0,
            tax_rate: parseFloat(row.tax_rate) || 0,
            status: row.status || 'active'
          };
          
          validProducts.push(productData);
        } catch (error: any) {
          errors.push(`Fila ${i + 2}: ${error.message || 'Error desconocido'}`);
        }
      }
      
      // Intentar crear todos los productos en lote
      if (validProducts.length > 0) {
        try {
          const createdProducts = await productService.createBatch(validProducts);
          successCount = createdProducts.length;
        } catch (error: any) {
          errors.push(`Error al crear productos en lote: ${error.message || 'Error desconocido'}`);
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
    const headers = "name,description,sku,barcode,category_id,min_stock,max_stock,purchase_price,sale_price,tax_rate,status\n";
    const sampleData = "Producto 1,Descripción del producto 1,ABC123,123456789,9e91d103-7c4c-472d-9566-981274a13ff4,10,100,15000,20000,19,active\n" +
                        "Producto 2,Descripción del producto 2,DEF456,987654321,,5,50,25000,35000,19,active\n";
    
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
              accept=".csv"
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
                  <div className="mt-2">
                    <details>
                      <summary className="cursor-pointer font-medium">Ver detalles de errores</summary>
                      <ul className="mt-2 text-xs pl-5 list-disc">
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