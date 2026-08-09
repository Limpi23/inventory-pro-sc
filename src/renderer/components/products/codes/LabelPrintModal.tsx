import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { Product } from '../../../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useCurrency } from '../../../hooks/useCurrency';
import { useBranch, ALL_BRANCHES } from '../../../lib/branch';
import { warehousesService } from '../../../lib/supabase';
import { priceService, type ProductPrice } from '../../../lib/priceService';
import { resolveCodeValue, validateCode, effectiveSymbology, type BarcodeSymbology } from '../../../lib/codes';
import ProductLabel, { type LabelOptions } from './ProductLabel';

interface SheetTemplate {
  id: string;
  label: string;
  page: 'A4' | 'letter';
  cols: number;
  rows: number;
  /** Etiqueta en mm. */
  w: number;
  h: number;
  /** Márgenes de la hoja en mm. */
  mt: number;
  ml: number;
  /** Separación entre etiquetas en mm. */
  gx: number;
  gy: number;
}

const PAGE_SIZES: Record<'A4' | 'letter', { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

const TEMPLATES: SheetTemplate[] = [
  // 3 × 70 mm = 210 mm y 8 × 37 mm = 296 mm: ocupa la hoja A4 casi exacta,
  // así que el margen superior tiene que ser mínimo o la última fila se cae.
  { id: 'a4-3x8',      label: 'A4 · 3×8 (70 × 37 mm)',                 page: 'A4',     cols: 3,  rows: 8,  w: 70,    h: 37,   mt: 0.5,  ml: 0,    gx: 0,   gy: 0 },
  { id: 'a4-4x10',     label: 'A4 · 4×10 (48.5 × 25.4 mm)',            page: 'A4',     cols: 4,  rows: 10, w: 48.5,  h: 25.4, mt: 21.5, ml: 8,    gx: 0,   gy: 0 },
  { id: 'a4-2x7',      label: 'A4 · 2×7 (99.1 × 38.1 mm)',             page: 'A4',     cols: 2,  rows: 7,  w: 99.1,  h: 38.1, mt: 15.1, ml: 4.65, gx: 2.5, gy: 0 },
  { id: 'letter-3x10', label: 'Carta · 3×10 (66.7 × 25.4 mm) · Avery 5160', page: 'letter', cols: 3, rows: 10, w: 66.7, h: 25.4, mt: 12.7, ml: 4.7, gx: 3.2, gy: 0 },
  { id: 'letter-2x5',  label: 'Carta · 2×5 (101.6 × 50.8 mm) · Avery 5163', page: 'letter', cols: 2, rows: 5,  w: 101.6, h: 50.8, mt: 12.7, ml: 4.7, gx: 4.8, gy: 0 },
];

interface LabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

export default function LabelPrintModal({ open, onClose, products }: LabelPrintModalProps) {
  const currency = useCurrency();
  const { activeBranchId } = useBranch();
  const printRef = useRef<HTMLDivElement>(null);

  // Sucursal cuyo precio se imprime en la etiqueta
  const [priceWarehouseId, setPriceWarehouseId] = useState<string>(activeBranchId || ALL_BRANCHES);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [branchPrices, setBranchPrices] = useState<Map<string, ProductPrice>>(new Map());

  useEffect(() => {
    warehousesService
      .getAll()
      .then((w: any[]) => setWarehouses((w || []).filter((x) => x.is_active !== false).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    if (!priceWarehouseId || priceWarehouseId === ALL_BRANCHES) {
      setBranchPrices(new Map());
      return;
    }
    priceService
      .getMapByWarehouse(priceWarehouseId)
      .then((m) => { if (!cancelado) setBranchPrices(m); })
      .catch(() => { if (!cancelado) setBranchPrices(new Map()); });
    return () => { cancelado = true; };
  }, [priceWarehouseId]);

  const [templateId, setTemplateId] = useState<string>('a4-3x8');
  const [custom, setCustom] = useState<SheetTemplate>({
    ...TEMPLATES[0], id: 'custom', label: 'Personalizado',
  });
  const [symbology, setSymbology] = useState<BarcodeSymbology>(
    products.length ? effectiveSymbology(products[0]) : 'CODE128'
  );
  const [copies, setCopies] = useState(1);
  const [startAt, setStartAt] = useState(1);
  const [showName, setShowName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showGuide, setShowGuide] = useState(true);

  const tpl = templateId === 'custom' ? custom : (TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]);
  const perPage = Math.max(1, tpl.cols * tpl.rows);
  const pageSize = PAGE_SIZES[tpl.page];

  // Una plantilla que no cabe recorta la última fila o columna sin avisar.
  const usedWmm = tpl.ml + tpl.cols * tpl.w + Math.max(0, tpl.cols - 1) * tpl.gx;
  const usedHmm = tpl.mt + tpl.rows * tpl.h + Math.max(0, tpl.rows - 1) * tpl.gy;
  const overflowMm = {
    x: +(usedWmm - pageSize.w).toFixed(1),
    y: +(usedHmm - pageSize.h).toFixed(1),
  };
  const fits = overflowMm.x <= 0 && overflowMm.y <= 0;

  const options: LabelOptions = {
    symbology, showName, showSku, showPrice, widthMm: tpl.w, heightMm: tpl.h,
  };

  // Productos que no se pueden representar en la simbología elegida
  const invalid = useMemo(() => {
    return products
      .map(p => ({ p, v: validateCode(resolveCodeValue(p), symbology) }))
      .filter(x => !x.v.ok);
  }, [products, symbology]);

  const printable = useMemo(
    () => products.filter(p => validateCode(resolveCodeValue(p), symbology).ok),
    [products, symbology]
  );

  const priceLabels = useMemo(() => {
    const map: Record<string, string> = {};
    printable.forEach(p => {
      map[p.id] = currency.format(priceService.resolve(p, branchPrices.get(p.id)).sale_price);
    });
    return map;
  }, [printable, currency, branchPrices]);

  // Etiquetas expandidas por copias, precedidas por los huecos ya usados de la hoja
  const pages = useMemo(() => {
    const cells: (Product | null)[] = [];
    const offset = Math.min(Math.max(0, startAt - 1), perPage - 1);
    for (let i = 0; i < offset; i++) cells.push(null);
    printable.forEach(p => {
      for (let c = 0; c < Math.max(1, copies); c++) cells.push(p);
    });
    const out: (Product | null)[][] = [];
    for (let i = 0; i < cells.length; i += perPage) out.push(cells.slice(i, i + perPage));
    return out;
  }, [printable, copies, startAt, perPage]);

  const totalLabels = printable.length * Math.max(1, copies);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Etiquetas-${new Date().toISOString().slice(0, 10)}`,
  });

  const updateCustom = (patch: Partial<SheetTemplate>) => setCustom(prev => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[980px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Imprimir etiquetas · {products.length} producto{products.length === 1 ? '' : 's'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[300px_1fr] mt-2">
          {/* ----------------------------- Controles ----------------------------- */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Formato de hoja</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  <SelectItem value="custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {templateId === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-md border bg-muted/40">
                <div className="grid gap-1">
                  <Label className="text-xs">Hoja</Label>
                  <Select value={custom.page} onValueChange={(v) => updateCustom({ page: v as 'A4' | 'letter' })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="letter">Carta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {([
                  ['cols', 'Columnas'], ['rows', 'Filas'],
                  ['w', 'Ancho (mm)'], ['h', 'Alto (mm)'],
                  ['ml', 'Margen izq. (mm)'], ['mt', 'Margen sup. (mm)'],
                  ['gx', 'Sep. horiz. (mm)'], ['gy', 'Sep. vert. (mm)'],
                ] as const).map(([key, lbl]) => (
                  <div className="grid gap-1" key={key}>
                    <Label className="text-xs">{lbl}</Label>
                    <Input
                      className="h-8"
                      type="number"
                      step="0.1"
                      value={String(custom[key])}
                      onChange={(e) => updateCustom({ [key]: Number(e.target.value) || 0 } as any)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Código a imprimir</Label>
              <Select value={symbology} onValueChange={(v) => setSymbology(v as BarcodeSymbology)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">Barras · Code128</SelectItem>
                  <SelectItem value="EAN13">Barras · EAN-13</SelectItem>
                  <SelectItem value="QR">QR</SelectItem>
                </SelectContent>
              </Select>
              {symbology === 'QR' && (
                <p className="text-xs text-muted-foreground">
                  Requiere un lector 2D. Los lectores láser de barras no leen QR.
                </p>
              )}
            </div>

            {showPrice && warehouses.length > 0 && (
              <div className="grid gap-2">
                <Label>Precio de qué sucursal</Label>
                <Select value={priceWarehouseId} onValueChange={setPriceWarehouseId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_BRANCHES}>Precio base del catálogo</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="copies">Copias c/u</Label>
                <Input id="copies" type="number" min={1} value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="startAt">Empezar en</Label>
                <Input id="startAt" type="number" min={1} max={perPage} value={startAt}
                  onChange={(e) => setStartAt(Math.min(perPage, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              «Empezar en» salta etiquetas ya usadas de la hoja (de 1 a {perPage}).
            </p>

            <div className="space-y-2">
              <Label>Mostrar en la etiqueta</Label>
              {([
                ['Nombre', showName, setShowName],
                ['Código en texto', showSku, setShowSku],
                ['Precio', showPrice, setShowPrice],
                ['Guías de corte (solo pantalla)', showGuide, setShowGuide],
              ] as const).map(([lbl, val, set]) => (
                <label key={lbl} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={val} onCheckedChange={(c) => (set as any)(Boolean(c))} />
                  {lbl}
                </label>
              ))}
            </div>

            <div className="text-sm text-muted-foreground border-t pt-3">
              {totalLabels} etiqueta{totalLabels === 1 ? '' : 's'} · {pages.length} hoja{pages.length === 1 ? '' : 's'}
            </div>

            {!fits && (
              <div className="text-xs rounded-md border border-red-300 bg-red-50 text-red-900 p-2">
                <span className="font-medium">La plantilla no cabe en la hoja.</span>{' '}
                Se pasa
                {overflowMm.x > 0 && ` ${overflowMm.x} mm de ancho`}
                {overflowMm.x > 0 && overflowMm.y > 0 && ' y'}
                {overflowMm.y > 0 && ` ${overflowMm.y} mm de alto`}
                . La última {overflowMm.y > 0 ? 'fila' : 'columna'} saldrá recortada.
              </div>
            )}

            {invalid.length > 0 && (
              <div className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2 space-y-1">
                <div className="font-medium">
                  {invalid.length} producto{invalid.length === 1 ? ' queda' : 's quedan'} fuera:
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {invalid.slice(0, 5).map(({ p, v }) => (
                    <li key={p.id}><span className="font-mono">{p.sku || p.name}</span> — {v.error}</li>
                  ))}
                  {invalid.length > 5 && <li>…y {invalid.length - 5} más</li>}
                </ul>
              </div>
            )}
          </div>

          {/* ------------------------------ Vista previa ------------------------------ */}
          <div className="border rounded-md bg-gray-100 dark:bg-gray-900 p-3 overflow-auto max-h-[62vh]">
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No hay nada que imprimir con esta configuración.
              </p>
            ) : (
              <div style={{ transform: 'scale(0.52)', transformOrigin: 'top left', width: `${pageSize.w * 0.52}mm` }}>
                <div ref={printRef}>
                  <style>{`
                    @media print {
                      @page { size: ${tpl.page === 'A4' ? 'A4' : 'letter'}; margin: 0; }
                      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    .label-sheet { break-after: page; page-break-after: always; }
                    .label-sheet:last-child { break-after: auto; page-break-after: auto; }
                  `}</style>
                  {pages.map((cells, pi) => (
                    <div
                      key={pi}
                      className="label-sheet"
                      style={{
                        width: `${pageSize.w}mm`,
                        height: `${pageSize.h}mm`,
                        paddingTop: `${tpl.mt}mm`,
                        paddingLeft: `${tpl.ml}mm`,
                        boxSizing: 'border-box',
                        background: '#ffffff',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${tpl.cols}, ${tpl.w}mm)`,
                        gridAutoRows: `${tpl.h}mm`,
                        columnGap: `${tpl.gx}mm`,
                        rowGap: `${tpl.gy}mm`,
                        overflow: 'hidden',
                      }}
                    >
                      {cells.map((p, ci) =>
                        p ? (
                          <ProductLabel
                            key={`${pi}-${ci}-${p.id}`}
                            product={p}
                            options={options}
                            priceLabel={priceLabels[p.id]}
                            showGuide={showGuide}
                          />
                        ) : (
                          <div
                            key={`${pi}-${ci}-blank`}
                            style={{ width: `${tpl.w}mm`, height: `${tpl.h}mm` }}
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => handlePrint()} disabled={pages.length === 0}>
            Imprimir {totalLabels > 0 ? `(${totalLabels})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
