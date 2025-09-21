import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getSupabaseClient, warehousesService } from '../../lib/supabase';

interface LocationImportProps {
  onImportComplete: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

type ImportResult = {
  success: number;
  errors: number;
  errorMessages: string[];
} | null;

export default function LocationImport({ onImportComplete, className, size = 'default' }: LocationImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileData, setFileData] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (e) {
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
    if (!fileData) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const name = fileData.name.toLowerCase();
      let rows: any[] = [];
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buf = await fileData.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      } else if (name.endsWith('.csv')) {
        const Papa = await import('papaparse');
        const parseResult = await new Promise<any>((resolve, reject) => {
          Papa.parse(fileData, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => resolve(results),
            error: (error: any) => reject(error),
          });
        });
        rows = parseResult.data || [];
      } else {
        throw new Error('Formato no soportado. Usa .xlsx, .xls o .csv');
      }

      // Mapear almacenes por nombre e id (para permitir warehouse o warehouse_id)
      const warehouses = await warehousesService.getAll();
      const byName = new Map<string, string>();
      warehouses.forEach(w => { if (w.name) byName.set(w.name.toLowerCase(), w.id); });

      const supabase = await getSupabaseClient();
      const errors: string[] = [];
      const valid: any[] = [];
      let successCount = 0;

      for (let i = 0; i < rows.length; i++) {
        try {
          const r = rows[i];
          const name = (r.name || '').trim();
          if (!name) {
            errors.push(`Fila ${i + 2}: el nombre es obligatorio`);
            continue;
          }

          let warehouse_id: string | null | undefined = (r.warehouse_id || '').trim() || null;
          if (!warehouse_id && r.warehouse) {
            const match = byName.get(String(r.warehouse).toLowerCase().trim());
            if (match) warehouse_id = match;
          }

          // Requisito: importar SIEMPRE como activas
          const loc = {
            name,
            description: r.description ? String(r.description) : undefined,
            warehouse_id,
            active: true,
          } as any;
          valid.push(loc);
        } catch (e: any) {
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
          if (error) throw error;
          successCount += (data?.length || 0);
        } catch (e: any) {
          errors.push(e.message || 'Error al insertar lote');
        }
      }

      setUploadResult({ success: successCount, errors: errors.length, errorMessages: errors });
      if (successCount > 0) onImportComplete();
    } catch (e: any) {
      setUploadResult({ success: 0, errors: 1, errorMessages: [e.message || 'Error al procesar el archivo'] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size} className={className}>
          Importar Ubicaciones
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Ubicaciones</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">
            Sube un archivo con columnas: name, description, warehouse_id (opcional), active (true/false).
            También puedes usar la columna "warehouse" con el nombre del almacén.
          </p>
          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            Descargar Plantilla Excel
          </Button>
          <div className="flex flex-col space-y-2">
            <label htmlFor="file-upload-locations" className="text-sm font-medium">
              Seleccionar archivo (.xlsx, .xls, .csv)
            </label>
            <input id="file-upload-locations" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="border border-gray-300 rounded-md p-2 text-sm" />
          </div>

          {uploadResult && (
            <Alert variant={uploadResult.success > 0 ? 'default' : 'destructive'}>
              <AlertTitle>Resultado de la importación</AlertTitle>
              <AlertDescription>
                <p>Ubicaciones importadas: {uploadResult.success}</p>
                <p>Errores: {uploadResult.errors}</p>
                {uploadResult.errorMessages.length > 0 && (
                  <div className="mt-2">
                    <details>
                      <summary className="cursor-pointer font-medium">Ver detalles de errores</summary>
                      <ul className="mt-2 text-xs pl-5 list-disc">
                        {uploadResult.errorMessages.map((msg, i) => (<li key={i}>{msg}</li>))}
                      </ul>
                    </details>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button onClick={processFile} disabled={!fileData || isUploading}>{isUploading ? 'Importando...' : 'Importar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
