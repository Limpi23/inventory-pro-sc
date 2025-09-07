import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
// Usar la versión dinámica de supabase dentro de renderer
import { warehousesService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import WarehouseModal from "./WarehouseModal";
export default function WarehouseList() {
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    useEffect(() => {
        fetchWarehouses();
    }, []);
    async function fetchWarehouses() {
        try {
            setIsLoading(true);
            const data = await warehousesService.getAll();
            setWarehouses(data || []);
        }
        catch (error) {
            console.error("Error al cargar almacenes:", error);
        }
        finally {
            setIsLoading(false);
        }
    }
    function handleEdit(warehouse) {
        setEditingWarehouse(warehouse);
        setIsModalOpen(true);
    }
    async function handleDelete(id) {
        if (confirm("¿Estás seguro de que deseas eliminar este almacén?")) {
            try {
                await warehousesService.delete(id);
                fetchWarehouses();
            }
            catch (error) {
                console.error("Error al eliminar almacén:", error);
            }
        }
    }
    function handleModalClose() {
        setIsModalOpen(false);
        setEditingWarehouse(null);
        fetchWarehouses();
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { className: "space-y-3", children: _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(CardTitle, { className: "text-xl md:text-2xl", children: "Almacenes" }), _jsx(Button, { onClick: () => setIsModalOpen(true), className: "bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto", size: "sm", children: "Agregar Almac\u00E9n" })] }) }), _jsx(CardContent, { children: isLoading ? (_jsx("p", { children: "Cargando almacenes..." })) : (_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { children: "Ubicaci\u00F3n" }), _jsx(TableHead, { children: "Descripci\u00F3n" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: warehouses.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 4, className: "text-center", children: "No hay almacenes registrados" }) })) : (warehouses.map((warehouse) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: warehouse.name }), _jsx(TableCell, { children: warehouse.location || "-" }), _jsx(TableCell, { children: warehouse.description || "-" }), _jsxs(TableCell, { className: "text-right", children: [_jsx(Button, { variant: "outline", size: "sm", className: "mr-2", onClick: () => handleEdit(warehouse), children: "Editar" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => handleDelete(warehouse.id), children: "Eliminar" })] })] }, warehouse.id)))) })] })) }), _jsx(WarehouseModal, { open: isModalOpen, onClose: handleModalClose, warehouse: editingWarehouse })] }));
}
