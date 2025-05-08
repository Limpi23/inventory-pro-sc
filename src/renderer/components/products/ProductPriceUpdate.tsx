import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { productsService } from '../../../lib/supabase';
import Papa from 'papaparse';

interface ProductPriceUpdateProps {
  open: boolean;
  onClose: () => void;
  onUpdateComplete: () => void;
}

const ProductPriceUpdate: React.FC<ProductPriceUpdateProps> = ({ open, onClose, onUpdateComplete }) => {
  const [fileData, setFileData] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<null | { success: number; errors: number; errorMessages: string[] }>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileData(e.target.files[0]);
      setResult(null);
    }
  };

  const downloadTemplate = async () => {
    // Obtener productos actuales
    const products = await productsService.getAll();
    const headers = 'sku,precio_compra,precio_venta\n';
    const rows = products.map((p: any) => `${p.sku || ''},,`).join('\n');
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
    if (!fileData) return;
    setIsUploading(true);
    setResult(null);
    try {
      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileData, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results),
          error: (error) => reject(error)
        });
      });
      const products = await productsService.getAll();
      const skuMap = new Map((products as any[]).map((p: any) => [(p.sku || '').trim(), p]));
      const updates = [];
      const errors: string[] = [];
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
          const updateData: any = {};
          if (upd.compra !== null) updateData.purchase_price = upd.compra;
          if (upd.venta !== null) updateData.sale_price = upd.venta;
          if (Object.keys(updateData).length > 0) {
            await productsService.update(prod.id, updateData);
            successCount++;
          }
        } catch (e: any) {
          errors.push(`SKU ${upd.sku}: Error al actualizar (${e.message || 'Error desconocido'})`);
        }
      }
      setResult({ success: successCount, errors: errors.length, errorMessages: errors });
      if (successCount > 0) onUpdateComplete();
    } catch (error: any) {
      setResult({ success: 0, errors: 1, errorMessages: [error.message || 'Error al procesar el archivo'] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar Precios Masivos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500">
            Descarga la plantilla, edítala con los nuevos precios y vuelve a subirla. Solo se actualizarán los productos cuyo código (SKU) exista.
          </p>
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            Descargar Plantilla CSV
          </Button>
          <div className="flex flex-col space-y-2">
            <label htmlFor="file-upload-precios" className="text-sm font-medium">
              Seleccionar archivo CSV
            </label>
            <input
              id="file-upload-precios"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
          {result && (
            <Alert variant={result.success > 0 ? 'default' : 'destructive'}>
              <AlertTitle>Resultado de la actualización</AlertTitle>
              <AlertDescription>
                <p>Productos actualizados: {result.success}</p>
                <p>Errores: {result.errors}</p>
                {result.errorMessages.length > 0 && (
                  <div className="mt-2">
                    <details>
                      <summary className="cursor-pointer font-medium">Ver detalles de errores</summary>
                      <ul className="mt-2 text-xs pl-5 list-disc">
                        {result.errorMessages.map((error, index) => (
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={processCSV} disabled={!fileData || isUploading}>
            {isUploading ? 'Actualizando...' : 'Actualizar Precios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductPriceUpdate; 