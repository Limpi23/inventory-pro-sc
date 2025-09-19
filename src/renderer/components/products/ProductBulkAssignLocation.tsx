import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { locationsService, productService, warehousesService } from '../../lib/supabase';

interface Props {
  selectedIds: string[];
  onDone: () => void;
}

export default function ProductBulkAssignLocation({ selectedIds, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [whs, locs] = await Promise.all([warehousesService.getAll(), locationsService.getAll()]);
        setWarehouses(whs || []);
        setLocations(locs || []);
      } catch (e) {
        console.error('Error cargando almacenes/ubicaciones', e);
      }
    })();
  }, [open]);

  const locationsFiltered = locations.filter(l => !warehouseId || l.warehouse_id === warehouseId);

  const handleAssign = async () => {
    setSaving(true);
    try {
      const id = locationId || null as any;
      // Actualizar en lotes de 100
      const ids = [...selectedIds];
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await Promise.all(batch.map(pid => productService.update(pid, { location_id: id as any })));
      }
      setOpen(false);
      setWarehouseId('');
      setLocationId('');
      onDone();
    } catch (e) {
      console.error('Error asignando ubicación en lote', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={selectedIds.length === 0}
        onClick={() => setOpen(true)}
        className="whitespace-nowrap"
      >
        Asignar Ubicación {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Asignar ubicación a {selectedIds.length} producto(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <span className="text-sm">Almacén (opcional para filtrar)</span>
              <Select value={warehouseId || 'all'} onValueChange={(v) => setWarehouseId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar almacén" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="text-sm">Ubicación</span>
              <Select value={locationId || 'null'} onValueChange={(v) => setLocationId(v === 'null' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sin ubicación</SelectItem>
                  {locationsFiltered.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={saving || selectedIds.length === 0}>{saving ? 'Asignando...' : 'Asignar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
