import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  sku?: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  warehouse_id: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  movement_type_id: number;
  movement_date: string;
  reference?: string;
  notes?: string;
  product?: { name: string };
  warehouse?: { name: string };
  movement_type?: { code: string; description: string };
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movementTypes, setMovementTypes] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [currentStock, setCurrentStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de entrada/salida
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isEntry, setIsEntry] = useState(true);
  // Nuevos estados para transferencias
  const [isTransfer, setIsTransfer] = useState(false);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  // Ubicaciones
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [destinationLocations, setDestinationLocations] = useState<Location[]>([]);
  const [destinationLocationId, setDestinationLocationId] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
  const client = await supabase.getClient();
        // Cargar productos
  const { data: productsData, error: productsError } = await client
          .from('products')
          .select('*');
        
        if (productsError) throw productsError;
  setProducts((productsData as unknown as Product[]) || []);

        // Cargar almacenes
  const { data: warehousesData, error: warehousesError } = await client
          .from('warehouses')
          .select('*');
        
        if (warehousesError) throw warehousesError;
  setWarehouses((warehousesData as unknown as Warehouse[]) || []);

        // Cargar tipos de movimiento
  const { data: movementTypesData, error: movementTypesError } = await client
          .from('movement_types')
          .select('*');
        
        if (movementTypesError) throw movementTypesError;
  setMovementTypes((movementTypesData as unknown as any[]) || []);

        // Cargar movimientos recientes (incluyendo ubicación)
  const { data: movementsData, error: movementsError } = await client
          .from('stock_movements')
          .select(`
            *,
            product:products(id, name),
            warehouse:warehouses(id, name),
            location:locations(id, name),
            movement_type:movement_types(id, code, description)
          `)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (movementsError) throw movementsError;
  setStockMovements((movementsData as unknown as StockMovement[]) || []);

        // Cargar stock actual
  const { data: stockData, error: stockError } = await client
          .from('current_stock')
          .select('*');
        
        if (stockError) throw stockError;
  setCurrentStock((stockData as unknown as any[]) || []);

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error cargando datos:', err);
        setError(err.message);
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Cargar ubicaciones cuando cambie el almacén origen
  useEffect(() => {
    (async () => {
      try {
        const client = await supabase.getClient();
        if (warehouseId) {
          const { data, error } = await client
            .from('locations')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .order('name');
          if (error) throw error;
          setLocations((data as unknown as Location[]) || []);
        } else {
          setLocations([]);
        }
        // Reset selección al cambiar almacén
        setLocationId('');
      } catch (e) {
        console.error('Error cargando ubicaciones:', e);
      }
    })();
  }, [warehouseId]);

  // Cargar ubicaciones cuando cambie el almacén destino (transferencias)
  useEffect(() => {
    (async () => {
      try {
        const client = await supabase.getClient();
        if (destinationWarehouseId) {
          const { data, error } = await client
            .from('locations')
            .select('*')
            .eq('warehouse_id', destinationWarehouseId)
            .order('name');
          if (error) throw error;
          setDestinationLocations((data as unknown as Location[]) || []);
        } else {
          setDestinationLocations([]);
        }
        setDestinationLocationId('');
      } catch (e) {
        console.error('Error cargando ubicaciones destino:', e);
      }
    })();
  }, [destinationWarehouseId]);

  // Función para manejar cambios en el tipo de movimiento
  const handleMovementTypeChange = (type: 'entry' | 'exit' | 'transfer') => {
    if (type === 'entry') {
      setIsEntry(true);
      setIsTransfer(false);
    } else if (type === 'exit') {
      setIsEntry(false);
      setIsTransfer(false);
    } else {
      // Transferencia
      setIsEntry(false); // Empezamos con salida del almacén origen
      setIsTransfer(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
  const client = await supabase.getClient();
      if (!productId || !warehouseId) {
        throw new Error('Selecciona un producto y un almacén');
      }
      if (!isTransfer && !locationId) {
        throw new Error('Selecciona una ubicación');
      }

      // Validación adicional para transferencias
      if (isTransfer && (!destinationWarehouseId || destinationWarehouseId === warehouseId)) {
        throw new Error('Selecciona un almacén de destino diferente al de origen');
      }
      if (isTransfer && !destinationLocationId) {
        throw new Error('Selecciona una ubicación de destino');
      }

      // Para salidas o transferencias, verificar stock disponible
      if (!isEntry || isTransfer) {
        // Validar stock por ubicación (si está seleccionada)
        const { data: stockData } = await client
          .from('current_stock_by_location')
          .select('current_quantity')
          .eq('product_id', productId)
          .eq('warehouse_id', warehouseId)
          .eq('location_id', locationId)
          .maybeSingle();
        const currentQty = Number((stockData as any)?.current_quantity ?? 0);
        if (quantity > currentQty) {
          throw new Error(`Stock insuficiente. Solo hay ${currentQty} unidades disponibles.`);
        }
      }

      if (isTransfer) {
        // Crear movimiento de salida del almacén origen
        const outMovementType = movementTypes.find((t) => t.code === 'OUT_TRANSFER');
        if (!outMovementType) {
          throw new Error('Tipo de movimiento de salida por transferencia no encontrado');
        }
        
        // Generar un ID de transferencia para relacionar ambos movimientos
        const transferId = crypto.randomUUID();
        
  const { error: outError } = await client
          .from('stock_movements')
          .insert({
            product_id: productId,
            warehouse_id: warehouseId,
            location_id: locationId,
            quantity: quantity,
            movement_type_id: outMovementType.id,
            movement_date: new Date(date).toISOString(),
            reference: reference || `Transferencia a ${warehouses.find(w => w.id === destinationWarehouseId)?.name}`,
            notes: notes || null,
            related_id: transferId
          });

        if (outError) throw outError;

        // Crear movimiento de entrada en el almacén destino
        const inMovementType = movementTypes.find((t) => t.code === 'IN_TRANSFER');
        if (!inMovementType) {
          throw new Error('Tipo de movimiento de entrada por transferencia no encontrado');
        }
        
  const { error: inError } = await client
          .from('stock_movements')
          .insert({
            product_id: productId,
            warehouse_id: destinationWarehouseId,
            location_id: destinationLocationId,
            quantity: quantity,
            movement_type_id: inMovementType.id,
            movement_date: new Date(date).toISOString(),
            reference: reference || `Transferencia desde ${warehouses.find(w => w.id === warehouseId)?.name}`,
            notes: notes || null,
            related_id: transferId
          });

        if (inError) throw inError;
      } else {
        // Código existente para entradas y salidas normales
        // Buscar ID del tipo de movimiento
        const typeCode = isEntry ? 'IN_PURCHASE' : 'OUT_SALE';
        const movementType = movementTypes.find((t) => t.code === typeCode);
        
        if (!movementType) {
          throw new Error('Tipo de movimiento no encontrado');
        }

        // Crear movimiento
  const { error: insertError } = await client
          .from('stock_movements')
          .insert({
            product_id: productId,
            warehouse_id: warehouseId,
            location_id: locationId,
            quantity: quantity,
            movement_type_id: movementType.id,
            movement_date: new Date(date).toISOString(),
            reference: reference || null,
            notes: notes || null
          });

        if (insertError) throw insertError;
      }

      // Recargar datos
  const { data: updatedMovements } = await client
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name),
          warehouse:warehouses(id, name),
          location:locations(id, name),
          movement_type:movement_types(id, code, description)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
  setStockMovements((updatedMovements as unknown as StockMovement[]) || []);

  const { data: updatedStock } = await client
        .from('current_stock')
        .select('*');
      
  setCurrentStock((updatedStock as unknown as any[]) || []);

      // Reset form
      setQuantity(1);
      setReference('');
      setNotes('');
  setDestinationWarehouseId(''); // Resetear almacén destino
  setLocationId('');
  setDestinationLocationId('');

      alert(isTransfer 
        ? 'Transferencia registrada correctamente' 
        : `${isEntry ? 'Entrada' : 'Salida'} registrada correctamente`);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !products.length) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Control de Inventario</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Registrar Movimiento</h2>
            <p className="text-gray-500 text-sm">
              {isTransfer 
                ? 'Registra transferencias de productos entre almacenes'
                : isEntry 
                  ? 'Registra entradas de productos en el inventario' 
                  : 'Registra salidas de productos del inventario'}
            </p>
          </div>

          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => handleMovementTypeChange('entry')}
              className={`px-4 py-2 rounded-md text-sm ${
                isEntry && !isTransfer
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Entrada
            </button>
            <button
              onClick={() => handleMovementTypeChange('exit')}
              className={`px-4 py-2 rounded-md text-sm ${
                !isEntry && !isTransfer
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Salida
            </button>
            <button
              onClick={() => handleMovementTypeChange('transfer')}
              className={`px-4 py-2 rounded-md text-sm ${
                isTransfer
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Transferencia
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto *
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isTransfer ? 'Almacén Origen *' : 'Almacén *'}
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecciona un almacén</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ubicación para entrada/salida o ubicación origen en transferencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isTransfer ? 'Ubicación Origen *' : 'Ubicación *'}
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
                disabled={!warehouseId}
              >
                <option value="">{warehouseId ? 'Selecciona una ubicación' : 'Selecciona primero un almacén'}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo adicional para almacén destino en transferencias */}
            {isTransfer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Almacén Destino *
                </label>
                <select
                  value={destinationWarehouseId}
                  onChange={(e) => setDestinationWarehouseId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecciona un almacén de destino</option>
                  {warehouses
                    .filter((w) => w.id !== warehouseId) // Filtrar el almacén origen
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {isTransfer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación Destino *
                </label>
                <select
                  value={destinationLocationId}
                  onChange={(e) => setDestinationLocationId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                  disabled={!destinationWarehouseId}
                >
                  <option value="">{destinationWarehouseId ? 'Selecciona una ubicación' : 'Selecciona primero un almacén'}</option>
                  {destinationLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia (opcional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Número de factura, orden, etc."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional sobre este movimiento"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
              ></textarea>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className={`px-4 py-2 rounded-md text-white text-sm ${
                  isTransfer
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? 'Procesando...' : isTransfer 
                  ? 'Registrar Transferencia' 
                  : `Registrar ${isEntry ? 'Entrada' : 'Salida'}`}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Stock Actual</h2>
          
          <div className="max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                    Producto
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                    Almacén
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentStock.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 text-center text-sm text-gray-500">
                      No hay datos de inventario
                    </td>
                  </tr>
                ) : (
                  currentStock.map((item, index) => (
                    <tr key={index}>
                      <td className="py-2 text-sm">{item.product_name}</td>
                      <td className="py-2 text-sm">{item.warehouse_name}</td>
                      <td className="py-2 text-sm text-right font-medium">{item.current_quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mt-6">
        <h2 className="text-xl font-semibold mb-3">Movimientos Recientes</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Fecha
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Tipo
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Producto
                </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Almacén
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Ubicación
                  </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Cantidad
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                  Referencia
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-sm text-gray-500">
                    No hay movimientos recientes
                  </td>
                </tr>
              ) : (
                stockMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="py-3 px-4 text-sm">
                      {new Date(movement.movement_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          movement.movement_type?.code?.startsWith('IN_')
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {movement.movement_type?.description || 'Desconocido'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{movement.product?.name}</td>
                      <td className="py-3 px-4 text-sm">{movement.warehouse?.name}</td>
                      <td className="py-3 px-4 text-sm">{(movement as any).location?.name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">{movement.quantity}</td>
                    <td className="py-3 px-4 text-sm">{movement.reference || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory; 