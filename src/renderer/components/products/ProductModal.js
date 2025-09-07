import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { productService, categoriesService } from "../../lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
export default function ProductModal({ open, onClose, product }) {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        sku: "",
        barcode: "",
        category_id: "",
        min_stock: 0,
        max_stock: null,
        purchase_price: 0,
        sale_price: 0,
        tax_rate: 0,
        status: "active",
        image_url: "",
    });
    const [categories, setCategories] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    // Cargar categorías
    useEffect(() => {
        async function loadCategories() {
            try {
                const data = await categoriesService.getAll();
                setCategories(data || []);
            }
            catch (error) {
                console.error("Error al cargar categorías:", error);
            }
        }
        loadCategories();
    }, []);
    // Actualizar el formulario cuando se edita un producto existente
    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name,
                description: product.description || "",
                sku: product.sku || "",
                barcode: product.barcode || "",
                category_id: product.category_id || "",
                min_stock: product.min_stock,
                max_stock: product.max_stock,
                purchase_price: product.purchase_price,
                sale_price: product.sale_price,
                tax_rate: product.tax_rate,
                status: product.status,
                image_url: product.image_url || "",
            });
        }
        else {
            // Reiniciar el formulario al crear un nuevo producto
            setFormData({
                name: "",
                description: "",
                sku: "",
                barcode: "",
                category_id: "",
                min_stock: 0,
                max_stock: null,
                purchase_price: 0,
                sale_price: 0,
                tax_rate: 0,
                status: "active",
                image_url: "",
            });
        }
    }, [product, open]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        // Convertir valores numéricos
        if (["min_stock", "max_stock", "purchase_price", "sale_price", "tax_rate"].includes(name)) {
            setFormData((prev) => ({
                ...prev,
                [name]: value === "" ? null : Number(value),
            }));
        }
        else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };
    const handleSelectChange = (name, value) => {
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
            if (product) {
                // Actualizar producto existente
                await productService.update(product.id, formData);
            }
            else {
                // Crear nuevo producto
                await productService.create(formData);
            }
            onClose();
        }
        catch (err) {
            setError(err.message || "Error al guardar el producto");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "sm:max-w-[650px]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: product ? "Editar Producto" : "Agregar Producto" }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre *" }), _jsx(Input, { id: "name", name: "name", value: formData.name, onChange: handleChange, required: true, placeholder: "Nombre del producto" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "category_id", children: "Categor\u00EDa" }), _jsxs(Select, { value: formData.category_id?.toString() || "null", onValueChange: (value) => handleSelectChange("category_id", value === "null" ? "" : value), children: [_jsx(SelectTrigger, { id: "category_id", children: _jsx(SelectValue, { placeholder: "Seleccionar categor\u00EDa" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "null", children: "Sin categor\u00EDa" }), categories.map((category) => (_jsx(SelectItem, { value: category.id, children: category.name }, category.id)))] })] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "sku", children: "SKU" }), _jsx(Input, { id: "sku", name: "sku", value: formData.sku || "", onChange: handleChange, placeholder: "C\u00F3digo SKU" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "barcode", children: "C\u00F3digo de barras" }), _jsx(Input, { id: "barcode", name: "barcode", value: formData.barcode || "", onChange: handleChange, placeholder: "C\u00F3digo de barras" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "purchase_price", children: "Precio de compra" }), _jsx(Input, { id: "purchase_price", name: "purchase_price", type: "number", value: formData.purchase_price !== null ? formData.purchase_price : "", onChange: handleChange, placeholder: "0" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "sale_price", children: "Precio de venta" }), _jsx(Input, { id: "sale_price", name: "sale_price", type: "number", value: formData.sale_price !== null ? formData.sale_price : "", onChange: handleChange, placeholder: "0" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "min_stock", children: "Stock m\u00EDnimo" }), _jsx(Input, { id: "min_stock", name: "min_stock", type: "number", value: formData.min_stock !== null ? formData.min_stock : "", onChange: handleChange, placeholder: "0" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "max_stock", children: "Stock m\u00E1ximo" }), _jsx(Input, { id: "max_stock", name: "max_stock", type: "number", value: formData.max_stock !== null ? formData.max_stock : "", onChange: handleChange, placeholder: "Stock m\u00E1ximo (opcional)" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "tax_rate", children: "Tasa de IVA (%)" }), _jsx(Input, { id: "tax_rate", name: "tax_rate", type: "number", value: formData.tax_rate !== null ? formData.tax_rate : "", onChange: handleChange, placeholder: "0" })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Label, { htmlFor: "status", children: "Estado" }), _jsxs(Select, { value: formData.status || "active", onValueChange: (value) => handleSelectChange("status", value), children: [_jsx(SelectTrigger, { id: "status", children: _jsx(SelectValue, { placeholder: "Seleccionar estado" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "active", children: "Activo" }), _jsx(SelectItem, { value: "inactive", children: "Inactivo" }), _jsx(SelectItem, { value: "discontinued", children: "Descontinuado" })] })] })] }), _jsxs("div", { className: "grid gap-2 col-span-2", children: [_jsx(Label, { htmlFor: "image_url", children: "URL de imagen" }), _jsx(Input, { id: "image_url", name: "image_url", value: formData.image_url || "", onChange: handleChange, placeholder: "URL de la imagen (opcional)" })] }), _jsxs("div", { className: "grid gap-2 col-span-2", children: [_jsx(Label, { htmlFor: "description", children: "Descripci\u00F3n" }), _jsx(Input, { id: "description", name: "description", value: formData.description || "", onChange: handleChange, placeholder: "Descripci\u00F3n del producto (opcional)" })] })] }), error && _jsx("p", { className: "text-red-500 text-sm", children: error }), _jsxs(DialogFooter, { className: "mt-6", children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: isSubmitting, children: isSubmitting ? "Guardando..." : "Guardar" })] })] })] }) }));
}
