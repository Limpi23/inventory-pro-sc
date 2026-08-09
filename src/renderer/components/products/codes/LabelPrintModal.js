import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useCurrency } from '../../../hooks/useCurrency';
import { useBranch, ALL_BRANCHES } from '../../../lib/branch';
import { warehousesService } from '../../../lib/supabase';
import { priceService } from '../../../lib/priceService';
import { resolveCodeValue, validateCode, effectiveSymbology } from '../../../lib/codes';
import ProductLabel from './ProductLabel';
const PAGE_SIZES = {
    A4: { w: 210, h: 297 },
    letter: { w: 215.9, h: 279.4 },
};
const TEMPLATES = [
    // 3 × 70 mm = 210 mm y 8 × 37 mm = 296 mm: ocupa la hoja A4 casi exacta,
    // así que el margen superior tiene que ser mínimo o la última fila se cae.
    { id: 'a4-3x8', label: 'A4 · 3×8 (70 × 37 mm)', page: 'A4', cols: 3, rows: 8, w: 70, h: 37, mt: 0.5, ml: 0, gx: 0, gy: 0 },
    { id: 'a4-4x10', label: 'A4 · 4×10 (48.5 × 25.4 mm)', page: 'A4', cols: 4, rows: 10, w: 48.5, h: 25.4, mt: 21.5, ml: 8, gx: 0, gy: 0 },
    { id: 'a4-2x7', label: 'A4 · 2×7 (99.1 × 38.1 mm)', page: 'A4', cols: 2, rows: 7, w: 99.1, h: 38.1, mt: 15.1, ml: 4.65, gx: 2.5, gy: 0 },
    { id: 'letter-3x10', label: 'Carta · 3×10 (66.7 × 25.4 mm) · Avery 5160', page: 'letter', cols: 3, rows: 10, w: 66.7, h: 25.4, mt: 12.7, ml: 4.7, gx: 3.2, gy: 0 },
    { id: 'letter-2x5', label: 'Carta · 2×5 (101.6 × 50.8 mm) · Avery 5163', page: 'letter', cols: 2, rows: 5, w: 101.6, h: 50.8, mt: 12.7, ml: 4.7, gx: 4.8, gy: 0 },
];
export default function LabelPrintModal({ open, onClose, products }) {
    const currency = useCurrency();
    const { activeBranchId } = useBranch();
    const printRef = useRef(null);
    // Sucursal cuyo precio se imprime en la etiqueta
    const [priceWarehouseId, setPriceWarehouseId] = useState(activeBranchId || ALL_BRANCHES);
    const [warehouses, setWarehouses] = useState([]);
    const [branchPrices, setBranchPrices] = useState(new Map());
    useEffect(() => {
        warehousesService
            .getAll()
            .then((w) => setWarehouses((w || []).filter((x) => x.is_active !== false).map((x) => ({ id: x.id, name: x.name }))))
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
            .then((m) => { if (!cancelado)
            setBranchPrices(m); })
            .catch(() => { if (!cancelado)
            setBranchPrices(new Map()); });
        return () => { cancelado = true; };
    }, [priceWarehouseId]);
    const [templateId, setTemplateId] = useState('a4-3x8');
    const [custom, setCustom] = useState({
        ...TEMPLATES[0], id: 'custom', label: 'Personalizado',
    });
    const [symbology, setSymbology] = useState(products.length ? effectiveSymbology(products[0]) : 'CODE128');
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
    const options = {
        symbology, showName, showSku, showPrice, widthMm: tpl.w, heightMm: tpl.h,
    };
    // Productos que no se pueden representar en la simbología elegida
    const invalid = useMemo(() => {
        return products
            .map(p => ({ p, v: validateCode(resolveCodeValue(p), symbology) }))
            .filter(x => !x.v.ok);
    }, [products, symbology]);
    const printable = useMemo(() => products.filter(p => validateCode(resolveCodeValue(p), symbology).ok), [products, symbology]);
    const priceLabels = useMemo(() => {
        const map = {};
        printable.forEach(p => {
            map[p.id] = currency.format(priceService.resolve(p, branchPrices.get(p.id)).sale_price);
        });
        return map;
    }, [printable, currency, branchPrices]);
    // Etiquetas expandidas por copias, precedidas por los huecos ya usados de la hoja
    const pages = useMemo(() => {
        const cells = [];
        const offset = Math.min(Math.max(0, startAt - 1), perPage - 1);
        for (let i = 0; i < offset; i++)
            cells.push(null);
        printable.forEach(p => {
            for (let c = 0; c < Math.max(1, copies); c++)
                cells.push(p);
        });
        const out = [];
        for (let i = 0; i < cells.length; i += perPage)
            out.push(cells.slice(i, i + perPage));
        return out;
    }, [printable, copies, startAt, perPage]);
    const totalLabels = printable.length * Math.max(1, copies);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Etiquetas-${new Date().toISOString().slice(0, 10)}`,
    });
    const updateCustom = (patch) => setCustom(prev => ({ ...prev, ...patch }));
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-[980px] max-h-[92vh] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { children: ["Imprimir etiquetas \u00B7 ", products.length, " producto", products.length === 1 ? '' : 's'] }) }), _jsxs("div", { className: "grid gap-6 md:grid-cols-[300px_1fr] mt-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: "Formato de hoja" }), _jsxs(Select, { value: templateId, onValueChange: setTemplateId, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [TEMPLATES.map(t => _jsx(SelectItem, { value: t.id, children: t.label }, t.id)), _jsx(SelectItem, { value: "custom", children: "Personalizado\u2026" })] })] })] }), templateId === 'custom' && (_jsxs("div", { className: "grid grid-cols-2 gap-2 p-3 rounded-md border bg-muted/40", children: [_jsxs("div", { className: "grid gap-1", children: [_jsx(Label, { className: "text-xs", children: "Hoja" }), _jsxs(Select, { value: custom.page, onValueChange: (v) => updateCustom({ page: v }), children: [_jsx(SelectTrigger, { className: "h-8", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "A4", children: "A4" }), _jsx(SelectItem, { value: "letter", children: "Carta" })] })] })] }), [
                                            ['cols', 'Columnas'], ['rows', 'Filas'],
                                            ['w', 'Ancho (mm)'], ['h', 'Alto (mm)'],
                                            ['ml', 'Margen izq. (mm)'], ['mt', 'Margen sup. (mm)'],
                                            ['gx', 'Sep. horiz. (mm)'], ['gy', 'Sep. vert. (mm)'],
                                        ].map(([key, lbl]) => (_jsxs("div", { className: "grid gap-1", children: [_jsx(Label, { className: "text-xs", children: lbl }), _jsx(Input, { className: "h-8", type: "number", step: "0.1", value: String(custom[key]), onChange: (e) => updateCustom({ [key]: Number(e.target.value) || 0 }) })] }, key)))] })), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: "C\u00F3digo a imprimir" }), _jsxs(Select, { value: symbology, onValueChange: (v) => setSymbology(v), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "CODE128", children: "Barras \u00B7 Code128" }), _jsx(SelectItem, { value: "EAN13", children: "Barras \u00B7 EAN-13" }), _jsx(SelectItem, { value: "QR", children: "QR" })] })] }), symbology === 'QR' && (_jsx("p", { className: "text-xs text-muted-foreground", children: "Requiere un lector 2D. Los lectores l\u00E1ser de barras no leen QR." }))] }), showPrice && warehouses.length > 0 && (_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { children: "Precio de qu\u00E9 sucursal" }), _jsxs(Select, { value: priceWarehouseId, onValueChange: setPriceWarehouseId, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: ALL_BRANCHES, children: "Precio base del cat\u00E1logo" }), warehouses.map(w => _jsx(SelectItem, { value: w.id, children: w.name }, w.id))] })] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "copies", children: "Copias c/u" }), _jsx(Input, { id: "copies", type: "number", min: 1, value: copies, onChange: (e) => setCopies(Math.max(1, Number(e.target.value) || 1)) })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "startAt", children: "Empezar en" }), _jsx(Input, { id: "startAt", type: "number", min: 1, max: perPage, value: startAt, onChange: (e) => setStartAt(Math.min(perPage, Math.max(1, Number(e.target.value) || 1))) })] })] }), _jsxs("p", { className: "text-xs text-muted-foreground -mt-2", children: ["\u00ABEmpezar en\u00BB salta etiquetas ya usadas de la hoja (de 1 a ", perPage, ")."] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Mostrar en la etiqueta" }), [
                                            ['Nombre', showName, setShowName],
                                            ['Código en texto', showSku, setShowSku],
                                            ['Precio', showPrice, setShowPrice],
                                            ['Guías de corte (solo pantalla)', showGuide, setShowGuide],
                                        ].map(([lbl, val, set]) => (_jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx(Checkbox, { checked: val, onCheckedChange: (c) => set(Boolean(c)) }), lbl] }, lbl)))] }), _jsxs("div", { className: "text-sm text-muted-foreground border-t pt-3", children: [totalLabels, " etiqueta", totalLabels === 1 ? '' : 's', " \u00B7 ", pages.length, " hoja", pages.length === 1 ? '' : 's'] }), !fits && (_jsxs("div", { className: "text-xs rounded-md border border-red-300 bg-red-50 text-red-900 p-2", children: [_jsx("span", { className: "font-medium", children: "La plantilla no cabe en la hoja." }), ' ', "Se pasa", overflowMm.x > 0 && ` ${overflowMm.x} mm de ancho`, overflowMm.x > 0 && overflowMm.y > 0 && ' y', overflowMm.y > 0 && ` ${overflowMm.y} mm de alto`, ". La \u00FAltima ", overflowMm.y > 0 ? 'fila' : 'columna', " saldr\u00E1 recortada."] })), invalid.length > 0 && (_jsxs("div", { className: "text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2 space-y-1", children: [_jsxs("div", { className: "font-medium", children: [invalid.length, " producto", invalid.length === 1 ? ' queda' : 's quedan', " fuera:"] }), _jsxs("ul", { className: "list-disc pl-4 space-y-0.5", children: [invalid.slice(0, 5).map(({ p, v }) => (_jsxs("li", { children: [_jsx("span", { className: "font-mono", children: p.sku || p.name }), " \u2014 ", v.error] }, p.id))), invalid.length > 5 && _jsxs("li", { children: ["\u2026y ", invalid.length - 5, " m\u00E1s"] })] })] }))] }), _jsx("div", { className: "border rounded-md bg-gray-100 dark:bg-gray-900 p-3 overflow-auto max-h-[62vh]", children: pages.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground text-center py-10", children: "No hay nada que imprimir con esta configuraci\u00F3n." })) : (_jsx("div", { style: { transform: 'scale(0.52)', transformOrigin: 'top left', width: `${pageSize.w * 0.52}mm` }, children: _jsxs("div", { ref: printRef, children: [_jsx("style", { children: `
                    @media print {
                      @page { size: ${tpl.page === 'A4' ? 'A4' : 'letter'}; margin: 0; }
                      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    .label-sheet { break-after: page; page-break-after: always; }
                    .label-sheet:last-child { break-after: auto; page-break-after: auto; }
                  ` }), pages.map((cells, pi) => (_jsx("div", { className: "label-sheet", style: {
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
                                            }, children: cells.map((p, ci) => p ? (_jsx(ProductLabel, { product: p, options: options, priceLabel: priceLabels[p.id], showGuide: showGuide }, `${pi}-${ci}-${p.id}`)) : (_jsx("div", { style: { width: `${tpl.w}mm`, height: `${tpl.h}mm` } }, `${pi}-${ci}-blank`))) }, pi)))] }) })) })] }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { variant: "outline", onClick: onClose, children: "Cancelar" }), _jsxs(Button, { onClick: () => handlePrint(), disabled: pages.length === 0, children: ["Imprimir ", totalLabels > 0 ? `(${totalLabels})` : ''] })] })] }) }));
}
