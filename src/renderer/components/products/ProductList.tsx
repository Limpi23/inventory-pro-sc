import { useEffect, useState } from "react";
import { Product } from "../../../types";
import { productsService } from "../../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import ProductModal from "./ProductModal";
import ProductImport from "./ProductImport";
import ProductPriceUpdate from './ProductPriceUpdate';

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
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
      setProducts(data || []);
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
      setProducts(data || []);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Productos</CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Buscar productos..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button variant="outline" onClick={handleSearch}>
              Buscar
            </Button>
          </div>
          <div className="flex gap-2">
            <ProductImport onImportComplete={fetchProducts} />
            <Button 
              onClick={() => setIsPriceUpdateOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Actualizar Precios Masivos
            </Button>
            <Button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Agregar Producto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Cargando productos...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio Compra</TableHead>
                <TableHead>Precio Venta</TableHead>
                <TableHead>Estado</TableHead>
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
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>{product.category?.name || "-"}</TableCell>
                    <TableCell>{formatCurrency(product.purchase_price ?? 0)}</TableCell>
                    <TableCell>{formatCurrency(product.sale_price ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                        product.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {product.status === 'active' ? 'Activo' :
                         product.status === 'inactive' ? 'Inactivo' : 'Descontinuado'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
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