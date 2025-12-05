import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getLocalDateISOString, formatDateString } from '../lib/dateUtils';
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
    startDate: (() => {
      const d = new Date();
      d.setDate(1); // Establecer al día 1 del mes actual
      return getLocalDateISOString(d);
    })(),
    endDate: getLocalDateISOString(),
  });

  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [purchasesData, setPurchasesData] = useState<PurchaseData[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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
    setCurrentPage(1); // Reset página al cambiar filtros
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
      
      // Agregar día completo para incluir todo el día final
      const endDatePlusOne = (() => {
        const d = new Date(filters.endDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })();

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
        .lt('invoice_date', endDatePlusOne)
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

      // Calcular estadísticas (EXCLUIR facturas anuladas del total)
      // Filtrar solo facturas válidas (emitida, pagada, borrador) para los cálculos
      const validInvoices = formattedData.filter(item => item.status !== 'anulada');

      if (validInvoices.length > 0) {
        const total = validInvoices.reduce((sum, item) => sum + item.total_amount, 0);
        const count = validInvoices.length;
        const avg = total / count;
        const min = Math.min(...validInvoices.map(item => item.total_amount));
        const max = Math.max(...validInvoices.map(item => item.total_amount));

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
      
      // Agregar día completo para incluir todo el día final
      const endDatePlusOne = (() => {
        const d = new Date(filters.endDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })();

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
        .lt('order_date', endDatePlusOne)
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
          formatDateString((item as SalesData).invoice_date, currency.settings.locale),
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
          formatDateString((item as PurchaseData).order_date, currency.settings.locale),
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
      const date = getLocalDateISOString(); // Formato YYYY-MM-DD
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

  // Lógica de paginación
  const currentData = activeReport === 'sales' ? salesData : purchasesData;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

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
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeReport === 'sales'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            Reporte de Ventas
          </button>
          <button
            onClick={() => setActiveReport('purchases')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeReport === 'purchases'
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold dark:text-gray-200">Filtros</h2>
          <button
            onClick={() => {
              const today = getLocalDateISOString();
              setFilters(prev => ({
                ...prev,
                startDate: today,
                endDate: today
              }));
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center text-sm"
          >
            <i className="fas fa-calendar-day mr-2"></i>
            Reporte Diario
          </button>
        </div>
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
        
        {/* Indicador de Reporte Diario */}
        {filters.startDate === filters.endDate && filters.startDate === getLocalDateISOString() && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-3 rounded-md">
            <div className="flex items-center">
              <i className="fas fa-info-circle text-blue-500 dark:text-blue-300 mr-2"></i>
              <p className="text-sm text-blue-700 dark:text-blue-200 font-medium">
                Mostrando reporte del día: {formatDateString(filters.startDate, currency.settings.locale)}
              </p>
            </div>
          </div>
        )}
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
        <>
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
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
                  paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay datos para el período seleccionado
                      </td>
                    </tr>
                  ) : (
                    (paginatedData as SalesData[]).map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                        {invoice.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {formatDateString(invoice.invoice_date, currency.settings.locale)}
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
                  paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay datos para el período seleccionado
                      </td>
                    </tr>
                  ) : (
                    (paginatedData as PurchaseData[]).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                        #{order.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-300">
                        {formatDateString(order.order_date, currency.settings.locale)}
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

          {/* Controles de paginación */}
          {currentData.length > itemsPerPage && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-b-lg shadow">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Mostrando{' '}
                    <span className="font-medium">{startIndex + 1}</span>
                    {' '}-{' '}
                    <span className="font-medium">
                      {Math.min(endIndex, currentData.length)}
                    </span>
                    {' '}de{' '}
                    <span className="font-medium">{currentData.length}</span>
                    {' '}resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Anterior</span>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    {getPageNumbers().map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-200'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Siguiente</span>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;