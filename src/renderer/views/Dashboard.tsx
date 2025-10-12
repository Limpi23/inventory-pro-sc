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
      
      // Fetch total products count
      const { count: productsCount, error: productsError } = await client
        .from('products')
        .select('*', { count: 'exact', head: true });
      
      if (productsError) throw productsError;
      
      // Fetch monthly sales total
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const { data: monthlySales, error: salesError } = await client
        .from('invoices')
        .select('total_amount')
        .gte('invoice_date', firstDayOfMonth.toISOString())
        .in('status', ['emitida', 'pagada']);
      
      if (salesError) throw salesError;
      
      const monthlyTotal = (monthlySales as any[])?.reduce(
        (sum, invoice: any) => sum + (Number(invoice?.total_amount) || 0),
        0
      ) || 0;
      
      // Fetch low stock products count
      const { data: lowStockCount, error: lowStockError } = await client
        .from('current_stock')
        .select('product_id')
        .lte('current_quantity', 5);
      
      if (lowStockError) throw lowStockError;
      
      const uniqueLowStockProducts = [...new Set(lowStockCount?.map(item => item.product_id) || [])];
      
      // Fetch today's movements count
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const { count: movementsCount, error: movementsError } = await client
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .gte('movement_date', startOfDay.toISOString());
      
      if (movementsError) throw movementsError;
      
      // Update stats
      const updatedStats = [
        { title: 'Total Productos', value: productsCount?.toString() || '0', icon: 'fas fa-box', color: 'bg-primary' },
  { title: 'Ventas del Mes', value: formatCurrency(monthlyTotal), icon: 'fas fa-shopping-cart', color: 'bg-secondary' },
        { title: 'Productos Agotados', value: uniqueLowStockProducts.length.toString(), icon: 'fas fa-exclamation-triangle', color: 'bg-orange-500' },
        { title: 'Movimientos Hoy', value: movementsCount?.toString() || '0', icon: 'fas fa-exchange-alt', color: 'bg-blue-500' },
      ];
      
      setStats(updatedStats);
      
      // Fetch recent movements
      const { data: movements, error: recentMovementsError } = await client
        .from('stock_movements')
        .select(`
          id,
          quantity,
          movement_date,
          movement_type_id,
          product_id,
          warehouse_id
        `)
        .order('movement_date', { ascending: false })
        .limit(5);
      
      if (recentMovementsError) throw recentMovementsError;
      
      // Si tenemos movimientos, obtenemos los detalles adicionales necesarios
      if (movements && movements.length > 0) {
        // Obtener IDs únicos de productos, almacenes y tipos de movimiento
        const productIds = [...new Set(movements.map(m => m.product_id))];
        const warehouseIds = [...new Set(movements.map(m => m.warehouse_id))];
        const movementTypeIds = [...new Set(movements.map(m => m.movement_type_id))];
        
        // Obtener detalles de productos
        const { data: products, error: productsError } = await client
          .from('products')
          .select('id, name, sku')
          .in('id', productIds);
          
        if (productsError) throw productsError;
        
        // Obtener detalles de almacenes
        const { data: warehouses, error: warehousesError } = await client
          .from('warehouses')
          .select('id, name')
          .in('id', warehouseIds);
          
        if (warehousesError) throw warehousesError;
        
        // Obtener detalles de tipos de movimiento
        const { data: movementTypes, error: movementTypesError } = await client
          .from('movement_types')
          .select('id, code, description')
          .in('id', movementTypeIds);
          
        if (movementTypesError) throw movementTypesError;
        
        // Crear mapas para búsqueda rápida
  const productMap = new Map((products as any[])?.map((p: any) => [p.id, p]));
  const warehouseMap = new Map((warehouses as any[])?.map((w: any) => [w.id, w]));
  const movementTypeMap = new Map((movementTypes as any[])?.map((mt: any) => [mt.id, mt]));
        
        // Formatear los datos de movimientos correctamente
  const formattedMovements = (movements as any[]).map((movement: any) => {
          const product = productMap.get(movement.product_id);
          const warehouse = warehouseMap.get(movement.warehouse_id);
          const movementType = movementTypeMap.get(movement.movement_type_id);
          
          return {
            id: movement.id,
            quantity: Number(movement.quantity),
            movement_date: movement.movement_date,
            movement_type_id: movement.movement_type_id,
            product: {
              name: product?.name || 'Desconocido'
            },
            warehouse: {
              name: warehouse?.name || 'Desconocido'
            },
            movement_type: {
              code: movementType?.code || '',
              description: movementType?.description || ''
            }
          };
        });
        
        setRecentMovements(formattedMovements);
      } else {
        setRecentMovements([]);
      }
      
      // Fetch top 5 products by movement quantity
      try {
        // Intentar usar la función RPC
  const { data: topProductsData, error: topProductsError } = await client
          .rpc('get_top_selling_products', { limit_count: 5 })
          .select('*');
        
        if (topProductsError) {
          
          
          // Fallback - consultar movimientos y productos directamente
          // debug silenciado
          
          // Obtener todos los productos primero
          const { data: products, error: productsError } = await client
            .from('products')
            .select('id, name, sku');
            
          if (productsError) throw productsError;
          
          // Mapeo de productos para acceso rápido
          const productMap = new Map((products as any[])?.map((p: any) => [p.id, p]) || []);
          
          // Obtener movimientos de salida
          const { data: outMovements, error: movementsError } = await client
            .from('stock_movements')
            .select(`
              product_id,
              quantity,
              movement_type_id
            `)
            .in('movement_type_id', [2, 4, 6, 8]) // IDs para movimientos de salida
            .limit(500);
            
          if (movementsError) throw movementsError;
          
          // Agregar cantidades por producto
          const productQuantityMap: Record<string, number> = {};
          
          (outMovements as any[])?.forEach((movement: any) => {
            const productId = movement.product_id as string;
            if (!productQuantityMap[productId]) {
              productQuantityMap[productId] = 0;
            }
            productQuantityMap[productId] += Number(movement.quantity) || 0;
          });
          
          // Crear array de productos más vendidos
          const topProductsList: TopProduct[] = [];
          
          Object.entries(productQuantityMap).forEach(([productId, totalQuantity]) => {
            const product: any = productMap.get(productId);
            if (product) {
              topProductsList.push({
                id: productId,
                name: product.name,
                sku: product.sku || 'Sin SKU',
                totalQuantity
              });
            }
          });
          
          // Ordenar y limitar a los 5 más vendidos
          const sortedProducts = topProductsList
            .sort((a, b) => b.totalQuantity - a.totalQuantity)
            .slice(0, 5);
            
          setTopProducts(sortedProducts);
        } else {
          // Si la función RPC funcionó correctamente
          const formattedTopProducts = (topProductsData as any[])?.map((item: any) => ({
            id: item.product_id,
            name: item.product_name,
            sku: item.sku || 'Sin SKU',
            totalQuantity: Number(item.total_quantity)
          }));
          
          setTopProducts(formattedTopProducts);
        }
      } catch (error) {
        
        setTopProducts([]);
      }
      
      // Fetch low stock products detail
      try {
        // Obtener productos con stock bajo directamente
  const { data: lowStockItems, error: lowStockItemsError } = await client
          .from('current_stock')
          .select(`
            product_id,
            product_name,
            sku,
            warehouse_id,
            warehouse_name,
            current_quantity
          `)
          .lte('current_quantity', 5)
          .order('current_quantity', { ascending: true })
          .limit(5);
          
        if (lowStockItemsError) {
          throw lowStockItemsError;
        }
        
        // Si los datos de la vista no tienen toda la información, obtener los detalles de los productos
    if (lowStockItems && (lowStockItems as any[]).length > 0 && 
      ((lowStockItems as any[])[0].product_name === null || (lowStockItems as any[])[0].sku === null)) {
          
          const productIds = (lowStockItems as any[]).map((item: any) => item.product_id);
          
          // Obtener detalles completos de los productos
          const { data: productDetails, error: productDetailsError } = await client
            .from('products')
            .select('id, name, sku')
            .in('id', productIds);
            
          if (productDetailsError) throw productDetailsError;
          
          const productMap = new Map((productDetails as any[])?.map((p: any) => [p.id, p]) || []);
          
          // Formatear los datos con la información completa de productos
          const formattedLowStock = (lowStockItems as any[]).map((item: any) => {
            const product: any = productMap.get(item.product_id);
            
            return {
              current_quantity: Number(item.current_quantity),
              product: {
                id: item.product_id,
                name: product?.name || item.product_name || 'Desconocido',
                sku: product?.sku || item.sku || 'Sin SKU'
              },
              warehouse: {
                name: item.warehouse_name || 'Desconocido'
              }
            };
          });
          
          setLowStockProducts(formattedLowStock);
        } else {
          // Si la vista ya tiene toda la información necesaria
          const formattedLowStock = (lowStockItems as any[]).map((item: any) => ({
            current_quantity: Number(item.current_quantity),
            product: {
              id: item.product_id,
              name: item.product_name || 'Desconocido',
              sku: item.sku || 'Sin SKU'
            },
            warehouse: {
              name: item.warehouse_name || 'Desconocido'
            }
          }));
          
          setLowStockProducts(formattedLowStock);
        }
      } catch (error) {
        
        setLowStockProducts([]);
      }
      
    } catch (error: any) {
      
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
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent drop-shadow-lg">
          🎯 Dashboard
        </h1>
        <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">Panel de Control</span>
        <span className="text-xl font-black bg-gradient-to-r from-emerald-400 via-green-500 to-teal-600 text-white px-6 py-3 rounded-full shadow-2xl animate-pulse border-4 border-green-200">
          ✨ NSIS v1.10.1 ✨
        </span>
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