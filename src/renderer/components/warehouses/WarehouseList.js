import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { warehousesService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "../ui/dropdown-menu";
import WarehouseModal from "./WarehouseModal";
export default function WarehouseList() {
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
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
        if (confirm("Estás seguro de que deseas eliminar este almacén?")) {
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
    const filteredWarehouses = warehouses.filter((warehouse) => {
        const searchLower = searchTerm.toLowerCase();
        return (warehouse.name.toLowerCase().includes(searchLower) ||
            warehouse.location?.toLowerCase().includes(searchLower) ||
            warehouse.description?.toLowerCase().includes(searchLower));
    });
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentWarehouses = filteredWarehouses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredWarehouses.length / itemsPerPage);
    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };
    const handleSearch = (value) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(CardTitle, { className: "text-xl md:text-2xl", children: "Almacenes" }), _jsxs(Button, { onClick: () => setIsModalOpen(true), className: "bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto", size: "sm", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Agregar Almac\u00E9n"] })] }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", placeholder: "Buscar por nombre, ubicaci\u00F3n o descripci\u00F3n...", value: searchTerm, onChange: (e) => handleSearch(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsx(CardContent, { children: isLoading ? (_jsx("div", { className: "flex justify-center items-center py-8", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs(_Fragment, { children: [_jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { children: "Ubicaci\u00F3n" }), _jsx(TableHead, { children: "Descripci\u00F3n" }), _jsx(TableHead, { className: "text-center", children: "Acciones" })] }) }), _jsx(TableBody, { children: currentWarehouses.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 4, className: "text-center py-8", children: searchTerm ? (_jsxs("div", { className: "flex flex-col items-center text-gray-500", children: [_jsx("i", { className: "fas fa-search text-4xl mb-2 text-gray-300" }), _jsxs("p", { children: ["No se encontraron resultados para \"", searchTerm, "\""] })] })) : (_jsxs("div", { className: "flex flex-col items-center text-gray-500", children: [_jsx("i", { className: "fas fa-warehouse text-4xl mb-2 text-gray-300" }), _jsx("p", { children: "No hay almacenes registrados" })] })) }) })) : (currentWarehouses.map((warehouse) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: warehouse.name }), _jsx(TableCell, { children: warehouse.location || "-" }), _jsx(TableCell, { className: "max-w-xs truncate", children: warehouse.description || "-" }), _jsx(TableCell, { className: "text-center", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-8 px-2", children: [_jsx("i", { className: "fas fa-ellipsis-v mr-2" }), "Acciones"] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "min-w-[180px]", children: [_jsxs(DropdownMenuItem, { onClick: () => handleEdit(warehouse), children: [_jsx("i", { className: "fas fa-edit text-muted-foreground" }), _jsx("span", { className: "ml-2", children: "Editar" })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => handleDelete(warehouse.id), className: "text-red-600 focus:text-red-700", children: [_jsx("i", { className: "fas fa-trash" }), _jsx("span", { className: "ml-2", children: "Eliminar" })] })] })] }) })] }, warehouse.id)))) })] }), filteredWarehouses.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex flex-col sm:flex-row items-center justify-between gap-4", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, filteredWarehouses.length), " de ", filteredWarehouses.length, " almacenes"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => handlePageChange(currentPage - 1), disabled: currentPage === 1, children: _jsx("i", { className: "fas fa-chevron-left" }) }), Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                            let pageNumber;
                                            if (totalPages <= 5)
                                                pageNumber = i + 1;
                                            else if (currentPage <= 3)
                                                pageNumber = i + 1;
                                            else if (currentPage >= totalPages - 2)
                                                pageNumber = totalPages - 4 + i;
                                            else
                                                pageNumber = currentPage - 2 + i;
                                            return (_jsx(Button, { variant: currentPage === pageNumber ? "default" : "outline", size: "sm", onClick: () => handlePageChange(pageNumber), className: currentPage === pageNumber ? "bg-blue-600 hover:bg-blue-700" : "", children: pageNumber }, pageNumber));
                                        }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => handlePageChange(currentPage + 1), disabled: currentPage === totalPages, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] })) }), _jsx(WarehouseModal, { open: isModalOpen, onClose: handleModalClose, warehouse: editingWarehouse })] }));
}
