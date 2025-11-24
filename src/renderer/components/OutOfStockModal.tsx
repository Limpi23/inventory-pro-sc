import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { productService } from '../lib/supabase';

interface OutOfStockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StockItem {
  current_quantity: number;
  warehouse_name: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    image_url?: string;
  };
}

export const OutOfStockModal: React.FC<OutOfStockModalProps> = ({ isOpen, onClose }) => {
  const [products, setProducts] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    } else {
      // Reset state when closed
      setPage(1);
      setSearch('');
      setProducts([]);
    }
  }, [isOpen, page, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, count } = await productService.getLowStockProducts({
        page,
        pageSize,
        search,
        threshold: 0 // Productos agotados
      });
      
      // Supabase returns data as any[], need to cast or ensure type
      setProducts(data as unknown as StockItem[]);
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));
    } catch (error) {
      console.error('Error fetching out of stock products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on search
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Productos Agotados</DialogTitle>
          <DialogDescription>
            Listado de productos con stock 0 o menor. Total: {totalCount}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 my-4">
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={handleSearchChange}
            className="max-w-sm"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No se encontraron productos agotados.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((item, index) => (
                  <TableRow key={`${item.product.id}-${index}`}>
                    <TableCell className="font-medium">{item.product.name}</TableCell>
                    <TableCell>{item.product.sku || '-'}</TableCell>
                    <TableCell>{item.warehouse_name}</TableCell>
                    <TableCell className="text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {item.current_quantity}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            Siguiente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
