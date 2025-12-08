import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase, stockMovementService, productService, warehousesService, locationsService, serialsService } from '../../lib/supabase';

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
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mode, setMode] = useState<'standard' | 'serialized'>('standard');

  const templateData = useMemo(() => {
    if (mode === 'serialized') {
      const header = ['sku', 'serial_code', 'vin', 'engine_number', 'year', 'color', 'warehouse', 'location', 'acquired_at', 'reference'];
      const sample = ['DE191033', 'ABC12345', '1HGBH41JXMN109186', 'ENG987654', '2024', 'Negro', 'Almacen Central', 'Pasillo A - Estante 1', '2025-09-01', 'Importación inicial'];
      return {
        aoa: [header, sample],
        csv: `${header.join(',')}\n${sample.join(',')}`,
        filename: 'plantilla_inventario_inicial_serial',
      };
    }

    const header = ['sku', 'warehouse', 'location', 'quantity', 'reference', 'movement_date'];
    const sample = ['DE191033', 'Almacen Central', 'Pasillo A - Estante 1', '3', 'Inventario inicial', '2025-09-01'];
    return {
      aoa: [header, sample],
      csv: `${header.join(',')}\n${sample.join(',')}`,
      filename: 'plantilla_inventario_inicial',
    };
  }, [mode]);

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(templateData.aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
      XLSX.writeFile(wb, `${templateData.filename}.xlsx`);
    } catch (err) {
      console.warn('xlsx no disponible, exportando CSV', err);
      const blob = new Blob([templateData.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateData.filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const parseFile = async () => {
    if (!file) return;
    setProgress(0);
    setProgressMessage(null);
    setIsProcessing(true);
    setErrors([]);
    setPreview([]);
    try {
      const filename = file.name?.toLowerCase() || '';
      let rows: any[] = [];

      if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else if (filename.endsWith('.csv')) {
        const results = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
          Papa.parse(file!, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
        });
        rows = results.data as any[];
      } else {
        throw new Error('Formato no soportado. Usa un archivo .xlsx, .xls o .csv');
      }

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

      const normalizeRow = (input: Record<string, any>) => {
        return Object.entries(input || {}).reduce<Record<string, any>>((acc, [key, value]) => {
          const cleanKey = String(key || '').trim().toLowerCase();
          if (!cleanKey) return acc;
          acc[cleanKey] = value;
          return acc;
        }, {});
      };

      const coerceDate = (value: any): null | { iso: string; dateOnly: string } => {
        const toResult = (date: Date | null) => {
          if (!date || isNaN(date.getTime())) return null;
          const iso = date.toISOString();
          return { iso, dateOnly: iso.slice(0, 10) };
        };

        if (!value) return null;
        if (value instanceof Date) {
          return toResult(value);
        }
        if (typeof value === 'number') {
          const excelEpoch = Date.UTC(1899, 11, 30);
          const millis = excelEpoch + value * 24 * 60 * 60 * 1000;
          return toResult(new Date(millis));
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const isoCandidate = new Date(trimmed);
          if (!isNaN(isoCandidate.getTime())) return toResult(isoCandidate);
          const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (match) {
            const [, day, month, year] = match;
            return toResult(new Date(Number(year), Number(month) - 1, Number(day)));
          }
        }
        return null;
      };

      const sanitizeRows = rows
        .map((row) => ({ original: row, normalized: normalizeRow(row) }))
        .filter(({ normalized }) => Object.values(normalized).some((value) => String(value ?? '').trim().length));

      if (!sanitizeRows.length) {
        setErrors(['El archivo está vacío o no pudimos leer filas válidas.']);
        return;
      }

      const headerSet = new Set<string>();
      sanitizeRows.forEach(({ normalized }) => {
        Object.keys(normalized).forEach((key) => {
          if (key) headerSet.add(key);
        });
      });

      const formatErrors: string[] = [];
      const ensureColumns = (columns: string[], modeLabel: string) => {
        const missing = columns.filter((col) => !headerSet.has(col));
        if (missing.length) {
          formatErrors.push(`Faltan columnas obligatorias para el modo ${modeLabel}: ${missing.map((col) => `“${col}”`).join(', ')}.`);
        }
      };
      const ensureAny = (columns: string[], message: string) => {
        if (!columns.some((col) => headerSet.has(col))) {
          formatErrors.push(message);
        }
      };

      if (mode === 'serialized') {
        ensureColumns(['sku', 'serial_code'], 'serializado');
        ensureAny(['warehouse', 'warehouse_id'], 'Agrega la columna “warehouse” o “warehouse_id” para indicar el almacén.');
      } else {
        ensureColumns(['sku', 'quantity'], 'estándar');
        ensureAny(['warehouse', 'warehouse_id'], 'Agrega la columna “warehouse” o “warehouse_id” para indicar el almacén.');
      }

      if (formatErrors.length) {
        setErrors(formatErrors);
        return;
      }

      if (mode === 'serialized') {
        for (let i = 0; i < sanitizeRows.length; i++) {
          const { normalized: r, original } = sanitizeRows[i];
          const rowNumber = i + 2;
          const rawSku = String(r.sku ?? '').trim();
          if (!rawSku) { errs.push(`Fila ${rowNumber}: "sku" requerido.`); continue; }
          const sku = rawSku.toLowerCase();
          const product = bySku.get(sku);
          const displaySku = (original?.sku ?? original?.SKU ?? r.sku ?? '').toString().trim();
          if (!product) { errs.push(`Fila ${rowNumber}: SKU no encontrado: ${displaySku || rawSku}`); continue; }

          let warehouse_id: number | null = null;
          let location_id: number | null = null;
          const warehouseIdRaw = r.warehouse_id;
          if (warehouseIdRaw !== undefined && warehouseIdRaw !== null && String(warehouseIdRaw).trim() !== '') {
            const parsed = Number(warehouseIdRaw);
            if (!Number.isFinite(parsed) || parsed <= 0) {
              errs.push(`Fila ${rowNumber}: "warehouse_id" debe ser un número válido.`);
              continue;
            }
            warehouse_id = parsed;
          } else {
            warehouse_id = whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
          }
          if (!warehouse_id) { errs.push(`Fila ${rowNumber}: almacén requerido`); continue; }

          const locationIdRaw = r.location_id;
          if (locationIdRaw !== undefined && locationIdRaw !== null && String(locationIdRaw).trim() !== '') {
            const parsedLoc = Number(locationIdRaw);
            if (!Number.isFinite(parsedLoc) || parsedLoc <= 0) {
              errs.push(`Fila ${rowNumber}: "location_id" debe ser un número válido.`);
              continue;
            }
            location_id = parsedLoc;
          } else {
            location_id = locByName.get(String(r.location || '').trim().toLowerCase()) || null;
          }
          const serial_code = String(r.serial_code || '').trim();
          if (!serial_code) { errs.push(`Fila ${rowNumber}: serial_code requerido`); continue; }

          let year: number | null = null;
          if (r.year !== undefined && String(r.year ?? '').trim() !== '') {
            const parsedYear = Number(r.year);
            if (!Number.isFinite(parsedYear)) {
              errs.push(`Fila ${rowNumber}: "year" debe ser numérico.`);
              continue;
            }
            year = parsedYear;
          }

          const parsedAcquired = coerceDate(r.acquired_at);
          if (r.acquired_at && !parsedAcquired) {
            errs.push(`Fila ${rowNumber}: "acquired_at" no tiene un formato de fecha válido.`);
            continue;
          }
          const row = {
            product_id: product.id,
            product_sku: product.sku ?? rawSku,
            product_name: product.name ?? (displaySku || rawSku),
            warehouse_id,
            location_id,
            serial_code,
            vin: r.vin || null,
            engine_number: r.engine_number || null,
            year,
            color: r.color || null,
            acquired_at: parsedAcquired?.iso || new Date().toISOString(),
            reference: r.reference || 'INICIAL',
          };
          out.push(row);
        }
      } else {
        for (let i = 0; i < sanitizeRows.length; i++) {
          const { normalized: r, original } = sanitizeRows[i];
          const rowNumber = i + 2;
          const rawSku = String(r.sku ?? '').trim();
          if (!rawSku) { errs.push(`Fila ${rowNumber}: "sku" requerido.`); continue; }
          const sku = rawSku.toLowerCase();
          const product = bySku.get(sku);
          const displaySku = (original?.sku ?? original?.SKU ?? r.sku ?? '').toString().trim();
          if (!product) { errs.push(`Fila ${rowNumber}: SKU no encontrado: ${displaySku || rawSku}`); continue; }

          let warehouse_id: number | null = null;
          const warehouseIdRaw = r.warehouse_id;
          if (warehouseIdRaw !== undefined && warehouseIdRaw !== null && String(warehouseIdRaw).trim() !== '') {
            const parsed = Number(warehouseIdRaw);
            if (!Number.isFinite(parsed) || parsed <= 0) {
              errs.push(`Fila ${rowNumber}: "warehouse_id" debe ser un número válido.`);
              continue;
            }
            warehouse_id = parsed;
          } else {
            warehouse_id = whByName.get(String(r.warehouse || '').trim().toLowerCase()) || null;
          }
          if (!warehouse_id) { errs.push(`Fila ${rowNumber}: almacén requerido`); continue; }

          let location_id: number | null = null;
          const locationIdRaw = r.location_id;
          if (locationIdRaw !== undefined && locationIdRaw !== null && String(locationIdRaw).trim() !== '') {
            const parsedLoc = Number(locationIdRaw);
            if (!Number.isFinite(parsedLoc) || parsedLoc <= 0) {
              errs.push(`Fila ${rowNumber}: "location_id" debe ser un número válido.`);
              continue;
            }
            location_id = parsedLoc;
          } else {
            location_id = locByName.get(String(r.location || '').trim().toLowerCase()) || null;
          }

          const quantityRaw = r.quantity;
          const quantity = Number(quantityRaw);
          if (!Number.isFinite(quantity) || quantity <= 0) { errs.push(`Fila ${rowNumber}: "quantity" debe ser un número mayor que 0.`); continue; }

          const parsedMovementDate = coerceDate(r.movement_date);
          if (r.movement_date && !parsedMovementDate) {
            errs.push(`Fila ${rowNumber}: "movement_date" no tiene un formato de fecha válido.`);
            continue;
          }
          const movement_date = parsedMovementDate?.dateOnly || new Date().toISOString().slice(0, 10);
          out.push({
            product_id: product.id,
            product_sku: product.sku ?? rawSku,
            product_name: product.name ?? (displaySku || rawSku),
            warehouse_id,
            location_id,
            quantity,
            reference: r.reference || 'INICIAL',
            movement_date,
          });
        }
      }

      setPreview(out);
      setErrors(errs);
    } catch (e: any) {
      setErrors([e.message || 'Error al procesar el archivo']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setPreview([]);
    setErrors([]);
    setProgress(0);
    setProgressMessage(null);
  };

  const doImport = async () => {
    if (!preview.length) return;
    setProgress(0);
    setProgressMessage('Preparando importación...');
    setIsProcessing(true);
    setErrors([]);
    try {
      const typeId = await stockMovementService.getInboundInitialTypeId();
      let created = 0;
      const importErrors: string[] = [];
      
      if (mode === 'serialized') {
        setProgressMessage('Creando seriales...');
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
        
        // Intentar crear seriales en lotes, capturando errores de duplicados
        const inserted: any[] = [];
        const batchSize = 50;
        const client = await supabase.getClient();
        
        for (let i = 0; i < serials.length; i += batchSize) {
          const batch = serials.slice(i, i + batchSize);
          try {
            const { data, error } = await client
              .from('product_serials')
              .insert(batch as any)
              .select();

            if (error) {
              // Si hay error de unicidad, intentar uno por uno
              if (error.code === '23505') {
                for (const serial of batch) {
                  try {
                    const { data: singleData, error: singleError } = await client
                      .from('product_serials')
                      .insert([serial as any])
                      .select()
                      .single();
                    
                    if (singleError) {
                      if (singleError.code === '23505') {
                        importErrors.push(`Serial duplicado: ${serial.serial_code} (ya existe en el sistema)`);
                      } else {
                        importErrors.push(`Error en serial ${serial.serial_code}: ${singleError.message}`);
                      }
                    } else if (singleData) {
                      inserted.push(singleData);
                    }
                  } catch (err: any) {
                    importErrors.push(`Error en serial ${serial.serial_code}: ${err.message}`);
                  }
                }
              } else {
                throw error;
              }
            } else if (data) {
              inserted.push(...data);
            }
          } catch (err: any) {
            importErrors.push(`Error en lote: ${err.message}`);
          }
          
          const processed = Math.min(i + batch.length, serials.length);
          setProgress(Math.round((processed / serials.length) * 50));
        }
        const byCode = new Map(inserted.map((s) => [s.serial_code, s]));
        setProgressMessage('Generando movimientos...');
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
        created = await stockMovementService.createBatch(moves, {
          onProgress: (processed, total) => {
            if (total > 0) {
              const percent = 50 + Math.round((processed / total) * 50);
              setProgress(Math.min(100, percent));
            } else {
              setProgress(100);
            }
          },
        });
      } else {
        setProgressMessage('Generando movimientos...');
        const moves = preview.map((r) => ({
          product_id: r.product_id,
          warehouse_id: r.warehouse_id,
          location_id: r.location_id || null,
          quantity: r.quantity,
          movement_type_id: typeId,
          reference: r.reference || 'INICIAL',
          related_id: null,
          movement_date: r.movement_date || new Date().toISOString().slice(0, 10),
          notes: 'Importación inicial',
        }));
        created = await stockMovementService.createBatch(moves, {
          onProgress: (processed, total) => {
            if (total > 0) {
              const percent = Math.round((processed / total) * 100);
              setProgress(percent);
            } else {
              setProgress(100);
            }
          },
        });
      }
      setProgress(100);
      setProgressMessage('Importación completada');
      
      if (importErrors.length > 0) {
        setErrors(importErrors);
        onImported?.({ created, errors: importErrors });
        // No cerramos el modal para que el usuario vea los errores
      } else {
        onImported?.({ created, errors: [] });
        setFile(null);
        setPreview([]);
        setErrors([]);
        setOpen(false);
      }
    } catch (e: any) {
      setErrors([e.message || 'Error al importar inventario']);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage(null);
      }, 300);
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
                <button className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200" onClick={downloadTemplate}>Descargar plantilla Excel</button>
                <label className="px-3 py-2 bg-white border rounded-md cursor-pointer hover:bg-gray-50">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                  Seleccionar archivo (.xlsx / .xls / .csv)
                </label>
                <button disabled={!file || isProcessing} onClick={parseFile} className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">Validar</button>
              </div>
              <p className="text-xs text-gray-500">
                {mode === 'serialized'
                  ? 'En la columna “acquired_at” usa la fecha en la que se recibió cada unidad (formato YYYY-MM-DD o dd/mm/aaaa). Si la dejas vacía registraremos la fecha de hoy.'
                  : 'En la columna “movement_date” usa la fecha en la que el stock entró al inventario (formato YYYY-MM-DD o dd/mm/aaaa). Si la dejas vacía registraremos la fecha de hoy.'}
              </p>

              {isProcessing && progressMessage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{progressMessage}</span>
                    <span>{`${Math.min(progress, 100)}%`}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}

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
