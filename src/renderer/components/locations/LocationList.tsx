import { useEffect, useMemo, useState } from 'react';
import { Location, Warehouse } from '../../../types';
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
  const [locations, setLocations] = useState<(Location & { warehouse?: Warehouse | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations(opts?: { keepPage?: boolean }) {
    try {
      setLoading(true);
      const [locs, whs] = await Promise.all([
        locationsService.getAll(),
        warehousesService.getAll(),
      ]);
      const byId = new Map((whs || []).map(w => [w.id, w] as const));
      const list = (locs || []).map(l => ({ ...l, warehouse: l.warehouse_id ? byId.get(l.warehouse_id) || null : null }));
      setLocations(list);
      setSelectedIds(prev => new Set([...prev].filter(id => list.some(l => l.id === id))));
      if (!opts?.keepPage) setPage(1);
    } catch (e) {
      console.error('Error cargando ubicaciones', e);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (loc: Location) => { setEditing(loc); setModalOpen(true); };
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar ubicación?')) return;
    try {
      await locationsService.delete(id);
      fetchLocations({ keepPage: true });
    } catch (e) {
      console.error('Error eliminando ubicación', e);
    }
  };
  const handleClose = () => { setModalOpen(false); setEditing(null); fetchLocations({ keepPage: true }); };

  // Filtrado simple por búsqueda (cliente)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q) ||
      (l.warehouse?.name || '').toLowerCase().includes(q)
    );
  }, [locations, searchQuery]);

  // Paginación
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const visible = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  // Selección
  const allVisibleSelected = useMemo(() => visible.length > 0 && visible.every(l => selectedIds.has(l.id)), [visible, selectedIds]);
  const someVisibleSelected = useMemo(() => visible.some(l => selectedIds.has(l.id)) && !allVisibleSelected, [visible, selectedIds, allVisibleSelected]);
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedIds);
      visible.forEach(l => next.delete(l.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      visible.forEach(l => next.add(l.id));
      setSelectedIds(next);
    }
  };
  const toggleOne = (id: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

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
    XLSX.writeFile(wb, `ubicaciones_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl md:text-2xl">Ubicaciones</CardTitle>
          <div className="flex gap-2 sm:justify-end w-full sm:w-auto">
            <LocationImport onImportComplete={() => fetchLocations()} size="sm" className="w-full sm:w-auto" />
            <Button onClick={handleExportExcel} variant="outline" className="whitespace-nowrap w-full sm:w-auto" size="sm">
              Exportar Excel {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
            <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full sm:w-auto" size="sm">
              Agregar Ubicación
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="Buscar ubicaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          <Button variant="outline" onClick={() => setPage(1)} className="whitespace-nowrap" size="sm">
            Buscar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Cargando ubicaciones...</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={someVisibleSelected ? 'indeterminate' : allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Seleccionar todos" />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden lg:table-cell">Descripción</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No hay ubicaciones</TableCell>
                  </TableRow>
                ) : (
                  visible.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="w-10">
                        <Checkbox checked={selectedIds.has(loc.id)} onCheckedChange={() => toggleOne(loc.id)} aria-label={`Seleccionar ${loc.name}`} />
                      </TableCell>
                      <TableCell>{loc.name}</TableCell>
                      <TableCell className="hidden lg:table-cell">{loc.description || '-'}</TableCell>
                      <TableCell>{loc.warehouse?.name || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${loc.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                          {loc.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(loc)} className="gap-2">
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(loc.id)} className="gap-2 text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {total === 0 ? 0 : startIndex + 1}–{endIndex} de {total}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Por página</span>
                <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                    Anterior
                  </Button>
                  <div className="text-sm">Página {page} de {totalPages}</div>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <LocationModal open={modalOpen} onClose={handleClose} location={editing} />
    </Card>
  );
}
