import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProductSerial {
  id: string;
  product_id: string;
  serial_code: string;
  vin?: string;
  engine_number?: string;
  year?: number;
  color?: string;
  status: string;
  warehouse_id?: string;
  location_id?: string;
  acquired_at?: string;
  sold_at?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    name: string;
  };
}

export default function SerializedInventory() {
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    sku: '',
    vin: '',
    engine: '',
    year: '',
    color: '',
    status: ''
  });

  useEffect(() => {
    fetchSerials();
  }, []);

  const fetchSerials = async () => {
    try {
      setIsLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('product_serials')
        .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name),
          location:locations(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSerials(data || []);
    } catch (error: any) {
      console.error('Error fetching serials:', error);
      toast.error('Error al cargar inventario serializado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setIsLoading(true);
      const client = await supabase.getClient();
      let query = client
        .from('product_serials')
        .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name),
          location:locations(id, name)
        `);

      // Aplicar filtros
      if (filters.sku) {
        query = query.ilike('product.sku', `%${filters.sku}%`);
      }
      if (filters.vin) {
        query = query.ilike('vin', `%${filters.vin}%`);
      }
      if (filters.engine) {
        query = query.ilike('engine_number', `%${filters.engine}%`);
      }
      if (filters.year) {
        query = query.eq('year', parseInt(filters.year));
      }
      if (filters.color) {
        query = query.ilike('color', `%${filters.color}%`);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setSerials(data || []);
    } catch (error: any) {
      console.error('Error searching serials:', error);
      toast.error('Error al buscar');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      in_stock: { label: 'En Stock', className: 'bg-green-100 text-green-800' },
      sold: { label: 'Vendido', className: 'bg-blue-100 text-blue-800' },
      reserved: { label: 'Reservado', className: 'bg-yellow-100 text-yellow-800' },
      maintenance: { label: 'Mantenimiento', className: 'bg-orange-100 text-orange-800' },
      lost: { label: 'Perdido', className: 'bg-red-100 text-red-800' },
      scrapped: { label: 'Desechado', className: 'bg-gray-100 text-gray-800' },
      in_transit: { label: 'En Tránsito', className: 'bg-purple-100 text-purple-800' },
      returned: { label: 'Devuelto', className: 'bg-cyan-100 text-cyan-800' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario Serializado</CardTitle>
        <p className="text-sm text-gray-500">
          Vista detallada de productos con números de serie (VIN, Motor, etc.)
        </p>
      </CardHeader>
      <CardContent>
        {/* Filtros de búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <Input
            placeholder="SKU..."
            value={filters.sku}
            onChange={(e) => setFilters({ ...filters, sku: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Input
            placeholder="VIN/Chasis..."
            value={filters.vin}
            onChange={(e) => setFilters({ ...filters, vin: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Input
            placeholder="Nº Motor..."
            value={filters.engine}
            onChange={(e) => setFilters({ ...filters, engine: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Input
            placeholder="Año..."
            type="number"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Input
            placeholder="Color..."
            value={filters.color}
            onChange={(e) => setFilters({ ...filters, color: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="in_stock">En Stock</option>
            <option value="sold">Vendido</option>
            <option value="reserved">Reservado</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="lost">Perdido</option>
          </select>
        </div>

        <div className="flex gap-2 mb-4">
          <Button onClick={handleSearch} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFilters({ sku: '', vin: '', engine: '', year: '', color: '', status: '' });
              fetchSerials();
            }}
          >
            Limpiar Filtros
          </Button>
        </div>

        {/* Tabla de seriales */}
        {isLoading ? (
          <p>Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>VIN/Chasis</TableHead>
                  <TableHead>Nº Motor</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead>Ubicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No hay productos serializados registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  serials.map((serial) => (
                    <TableRow key={serial.id}>
                      <TableCell className="font-medium">{serial.product?.name || '-'}</TableCell>
                      <TableCell>{serial.product?.sku || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{serial.vin || serial.serial_code || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{serial.engine_number || '-'}</TableCell>
                      <TableCell>{serial.year || '-'}</TableCell>
                      <TableCell>
                        {serial.color && (
                          <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs">
                            {serial.color}
                          </span>
                        )}
                        {!serial.color && '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(serial.status)}</TableCell>
                      <TableCell>{serial.warehouse?.name || '-'}</TableCell>
                      <TableCell>{serial.location?.name || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {serials.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Total: {serials.length} serial{serials.length !== 1 ? 'es' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
