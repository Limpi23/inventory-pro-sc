import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { productService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import ProductModal from "./ProductModal";
import ProductImport from "./ProductImport";
import ProductPriceUpdate from './ProductPriceUpdate';
export default function ProductList() {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
    useEffect(() => {
        fetchProducts();
    }, []);
    async function fetchProducts() {
        try {
            setIsLoading(true);
            const data = await productService.getAll();
            setProducts(data || []);
        }
        catch (error) {
            console.error("Error al cargar productos:", error);
        }
        finally {
            setIsLoading(false);
        }
    }
    async function handleSearch() {
        if (!searchQuery.trim()) {
            fetchProducts();
            return;
        }
        try {
            setIsLoading(true);
            const data = await productService.search(searchQuery);
            setProducts(data || []);
        }
        catch (error) {
            console.error("Error al buscar productos:", error);
        }
        finally {
            setIsLoading(false);
        }
    }
    function handleEdit(product) {
        setEditingProduct(product);
        setIsModalOpen(true);
    }
    async function handleDelete(id) {
        if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
            try {
                await productService.delete(id);
                fetchProducts();
            }
            catch (error) {
                console.error("Error al eliminar producto:", error);
            }
        }
    }
    function handleModalClose() {
        setIsModalOpen(false);
        setEditingProduct(null);
        fetchProducts();
    }
    // Formatear el precio como moneda
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(CardTitle, { className: "text-xl md:text-2xl", children: "Productos" }), _jsxs("div", { className: "flex gap-2 sm:justify-end w-full sm:w-auto", children: [_jsx(ProductImport, { onImportComplete: fetchProducts, size: "sm", className: "w-full sm:w-auto" }), _jsx(Button, { onClick: () => setIsPriceUpdateOpen(true), className: "bg-yellow-500 hover:bg-yellow-600 text-white whitespace-nowrap text-xs md:text-sm w-full sm:w-auto", "aria-label": "Actualizar precios masivos", size: "sm", children: "Actualizar Precios Masivos" }), _jsx(Button, { onClick: () => setIsModalOpen(true), className: "bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full sm:w-auto", size: "sm", children: "Agregar Producto" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2", children: [_jsx(Input, { placeholder: "Buscar productos...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch(), className: "w-full" }), _jsx(Button, { variant: "outline", onClick: handleSearch, className: "whitespace-nowrap", size: "sm", children: "Buscar" })] })] }), _jsx(CardContent, { children: isLoading ? (_jsx("p", { children: "Cargando productos..." })) : (_jsx("div", { className: "overflow-x-auto -mx-4 md:mx-0", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "SKU" }), _jsx(TableHead, { className: "hidden lg:table-cell", children: "Categor\u00EDa" }), _jsx(TableHead, { className: "hidden xl:table-cell", children: "Precio Compra" }), _jsx(TableHead, { children: "Precio Venta" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "Estado" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: products.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, className: "text-center", children: "No hay productos registrados" }) })) : (products.map((product) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: product.name }), _jsx(TableCell, { className: "hidden md:table-cell", children: product.sku || "-" }), _jsx(TableCell, { className: "hidden lg:table-cell", children: product.category?.name || "-" }), _jsx(TableCell, { className: "hidden xl:table-cell", children: formatCurrency(product.purchase_price ?? 0) }), _jsx(TableCell, { children: formatCurrency(product.sale_price ?? 0) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs capitalize ${product.status === 'active'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : product.status === 'inactive'
                                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`, children: product.status === 'active'
                                                    ? 'Activo'
                                                    : product.status === 'inactive'
                                                        ? 'Inactivo'
                                                        : 'Descontinuado' }) }), _jsxs(TableCell, { className: "text-right whitespace-nowrap", children: [_jsx(Button, { variant: "outline", size: "sm", className: "mr-2", onClick: () => handleEdit(product), children: "Editar" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => handleDelete(product.id), children: "Eliminar" })] })] }, product.id)))) })] }) })) }), _jsx(ProductModal, { open: isModalOpen, onClose: handleModalClose, product: editingProduct }), _jsx(ProductPriceUpdate, { open: isPriceUpdateOpen, onClose: () => setIsPriceUpdateOpen(false), onUpdateComplete: fetchProducts })] }));
}
