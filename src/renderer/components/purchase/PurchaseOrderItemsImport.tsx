import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

// Minimal product shape expected from parent
export interface ImportProductRef {
  id: string;
  name: string;
  sku: string;
  purchase_price?: number;
}

export interface ImportOrderItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  products: ImportProductRef[];
  onImport: (items: ImportOrderItem[]) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
}

const PurchaseOrderItemsImport: React.FC<Props> = ({ products, onImport, className, size = 'default', disabled }) => {
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

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const header = [ [ 'sku', 'quantity', 'unit_price' ] ];
      const rows = [
        [ 'ABC123', 5, 15000 ],
        [ 'DEF456', 2, 25000 ]
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
    } catch (e) {
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
    if (!fileData) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      let rows: any[] = [];
      const name = (fileData.name || '').toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buf = await fileData.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      } else {
        const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
          Papa.parse(fileData, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results),
            error: (error) => reject(error)
          });
        });
        rows = parseResult.data as any[];
      }

      const productsBySku = new Map<string, ImportProductRef>();
      for (const p of products) {
        if (p.sku) productsBySku.set(String(p.sku).trim().toLowerCase(), p);
      }

      const errors: string[] = [];
      const aggregated = new Map<string, ImportOrderItem>();

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
        } else {
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
    } catch (error: any) {
      setUploadResult({ success: 0, errors: 1, errorMessages: [error.message || 'Error al procesar el archivo'] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className={className} disabled={disabled}>
          <i className="fas fa-file-upload mr-2" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Productos a la Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            Formato: sku, quantity, unit_price (opcional). Si no incluyes unit_price, se usa el precio de compra del producto.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>Descargar plantilla</Button>
          </div>

          <div className="flex flex-col space-y-2">
            <label htmlFor="file-upload-po" className="text-sm font-medium">Archivo Excel o CSV</label>
            <input id="file-upload-po" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="border border-gray-300 rounded-md p-2 text-sm" />
          </div>

          {uploadResult && (
            <Alert variant={uploadResult.success > 0 ? 'default' : 'destructive'}>
              <AlertTitle>Resumen</AlertTitle>
              <AlertDescription>
                <p>Items válidos: {uploadResult.success}</p>
                <p>Errores: {uploadResult.errors}</p>
                {uploadResult.errorMessages.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Ver detalles</summary>
                    <ul className="mt-2 text-xs pl-5 list-disc">
                      {uploadResult.errorMessages.map((e, i) => (<li key={i}>{e}</li>))}
                    </ul>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cerrar</Button>
          <Button onClick={processCSV} disabled={!fileData || isUploading}>{isUploading ? 'Procesando…' : 'Importar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrderItemsImport;
