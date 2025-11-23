import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';

interface StockMovement {
  id: string;
  quantity: number;
  movement_date: string;
  movement_type_id: number;
  product: {
    name: string;
    sku?: string;
  };
  warehouse: {
    name: string;
  };
  movement_type: {
    code: string;
    description: string;
  };
}

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
}

interface LowStockProduct {
  current_quantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    name: string;
  };
}

interface StatCard {
  title: string;
  value: string;
  icon: string;
  color: string;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const currency = useCurrency();
  const [stats, setStats] = useState<StatCard[]>([
    { title: 'Total Productos', value: '0', icon: 'fas fa-box', color: 'bg-primary' },
    { title: 'Ventas del Mes', value: currency.format(0), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
    { title: 'Productos Agotados', value: '0', icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
    { title: 'Movimientos Hoy', value: '0', icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
  ]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Execute independent queries in parallel
      const [
        productsResult,
        salesResult,
        lowStockCountResult,
        movementsCountResult,
        recentMovementsResult,
        topProductsResult,
        lowStockDetailResult
      ] = await Promise.all([
        // 1. Total products count
        client.from('products').select('*', { count: 'exact', head: true }),
        
        // 2. Monthly sales (fetch total_amount only)
        client.from('invoices')
          .select('total_amount')
          .gte('invoice_date', firstDayOfMonth.toISOString())
          .in('status', ['emitida', 'pagada']),
          
        // 3. Low stock count (unique products)
        client.from('current_stock')
          .select('product_id')
          .lte('current_quantity', 5),
          
        // 4. Today's movements count
        client.from('stock_movements')
          .select('*', { count: 'exact', head: true })
          .gte('movement_date', startOfDay.toISOString()),
          
        // 5. Recent movements with joins
        client.from('stock_movements')
          .select(`
            id,
            quantity,
            movement_date,
            movement_type_id,
            product:products(name),
            warehouse:warehouses(name),
            product_id,
            warehouse_name,
            product:products(name, sku),
            movement_type:movement_types(code, description)
          `)
          .order('created_at', { ascending: false })
          .limit(5),

        // 6. Top products (RPC or query)
        client.rpc('get_top_products', { limit_count: 5 }),

        // 7. Low stock detail
        client.from('current_stock')
          .select(`
            current_quantity,
            product_id,
            warehouse_name,
            product:products(id, name, sku)
          `)
          .lte('current_quantity', 5)
          .order('current_quantity', { ascending: true })
          .limit(5)
      ]) as any;

      // Process Results
      
      // Stats
      const productsCount = productsResult.count || 0;
      
      const monthlyTotal = (salesResult.data as any[])?.reduce(
        (sum, invoice: any) => sum + (Number(invoice?.total_amount) || 0),
        0
      ) || 0;
      
      const uniqueLowStockProducts = [...new Set(lowStockCountResult.data?.map((item: any) => item.product_id) || [])];
      
      const movementsCount = movementsCountResult.count || 0;
      
      setStats([
        { title: 'Total Productos', value: productsCount.toString(), icon: 'fas fa-box', color: 'bg-primary' },
        { title: 'Ventas del Mes', value: formatCurrency(monthlyTotal), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
        { title: 'Productos Agotados', value: uniqueLowStockProducts.length.toString(), icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
        { title: 'Movimientos Hoy', value: movementsCount.toString(), icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
      ]);

      // Recent Movements
      if (recentMovementsResult.data) {
        const formattedMovements = recentMovementsResult.data.map((m: any) => ({
          id: m.id,
          quantity: Number(m.quantity),
          movement_date: m.movement_date,
          movement_type_id: m.movement_type_id,
          product: { name: m.product?.name || 'Desconocido' },
          warehouse: { name: m.warehouse?.name || 'Desconocido' },
          movement_type: { 
            code: m.movement_type?.code || '',
            description: m.movement_type?.description || ''
          }
        }));
        setRecentMovements(formattedMovements);
      } else {
        setRecentMovements([]);
      }

      // Top Products
      if (topProductsResult.data) {
        setTopProducts(topProductsResult.data.map((item: any) => ({
          id: item.product_id,
          name: item.product_name,
          sku: item.sku || 'Sin SKU',
          totalQuantity: Number(item.total_quantity)
        })));
      } else {
        // Fallback or empty if RPC fails
        setTopProducts([]); 
      }

      // Low Stock Detail
      if (lowStockDetailResult.data) {
        const formattedLowStock = lowStockDetailResult.data.map((item: any) => ({
          current_quantity: Number(item.current_quantity),
          product: {
            id: item.product_id,
            name: item.product?.name || 'Desconocido',
            sku: item.product?.sku || 'Sin SKU'
          },
          warehouse: {
            name: item.warehouse_name || 'Desconocido'
          }
        }));
        setLowStockProducts(formattedLowStock);
      } else {
        setLowStockProducts([]);
      }

    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount: number): string => currency.format(amount);
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(currency.settings.locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getMovementTypeLabel = (movementType: { code: string; description: string }) => {
    if (!movementType) return { label: 'Desconocido', className: 'bg-gray-100 text-gray-800' };
    
    const isInput = movementType.code.startsWith('IN');
    return {
      label: isInput ? 'Entrada' : 'Salida',
      className: isInput ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">Panel de Control</span>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={`${stat.color} text-white p-2 rounded-lg`}>
                    <i className={`${stat.icon} text-xl`}></i>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Productos Más Vendidos</CardTitle>
                <CardDescription>
                  Los productos con mayor rotación de salida
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No hay suficientes datos para mostrar productos populares
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{product.totalQuantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* Low Stock Products */}
            <Card>
              <CardHeader>
                <CardTitle>Productos Con Bajo Stock</CardTitle>
                <CardDescription>
                  Productos que requieren reposición inmediata
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No hay productos con bajo stock actualmente
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Almacén</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockProducts.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-xs text-gray-500">SKU: {item.product?.sku}</div>
                          </TableCell>
                          <TableCell>{item.warehouse?.name}</TableCell>
                          <TableCell className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.current_quantity <= 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.current_quantity}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Movements */}
          <Card>
            <CardHeader>
              <CardTitle>Movimientos Recientes</CardTitle>
              <CardDescription>
                Los últimos movimientos de inventario registrados en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentMovements.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No hay movimientos recientes registrados
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.map((movement) => {
                      const typeInfo = getMovementTypeLabel(movement.movement_type);
                      return (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.className}`}>
                              {typeInfo.label}
                            </span>
                          </TableCell>
                          <TableCell>{movement.product?.name}</TableCell>
                          <TableCell>{movement.quantity}</TableCell>
                          <TableCell>{movement.warehouse?.name}</TableCell>
                          <TableCell>{formatDate(movement.movement_date)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link to="/productos" className="w-full">
              <Button className="flex items-center gap-2 w-full" variant="outline">
                <i className="fas fa-plus-circle text-primary"></i>
                <span>Nuevo Producto</span>
              </Button>
            </Link>
            <Link to="/inventario" className="w-full">
              <Button className="flex items-center gap-2 w-full" variant="outline">
                <i className="fas fa-arrow-down text-green-600"></i>
                <span>Registrar Entrada</span>
              </Button>
            </Link>
            <Link to="/inventario" className="w-full">
              <Button className="flex items-center gap-2 w-full" variant="outline">
                <i className="fas fa-arrow-up text-orange-500"></i>
                <span>Registrar Salida</span>
              </Button>
            </Link>
            <Link to="/ventas/facturas/nueva" className="w-full">
              <Button className="flex items-center gap-2 w-full" variant="outline">
                <i className="fas fa-file-invoice-dollar text-blue-500"></i>
                <span>Nueva Venta</span>
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;