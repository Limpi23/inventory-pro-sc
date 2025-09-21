import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { locationsService, warehousesService } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import * as XLSX from 'xlsx';
import LocationModal from './LocationModal';
import LocationImport from './LocationImport';
export default function LocationList() {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    // Alcance de selección: página actual o todos los resultados filtrados (por defecto: todos)
    const [selectScope, setSelectScope] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    useEffect(() => {
        fetchLocations();
    }, []);
    async function fetchLocations(opts) {
        try {
            setLoading(true);
            const [locs, whs] = await Promise.all([
                locationsService.getAll(),
                warehousesService.getAll(),
            ]);
            const byId = new Map((whs || []).map(w => [w.id, w]));
            const list = (locs || []).map(l => ({ ...l, warehouse: l.warehouse_id ? byId.get(l.warehouse_id) || null : null }));
            setLocations(list);
            setSelectedIds(prev => new Set([...prev].filter(id => list.some(l => l.id === id))));
            if (!opts?.keepPage)
                setPage(1);
        }
        catch (e) {
            console.error('Error cargando ubicaciones', e);
        }
        finally {
            setLoading(false);
        }
    }
    const handleEdit = (loc) => { setEditing(loc); setModalOpen(true); };
    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar ubicación?'))
            return;
        try {
            await locationsService.delete(id);
            fetchLocations({ keepPage: true });
        }
        catch (e) {
            console.error('Error eliminando ubicación', e);
        }
    };
    const handleClose = () => { setModalOpen(false); setEditing(null); fetchLocations({ keepPage: true }); };
    // Filtrado simple por búsqueda (cliente)
    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q)
            return locations;
        return locations.filter(l => l.name.toLowerCase().includes(q) ||
            (l.description || '').toLowerCase().includes(q) ||
            (l.warehouse?.name || '').toLowerCase().includes(q));
    }, [locations, searchQuery]);
    // Paginación
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    const visible = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);
    useEffect(() => { if (page > totalPages)
        setPage(totalPages); }, [totalPages, page]);
    // Selección
    const scopeItems = selectScope === 'page' ? visible : filtered;
    const allScopeSelected = useMemo(() => scopeItems.length > 0 && scopeItems.every(l => selectedIds.has(l.id)), [scopeItems, selectedIds]);
    const someScopeSelected = useMemo(() => scopeItems.some(l => selectedIds.has(l.id)) && !allScopeSelected, [scopeItems, selectedIds, allScopeSelected]);
    const toggleSelectAll = () => {
        if (allScopeSelected) {
            const next = new Set(selectedIds);
            scopeItems.forEach(l => next.delete(l.id));
            setSelectedIds(next);
        }
        else {
            const next = new Set(selectedIds);
            scopeItems.forEach(l => next.add(l.id));
            setSelectedIds(next);
        }
    };
    const toggleOne = (id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id))
        next.delete(id);
    else
        next.add(id); return next; });
    // Acciones masivas
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0)
            return;
        const count = selectedIds.size;
        if (!confirm(`¿Eliminar ${count} ubicaci${count === 1 ? 'ón' : 'ones'} seleccionada${count === 1 ? '' : 's'}?`))
            return;
        try {
            setLoading(true);
            const ids = Array.from(selectedIds);
            // Borrado en paralelo simple; si prefieres, se puede implementar en el servicio con .in('id', ...)
            await Promise.all(ids.map(id => locationsService.delete(id)));
            setSelectedIds(new Set());
            await fetchLocations({ keepPage: true });
        }
        catch (e) {
            console.error('Error eliminando ubicaciones seleccionadas', e);
            alert('Ocurrió un error al eliminar una o más ubicaciones.');
        }
        finally {
            setLoading(false);
        }
    };
    // Exportar a Excel
    const handleExportExcel = () => {
        const items = selectedIds.size > 0 ? locations.filter(l => selectedIds.has(l.id)) : locations;
        const rows = items.map(l => ({
            ID: l.id,
            Nombre: l.name,
            Descripción: l.description || '',
            Almacén: l.warehouse?.name || '',
            Activo: l.active ? 'Sí' : 'No',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ubicaciones');
        XLSX.writeFile(wb, `ubicaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx(CardTitle, { className: "text-xl md:text-2xl", children: "Ubicaciones" }), _jsxs("div", { className: "flex gap-2 sm:justify-end w-full sm:w-auto", children: [_jsx(LocationImport, { onImportComplete: () => fetchLocations(), size: "sm", className: "w-full sm:w-auto" }), _jsxs(Button, { onClick: handleExportExcel, variant: "outline", className: "whitespace-nowrap w-full sm:w-auto", size: "sm", children: ["Exportar Excel ", selectedIds.size > 0 ? `(${selectedIds.size})` : ''] }), _jsx(Button, { onClick: () => setModalOpen(true), className: "bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full sm:w-auto", size: "sm", children: "Agregar Ubicaci\u00F3n" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2", children: [_jsx(Input, { placeholder: "Buscar ubicaciones...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full" }), _jsx(Button, { variant: "outline", onClick: () => setPage(1), className: "whitespace-nowrap", size: "sm", children: "Buscar" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground hidden md:inline", children: "Selecci\u00F3n" }), _jsxs(Select, { value: selectScope, onValueChange: (val) => setSelectScope(val), children: [_jsx(SelectTrigger, { className: "w-[140px]", "aria-label": "Alcance de selecci\u00F3n", children: _jsx(SelectValue, { placeholder: "P\u00E1gina" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "page", children: "Esta p\u00E1gina" }), _jsx(SelectItem, { value: "all", children: "Todos (filtrados)" })] })] })] })] })] }), _jsx(CardContent, { children: loading ? (_jsx("p", { children: "Cargando ubicaciones..." })) : (_jsxs("div", { className: "overflow-x-auto -mx-4 md:mx-0", children: [selectedIds.size > 0 && (_jsxs("div", { className: "flex items-center justify-between p-3 mb-2 rounded-md bg-blue-50 text-blue-900 border border-blue-200", children: [_jsxs("div", { className: "text-sm", children: ["Seleccionados ", selectedIds.size, " de ", selectScope === 'page' ? visible.length : filtered.length, selectScope === 'page' ? ' en esta página' : ' en total', "."] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setSelectedIds(new Set()), children: "Limpiar selecci\u00F3n" }), _jsx(Button, { variant: "destructive", size: "sm", onClick: handleBulkDelete, disabled: loading, children: "Eliminar seleccionados" })] })] })), _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "w-10", children: _jsx(Checkbox, { checked: someScopeSelected ? 'indeterminate' : allScopeSelected, onCheckedChange: toggleSelectAll, "aria-label": selectScope === 'page' ? 'Seleccionar todos en esta página' : 'Seleccionar todos (filtrados)' }) }), _jsx(TableHead, { children: "Nombre" }), _jsx(TableHead, { className: "hidden lg:table-cell", children: "Descripci\u00F3n" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { className: "hidden md:table-cell", children: "Estado" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: filtered.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "text-center", children: "No hay ubicaciones" }) })) : (visible.map((loc) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "w-10", children: _jsx(Checkbox, { checked: selectedIds.has(loc.id), onCheckedChange: () => toggleOne(loc.id), "aria-label": `Seleccionar ${loc.name}` }) }), _jsx(TableCell, { children: loc.name }), _jsx(TableCell, { className: "hidden lg:table-cell", children: loc.description || '-' }), _jsx(TableCell, { children: loc.warehouse?.name || '-' }), _jsx(TableCell, { className: "hidden md:table-cell", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs capitalize ${loc.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`, children: loc.active ? 'Activa' : 'Inactiva' }) }), _jsx(TableCell, { className: "text-right whitespace-nowrap", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: () => handleEdit(loc), className: "gap-2", children: [_jsx(Pencil, { className: "h-4 w-4" }), " Editar"] }), _jsxs(DropdownMenuItem, { onClick: () => handleDelete(loc.id), className: "gap-2 text-red-600 focus:text-red-600", children: [_jsx(Trash2, { className: "h-4 w-4" }), " Eliminar"] })] })] }) })] }, loc.id)))) })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: ["Mostrando ", total === 0 ? 0 : startIndex + 1, "\u2013", endIndex, " de ", total] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm", children: "Por p\u00E1gina" }), _jsxs(Select, { value: String(pageSize), onValueChange: (val) => { setPageSize(Number(val)); setPage(1); }, children: [_jsx(SelectTrigger, { className: "w-[80px]", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "10", children: "10" }), _jsx(SelectItem, { value: "20", children: "20" }), _jsx(SelectItem, { value: "50", children: "50" }), _jsx(SelectItem, { value: "100", children: "100" })] })] }), _jsxs("div", { className: "flex items-center gap-2 ml-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page <= 1, children: "Anterior" }), _jsxs("div", { className: "text-sm", children: ["P\u00E1gina ", page, " de ", totalPages] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page >= totalPages, children: "Siguiente" })] })] })] })] })) }), _jsx(LocationModal, { open: modalOpen, onClose: handleClose, location: editing })] }));
}
