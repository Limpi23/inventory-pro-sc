import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import { useCurrency } from '../hooks/useCurrency';

interface ReportFilter {
  startDate: string;
  endDate: string;
  status?: string;
  warehouse_id?: string;
}

interface SalesData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  status: string;
  warehouse_name: string;
  total_amount: number;
}

interface PurchaseData {
  id: string;
  order_date: string;
  supplier_name: string;
  status: string;
  warehouse_name: string;
  total_amount: number;
}

interface Warehouse {
  id: string;
  name: string;
}

const Reports: React.FC = () => {
  const currency = useCurrency();
  const [activeReport, setActiveReport] = useState<'sales' | 'purchases'>('sales');
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [purchasesData, setPurchasesData] = useState<PurchaseData[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estadísticas
  const [stats, setStats] = useState({
    totalAmount: 0,
    count: 0,
    avgAmount: 0,
    minAmount: 0,
    maxAmount: 0
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (activeReport === 'sales') {
      fetchSalesReport();
    } else {
      fetchPurchasesReport();
    }
  }, [activeReport, filters]);

  const fetchWarehouses = async () => {
    try {
      const client = await supabase.getClient();
      const { data, error } = await client.from('warehouses')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
  setWarehouses((data as any[]) || []);
    } catch (err: any) {
      console.error('Error cargando almacenes:', err);
      setError('Error cargando almacenes: ' + err.message);
    }
  };

  const fetchSalesReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const client = await supabase.getClient();
      let query = client.from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          status,
          total_amount,
          customer:customers(name),
          warehouse:warehouses(name)
        `)
        .gte('invoice_date', filters.startDate)
        .lte('invoice_date', filters.endDate)
        .order('invoice_date', { ascending: false });
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const formattedData = (data || []).map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        customer_name: invoice.customer?.name || 'Desconocido',
        status: invoice.status,
        warehouse_name: invoice.warehouse?.name || 'Desconocido',
        total_amount: invoice.total_amount || 0
      }));
      
      setSalesData(formattedData);
      
      // Calcular estadísticas
      if (formattedData.length > 0) {
        const total = formattedData.reduce((sum, item) => sum + item.total_amount, 0);
        const count = formattedData.length;
        const avg = total / count;
        const min = Math.min(...formattedData.map(item => item.total_amount));
        const max = Math.max(...formattedData.map(item => item.total_amount));
        
        setStats({
          totalAmount: total,
          count,
          avgAmount: avg,
          minAmount: min,
          maxAmount: max
        });
      } else {
        setStats({
          totalAmount: 0,
          count: 0,
          avgAmount: 0,
          minAmount: 0,
          maxAmount: 0
        });
      }
      
    } catch (err: any) {
      console.error('Error cargando reporte de ventas:', err);
      setError('Error cargando reporte de ventas: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPurchasesReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const client = await supabase.getClient();
      let query = client.from('purchase_orders')
        .select(`
          id,
          order_date,
          status,
          total_amount,
          supplier:suppliers(name),
          warehouse:warehouses(name)
        `)
        .gte('order_date', filters.startDate)
        .lte('order_date', filters.endDate)
        .order('order_date', { ascending: false });
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const formattedData = (data || []).map((order: any) => ({
        id: order.id,
        order_date: order.order_date,
        supplier_name: order.supplier?.name || 'Desconocido',
        status: order.status,
        warehouse_name: order.warehouse?.name || 'Desconocido',
        total_amount: order.total_amount || 0
      }));
      
      setPurchasesData(formattedData);
      
      // Calcular estadísticas
      if (formattedData.length > 0) {
        const total = formattedData.reduce((sum, item) => sum + item.total_amount, 0);
        const count = formattedData.length;
        const avg = total / count;
        const min = Math.min(...formattedData.map(item => item.total_amount));
        const max = Math.max(...formattedData.map(item => item.total_amount));
        
        setStats({
          totalAmount: total,
          count,
          avgAmount: avg,
          minAmount: min,
          maxAmount: max
        });
      } else {
        setStats({
          totalAmount: 0,
          count: 0,
          avgAmount: 0,
          minAmount: 0,
          maxAmount: 0
        });
      }
      
    } catch (err: any) {
      console.error('Error cargando reporte de compras:', err);
      setError('Error cargando reporte de compras: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const exportToCSV = () => {
    try {
      setIsExporting(true);
      
      const data = activeReport === 'sales' ? salesData : purchasesData;
      let headers: string[];
      let dataRows: string[][];
      
      if (activeReport === 'sales') {
        headers = [
          'Número de Factura',
          'Fecha',
          'Cliente',
          'Estado',
          'Almacén',
          'Total'
        ];
        
        dataRows = data.map(item => [
          (item as SalesData).invoice_number,
          new Date((item as SalesData).invoice_date).toLocaleDateString(currency.settings.locale),
          (item as SalesData).customer_name,
          (item as SalesData).status,
          (item as SalesData).warehouse_name,
          (item as SalesData).total_amount.toString()
        ]);
      } else {
        headers = [
          'ID',
          'Fecha',
          'Proveedor',
          'Estado',
          'Almacén',
          'Total'
        ];
        
        dataRows = data.map(item => [
          (item as PurchaseData).id,
          new Date((item as PurchaseData).order_date).toLocaleDateString(currency.settings.locale),
          (item as PurchaseData).supplier_name,
          (item as PurchaseData).status,
          (item as PurchaseData).warehouse_name,
          (item as PurchaseData).total_amount.toString()
        ]);
      }
      
      // Añadir estadísticas al final
      dataRows.push([]);
      dataRows.push(['Resumen', '', '', '', '', '']);
      dataRows.push(['Total registros', stats.count.toString(), '', '', '', '']);
  dataRows.push(['Total monto', stats.totalAmount.toString(), '', '', '', '']);
  dataRows.push(['Promedio', stats.avgAmount.toString(), '', '', '', '']);
  dataRows.push(['Mínimo', stats.minAmount.toString(), '', '', '', '']);
  dataRows.push(['Máximo', stats.maxAmount.toString(), '', '', '', '']);
      
      // Usar PapaParse para crear el CSV correctamente con manejo de comillas y caracteres especiales
      const csv = Papa.unparse({
        fields: headers,
        data: dataRows
      });
      
      // Crear un blob y URL para descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Crear elemento de enlace para descarga
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
      const fileName = activeReport === 'sales' 
        ? `reporte_ventas_${date}.csv` 
        : `reporte_compras_${date}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      
      // Simular clic y eliminar el enlace
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
      console.error('Error al exportar reporte:', err);
      setError('Error al generar el archivo CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => currency.format(amount);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <button
          onClick={exportToCSV}
          disabled={isExporting || isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center"
        >
          {isExporting ? (
            <span className="inline-block animate-spin mr-2">
              <i className="fas fa-spinner"></i>
            </span>
          ) : (
            <i className="fas fa-file-csv mr-2"></i>
          )}
          Exportar a CSV
        </button>
      </div>
      
      {/* Pestañas de tipo de reporte */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveReport('sales')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'sales'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Reporte de Ventas
          </button>
          <button
            onClick={() => setActiveReport('purchases')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'purchases'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Reporte de Compras
          </button>
        </nav>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4 dark:text-gray-200">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estado
            </label>
            <select
              id="status"
              name="status"
              value={filters.status || ''}
              onChange={handleFilterChange}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos los estados</option>
              {activeReport === 'sales' ? (
                <>
                  <option value="borrador">Borrador</option>
                  <option value="emitida">Emitida</option>
                  <option value="pagada">Pagada</option>
                  <option value="anulada">Anulada</option>
                </>
              ) : (
                <>
                  <option value="borrador">Borrador</option>
                  <option value="enviada">Enviada</option>
                  <option value="recibida_parcialmente">Recibida parcialmente</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label htmlFor="warehouse_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Almacén
            </label>
            <select
              id="warehouse_id"
              name="warehouse_id"
              value={filters.warehouse_id || ''}
              onChange={handleFilterChange}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos los almacenes</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow">
          <div className="text-xs text-blue-500 dark:text-blue-300 uppercase font-semibold">Total</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">{formatCurrency(stats.totalAmount)}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg shadow">
          <div className="text-xs text-green-500 dark:text-green-300 uppercase font-semibold">Registros</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-200">{stats.count}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg shadow">
          <div className="text-xs text-purple-500 dark:text-purple-300 uppercase font-semibold">Promedio</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-200">{formatCurrency(stats.avgAmount)}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg shadow">
          <div className="text-xs text-yellow-500 dark:text-yellow-300 uppercase font-semibold">Mínimo</div>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-200">{formatCurrency(stats.minAmount)}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg shadow">
          <div className="text-xs text-red-500 dark:text-red-300 uppercase font-semibold">Máximo</div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-200">{formatCurrency(stats.maxAmount)}</div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {activeReport === 'sales' ? (
                  <>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Factura
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Fecha
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Cliente
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Orden #
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Fecha
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                      Proveedor
                    </th>
                  </>
                )}
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                  Estado
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                  Almacén
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {activeReport === 'sales' ? (
                salesData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay datos para el período seleccionado
                    </td>
                  </tr>
                ) : (
                  salesData.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                        {invoice.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {new Date(invoice.invoice_date).toLocaleDateString(currency.settings.locale)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {invoice.customer_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${invoice.status === 'emitida' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                          invoice.status === 'pagada' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          invoice.status === 'anulada' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {invoice.warehouse_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium dark:text-gray-300">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                purchasesData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No hay datos para el período seleccionado
                    </td>
                  </tr>
                ) : (
                  purchasesData.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                        #{order.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {new Date(order.order_date).toLocaleDateString(currency.settings.locale)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {order.supplier_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${order.status === 'enviada' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                          order.status === 'completada' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          order.status === 'cancelada' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                          order.status === 'recibida_parcialmente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {order.warehouse_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium dark:text-gray-300">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports; 