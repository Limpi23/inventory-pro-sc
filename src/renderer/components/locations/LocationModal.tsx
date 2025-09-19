import { useEffect, useState } from 'react';
import { Location, Warehouse } from '../../../types';
import { locationsService, warehousesService } from '../../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  location: Location | null;
}

export default function LocationModal({ open, onClose, location }: LocationModalProps) {
  const [form, setForm] = useState<{ name: string; description?: string; warehouse_id?: string | null; active: boolean }>({
    name: '',
    description: '',
    warehouse_id: null,
    active: true,
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await warehousesService.getAll();
        setWarehouses(data);
      } catch (e) {
        console.error('Error cargando almacenes', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name,
        description: location.description || '',
        warehouse_id: location.warehouse_id || null,
        active: location.active ?? true,
      });
    } else {
      setForm({ name: '', description: '', warehouse_id: null, active: true });
    }
  }, [location, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (location) {
        await locationsService.update(location.id, form);
      } else {
        await locationsService.create(form as any);
      }
      onClose();
    } catch (err) {
      console.error('Error guardando ubicación', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{location ? 'Editar Ubicación' : 'Agregar Ubicación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="Nombre de la ubicación" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="warehouse_id">Almacén</Label>
              <Select value={form.warehouse_id || 'null'} onValueChange={(v) => setForm(p => ({ ...p, warehouse_id: v === 'null' ? null : v }))}>
                <SelectTrigger id="warehouse_id">
                  <SelectValue placeholder="Seleccionar almacén" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sin almacén</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" name="description" value={form.description || ''} onChange={handleChange} placeholder="Descripción (opcional)" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
