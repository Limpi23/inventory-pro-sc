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

interface MovementItem {
  tempId: string;
  productId: string;
  productName: string;
  productSku?: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  // Para transferencias
  destinationWarehouseId?: string;
  destinationWarehouseName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movementTypes, setMovementTypes] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [currentStock, setCurrentStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado separado para envío del formulario
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

  // Estado para búsqueda de productos
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Estados para la lista de productos (carrito)
  const [movementItems, setMovementItems] = useState<MovementItem[]>([]);
  const [globalReference, setGlobalReference] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');

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
          // Mostrar ubicaciones del almacén seleccionado y también las no asignadas (warehouse_id NULL)
          const { data, error } = await client
            .from('locations')
            .select('*')
            .or(`warehouse_id.eq.${warehouseId},warehouse_id.is.null`)
            .eq('active', true)
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
          // Para transferencias, incluir ubicaciones del almacén destino y también las no asignadas
          const { data, error } = await client
            .from('locations')
            .select('*')
            .or(`warehouse_id.eq.${destinationWarehouseId},warehouse_id.is.null`)
            .eq('active', true)
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

  // Filtrar productos basado en búsqueda (nombre o SKU)
  const filteredProducts = products.filter((product) => {
    const searchLower = productSearchTerm.toLowerCase();
    const nameMatch = product.name.toLowerCase().includes(searchLower);
    const skuMatch = product.sku?.toLowerCase().includes(searchLower);
    return nameMatch || skuMatch;
  });

  // Función para seleccionar un producto
  const handleSelectProduct = (product: Product) => {
    setProductId(product.id);
    setProductSearchTerm(product.sku ? `${product.name} (${product.sku})` : product.name);
    setShowProductDropdown(false);
  };

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
    // Limpiar la lista cuando se cambia el tipo de movimiento
    setMovementItems([]);
  };

  // Función para agregar producto a la lista
  const handleAddToList = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!productId || !warehouseId || !locationId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    if (isTransfer && (!destinationWarehouseId || !destinationLocationId)) {
      alert('Por favor completa el almacén y ubicación de destino');
      return;
    }

    if (isTransfer && destinationWarehouseId === warehouseId) {
      alert('El almacén de destino debe ser diferente al de origen');
      return;
    }

    // Buscar nombres para mostrar
    const product = products.find(p => p.id === productId);
    const warehouse = warehouses.find(w => w.id === warehouseId);
    const location = locations.find(l => l.id === locationId);
    const destWarehouse = isTransfer ? warehouses.find(w => w.id === destinationWarehouseId) : undefined;
    const destLocation = isTransfer ? destinationLocations.find(l => l.id === destinationLocationId) : undefined;

    if (!product || !warehouse || !location) {
      alert('Error al obtener información del producto, almacén o ubicación');
      return;
    }

    // Crear item para la lista
    const newItem: MovementItem = {
      tempId: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      locationId: location.id,
      locationName: location.name,
      quantity: quantity,
      destinationWarehouseId: destWarehouse?.id,
      destinationWarehouseName: destWarehouse?.name,
      destinationLocationId: destLocation?.id,
      destinationLocationName: destLocation?.name,
    };

    // Agregar a la lista
    setMovementItems([...movementItems, newItem]);

    // Limpiar formulario para agregar otro producto
    setProductId('');
    setProductSearchTerm('');
    setLocationId('');
    setQuantity(1);
    if (isTransfer) {
      setDestinationLocationId('');
    }
  };

  // Función para eliminar un producto de la lista
  const handleRemoveFromList = (tempId: string) => {
    setMovementItems(movementItems.filter(item => item.tempId !== tempId));
  };

  // Función para guardar todos los movimientos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (movementItems.length === 0) {
      alert('Agrega al menos un producto a la lista antes de guardar');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const client = await supabase.getClient();

      // Validar stock para salidas y transferencias (en paralelo)
      if (!isEntry || isTransfer) {
        const stockChecks = movementItems.map(async (item) => {
          // Primero consultar sin filtrar por location_id para ver el stock total
          const { data: totalStockData } = await client
            .from('current_stock_by_location')
            .select('location_id, location_name, current_quantity')
            .eq('product_id', item.productId)
            .eq('warehouse_id', item.warehouseId);
          
          // Luego consultar con la ubicación específica
          const { data: stockData } = await client
            .from('current_stock_by_location')
            .select('current_quantity')
            .eq('product_id', item.productId)
            .eq('warehouse_id', item.warehouseId)
            .eq('location_id', item.locationId)
            .maybeSingle();
          
          const currentQty = Number((stockData as any)?.current_quantity ?? 0);
          
          // Log de depuración
          console.log('Validación de stock:', {
            producto: item.productName,
            almacen: item.warehouseName,
            ubicacion_buscada: item.locationName,
            ubicacion_id: item.locationId,
            cantidad_solicitada: item.quantity,
            cantidad_disponible: currentQty,
            todas_ubicaciones: totalStockData
          });
          
          if (item.quantity > currentQty) {
            // Crear mensaje más informativo
            let errorMsg = `Stock insuficiente para ${item.productName} en ${item.locationName}. Solo hay ${currentQty} unidades disponibles en esa ubicación.`;
            
            // Si hay stock en otras ubicaciones, mencionarlo
            if (totalStockData && totalStockData.length > 0) {
              const otrasUbicaciones = totalStockData
                .filter((loc: any) => loc.location_id !== item.locationId && loc.current_quantity > 0)
                .map((loc: any) => `${loc.location_name}: ${loc.current_quantity} unidades`)
                .join(', ');
              
              if (otrasUbicaciones) {
                errorMsg += `\n\nStock disponible en otras ubicaciones: ${otrasUbicaciones}`;
              }
            }
            
            throw new Error(errorMsg);
          }
        });
        
        await Promise.all(stockChecks);
      }

      // Preparar movimientos para inserción masiva
      const movementsToInsert: any[] = [];
      
      // Obtener tipos de movimiento necesarios una sola vez
      let outMovementType: any;
      let inMovementType: any;
      let standardMovementType: any;

      if (isTransfer) {
        outMovementType = movementTypes.find((t) => t.code === 'OUT_TRANSFER');
        inMovementType = movementTypes.find((t) => t.code === 'IN_TRANSFER');
        if (!outMovementType || !inMovementType) {
          throw new Error('Tipos de movimiento de transferencia no encontrados');
        }
      } else {
        const typeCode = isEntry ? 'IN_PURCHASE' : 'OUT_SALE';
        standardMovementType = movementTypes.find((t) => t.code === typeCode);
        if (!standardMovementType) {
          throw new Error('Tipo de movimiento no encontrado');
        }
      }

      // Construir array de movimientos
      for (const item of movementItems) {
        if (isTransfer) {
          const transferId = crypto.randomUUID();
          
          // Salida
          movementsToInsert.push({
            product_id: item.productId,
            warehouse_id: item.warehouseId,
            location_id: item.locationId,
            quantity: item.quantity,
            movement_type_id: outMovementType.id,
            movement_date: new Date(date).toISOString(),
            reference: globalReference || `Transferencia a ${item.destinationWarehouseName}`,
            notes: globalNotes || null,
            related_id: transferId
          });

          // Entrada
          movementsToInsert.push({
            product_id: item.productId,
            warehouse_id: item.destinationWarehouseId!,
            location_id: item.destinationLocationId!,
            quantity: item.quantity,
            movement_type_id: inMovementType.id,
            movement_date: new Date(date).toISOString(),
            reference: globalReference || `Transferencia desde ${item.warehouseName}`,
            notes: globalNotes || null,
            related_id: transferId
          });
        } else {
          // Entrada/Salida normal
          movementsToInsert.push({
            product_id: item.productId,
            warehouse_id: item.warehouseId,
            location_id: item.locationId,
            quantity: item.quantity,
            movement_type_id: standardMovementType.id,
            movement_date: new Date(date).toISOString(),
            reference: globalReference || null,
            notes: globalNotes || null
          });
        }
      }

      // Inserción masiva
      if (movementsToInsert.length > 0) {
        const { error: insertError } = await client
          .from('stock_movements')
          .insert(movementsToInsert);

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

      // Reset form y lista
      setMovementItems([]);
      setQuantity(1);
      setGlobalReference('');
      setGlobalNotes('');
      setDestinationWarehouseId('');
      setLocationId('');
      setDestinationLocationId('');
      setProductId('');
      setProductSearchTerm('');

      const itemCount = movementItems.length;
      alert(isTransfer 
        ? `${itemCount} transferencia${itemCount > 1 ? 's' : ''} registrada${itemCount > 1 ? 's' : ''} correctamente` 
        : `${itemCount} ${isEntry ? 'entrada' : 'salida'}${itemCount > 1 ? 's' : ''} registrada${itemCount > 1 ? 's' : ''} correctamente`);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      alert('Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
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

          <form onSubmit={handleAddToList} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto * (buscar por nombre o SKU)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-search text-gray-400 text-sm"></i>
                  </div>
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setShowProductDropdown(true);
                      if (!e.target.value) {
                        setProductId('');
                      }
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => {
                      // Delay para permitir click en opciones
                      setTimeout(() => setShowProductDropdown(false), 200);
                    }}
                    placeholder="Escribe nombre o SKU del producto..."
                    className="w-full pl-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  {/* Dropdown de productos filtrados */}
                  {showProductDropdown && productSearchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{product.name}</div>
                            {product.sku && (
                              <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Mostrar producto seleccionado */}
                  {productId && !showProductDropdown && (
                    <div className="mt-1 text-xs text-green-600 flex items-center">
                      <i className="fas fa-check-circle mr-1"></i>
                      Producto seleccionado
                    </div>
                  )}
                </div>
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

            <div className="pt-4">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-plus mr-2"></i>
                Agregar a la lista
              </button>
            </div>
          </form>

          {/* Lista de productos agregados */}
          {movementItems.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">
                Productos en la lista ({movementItems.length})
              </h3>
              
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Producto
                      </th>
                      {isTransfer ? (
                        <>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Origen
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Destino
                          </th>
                        </>
                      ) : (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Almacén / Ubicación
                        </th>
                      )}
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Cantidad
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movementItems.map((item) => (
                      <tr key={item.tempId}>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium">{item.productName}</div>
                          {item.productSku && (
                            <div className="text-xs text-gray-500">SKU: {item.productSku}</div>
                          )}
                        </td>
                        {isTransfer ? (
                          <>
                            <td className="px-3 py-2 text-sm">
                              <div>{item.warehouseName}</div>
                              <div className="text-xs text-gray-500">{item.locationName}</div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div>{item.destinationWarehouseName}</div>
                              <div className="text-xs text-gray-500">{item.destinationLocationName}</div>
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-2 text-sm">
                            <div>{item.warehouseName}</div>
                            <div className="text-xs text-gray-500">{item.locationName}</div>
                          </td>
                        )}
                        <td className="px-3 py-2 text-sm text-right font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleRemoveFromList(item.tempId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            title="Eliminar de la lista"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Campos globales para referencia y notas */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={globalReference}
                    onChange={(e) => setGlobalReference(e.target.value)}
                    placeholder="Número de factura, orden, etc."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    placeholder="Notas adicionales para todos los movimientos..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setMovementItems([])}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  Guardar Movimientos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral con movimientos recientes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Movimientos Recientes</h2>
          
          <div className="space-y-4">
            {stockMovements.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay movimientos registrados
              </p>
            ) : (
              stockMovements.map((movement) => (
                <div key={movement.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      movement.movement_type?.code.startsWith('IN') 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {movement.movement_type?.description || movement.movement_type?.code}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(movement.movement_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-medium text-sm mb-1">
                    {movement.product?.name}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{movement.warehouse?.name}</span>
                    <span className="font-semibold text-gray-700">
                      {movement.quantity} u.
                    </span>
                  </div>
                  {movement.reference && (
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      Ref: {movement.reference}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;