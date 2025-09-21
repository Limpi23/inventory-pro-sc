import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { productService, warehousesService, locationsService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Ban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import * as XLSX from "xlsx";
import ProductModal from "./ProductModal";
import ProductImport from "./ProductImport";
import ProductPriceUpdate from './ProductPriceUpdate';
import ProductBulkAssignLocation from './ProductBulkAssignLocation';
import { useAuth } from "../../lib/auth";
import { toast } from "react-hot-toast";
export default function ProductList() {
    const { user, hasPermission } = useAuth();
    const isAdmin = ((user?.role_name || '').toLowerCase().includes('admin')) || user?.role_id === 1;
    const canUpdateProducts = (isAdmin ||
        hasPermission('products', 'update') ||
        hasPermission('product', 'update') ||
        hasPermission('productos', 'update') ||
        hasPermission('inventory', 'update') ||
        hasPermission('*', 'update') ||
        hasPermission('products', '*') ||
        hasPermission('*', '*'));
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    // Alcance de selección por defecto: todos los filtrados (como ubicaciones)
    const [selectScope, setSelectScope] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [warehouseFilter, setWarehouseFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [locations, setLocations] = useState([]);
    useEffect(() => {
        fetchProducts();
        // Cargar listas para filtros
        (async () => {
            try {
                const [whs, locs] = await Promise.all([warehousesService.getAll(), locationsService.getAll()]);
                setWarehouses(whs?.map(w => ({ id: w.id, name: w.name })) || []);
                setLocations(locs?.map(l => ({ id: l.id, name: l.name, warehouse_id: l.warehouse_id })) || []);
            }
            catch (e) {
                console.error('Error cargando filtros almacén/ubicación', e);
            }
        })();
    }, []);
    async function fetchProducts(opts) {
        try {
            setIsLoading(true);
            const data = await productService.getAll();
            const list = data || [];
            setProducts(list);
            // Si los IDs seleccionados ya no están, límpialos
            setSelectedIds(prev => new Set([...prev].filter(id => list.some(p => p.id === id))));
            if (!opts?.keepPage)
                setPage(1);
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
            const list = data || [];
            setProducts(list);
            setSelectedIds(prev => new Set([...prev].filter(id => list.some(p => p.id === id))));
            setPage(1);
        }
        catch (error) {
            console.error("Error al buscar productos:", error);
        }
        finally {
            setIsLoading(false);
        }
    }
    // Paginación
    const filteredProducts = useMemo(() => {
        let list = products;
        if (warehouseFilter) {
            list = list.filter(p => (p.location?.warehouse_id === warehouseFilter) || (p.warehouse_id === warehouseFilter));
        }
        if (locationFilter) {
            list = list.filter(p => (p.location?.id === locationFilter) || (p.location_id === locationFilter));
        }
        return list;
    }, [products, warehouseFilter, locationFilter]);
    const total = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    const visibleProducts = useMemo(() => filteredProducts.slice(startIndex, endIndex), [filteredProducts, startIndex, endIndex]);
    useEffect(() => {
        // Ajustar página si cambia el total y la página actual queda fuera de rango
        if (page > totalPages)
            setPage(totalPages);
    }, [totalPages, page]);
    // Selección: por alcance (página o todos los filtrados)
    const scopeItems = selectScope === 'page' ? visibleProducts : filteredProducts;
    const allVisibleSelected = useMemo(() => scopeItems.length > 0 && scopeItems.every(p => selectedIds.has(p.id)), [scopeItems, selectedIds]);
    const someVisibleSelected = useMemo(() => scopeItems.some(p => selectedIds.has(p.id)) && !allVisibleSelected, [scopeItems, selectedIds, allVisibleSelected]);
    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            // deseleccionar visibles
            const next = new Set(selectedIds);
            scopeItems.forEach(p => next.delete(p.id));
            setSelectedIds(next);
        }
        else {
            // seleccionar visibles
            const next = new Set(selectedIds);
            scopeItems.forEach(p => next.add(p.id));
            setSelectedIds(next);
        }
    };
    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    function handleEdit(product) {
        setEditingProduct(product);
        setIsModalOpen(true);
    }
    async function handleDelete(id) {
        if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
            try {
                await productService.delete(id);
                // Log de evento
                window.logger?.log({
                    action: 'product.delete',
                    entity: 'product',
                    entityId: id,
                    actor: user?.email || undefined
                });
                fetchProducts({ keepPage: true });
            }
            catch (error) {
                console.error("Error al eliminar producto:", error);
            }
        }
    }
    async function handleMarkInactive(id, alreadyInactive) {
        if (alreadyInactive)
            return;
        try {
            await productService.update(id, { status: 'inactive' });
            window.logger?.log({ action: 'product.mark_inactive', entity: 'product', entityId: id, actor: user?.email || undefined });
            fetchProducts({ keepPage: true });
        }
        catch (error) {
            console.error('Error al marcar inactivo:', error);
        }
    }
    async function handleMarkActive(id, alreadyActive) {
        if (alreadyActive)
            return;
        try {
            await productService.update(id, { status: 'active' });
            window.logger?.log({ action: 'product.mark_active', entity: 'product', entityId: id, actor: user?.email || undefined });
            fetchProducts({ keepPage: true });
        }
        catch (error) {
            console.error('Error al marcar activo:', error);
        }
    }
    function handleModalClose() {
        setIsModalOpen(false);
        setEditingProduct(null);
        fetchProducts({ keepPage: true });
    }
    // Formatear el precio como moneda
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };
    // Exportar a Excel (seleccionados o todos si no hay selección)
    const handleExportExcel = () => {
        const items = selectedIds.size > 0
            ? products.filter(p => selectedIds.has(p.id))
            : products;
        const rows = items.map(p => ({
            ID: p.id,
            Nombre: p.name,
            SKU: p.sku || "",
            Categoria: p.category?.name || "",
            "Precio Compra": p.purchase_price ?? 0,
            "Precio Venta": p.sale_price ?? 0,
            Estado: p.status,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Productos");
        XLSX.writeFile(wb, `productos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(CardTitle, { className: "text-xl md:text-2xl", children: "Productos" }), _jsxs("div", { className: "flex gap-2 sm:justify-end w-full sm:w-auto", children: [_jsx(ProductImport, { onImportComplete: fetchProducts, size: "sm", className: "w-full sm:w-auto" }), _jsxs(Button, { onClick: handleExportExcel, variant: "outline", className: "whitespace-nowrap w-full sm:w-auto", size: "sm", children: ["Exportar Excel ", selectedIds.size > 0 ? `(${selectedIds.size})` : ""] }), _jsx(ProductBulkAssignLocation, { selectedIds: [...selectedIds], onDone: () => fetchProducts({ keepPage: true }) }), _jsx(Button, { onClick: () => setIsPriceUpdateOpen(true), className: "bg-yellow-500 hover:bg-yellow-600 text-white whitespace-nowrap text-xs md:text-sm w-full sm:w-auto", "aria-label": "Actualizar precios masivos", size: "sm", children: "Actualizar Precios Masivos" }), _jsx(Button, { onClick: () => setIsModalOpen(true), className: "bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full sm:w-auto", size: "sm", children: "Agregar Producto" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2", children: [_jsx(Input, { placeholder: "Buscar productos...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch(), className: "w-full" }), _jsxs(Select, { value: warehouseFilter || 'all', onValueChange: (v) => { setWarehouseFilter(v === 'all' ? '' : v); setPage(1); }, children: [_jsx(SelectTrigger, { className: "min-w-[150px]", children: _jsx(SelectValue, { placeholder: "Almac\u00E9n" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "Todos almacenes" }), warehouses.map(w => (_jsx(SelectItem, { value: w.id, children: w.name }, w.id)))] })] }), _jsxs(Select, { value: locationFilter || 'all', onValueChange: (v) => { setLocationFilter(v === 'all' ? '' : v); setPage(1); }, children: [_jsx(SelectTrigger, { className: "min-w-[150px]", children: _jsx(SelectValue, { placeholder: "Ubicaci\u00F3n" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "Todas ubicaciones" }), locations
                                                .filter(l => !warehouseFilter || l.warehouse_id === warehouseFilter)
                                                .map(l => (_jsx(SelectItem, { value: l.id, children: l.name }, l.id)))] })] })] })] }), _jsx(CardContent, { children: isLoading ? (_jsx("p", { children: "Cargando productos..." })) : (_jsxs("div", { className: "overflow-x-auto -mx-4 md:mx-0", children: [selectedIds.size > 0 && (_jsxs("div", { className: "flex items-center justify-between p-3 mb-2 rounded-md bg-blue-50 text-blue-900 border border-blue-200", children: [_jsxs("div", { className: "text-sm", children: ["Seleccionados ", selectedIds.size, " de ", selectScope === 'page' ? visibleProducts.length : filteredProducts.length, selectScope === 'page' ? ' en esta página' : ' en total', "."] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setSelectedIds(new Set()), children: "Limpiar selecci\u00F3n" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: async () => {
                                                if (selectedIds.size === 0)
                                                    return;
                                                const count = selectedIds.size;
                                                const ok = confirm(`¿Eliminar ${count} producto${count === 1 ? '' : 's'} seleccionado${count === 1 ? '' : 's'}? Esta acción es irreversible.`);
                                                if (!ok)
                                                    return;
                                                try {
                                                    setIsLoading(true);
                                                    const ids = Array.from(selectedIds);
                                                    await productService.deleteMany(ids);
                                                    window.logger?.log({ action: 'product.bulk_delete', entity: 'product', details: { ids }, actor: user?.email || undefined });
                                                    setSelectedIds(new Set());
                                                    await fetchProducts({ keepPage: true });
                                                }
                                                catch (e) {
                                                    console.error('Error en eliminación masiva de productos', e);
                                                    toast.error('Ocurrió un error eliminando uno o más productos.');
                                                }
                                                finally {
                                                    setIsLoading(false);
                                                }
                                            }, children: "Eliminar seleccionados" })] })] })), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-10", children: _jsx(Checkbox, { checked: someVisibleSelected ? 'indeterminate' : allVisibleSelected, onCheckedChange: toggleSelectAll, "aria-label": selectScope === 'page' ? 'Seleccionar todos en esta página' : 'Seleccionar todos (filtrados)' }) }), _jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "SKU" }), _jsx(TableHead, { className: "hidden lg:table-cell", children: "Categor\u00EDa" }), _jsx(TableHead, { className: "hidden xl:table-cell", children: "Ubicaci\u00F3n" }), _jsx(TableHead, { className: "hidden xl:table-cell", children: "Precio Compra" }), _jsx(TableHead, { children: "Precio Venta" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "Estado" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: products.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 8, className: "text-center", children: "No hay productos registrados" }) })) : (visibleProducts.map((product) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "w-10", children: _jsx(Checkbox, { checked: selectedIds.has(product.id), onCheckedChange: () => toggleOne(product.id), "aria-label": `Seleccionar ${product.name}` }) }), _jsx(TableCell, { children: product.name }), _jsx(TableCell, { className: "hidden md:table-cell", children: product.sku || "-" }), _jsx(TableCell, { className: "hidden lg:table-cell", children: product.category?.name || "-" }), _jsx(TableCell, { className: "hidden xl:table-cell", children: product.location?.name || '-' }), _jsx(TableCell, { className: "hidden xl:table-cell", children: formatCurrency(product.purchase_price ?? 0) }), _jsx(TableCell, { children: formatCurrency(product.sale_price ?? 0) }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs capitalize ${product.status === 'active'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                        : product.status === 'inactive'
                                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`, children: product.status === 'active'
                                                        ? 'Activo'
                                                        : product.status === 'inactive'
                                                            ? 'Inactivo'
                                                            : 'Descontinuado' }) }), _jsx(TableCell, { className: "text-right whitespace-nowrap", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: [_jsx(MoreHorizontal, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Abrir men\u00FA" })] }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: () => handleEdit(product), className: "gap-2", children: [_jsx(Pencil, { className: "h-4 w-4" }), " Editar"] }), _jsx(DropdownMenuItem, { onClick: () => {
                                                                        if (!canUpdateProducts) {
                                                                            toast.error('No tienes permiso para cambiar el estado del producto');
                                                                            return;
                                                                        }
                                                                        if (product.status === 'active') {
                                                                            handleMarkInactive(product.id, false);
                                                                        }
                                                                        else {
                                                                            handleMarkActive(product.id, false);
                                                                        }
                                                                    }, className: "gap-2", children: product.status === 'active' ? (_jsxs(_Fragment, { children: [_jsx(Ban, { className: "h-4 w-4" }), " Marcar inactivo"] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", className: "h-4 w-4", children: _jsx("path", { fillRule: "evenodd", d: "M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-2.46a.75.75 0 1 0-1.22-.88l-3.236 4.49-1.49-1.49a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.616-4.836Z", clipRule: "evenodd" }) }), "Marcar activo"] })) }), _jsxs(DropdownMenuItem, { onClick: () => handleDelete(product.id), className: "gap-2 text-red-600 focus:text-red-600", children: [_jsx(Trash2, { className: "h-4 w-4" }), " Eliminar"] })] })] }) })] }, product.id)))) })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: ["Mostrando ", total === 0 ? 0 : startIndex + 1, "\u2013", endIndex, " de ", total] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm hidden md:inline", children: "Selecci\u00F3n" }), _jsxs(Select, { value: selectScope, onValueChange: (val) => setSelectScope(val), children: [_jsx(SelectTrigger, { className: "w-[160px]", "aria-label": "Alcance de selecci\u00F3n", children: _jsx(SelectValue, { placeholder: "P\u00E1gina" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "page", children: "Esta p\u00E1gina" }), _jsx(SelectItem, { value: "all", children: "Todos (filtrados)" })] })] }), _jsx("span", { className: "text-sm", children: "Por p\u00E1gina" }), _jsxs(Select, { value: String(pageSize), onValueChange: (val) => { setPageSize(Number(val)); setPage(1); }, children: [_jsx(SelectTrigger, { className: "w-[80px]", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "10", children: "10" }), _jsx(SelectItem, { value: "20", children: "20" }), _jsx(SelectItem, { value: "50", children: "50" }), _jsx(SelectItem, { value: "100", children: "100" })] })] }), _jsxs("div", { className: "flex items-center gap-2 ml-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page <= 1, children: "Anterior" }), _jsxs("div", { className: "text-sm", children: ["P\u00E1gina ", page, " de ", totalPages] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page >= totalPages, children: "Siguiente" })] })] })] })] })) }), _jsx(ProductModal, { open: isModalOpen, onClose: handleModalClose, product: editingProduct }), _jsx(ProductPriceUpdate, { open: isPriceUpdateOpen, onClose: () => setIsPriceUpdateOpen(false), onUpdateComplete: fetchProducts })] }));
}
