import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { stockMovementService, productService, warehousesService, locationsService, serialsService } from '../../lib/supabase';

interface Props {
  onImported?: (result: { created: number; errors: string[] }) => void;
  trigger?: React.ReactNode;
}

// CSV columns we support
// standard: sku | product_id | product_name | warehouse_id | warehouse | location_id | location | quantity | reference | movement_date
// serialized: sku | product_id | serial_id | serial_code | vin | engine_number | year | color | warehouse_id | warehouse | location_id | location | acquired_at | reference

const InventoryInitialImport: React.FC<Props> = ({ onImported, trigger }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mode, setMode] = useState<'standard' | 'serialized'>('standard');

  const templateCSV = useMemo(() => {
    if (mode === 'serialized') {
      return [
        'sku,serial_code,vin,engine_number,year,color,warehouse,location,acquired_at,reference',
        'DE191033,ABC12345,1HGBH41JXMN109186,ENG987654,2024,Negro,Almacen Central,Pasillo A - Estante 1,2025-09-01,Importación inicial',
      ].join('\n');
    }
    return [
      'sku,warehouse,location,quantity,reference,movement_date',
      'DE191033,Almacen Central,Pasillo A - Estante 1,3,Inventario inicial,2025-09-01',
    ].join('\n');
  }, [mode]);

  const downloadTemplate = () => {
    const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'serialized' ? 'plantilla_inventario_inicial_serial.csv' : 'plantilla_inventario_inicial.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const parseCSV = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrors([]);
    setPreview([]);
    try {
      const results = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(file!, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
      });
      const rows = results.data as any[];
      // Preload maps
      const [products, warehouses, locs] = await Promise.all([
        productService.getAllAll(),
        warehousesService.getAll(),
        locationsService.getAll(),
      ]);
      const bySku = new Map((products as any[]).map((p: any) => [String(p.sku || '').trim().toLowerCase(), p]));
      const whByName = new Map((warehouses as any[]).map((w: any) => [String(w.name || '').trim().toLowerCase(), w.id]));
      const locByName = new Map((locs as any[]).map((l: any) => [String(l.name || '').trim().toLowerCase(), l.id]));

      const out: any[] = [];
      const errs: string[] = [];

      if (mode === 'serialized') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const sku = String(r.sku || '').trim().toLowerCase();
          const product = bySku.get(sku);
          if (!product) { errs.push(`Fila ${i + 2}: SKU no encontrado: ${r.sku}`); continue; }
          const warehouse_id = r.warehouse_id || whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
          const location_id = r.location_id || locByName.get(String(r.location || '').trim().toLowerCase()) || null;
          if (!warehouse_id) { errs.push(`Fila ${i + 2}: almacén requerido`); continue; }
          const serial_code = String(r.serial_code || '').trim();
          if (!serial_code) { errs.push(`Fila ${i + 2}: serial_code requerido`); continue; }
          const row = {
            product_id: product.id,
            warehouse_id,
            location_id,
            serial_code,
            vin: r.vin || null,
            engine_number: r.engine_number || null,
            year: r.year ? Number(r.year) : null,
            color: r.color || null,
            acquired_at: r.acquired_at || new Date().toISOString(),
            reference: r.reference || 'INICIAL',
          };
          out.push(row);
        }
      } else {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const sku = String(r.sku || '').trim().toLowerCase();
          const product = bySku.get(sku);
          if (!product) { errs.push(`Fila ${i + 2}: SKU no encontrado: ${r.sku}`); continue; }
          const warehouse_id = r.warehouse_id || whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
          const location_id = r.location_id || locByName.get(String(r.location || '').trim().toLowerCase()) || null;
          const quantity = Number(r.quantity || 0);
          if (!warehouse_id) { errs.push(`Fila ${i + 2}: almacén requerido`); continue; }
          if (!(quantity > 0)) { errs.push(`Fila ${i + 2}: cantidad inválida`); continue; }
          const movement_date = r.movement_date || new Date().toISOString();
          out.push({ product_id: product.id, warehouse_id, location_id, quantity, reference: r.reference || 'INICIAL', movement_date });
        }
      }

      setPreview(out);
      setErrors(errs);
    } catch (e: any) {
      setErrors([e.message || 'Error al parsear CSV']);
    } finally {
      setIsProcessing(false);
    }
  };

  const doImport = async () => {
    if (!preview.length) return;
    setIsProcessing(true);
    try {
      const typeId = await stockMovementService.getInboundInitialTypeId();
      let created = 0;
      if (mode === 'serialized') {
        // Create serials then movements of quantity 1 linked to serial_id
        // 1) insert serials
        const serials = preview.map((r) => ({
          product_id: r.product_id,
          serial_code: r.serial_code,
          vin: r.vin || null,
          engine_number: r.engine_number || null,
          year: r.year || null,
          color: r.color || null,
          warehouse_id: r.warehouse_id || null,
          location_id: r.location_id || null,
          status: 'in_stock' as const,
          acquired_at: r.acquired_at || new Date().toISOString(),
        }));
        const inserted = await serialsService.createMany(serials);
        // Index by serial_code
        const byCode = new Map(inserted.map((s) => [s.serial_code, s]));
        const moves = preview.map((r) => ({
          product_id: r.product_id,
          warehouse_id: r.warehouse_id,
          location_id: r.location_id || null,
          serial_id: byCode.get(r.serial_code)?.id || null,
          quantity: 1,
          movement_type_id: typeId,
          reference: r.reference || 'INICIAL',
          related_id: null,
          movement_date: r.acquired_at || new Date().toISOString(),
          notes: 'Importación inicial serializada',
        }));
        created = await stockMovementService.createBatch(moves);
      } else {
        const moves = preview.map((r) => ({
          product_id: r.product_id,
          warehouse_id: r.warehouse_id,
          location_id: r.location_id || null,
          quantity: r.quantity,
          movement_type_id: typeId,
          reference: r.reference || 'INICIAL',
          related_id: null,
          movement_date: r.movement_date || new Date().toISOString(),
          notes: 'Importación inicial',
        }));
        created = await stockMovementService.createBatch(moves);
      }
      onImported?.({ created, errors: [] });
      setOpen(false);
    } catch (e: any) {
      setErrors([e.message || 'Error al importar inventario']);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Importar Inventario Inicial
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Importar Inventario Inicial</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)}>&times;</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Modo:</label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" checked={mode==='standard'} onChange={()=>setMode('standard')} />
                  <span>Estándar (por cantidad)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="mode" checked={mode==='serialized'} onChange={()=>setMode('serialized')} />
                  <span>Serializado (por unidad)</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200" onClick={downloadTemplate}>Descargar plantilla CSV</button>
                <label className="px-3 py-2 bg-white border rounded-md cursor-pointer hover:bg-gray-50">
                  <input type="file" accept=".csv" className="hidden" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
                  Seleccionar archivo CSV
                </label>
                <button disabled={!file || isProcessing} onClick={parseCSV} className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">Validar</button>
              </div>

              {!!errors.length && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
                  <p className="font-medium mb-1">Errores de validación:</p>
                  <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-auto">
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {!!preview.length && (
                <div className="border rounded p-3 max-h-60 overflow-auto text-sm">
                  <p className="font-medium mb-2">Vista previa ({preview.length} filas)</p>
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        {Object.keys(preview[0]).map((k)=> (<th key={k} className="text-left text-xs font-semibold text-gray-500 pr-4 py-1">{k}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0,50).map((row, idx)=> (
                        <tr key={idx} className="border-t">
                          {Object.keys(preview[0]).map((k)=> (<td key={k} className="pr-4 py-1">{String(row[k] ?? '')}</td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (<p className="text-xs text-gray-500 mt-1">Mostrando primeras 50 filas.</p>)}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 bg-gray-200 rounded-md" onClick={()=>setOpen(false)}>Cancelar</button>
              <button disabled={!preview.length || isProcessing} onClick={doImport} className="px-3 py-2 bg-green-600 text-white rounded-md disabled:opacity-50">
                {isProcessing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryInitialImport;
