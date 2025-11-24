import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { useCurrency } from '../hooks/useCurrency';

const ReturnDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currency = useCurrency();
  
  const [returnData, setReturnData] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturnDetails();
  }, [id]);

  const fetchReturnDetails = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      
      // Obtener detalles de la devolución
      const { data: returnResult, error: returnError } = await client
        .from('returns')
        .select(`
          *,
          invoice:invoices(invoice_number),
          customer:customers(name, email, phone)
        `)
        .eq('id', id)
        .single();
      
      if (returnError) throw returnError;
      setReturnData(returnResult);
      
      // Obtener items de la devolución
      const { data: itemsResult, error: itemsError } = await client
        .from('return_items')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('return_id', id);
        
      if (itemsError) throw itemsError;
      setReturnItems(itemsResult || []);
      
    } catch (error: any) {
      console.error('Error al cargar devolución:', error.message);
      toast.error('Error al cargar los detalles de la devolución');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const client = await supabase.getClient();
      const { error } = await client
        .from('returns')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      
      setReturnData({ ...returnData, status: newStatus });
      toast.success('Estado actualizado correctamente');
    } catch (error: any) {
      console.error('Error al actualizar estado:', error.message);
      toast.error('Error al actualizar el estado');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(currency.settings.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: string; text: string }> = {
      'pendiente': { color: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock', text: 'Pendiente' },
      'procesada': { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Procesada' },
      'rechazada': { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Rechazada' }
    };
    
    const config = statusConfig[status] || statusConfig.pendiente;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <i className={`fas ${config.icon} mr-1`}></i>
        {config.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas/devoluciones" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Devoluciones
          </Link>
          <h1 className="text-2xl font-semibold">Detalle de Devolución</h1>
        </div>
        
        {returnData && returnData.status === 'pendiente' && (
          <div className="flex space-x-2 mt-4 md:mt-0">
            <button
              onClick={() => handleUpdateStatus('procesada')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
              disabled={loading}
            >
              <i className="fas fa-check"></i>
              <span>Aprobar</span>
            </button>
            <button
              onClick={() => handleUpdateStatus('rechazada')}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-2"
              disabled={loading}
            >
              <i className="fas fa-times"></i>
              <span>Rechazar</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : !returnData ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">No se encontró la devolución solicitada.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Información general */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold mb-4">Información de la Devolución</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Estado</p>
                  <p className="mb-3">{renderStatusBadge(returnData.status)}</p>
                  
                  <p className="text-sm text-gray-600 mb-1">Fecha de Devolución</p>
                  <p className="mb-3">{formatDate(returnData.return_date)}</p>
                  
                  <p className="text-sm text-gray-600 mb-1">Total Devuelto</p>
                  <p className="mb-3 font-medium">{currency.format(returnData.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Factura Relacionada</p>
                  <p className="mb-3">
                    <Link 
                      to={`/ventas/facturas/${returnData.invoice?.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {returnData.invoice?.invoice_number}
                    </Link>
                  </p>
                  
                  <p className="text-sm text-gray-600 mb-1">Fecha de Factura</p>
                  <p className="mb-3">{formatDate(returnData.invoice?.invoice_date || '')}</p>
                  
                  <p className="text-sm text-gray-600 mb-1">Cliente</p>
                  <p className="mb-3">{returnData.invoice?.customer?.name}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Motivo de la devolución */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Motivo de la Devolución</h2>
              <p className="whitespace-pre-wrap">{returnData.reason}</p>
              
              {returnData.notes && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Notas Adicionales</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{returnData.notes}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Productos devueltos */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Productos Devueltos</h2>
              
              {returnItems.length === 0 ? (
                <p className="text-gray-500">No hay productos en esta devolución.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo Específico</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {returnItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-xs text-gray-500">SKU: {item.product?.sku}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {currency.format(item.unit_price ?? 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">
                            {currency.format(item.total_price ?? 0)}
                          </td>
                          <td className="px-6 py-4">
                            {item.reason || <span className="text-gray-400">Sin especificar</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-right font-medium">Total:</td>
                        <td className="px-6 py-4 font-bold">{currency.format(returnData.total_amount)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnDetail;