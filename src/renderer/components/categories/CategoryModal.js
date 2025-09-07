import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { categoriesService } from "../../lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
export default function CategoryModal({ open, onClose, category }) {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    // Actualizar el formulario cuando se edita una categoría existente
    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name,
                description: category.description || "",
            });
        }
        else {
            // Reiniciar el formulario al crear una nueva categoría
            setFormData({
                name: "",
                description: "",
            });
        }
    }, [category, open]);
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
            if (category) {
                // Actualizar categoría existente
                await categoriesService.update(category.id, {
                    name: formData.name,
                    description: formData.description || undefined
                });
            }
            else {
                // Crear nueva categoría
                await categoriesService.create({
                    name: formData.name,
                    description: formData.description || undefined
                });
            }
            onClose();
        }
        catch (err) {
            setError(err.message || "Error al guardar la categoría");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-[425px]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: category ? "Editar Categoría" : "Agregar Categoría" }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre" }), _jsx(Input, { id: "name", name: "name", value: formData.name, onChange: handleChange, required: true, placeholder: "Nombre de la categor\u00EDa" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "description", children: "Descripci\u00F3n" }), _jsx(Input, { id: "description", name: "description", value: formData.description || "", onChange: handleChange, placeholder: "Descripci\u00F3n (opcional)" })] }), error && _jsx("p", { className: "text-red-500 text-sm", children: error }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: isSubmitting, children: isSubmitting ? "Guardando..." : "Guardar" })] })] })] }) }));
}
