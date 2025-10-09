import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface ProductSerial {
  id: string;
  serial_code: string;
  vin?: string;
  engine_number?: string;
  year?: number;
  color?: string;
  status: string;
  warehouse_id?: string;
  location_id?: string;
  warehouse?: {
    name: string;
  };
  location?: {
    name: string;
  };
}

interface SerialManagementModalProps {
  productId: string;
  productName: string;
  productSku: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function SerialManagementModal({ 
  productId, 
  productName, 
  productSku,
  onClose,
  onUpdate 
}: SerialManagementModalProps) {
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    serial_code: '',
    vin: '',
    engine_number: '',
    year: '',
    color: '',
    warehouse_id: '',
    location_id: ''
  });

  useEffect(() => {
    fetchSerials();
    fetchWarehouses();
  }, [productId]);

  const fetchSerials = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('product_serials')
        .select(`
          *,
          warehouse:warehouses(name),
          location:locations(name)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSerials(data || []);
    } catch (error: any) {
      console.error('Error fetching serials:', error);
      toast.error('Error al cargar seriales');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error: any) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchLocations = async (warehouseId: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    if (formData.warehouse_id) {
      fetchLocations(formData.warehouse_id);
    } else {
      setLocations([]);
      setFormData(prev => ({ ...prev, location_id: '' }));
    }
  }, [formData.warehouse_id]);

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({
      serial_code: '',
      vin: '',
      engine_number: '',
      year: '',
      color: '',
      warehouse_id: '',
      location_id: ''
    });
  };

  const handleEdit = (serial: ProductSerial) => {
    setEditingId(serial.id);
    setIsAdding(true);
    setFormData({
      serial_code: serial.serial_code,
      vin: serial.vin || '',
      engine_number: serial.engine_number || '',
      year: serial.year?.toString() || '',
      color: serial.color || '',
      warehouse_id: serial.warehouse_id || '',
      location_id: serial.location_id || ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      serial_code: '',
      vin: '',
      engine_number: '',
      year: '',
      color: '',
      warehouse_id: '',
      location_id: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.serial_code.trim()) {
      toast.error('El código de serie es obligatorio');
      return;
    }

    try {
      const serialData = {
        product_id: productId,
        serial_code: formData.serial_code.trim(),
        vin: formData.vin.trim() || null,
        engine_number: formData.engine_number.trim() || null,
        year: formData.year ? parseInt(formData.year) : null,
        color: formData.color.trim() || null,
        warehouse_id: formData.warehouse_id || null,
        location_id: formData.location_id || null,
        status: 'in_stock'
      };

      if (editingId) {
        // Actualizar
        const { error } = await supabase
          .from('product_serials')
          .update(serialData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Serial actualizado correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('product_serials')
          .insert([serialData]);

        if (error) throw error;
        toast.success('Serial agregado correctamente');
      }

      handleCancel();
      fetchSerials();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving serial:', error);
      toast.error(error.message || 'Error al guardar serial');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este serial?')) return;

    try {
      const { error } = await supabase
        .from('product_serials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Serial eliminado correctamente');
      fetchSerials();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error deleting serial:', error);
      toast.error('Error al eliminar serial');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      in_stock: { label: 'En Stock', className: 'bg-green-100 text-green-800' },
      sold: { label: 'Vendido', className: 'bg-blue-100 text-blue-800' },
      reserved: { label: 'Reservado', className: 'bg-yellow-100 text-yellow-800' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestión de Seriales</h2>
              <p className="text-sm text-gray-500 mt-1">
                {productName} - SKU: {productSku}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Botón agregar */}
          {!isAdding && (
            <div className="mb-4">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                Agregar Serial
              </button>
            </div>
          )}

          {/* Formulario */}
          {isAdding && (
            <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold mb-4">
                {editingId ? 'Editar Serial' : 'Nuevo Serial'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código de Serie / VIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.serial_code}
                    onChange={(e) => setFormData({ ...formData, serial_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VIN (alternativo)
                  </label>
                  <input
                    type="text"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Motor
                  </label>
                  <input
                    type="text"
                    value={formData.engine_number}
                    onChange={(e) => setFormData({ ...formData, engine_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Año
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Almacén
                  </label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar almacén</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!formData.warehouse_id}
                  >
                    <option value="">Seleccionar ubicación</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Tabla de seriales */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial/VIN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    </td>
                  </tr>
                ) : serials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No hay seriales registrados
                    </td>
                  </tr>
                ) : (
                  serials.map((serial) => (
                    <tr key={serial.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{serial.serial_code}</div>
                        {serial.vin && serial.vin !== serial.serial_code && (
                          <div className="text-xs text-gray-500">VIN: {serial.vin}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{serial.engine_number || '-'}</td>
                      <td className="px-4 py-3 text-sm">{serial.year || '-'}</td>
                      <td className="px-4 py-3 text-sm">{serial.color || '-'}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(serial.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{serial.warehouse?.name || '-'}</div>
                        {serial.location?.name && (
                          <div className="text-xs text-gray-500">{serial.location.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(serial)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(serial.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Total de seriales: <span className="font-semibold">{serials.length}</span>
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
