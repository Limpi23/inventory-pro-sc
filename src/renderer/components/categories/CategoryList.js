import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { categoriesService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "../ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import CategoryModal from "./CategoryModal";
import { toast } from "react-hot-toast";
export default function CategoryList() {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = useRef(null);
    useEffect(() => {
        fetchCategories();
    }, []);
    async function fetchCategories() {
        try {
            setIsLoading(true);
            const data = await categoriesService.getAll();
            setCategories(data || []);
        }
        catch (error) {
            toast.error("Error al cargar categorías");
        }
        finally {
            setIsLoading(false);
        }
    }
    function handleEdit(category) {
        setEditingCategory(category);
        setIsModalOpen(true);
    }
    async function handleDelete(id) {
        if (confirm("¿Estás seguro de que deseas eliminar esta categoría?")) {
            try {
                await categoriesService.delete(id);
                fetchCategories();
                toast.success("Categoría eliminada correctamente");
            }
            catch (error) {
                toast.error("Error al eliminar categoría");
            }
        }
    }
    function handleModalClose() {
        setIsModalOpen(false);
        setEditingCategory(null);
        fetchCategories();
    }
    // Función para manejar la importación de categorías
    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // Verificar que sea un archivo Excel
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        const validExtensions = ['.xlsx', '.xls'];
        const hasValidType = validTypes.includes(file.type);
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidType && !hasValidExtension) {
            toast.error("Por favor, selecciona un archivo Excel válido (.xlsx o .xls)");
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }
        try {
            setIsImporting(true);
            // Importar las categorías desde Excel
            const result = await categoriesService.importFromExcel(file);
            if (result.success > 0) {
                toast.success(`Se importaron ${result.success} categorías correctamente`);
                fetchCategories(); // Actualizar la lista de categorías
            }
            if (result.errors > 0) {
                toast.error(`No se pudieron importar ${result.errors} categorías`);
            }
            if (result.messages && result.messages.length > 0) {
                console.log('Mensajes de importación:', result.messages);
            }
        }
        catch (error) {
            console.error('Error al importar:', error);
            toast.error(error.message || "Error al importar categorías");
        }
        finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    // Función para exportar categorías a Excel
    const handleExport = async () => {
        try {
            setIsExporting(true);
            const blob = await categoriesService.exportToExcel();
            // Crear un enlace para descargar el archivo y hacer clic en él
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `categorias_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            // Limpiar
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("Categorías exportadas correctamente");
        }
        catch (error) {
            console.error('Error al exportar:', error);
            toast.error("Error al exportar categorías");
        }
        finally {
            setIsExporting(false);
        }
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between", children: [_jsx(CardTitle, { children: "Categor\u00EDas" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "file", ref: fileInputRef, onChange: handleFileChange, accept: ".xlsx,.xls", className: "hidden" }), _jsx(Button, { onClick: handleImportClick, variant: "outline", disabled: isImporting, children: isImporting ? "Importando..." : "Importar Excel" }), _jsx(Button, { onClick: handleExport, variant: "outline", disabled: isExporting || categories.length === 0, children: isExporting ? "Exportando..." : "Exportar Excel" }), _jsx(Button, { onClick: () => setIsModalOpen(true), children: "Agregar Categor\u00EDa" })] })] }), _jsx(CardContent, { children: isLoading ? (_jsx("p", { children: "Cargando categor\u00EDas..." })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { children: "Descripci\u00F3n" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: categories.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, className: "text-center", children: "No hay categor\u00EDas registradas" }) })) : (categories.map((category) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: category.name }), _jsx(TableCell, { children: category.description || "-" }), _jsx(TableCell, { className: "text-right", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", "aria-label": "Acciones", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-40", children: [_jsxs(DropdownMenuItem, { onClick: () => handleEdit(category), children: [_jsx(Pencil, { className: "h-4 w-4" }), "Editar"] }), _jsxs(DropdownMenuItem, { className: "text-red-600 focus:text-red-600", onClick: () => handleDelete(category.id), children: [_jsx(Trash2, { className: "h-4 w-4" }), "Eliminar"] })] })] }) })] }, category.id)))) })] })) }), _jsx(CategoryModal, { open: isModalOpen, onClose: handleModalClose, category: editingCategory })] }));
}
