import { useEffect, useState } from "react";
import type { Product } from "../../../types";
import { productsService } from "../../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import ProductModal from "./ProductModal";
import ProductImport from "./ProductImport";
import ProductPriceUpdate from './ProductPriceUpdate';

type UIProduct = Product & { category?: { id: string; name: string } | null };

export default function ProductList() {
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriceUpdateOpen, setIsPriceUpdateOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setIsLoading(true);
  const data = await productsService.getAll();
  setProducts((data as unknown as UIProduct[]) || []);
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
  const data = await productsService.search(searchQuery);
  setProducts((data as unknown as UIProduct[]) || []);
    } catch (error) {
      console.error("Error al buscar productos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
        await productsService.delete(id);
        fetchProducts();
      } catch (error) {
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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl md:text-2xl">Productos</CardTitle>
          <div className="flex gap-2 sm:justify-end w-full sm:w-auto">
            <ProductImport onImportComplete={fetchProducts} size="sm" className="w-full sm:w-auto" />
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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <Input
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full"
            />
          <Button variant="outline" onClick={handleSearch} className="whitespace-nowrap" size="sm">
            Buscar
          </Button>
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
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                  <TableHead className="hidden xl:table-cell">Precio Compra</TableHead>
                  <TableHead>Precio Venta</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No hay productos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.sku || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{product.category?.name || "-"}</TableCell>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleEdit(product)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          Eliminar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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