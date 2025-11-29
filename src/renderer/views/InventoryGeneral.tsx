import React, { useState, useEffect, useRef } from 'react';
import InventoryInitialImport from '../components/inventory/InventoryInitialImport';
import SerializedInventory from '../components/inventory/SerializedInventory';
import { supabase } from '../lib/supabase';
import Papa from 'papaparse';
import { useReactToPrint } from 'react-to-print';
import { getLocalDateISOString } from '../lib/dateUtils';

interface InventoryItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  warehouse_id: string;
  warehouse_name: string;
  current_quantity: number;
}

interface InventoryMovement {
  id: string;
  product_name: string;
  warehouse_name: string;
  movement_date: string;
  movement_type: {
    description: string;
    code: string;
  };
  quantity: number;
  reference: string | null;
}

const InventoryGeneral: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'serialized'>('current');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'physical'>('csv');
  const [showExportOptions, setShowExportOptions] = useState(false);
  // Fila expandida para ver existencias por ubicación
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsByRow, setLocationsByRow] = useState<Record<string, { location_id: string | null; location_name: string; current_quantity: number }[]>>({});

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Estados para la vista previa de impresión
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  // Refs para la impresión y búsqueda
  const printComponentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInventory();
  }, [currentPage, searchTerm]); // Recargar cuando cambie la página o el término de búsqueda

  // Nuevo estado para total count
  const [totalInventoryCount, setTotalInventoryCount] = useState<number>(0);

  const fetchInventory = async () => {
    try {
      setIsLoading(true);

      const client = await supabase.getClient();

      // Construir query base
      let countQuery = client
        .from('current_stock')
        .select('*', { count: 'exact', head: true });

      let dataQuery = client
        .from('current_stock')
        .select('*');

      // Aplicar filtro de búsqueda si existe
      if (searchTerm.trim()) {
        const searchFilter = `product_name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }

      // Primero obtener el count total para la paginación
      const { count: totalCount, error: countError } = await countQuery;

      if (countError) throw countError;

      // Luego obtener solo los datos de la página actual
      const startIndex = (currentPage - 1) * itemsPerPage;
      const { data: inventoryData, error: inventoryError } = await dataQuery
        .order('product_name')
        .range(startIndex, startIndex + itemsPerPage - 1);

      if (inventoryError) throw inventoryError;

      // Debug: Log the actual count
      console.log('Inventory loaded:', {
        totalRecords: totalCount || 0,
        currentPageRecords: inventoryData?.length || 0,
        currentPage,
        itemsPerPage,
        startIndex,
        timestamp: new Date().toISOString()
      });

      setTotalInventoryCount(totalCount || 0);
      setInventory((inventoryData as any[]) || []);

      console.log(`Registros cargados en inventario: ${inventoryData?.length || 0}`);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading inventory:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const fetchProductHistory = async (productId: string) => {
    setIsLoading(true);
    try {
      const client = await supabase.getClient();

      // Obtener el conteo total de movimientos para este producto
      const { count } = await client
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

      // Cargar todos los movimientos sin límite de 1000
      const { data: movementsData, error: movementsError } = await client
        .from('stock_movements')
        .select(`
          id,
          movement_date,
          quantity,
          reference,
          product:products(name),
          warehouse:warehouses(name),
          movement_type:movement_types(description, code)
        `)
        .eq('product_id', productId)
        .order('movement_date', { ascending: false })
        .range(0, count ? count - 1 : 10000); // Cargar todos los movimientos

      if (movementsError) throw movementsError;

      const formattedMovements = (movementsData || []).map((m: any) => ({
        id: m.id,
        product_name: m.product?.name || 'Desconocido',
        warehouse_name: m.warehouse?.name || 'Desconocido',
        movement_date: m.movement_date,
        movement_type: {
          description: m.movement_type?.description || 'Desconocido',
          code: m.movement_type?.code || ''
        },
        quantity: m.quantity,
        reference: m.reference
      }));

      setMovements(formattedMovements);
      setActiveTab('history');
    } catch (err: any) {
      // swallow console noise
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar existencias por ubicación para una fila (producto + almacén)
  const loadLocationsForRow = async (productId: string, warehouseId: string, cacheKey: string) => {
    try {
      setLocationsLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client
        .from('current_stock_by_location')
        .select('*')
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId);
      if (error) throw error;

      const rows = (data as any[]) || [];
      // Resolver nombres de ubicaciones
      const ids = Array.from(new Set(rows.map(r => r.location_id).filter((v: string | null): v is string => !!v)));
      let namesMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: locs, error: locErr } = await client
          .from('locations')
          .select('id, name')
          .in('id', ids);
        if (locErr) throw locErr;
        namesMap = (locs || []).reduce((acc: Record<string, string>, l: any) => { acc[l.id] = l.name; return acc; }, {});
      }

      const mapped = rows
        .map(r => ({
          location_id: r.location_id ?? null,
          location_name: r.location_id ? (namesMap[r.location_id] || r.location_id) : 'Sin ubicación',
          current_quantity: Number(r.current_quantity ?? 0)
        }))
        // Orden: primero con nombre (no nulos), luego sin ubicación
        .sort((a, b) => {
          if (a.location_id && b.location_id) return a.location_name.localeCompare(b.location_name);
          if (a.location_id && !b.location_id) return -1;
          if (!a.location_id && b.location_id) return 1;
          return 0;
        });

      setLocationsByRow(prev => ({ ...prev, [cacheKey]: mapped }));
    } catch (e: any) {
      // swallow console noise
      setError(e.message || 'No se pudieron cargar las ubicaciones');
    } finally {
      setLocationsLoading(false);
    }
  };

  const toggleLocations = (item: InventoryItem) => {
    const key = `${item.product_id}|${item.warehouse_id}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    // Cargar si no está en caché
    if (!locationsByRow[key]) {
      loadLocationsForRow(item.product_id, item.warehouse_id, key);
    }
  };

  const clearFilters = () => {
    setSelectedProduct(null);
    setSelectedWarehouse(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Con paginación del servidor, no necesitamos filtrar en el frontend
  // Los filtros se aplicarán en la consulta del servidor
  const currentItems = inventory; // Los datos ya vienen paginados del servidor
  const totalPages = Math.ceil(totalInventoryCount / itemsPerPage);

  // Calcular índices para mostrar "Mostrando X-Y de Z items"
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = Math.min(indexOfFirstItem + itemsPerPage, totalInventoryCount);

  // Cambiar de página
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Función para mostrar las opciones de impresión
  const handleShowPrintOptions = () => {
    setShowPrintOptions(true);
  };

  // Función para cerrar las opciones de impresión
  const handleClosePrintOptions = () => {
    setShowPrintOptions(false);
  };

  // Manejo de la impresión usando react-to-print
  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: `Inventario para Conteo Físico - ${new Date().toLocaleDateString()}`,
    onAfterPrint: handleClosePrintOptions
  });

  // Función para abrir las opciones de exportación
  const openExportOptions = () => {
    setShowExportOptions(true);
  };

  // Función para cerrar las opciones de exportación
  const closeExportOptions = () => {
    setShowExportOptions(false);
  };

  // Función para exportar inventario a CSV para conteo físico
  const exportToCSV = (format: 'csv' | 'physical') => {
    try {
      setIsExporting(true);

      let headers: string[];
      let dataRows: string[][];

      if (format === 'physical') {
        // Formato para conteo físico con más columnas para la verificación
        headers = [
          'Producto',
          'SKU',
          'Almacén',
          'Cantidad en Sistema',
          'Cantidad Física',
          'Diferencia',
          'Observaciones',
          'Responsable de Conteo',
          'Fecha de Conteo'
        ];

        dataRows = currentItems.map(item => [
          item.product_name,
          item.sku || '',
          item.warehouse_name,
          item.current_quantity.toString(),
          '', // Campo para cantidad física (para completar durante conteo)
          '', // Campo para diferencia (para completar durante conteo)
          '', // Campo para observaciones
          '', // Campo para responsable de conteo
          ''  // Campo para fecha de conteo
        ]);
      } else {
        // Formato básico CSV
        headers = [
          'Producto',
          'SKU',
          'Almacén',
          'Cantidad'
        ];

        dataRows = currentItems.map(item => [
          item.product_name,
          item.sku || '',
          item.warehouse_name,
          item.current_quantity.toString()
        ]);
      }

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
      const fileName = format === 'physical'
        ? `conteo_fisico_inventario_${date}.csv`
        : `inventario_${date}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);

      // Simular clic y eliminar el enlace
      link.click();
      document.body.removeChild(link);

      // Cerrar el modal de opciones
      closeExportOptions();

    } catch (err: any) {
      // swallow console noise
      setError('Error al generar el archivo CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 inventory-report-container">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Inventario General</h1>
        <div className="flex space-x-3">
          <InventoryInitialImport
            trigger={<button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 flex items-center">
              <i className="fas fa-file-import mr-2"></i>
              Importar Inventario Inicial
            </button>}
            onImported={() => {
              // Refrescar inventario tras importaci3n
              fetchInventory();
              setActiveTab('current');
            }}
          />
          <button
            onClick={openExportOptions}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center"
          >
            <i className="fas fa-file-export mr-2"></i>
            Exportar Inventario
          </button>
          <button
            onClick={handleShowPrintOptions}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 flex items-center"
          >
            <i className="fas fa-print mr-2"></i>
            Imprimir para Conteo Físico
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'current'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Inventario Actual
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Historial de Movimientos
            </button>
            <button
              onClick={() => setActiveTab('serialized')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'serialized'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Inventario Serializado
            </button>
          </div>

          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset a la primera página cuando se busca
              }}
              disabled={false} // Siempre habilitado, independiente del estado de carga
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {(selectedProduct || selectedWarehouse || searchTerm) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
            >
              <i className="fas fa-times mr-2"></i>
              Limpiar Filtros
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'serialized' ? (
          <SerializedInventory />
        ) : activeTab === 'current' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Producto
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    SKU
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Almacén
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Cantidad
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center">
                        <i className="fas fa-box-open text-gray-300 text-4xl mb-2"></i>
                        <p>No hay datos de inventario disponibles</p>
                        {searchTerm && (
                          <p className="text-xs mt-1">
                            No se encontraron resultados para "{searchTerm}"
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => {
                    const rowKey = `${item.product_id}|${item.warehouse_id}`;
                    const isExpanded = expandedKey === rowKey;
                    const rows = locationsByRow[rowKey] || [];
                    return (
                      <React.Fragment key={`row-${rowKey}`}>
                        <tr key={`${item.product_id}-${item.warehouse_id}`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm">
                            <a
                              href="#"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedProduct(item.product_id);
                                setCurrentPage(1);
                              }}
                            >
                              {item.product_name}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">{item.sku || '-'}</td>
                          <td className="py-3 px-4 text-sm">
                            <a
                              href="#"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedWarehouse(item.warehouse_id);
                                setCurrentPage(1);
                              }}
                            >
                              {item.warehouse_name}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-medium">
                            <span className={`
                              ${item.current_quantity > 0 ? 'text-green-600' : 'text-red-600'}
                              ${item.current_quantity === 0 ? 'text-yellow-600' : ''}
                           `}>
                              {item.current_quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-center">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => toggleLocations(item)}
                                className="text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 rounded-md px-2 py-1"
                                aria-expanded={isExpanded}
                                aria-controls={`loc-${rowKey}`}
                                title={isExpanded ? 'Ocultar ubicaciones' : 'Ver ubicaciones'}
                              >
                                <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-map-marker-alt'} mr-1`}></i>
                                {isExpanded ? 'Ocultar ubicaciones' : 'Ver ubicaciones'}
                              </button>
                              <button
                                onClick={() => fetchProductHistory(item.product_id)}
                                className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-md px-2 py-1"
                              >
                                <i className="fas fa-history mr-1"></i>
                                Ver Historial
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-gray-50 px-4 py-3" id={`loc-${rowKey}`}>
                              {locationsLoading && rows.length === 0 ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <i className="fas fa-spinner animate-spin"></i>
                                  Cargando ubicaciones...
                                </div>
                              ) : rows.length === 0 ? (
                                <div className="text-sm text-gray-600">No hay existencias distribuidas por ubicación.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-[400px] text-sm">
                                    <thead>
                                      <tr className="text-left text-gray-500">
                                        <th className="py-2 pr-4">Ubicación</th>
                                        <th className="py-2 text-right">Cantidad</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map(r => (
                                        <tr key={r.location_id ?? 'null'} className="border-t border-gray-200">
                                          <td className="py-2 pr-4">{r.location_name}</td>
                                          <td className="py-2 text-right font-medium">{r.current_quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Paginación */}
            {totalInventoryCount > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mostrando {indexOfFirstItem + 1}-{indexOfLastItem} de {totalInventoryCount} items
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Botones de página */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    // Si hay más de 5 páginas, mostrar racionalmente las páginas cercanas a la actual
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => paginate(pageNumber)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === pageNumber
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <h2 className="text-lg font-medium mb-4">
              {selectedProduct ?
                `Historial de: ${inventory.find(i => i.product_id === selectedProduct)?.product_name}` :
                'Historial de Movimientos'}
            </h2>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Almacén
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center">
                        <i className="fas fa-history text-gray-300 dark:text-gray-600 text-4xl mb-2"></i>
                        <p>No hay movimientos disponibles</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-4 text-sm dark:text-gray-300">
                        {new Date(movement.movement_date).toLocaleDateString()}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          {new Date(movement.movement_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${movement.movement_type.code.startsWith('IN_')
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                        >
                          {movement.movement_type.code.startsWith('IN_') ?
                            <i className="fas fa-arrow-up mr-1"></i> :
                            <i className="fas fa-arrow-down mr-1"></i>}
                          {movement.movement_type.description}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium dark:text-gray-300">{movement.product_name}</td>
                      <td className="py-3 px-4 text-sm dark:text-gray-300">{movement.warehouse_name}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium">
                        <span className={movement.movement_type.code.startsWith('IN_') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {movement.movement_type.code.startsWith('IN_') ? '+' : '-'}{movement.quantity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para opciones de exportación */}
      {showExportOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Opciones de Exportación</h3>

            <div className="mb-6 space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="csv-standard"
                  name="export-format"
                  checked={exportFormat === 'csv'}
                  onChange={() => setExportFormat('csv')}
                  className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="csv-standard" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Inventario Simple (CSV)
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">- Lista básica del inventario actual</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="csv-physical"
                  name="export-format"
                  checked={exportFormat === 'physical'}
                  onChange={() => setExportFormat('physical')}
                  className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="csv-physical" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Formato para Conteo Físico (CSV)
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">- Incluye columnas para registrar conteo</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeExportOptions}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={() => exportToCSV(exportFormat)}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center"
              >
                {isExporting ? (
                  <span className="inline-block animate-spin mr-2">
                    <i className="fas fa-spinner"></i>
                  </span>
                ) : (
                  <i className="fas fa-download mr-2"></i>
                )}
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Componente oculto para impresión de conteo físico */}
      <div style={{ display: 'none' }}>
        <div ref={printComponentRef} className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Formulario de Conteo Físico de Inventario</h1>
            <p className="text-gray-600">Fecha de impresión: {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Producto</th>
                <th className="border border-gray-300 px-4 py-2 text-left">SKU</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Almacén</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Cant. Sistema</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Cant. Física</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Diferencia</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                <tr key={`${item.product_id}-${item.warehouse_id}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-300 px-4 py-3">{item.product_name}</td>
                  <td className="border border-gray-300 px-4 py-3">{item.sku || '-'}</td>
                  <td className="border border-gray-300 px-4 py-3">{item.warehouse_name}</td>
                  <td className="border border-gray-300 px-4 py-3 text-right">{item.current_quantity}</td>
                  <td className="border border-gray-300 px-4 py-3" style={{ minWidth: '100px' }}></td>
                  <td className="border border-gray-300 px-4 py-3" style={{ minWidth: '100px' }}></td>
                  <td className="border border-gray-300 px-4 py-3" style={{ minWidth: '150px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold">Responsable del conteo:</p>
                <div className="mt-2 border-b border-gray-400 h-8"></div>
              </div>
              <div>
                <p className="font-semibold">Supervisor:</p>
                <div className="mt-2 border-b border-gray-400 h-8"></div>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-semibold">Fecha de conteo:</p>
              <div className="mt-2 border-b border-gray-400 h-8"></div>
            </div>

            <div className="mt-6">
              <p className="font-semibold">Observaciones generales:</p>
              <div className="mt-2 border border-gray-400 h-24 p-2"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para vista previa de impresión */}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Vista Previa de Impresión</h3>
              <button onClick={handleClosePrintOptions} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Vista previa del inventario para conteo físico</p>
              <div className="border rounded-md bg-gray-50 p-3 h-[500px] overflow-auto">
                <div className="bg-white mx-auto">
                  {/* Aquí se renderiza el contenido que se va a imprimir */}
                  <div ref={printComponentRef} className="inventory-report-container">
                    <div className="p-8">
                      <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
                        <h1 className="text-2xl font-bold text-gray-800">INVENTARIO PARA CONTEO FÍSICO</h1>
                        <p className="text-lg text-gray-600 mt-2">Fecha: {new Date().toLocaleDateString()}</p>
                      </div>

                      <table className="w-full border-collapse border border-gray-400 text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Producto</th>
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">SKU</th>
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Almacén</th>
                            <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Cantidad Sistema</th>
                            <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Cantidad Física</th>
                            <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Diferencia</th>
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Observaciones</th>
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Responsable</th>
                            <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Fecha de Conteo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentItems.map((item, index) => (
                            <tr key={`${item.product_id}-${item.warehouse_id}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="border border-gray-300 px-3 py-2">{item.product_name}</td>
                              <td className="border border-gray-300 px-3 py-2">{item.sku || '-'}</td>
                              <td className="border border-gray-300 px-3 py-2">{item.warehouse_name}</td>
                              <td className="border border-gray-300 px-3 py-2 text-center">{item.current_quantity}</td>
                              <td className="border border-gray-300 px-3 py-2" style={{ minWidth: '100px' }}></td>
                              <td className="border border-gray-300 px-3 py-2" style={{ minWidth: '100px' }}></td>
                              <td className="border border-gray-300 px-3 py-2" style={{ minWidth: '150px' }}></td>
                              <td className="border border-gray-300 px-3 py-2" style={{ minWidth: '120px' }}></td>
                              <td className="border border-gray-300 px-3 py-2" style={{ minWidth: '100px' }}></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="mt-8 grid grid-cols-3 gap-8">
                        <div>
                          <p className="font-semibold">Responsable del conteo:</p>
                          <div className="mt-2 border-b border-gray-400 h-8"></div>
                        </div>

                        <div>
                          <p className="font-semibold">Supervisor:</p>
                          <div className="mt-2 border-b border-gray-400 h-8"></div>
                        </div>

                        <div>
                          <p className="font-semibold">Fecha de conteo:</p>
                          <div className="mt-2 border-b border-gray-400 h-8"></div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <p className="font-semibold">Observaciones generales:</p>
                        <div className="mt-2 border border-gray-400 h-24 p-2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Nota: Esta es la vista previa del documento que se imprimirá.
                Use esta vista para revisar el contenido antes de imprimir.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleClosePrintOptions}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <i className="fas fa-print mr-2"></i>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos para impresión - solo visible cuando se imprime */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .inventory-report-container,
          .inventory-report-container * {
            visibility: visible;
          }
          .inventory-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print,
          .no-print * {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
};

export default InventoryGeneral; 