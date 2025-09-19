import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { locationsService, productService, warehousesService } from '../../lib/supabase';
export default function ProductBulkAssignLocation({ selectedIds, onDone }) {
    const [open, setOpen] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [locations, setLocations] = useState([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        (async () => {
            try {
                const [whs, locs] = await Promise.all([warehousesService.getAll(), locationsService.getAll()]);
                setWarehouses(whs || []);
                setLocations(locs || []);
            }
            catch (e) {
                console.error('Error cargando almacenes/ubicaciones', e);
            }
        })();
    }, [open]);
    const locationsFiltered = locations.filter(l => !warehouseId || l.warehouse_id === warehouseId);
    const handleAssign = async () => {
        setSaving(true);
        try {
            const id = locationId || null;
            // Actualizar en lotes de 100
            const ids = [...selectedIds];
            for (let i = 0; i < ids.length; i += 100) {
                const batch = ids.slice(i, i + 100);
                await Promise.all(batch.map(pid => productService.update(pid, { location_id: id })));
            }
            setOpen(false);
            setWarehouseId('');
            setLocationId('');
            onDone();
        }
        catch (e) {
            console.error('Error asignando ubicación en lote', e);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", disabled: selectedIds.length === 0, onClick: () => setOpen(true), className: "whitespace-nowrap", children: ["Asignar Ubicaci\u00F3n ", selectedIds.length > 0 ? `(${selectedIds.length})` : ''] }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "sm:max-w-[520px]", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { children: ["Asignar ubicaci\u00F3n a ", selectedIds.length, " producto(s)"] }) }), _jsxs("div", { className: "space-y-4 mt-2", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx("span", { className: "text-sm", children: "Almac\u00E9n (opcional para filtrar)" }), _jsxs(Select, { value: warehouseId || 'all', onValueChange: (v) => setWarehouseId(v === 'all' ? '' : v), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Seleccionar almac\u00E9n" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "Todos" }), warehouses.map(w => (_jsx(SelectItem, { value: w.id, children: w.name }, w.id)))] })] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("span", { className: "text-sm", children: "Ubicaci\u00F3n" }), _jsxs(Select, { value: locationId || 'null', onValueChange: (v) => setLocationId(v === 'null' ? '' : v), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Seleccionar ubicaci\u00F3n" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "null", children: "Sin ubicaci\u00F3n" }), locationsFiltered.map(l => (_jsx(SelectItem, { value: l.id, children: l.name }, l.id)))] })] })] })] }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { variant: "outline", onClick: () => setOpen(false), children: "Cancelar" }), _jsx(Button, { onClick: handleAssign, disabled: saving || selectedIds.length === 0, children: saving ? 'Asignando...' : 'Asignar' })] })] }) })] }));
}
