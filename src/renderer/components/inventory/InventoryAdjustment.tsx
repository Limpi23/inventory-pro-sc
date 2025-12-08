import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface InventoryAdjustmentProps {
  isOpen: boolean;
  onClose: () => void;
  onAdjustmentComplete: () => void;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
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

interface CurrentStock {
  current_quantity: number;
}

const InventoryAdjustment: React.FC<InventoryAdjustmentProps> = ({ isOpen, onClose, onAdjustmentComplete }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState<string>('');
  const [reason, setReason] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadLocations(selectedWarehouseId);
    } else {
      setLocations([]);
      setSelectedLocationId('');
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (selectedProductId && selectedWarehouseId && selectedLocationId) {
      loadCurrentStock();
    } else {
      setCurrentQuantity(null);
    }
  }, [selectedProductId, selectedWarehouseId, selectedLocationId]);

  const loadData = async () => {
    try {
      const client = await supabase.getClient();
      
      const [productsRes, warehousesRes] = await Promise.all([
        client.from('products').select('id, name, sku').order('name'),
        client.from('warehouses').select('id, name').order('name')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (warehousesRes.error) throw warehousesRes.error;

      setProducts(productsRes.data || []);
      setWarehouses(warehousesRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    }
  };

  const loadLocations = async (warehouseId: string) => {
    try {
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('locations')
        .select('id, name, warehouse_id')
        .eq('warehouse_id', warehouseId)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error loading locations:', error);
      toast.error('Error al cargar ubicaciones');
    }
  };

  const loadCurrentStock = async () => {
    try {
      setIsLoadingStock(true);
      const client = await supabase.getClient();
      
      const { data, error } = await client
        .from('current_stock_by_location')
        .select('current_quantity')
        .eq('product_id', selectedProductId)
        .eq('warehouse_id', selectedWarehouseId)
        .eq('location_id', selectedLocationId)
        .maybeSingle();

      if (error) throw error;

      const qty = data?.current_quantity ?? 0;
      setCurrentQuantity(Number(qty));
    } catch (error: any) {
      console.error('Error loading current stock:', error);
      setCurrentQuantity(0);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !selectedWarehouseId || !selectedLocationId) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    const newQty = parseFloat(newQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('La nueva cantidad debe ser un número válido mayor o igual a 0');
      return;
    }

    if (!reason.trim()) {
      toast.error('Por favor indique la razón del ajuste');
      return;
    }

    try {
      setIsLoading(true);
      const client = await supabase.getClient();

      // Llamar a la función RPC que ajusta el inventario directamente
      const { error } = await client.rpc('adjust_inventory_direct', {
        p_product_id: selectedProductId,
        p_warehouse_id: selectedWarehouseId,
        p_location_id: selectedLocationId,
        p_new_quantity: newQty,
        p_reason: reason.trim()
      });

      if (error) throw error;

      const difference = newQty - (currentQuantity || 0);
      toast.success(`Ajuste realizado correctamente. Diferencia: ${difference > 0 ? '+' : ''}${difference}`);
      
      // Reset form
      setSelectedProductId('');
      setSelectedWarehouseId('');
      setSelectedLocationId('');
      setCurrentQuantity(null);
      setNewQuantity('');
      setReason('');
      setProductSearchTerm('');
      
      onAdjustmentComplete();
      onClose();
    } catch (error: any) {
      console.error('Error adjusting inventory:', error);
      toast.error(error.message || 'Error al ajustar inventario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedProductId('');
    setSelectedWarehouseId('');
    setSelectedLocationId('');
    setCurrentQuantity(null);
    setNewQuantity('');
    setReason('');
    setProductSearchTerm('');
    onClose();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Ajuste de Inventario
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle text-yellow-600 dark:text-yellow-500 mt-0.5 mr-2"></i>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">Ajuste Directo de Inventario</p>
                <p className="mt-1">
                  Esta función ajusta directamente las cantidades sin generar movimientos.
                  Use solo para corregir descuadres o inconsistencias del inventario.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Búsqueda de Producto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Producto <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    setShowProductDropdown(true);
                    if (!e.target.value) {
                      setSelectedProductId('');
                    }
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {showProductDropdown && productSearchTerm && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No se encontraron productos
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setProductSearchTerm(`${product.name} ${product.sku ? `(${product.sku})` : ''}`);
                            setShowProductDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                          {product.sku && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {product.sku}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Almacén */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Almacén <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Seleccione un almacén</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ubicación <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
                disabled={!selectedWarehouseId}
              >
                <option value="">Seleccione una ubicación</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad Actual */}
            {currentQuantity !== null && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cantidad Actual en Sistema:
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {isLoadingStock ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      currentQuantity
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Nueva Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nueva Cantidad <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ingrese la cantidad correcta"
                required
              />
              {newQuantity && currentQuantity !== null && (
                <p className={`mt-1 text-sm ${
                  parseFloat(newQuantity) > currentQuantity
                    ? 'text-green-600 dark:text-green-400'
                    : parseFloat(newQuantity) < currentQuantity
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  Diferencia: {parseFloat(newQuantity) > currentQuantity ? '+' : ''}{(parseFloat(newQuantity) - currentQuantity).toFixed(2)}
                </p>
              )}
            </div>

            {/* Razón del Ajuste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Razón del Ajuste <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Explique la razón del ajuste (ej: conteo físico, error de registro, producto dañado, etc.)"
                required
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !selectedProductId || !selectedWarehouseId || !selectedLocationId}
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Procesando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Aplicar Ajuste
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustment;
