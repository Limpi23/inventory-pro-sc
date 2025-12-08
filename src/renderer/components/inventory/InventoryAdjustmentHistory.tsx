import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AdjustmentRecord {
  id: string;
  adjusted_at: string;
  product_name: string;
  sku: string | null;
  warehouse_name: string;
  location_name: string;
  previous_quantity: number;
  new_quantity: number;
  difference: number;
  reason: string;
  adjusted_by_name: string;
  adjusted_by_email: string;
}

interface InventoryAdjustmentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const InventoryAdjustmentHistory: React.FC<InventoryAdjustmentHistoryProps> = ({ isOpen, onClose }) => {
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAdjustments();
    }
  }, [isOpen]);

  const loadAdjustments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const client = await supabase.getClient();

      const { data, error: fetchError } = await client
        .from('inventory_adjustments_history')
        .select('*')
        .order('adjusted_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      setAdjustments(data || []);
    } catch (err: any) {
      console.error('Error loading adjustments:', err);
      setError(err.message || 'Error al cargar el historial de ajustes');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Historial de Ajustes de Inventario
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-blue-600 dark:text-blue-500 mt-0.5 mr-2"></i>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold">Registro de Auditoría</p>
                <p className="mt-1">
                  Este historial muestra todos los ajustes directos realizados en el inventario.
                  Solo los ajustes realizados por el super administrador aparecen aquí.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-600 dark:text-gray-400">Cargando historial...</p>
              </div>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <i className="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-600 dark:text-gray-400">No hay ajustes registrados</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Almacén
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cant. Anterior
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cant. Nueva
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Razón
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ajustado Por
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatDate(adj.adjusted_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="font-medium">{adj.product_name}</div>
                        {adj.sku && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {adj.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {adj.warehouse_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {adj.location_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {adj.previous_quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap font-medium">
                        {adj.new_quantity}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-bold whitespace-nowrap ${
                        adj.difference > 0
                          ? 'text-green-600 dark:text-green-400'
                          : adj.difference < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {adj.difference > 0 ? '+' : ''}{adj.difference}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="max-w-xs truncate" title={adj.reason}>
                          {adj.reason}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="font-medium">{adj.adjusted_by_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{adj.adjusted_by_email}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustmentHistory;
