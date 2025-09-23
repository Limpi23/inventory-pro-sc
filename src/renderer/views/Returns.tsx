import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Return } from '../../types';
import { toast } from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';

const Returns: React.FC = () => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [returnsPerPage] = useState(10);
  const currency = useCurrency();

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client.from('returns')
        .select(`
          *,
          invoice:invoices(id, invoice_number, customer_id, customer:customers(id, name, identification_number))
        `)
        .order('return_date', { ascending: false });

      if (error) throw error;
  setReturns((data as any[]) || []);
    } catch (error: any) {
      
      toast.error(`Error al cargar devoluciones: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar devoluciones basadas en el término de búsqueda y filtro de estado
  const filteredReturns = returns.filter(ret => {
    const matchesSearch = (
      ret.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.invoice?.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.invoice?.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesStatus = statusFilter === 'all' || ret.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calcular la paginación
  const indexOfLastReturn = currentPage * returnsPerPage;
  const indexOfFirstReturn = indexOfLastReturn - returnsPerPage;
  const currentReturns = filteredReturns.slice(indexOfFirstReturn, indexOfLastReturn);
  const totalPages = Math.ceil(filteredReturns.length / returnsPerPage);

  const handleUpdateReturnStatus = async (id: string, newStatus: string) => {
    if (!confirm(`¿Está seguro que desea cambiar el estado de esta devolución a "${newStatus}"?`)) {
      return;
    }

    try {
      const client = await supabase.getClient();
      const { error } = await client.from('returns')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Estado de devolución actualizado a ${newStatus}`);
      fetchReturns();
    } catch (error: any) {
      
      toast.error(`Error al actualizar estado: ${error.message}`);
    }
  };

  // Formatear fecha con la configuración de moneda/locale
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(currency.settings.locale, options);
  };

  // Renderizar el badge de estado
  const renderStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string, icon: string, text: string } } = {
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
          <Link to="/ventas" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Ventas
          </Link>
          <h1 className="text-2xl font-semibold">Devoluciones</h1>
        </div>
        <Link 
          to="/ventas/devoluciones/nueva" 
          className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <i className="fas fa-plus mr-2"></i> Nueva Devolución
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-medium">Lista de Devoluciones</h2>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="procesada">Procesada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
                <i className="fas fa-filter absolute left-3 top-3 text-gray-400"></i>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar devolución..."
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : currentReturns.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fas fa-exchange-alt text-gray-300 text-5xl mb-4"></i>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'No se encontraron devoluciones que coincidan con la búsqueda.'
                : 'No hay devoluciones registradas. ¡Registra tu primera devolución!'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factura/Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">Factura: {ret.invoice?.invoice_number}</div>
                        <div className="text-sm text-gray-500">Cliente: {ret.invoice?.customer?.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(ret.return_date)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">{ret.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {currency.format(ret.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(ret.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Link 
                            to={`/ventas/devoluciones/${ret.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalle"
                          >
                            <i className="fas fa-eye"></i>
                          </Link>
                          
                          {ret.status === 'pendiente' && (
                            <>
                              <button 
                                onClick={() => handleUpdateReturnStatus(ret.id, 'procesada')}
                                className="text-green-600 hover:text-green-900"
                                title="Aprobar"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                              <button 
                                onClick={() => handleUpdateReturnStatus(ret.id, 'rechazada')}
                                className="text-red-600 hover:text-red-900"
                                title="Rechazar"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </>
                          )}
                          
                          <Link 
                            to={`/ventas/devoluciones/imprimir/${ret.id}`}
                            className="text-green-600 hover:text-green-900"
                            title="Imprimir"
                          >
                            <i className="fas fa-print"></i>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t">
                <div className="hidden sm:block">
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{indexOfFirstReturn + 1}</span> a{' '}
                    <span className="font-medium">
                      {Math.min(indexOfLastReturn, filteredReturns.length)}
                    </span>{' '}
                    de <span className="font-medium">{filteredReturns.length}</span> devoluciones
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === 1 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === totalPages 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Returns; 