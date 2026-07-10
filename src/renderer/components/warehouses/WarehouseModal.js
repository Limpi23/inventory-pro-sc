import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { warehousesService } from "../../lib/supabase";
import { useBranch } from "../../lib/branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "../ui/select";
export default function WarehouseModal({ open, onClose, warehouse }) {
    const { refreshWarehouses } = useBranch();
    const [formData, setFormData] = useState({
        name: "",
        location: "",
        description: "",
        branch_type: "sucursal",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    // Actualizar el formulario cuando se edita un almacén existente
    useEffect(() => {
        if (warehouse) {
            setFormData({
                name: warehouse.name,
                location: warehouse.location || "",
                description: warehouse.description || "",
                branch_type: warehouse.branch_type || "sucursal",
            });
        }
        else {
            // Reiniciar el formulario al crear un nuevo almacén
            setFormData({
                name: "",
                location: "",
                description: "",
                branch_type: "sucursal",
            });
        }
    }, [warehouse, open]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError("El nombre es obligatorio");
            return;
        }
        try {
            setIsSubmitting(true);
            setError("");
            const payload = {
                name: formData.name,
                location: formData.location || undefined,
                description: formData.description || undefined,
                branch_type: formData.branch_type || "sucursal",
            };
            if (warehouse) {
                await warehousesService.update(warehouse.id, payload);
            }
            else {
                await warehousesService.create({ ...payload, is_active: true });
            }
            await refreshWarehouses();
            onClose();
        }
        catch (err) {
            const msg = String(err.message || "");
            if (msg.includes("uniq_warehouses_matriz") || (msg.includes("duplicate key") && msg.includes("matriz"))) {
                setError("Ya existe una casa matriz. Solo puede haber una: cambie la actual a sucursal primero.");
            }
            else if (msg.includes("branch_type")) {
                setError("La base de datos aún no tiene la migración de sucursales. Ejecute las migraciones desde el menú de la aplicación.");
            }
            else {
                setError(msg || "Error al guardar el almacén");
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-[425px]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: warehouse ? "Editar Sucursal/Almacén" : "Agregar Sucursal/Almacén" }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre" }), _jsx(Input, { id: "name", name: "name", value: formData.name, onChange: handleChange, required: true, placeholder: "Nombre de la sucursal o almac\u00E9n" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "branch_type", children: "Tipo" }), _jsxs(Select, { value: formData.branch_type || "sucursal", onValueChange: (value) => setFormData((prev) => ({ ...prev, branch_type: value })), children: [_jsx(SelectTrigger, { id: "branch_type", children: _jsx(SelectValue, { placeholder: "Tipo" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "matriz", children: "Casa Matriz" }), _jsx(SelectItem, { value: "sucursal", children: "Sucursal" })] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Solo puede existir una casa matriz." })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "location", children: "Ubicaci\u00F3n" }), _jsx(Input, { id: "location", name: "location", value: formData.location || "", onChange: handleChange, placeholder: "Direcci\u00F3n o ciudad (opcional)" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "description", children: "Descripci\u00F3n" }), _jsx(Input, { id: "description", name: "description", value: formData.description || "", onChange: handleChange, placeholder: "Descripci\u00F3n (opcional)" })] }), error && _jsx("p", { className: "text-red-500 text-sm", children: error }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: isSubmitting, children: isSubmitting ? "Guardando..." : "Guardar" })] })] })] }) }));
}
