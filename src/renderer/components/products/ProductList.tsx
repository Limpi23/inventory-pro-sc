import { useEffect, useMemo, useState } from "react";
import type { Product } from "../../../types";
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

type UIProduct = Product & { category?: { id: string; name: string } | null; location?: { id: string; name: string } | null };

export default function ProductList() {
  const { user, hasPermission } = useAuth();
  const isAdmin = ((user?.role_name || '').toLowerCase().includes('admin')) || user?.role_id === 1;
  const canUpdateProducts = (
    isAdmin ||
    hasPermission('products', 'update') ||
    hasPermission('product', 'update') ||
    hasPermission('productos', 'update') ||
    hasPermission('inventory', 'update') ||
    hasPermission('*', 'update') ||
    hasPermission('products', '*') ||
    hasPermission('*', '*')
  );
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; warehouse_id?: string }[]>([]);

  useEffect(() => {
    fetchProducts();
    // Cargar listas para filtros
    (async () => {
      try {
        const [whs, locs] = await Promise.all([warehousesService.getAll(), locationsService.getAll()]);
        setWarehouses((whs as any[])?.map(w => ({ id: w.id, name: w.name })) || []);
        setLocations((locs as any[])?.map(l => ({ id: l.id, name: l.name, warehouse_id: (l as any).warehouse_id })) || []);
      } catch (e) {
        console.error('Error cargando filtros almacén/ubicación', e);
      }
    })();
  }, []);

  async function fetchProducts(opts?: { keepPage?: boolean }) {
    try {
      setIsLoading(true);
  const data = await productService.getAll();
  const list = (data as unknown as UIProduct[]) || [];
  setProducts(list);
  // Si los IDs seleccionados ya no están, límpialos
  setSelectedIds(prev => new Set([...prev].filter(id => list.some(p => p.id === id))));
  if (!opts?.keepPage) setPage(1);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
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
  const list = (data as unknown as UIProduct[]) || [];
  setProducts(list);
  setSelectedIds(prev => new Set([...prev].filter(id => list.some(p => p.id === id))));
  setPage(1);
    } catch (error) {
      console.error("Error al buscar productos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Paginación
  const filteredProducts = useMemo(() => {
    let list = products;
    if (warehouseFilter) {
      list = list.filter(p => ((p as any).location?.warehouse_id === warehouseFilter) || ((p as any).warehouse_id === warehouseFilter));
    }
    if (locationFilter) {
      list = list.filter(p => ((p as any).location?.id === locationFilter) || ((p as any).location_id === locationFilter));
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
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Selección: todos y por fila (sólo visibles en la página actual)
  const allVisibleSelected = useMemo(() => visibleProducts.length > 0 && visibleProducts.every(p => selectedIds.has(p.id)), [visibleProducts, selectedIds]);
  const someVisibleSelected = useMemo(() => visibleProducts.some(p => selectedIds.has(p.id)) && !allVisibleSelected, [visibleProducts, selectedIds, allVisibleSelected]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // deseleccionar visibles
      const next = new Set(selectedIds);
      visibleProducts.forEach(p => next.delete(p.id));
      setSelectedIds(next);
    } else {
      // seleccionar visibles
      const next = new Set(selectedIds);
      visibleProducts.forEach(p => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
  await productService.delete(id);
    fetchProducts({ keepPage: true });
      } catch (error) {
        console.error("Error al eliminar producto:", error);
      }
    }
  }

  async function handleMarkInactive(id: string, alreadyInactive: boolean) {
    if (alreadyInactive) return;
    try {
  await productService.update(id, { status: 'inactive' });
  fetchProducts({ keepPage: true });
    } catch (error) {
      console.error('Error al marcar inactivo:', error);
    }
  }

  async function handleMarkActive(id: string, alreadyActive: boolean) {
    if (alreadyActive) return;
    try {
  await productService.update(id, { status: 'active' });
  fetchProducts({ keepPage: true });
    } catch (error) {
      console.error('Error al marcar activo:', error);
    }
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingProduct(null);
  fetchProducts({ keepPage: true });
  }

  // Formatear el precio como moneda
  const formatCurrency = (value: number) => {
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
    XLSX.writeFile(wb, `productos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl md:text-2xl">Productos</CardTitle>
          <div className="flex gap-2 sm:justify-end w-full sm:w-auto">
            <ProductImport onImportComplete={fetchProducts} size="sm" className="w-full sm:w-auto" />
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="whitespace-nowrap w-full sm:w-auto"
              size="sm"
            >
              Exportar Excel {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
            <ProductBulkAssignLocation selectedIds={[...selectedIds]} onDone={() => fetchProducts({ keepPage: true })} />
            <Button
              onClick={() => setIsPriceUpdateOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white whitespace-nowrap text-xs md:text-sm w-full sm:w-auto"
              aria-label="Actualizar precios masivos"
              size="sm"
            >
              Actualizar Precios Masivos
            </Button>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full sm:w-auto"
              size="sm"
            >
              Agregar Producto
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <Input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full"
          />
          <Select value={warehouseFilter || 'all'} onValueChange={(v) => { setWarehouseFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="min-w-[150px]"><SelectValue placeholder="Almacén" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos almacenes</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter || 'all'} onValueChange={(v) => { setLocationFilter(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="min-w-[150px]"><SelectValue placeholder="Ubicación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ubicaciones</SelectItem>
              {locations
                .filter(l => !warehouseFilter || l.warehouse_id === warehouseFilter)
                .map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Cargando productos...</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={someVisibleSelected ? 'indeterminate' : allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                  <TableHead className="hidden xl:table-cell">Ubicación</TableHead>
                  <TableHead className="hidden xl:table-cell">Precio Compra</TableHead>
                  <TableHead>Precio Venta</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No hay productos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={() => toggleOne(product.id)}
                          aria-label={`Seleccionar ${product.name}`}
                        />
                      </TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.sku || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{product.category?.name || "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell">{product.location?.name || '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell">{formatCurrency(product.purchase_price ?? 0)}</TableCell>
                      <TableCell>{formatCurrency(product.sale_price ?? 0)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span
                          className={`px-2 py-1 rounded-full text-xs capitalize ${
                            product.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : product.status === 'inactive'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {product.status === 'active'
                            ? 'Activo'
                            : product.status === 'inactive'
                            ? 'Inactivo'
                            : 'Descontinuado'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Abrir menú</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(product)} className="gap-2">
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!canUpdateProducts) {
                                    toast.error('No tienes permiso para cambiar el estado del producto');
                                    return;
                                  }
                                  if (product.status === 'active') {
                                    handleMarkInactive(product.id, false);
                                  } else {
                                    handleMarkActive(product.id, false);
                                  }
                                }}
                                className="gap-2"
                              >
                                {product.status === 'active' ? (
                                  <>
                                    <Ban className="h-4 w-4" /> Marcar inactivo
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-2.46a.75.75 0 1 0-1.22-.88l-3.236 4.49-1.49-1.49a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.616-4.836Z" clipRule="evenodd" />
                                    </svg>
                                    Marcar activo
                                  </>
                                )}
                              </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(product.id)} className="gap-2 text-red-600 focus:text-red-600">
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
            {/* Controles de paginación */}
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
                  <div className="text-sm">
                    Página {page} de {totalPages}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <ProductModal
        open={isModalOpen}
        onClose={handleModalClose}
        product={editingProduct}
      />

      <ProductPriceUpdate
        open={isPriceUpdateOpen}
        onClose={() => setIsPriceUpdateOpen(false)}
        onUpdateComplete={fetchProducts}
      />
    </Card>
  );
} 