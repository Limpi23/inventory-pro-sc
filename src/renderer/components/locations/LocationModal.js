import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { locationsService, warehousesService } from '../../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
export default function LocationModal({ open, onClose, location }) {
    const [form, setForm] = useState({
        name: '',
        description: '',
        warehouse_id: null,
        active: true,
    });
    const [warehouses, setWarehouses] = useState([]);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        (async () => {
            try {
                const data = await warehousesService.getAll();
                setWarehouses(data);
            }
            catch (e) {
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
        }
        else {
            setForm({ name: '', description: '', warehouse_id: null, active: true });
        }
    }, [location, open]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim())
            return;
        setSaving(true);
        try {
            if (location) {
                await locationsService.update(location.id, form);
            }
            else {
                await locationsService.create(form);
            }
            onClose();
        }
        catch (err) {
            console.error('Error guardando ubicación', err);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-[550px]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: location ? 'Editar Ubicación' : 'Agregar Ubicación' }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre *" }), _jsx(Input, { id: "name", name: "name", value: form.name, onChange: handleChange, required: true, placeholder: "Nombre de la ubicaci\u00F3n" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "warehouse_id", children: "Almac\u00E9n" }), _jsxs(Select, { value: form.warehouse_id || 'null', onValueChange: (v) => setForm(p => ({ ...p, warehouse_id: v === 'null' ? null : v })), children: [_jsx(SelectTrigger, { id: "warehouse_id", children: _jsx(SelectValue, { placeholder: "Seleccionar almac\u00E9n" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "null", children: "Sin almac\u00E9n" }), warehouses.map(w => (_jsx(SelectItem, { value: w.id, children: w.name }, w.id)))] })] })] }), _jsxs("div", { className: "grid gap-2 sm:col-span-2", children: [_jsx(Label, { htmlFor: "description", children: "Descripci\u00F3n" }), _jsx(Input, { id: "description", name: "description", value: form.description || '', onChange: handleChange, placeholder: "Descripci\u00F3n (opcional)" })] })] }), _jsxs(DialogFooter, { className: "mt-6", children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: saving, children: saving ? 'Guardando...' : 'Guardar' })] })] })] }) }));
}
