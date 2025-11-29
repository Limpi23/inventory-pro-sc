import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../lib/auth';
import { getLocalDateISOString } from '../lib/dateUtils';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  payment_method?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  sales_order_id?: string | null;
  customer: {
    id: string;
    name: string;
    identification_type?: string;
    identification_number?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  warehouse: {
    id: string;
    name: string;
    location?: string;
  };
}

interface InvoiceItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_percent?: number;
  discount_amount?: number;
  total_price: number;
  product: {
    name: string;
    sku: string;
  };
}

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printFormat, setPrintFormat] = useState<'letter' | 'roll'>('letter');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const { settings } = useCompanySettings();
  const currency = useCurrency();
  const location = useLocation();
  const { user } = useAuth();
  const roleName = (user?.role_name || '').toLowerCase();
  const isAdmin = roleName.includes('admin') || user?.role_id === 1;
  const [isGeneratingSale, setIsGeneratingSale] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shouldAutoGenerateSale = searchParams.get('generar-venta') === '1';
  const attemptedAutoSaleRef = useRef(false);

  const letterPrintRef = useRef<HTMLDivElement>(null);
  const rollPrintRef = useRef<HTMLDivElement>(null);

  const fetchInvoiceDetails = useCallback(async () => {
    try {
      setLoading(true);

      const client = await supabase.getClient();

      // Fetch invoice with customer and warehouse data
      const { data: invoiceData, error: invoiceError } = await client
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, identification_type, identification_number, address, phone, email),
          warehouse:warehouses(id, name, location)
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;

      if (invoiceData) {
        setInvoice(invoiceData);

        // Fetch invoice items with product data
        const { data: itemsData, error: itemsError } = await client
          .from('invoice_items')
          .select(`
            *,
            product:products(name, sku)
          `)
          .eq('invoice_id', id)
          .order('id');

        if (itemsError) throw itemsError;

        if (itemsData) {
          setInvoiceItems(itemsData);
        }
      }
    } catch (err: any) {
      console.error('Error fetching invoice details:', err);
      setError(`Error al cargar los detalles de la cotización: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [fetchInvoiceDetails]);

  const handleCancelInvoice = async () => {
    if (!isAdmin) {
      toast.error('Solo un administrador puede anular una cotización.');
      return;
    }

    if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const client = await supabase.getClient();

      const { error } = await client
        .from('invoices')
        .update({
          status: 'anulada',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // If invoice was previously emitted, reverse stock movements
      if (invoice?.status === 'emitida') {
        // Create reverse stock movements
        const stockMovements = invoiceItems.map(item => ({
          product_id: item.product_id,
          warehouse_id: invoice.warehouse.id,
          quantity: item.quantity,
          movement_type_id: 3, // Entrada por ajuste (asumimos que es el ID para IN_ADJUST)
          reference: `Anulación Cotización ${invoice.invoice_number}`,
          related_id: invoice.id,
          movement_date: new Date().toISOString(),
          notes: `Anulación de cotización #${invoice.invoice_number}`
        }));

        const { error: movementError } = await client
          .from('stock_movements')
          .insert(stockMovements);

        if (movementError) {
          console.error('Error registrando movimientos de inventario para anulación:', movementError);
          // No interrumpimos el proceso por errores en los movimientos
        }
      }

      toast.success('Cotización anulada correctamente');

      // Refresh the invoice details
      fetchInvoiceDetails();
    } catch (err: any) {
      console.error('Error anulando cotización:', err);
      toast.error(`Error al anular cotización: ${err.message}`);
    }
  };

  const handleGenerateSale = useCallback(async (options?: { skipConfirmation?: boolean }) => {
    if (!invoice) {
      toast.error('No se encontró la cotización a convertir.');
      return;
    }

    if (!isAdmin) {
      toast.error('Solo un administrador puede generar una venta desde la cotización.');
      return;
    }

    if (isGeneratingSale) {
      return;
    }

    if (invoice.status === 'anulada') {
      toast.error('No se puede generar una venta a partir de una cotización anulada.');
      return;
    }

    if (invoice.sales_order_id || invoice.status === 'pagada') {
      toast.success('Esta cotización ya tiene una venta generada.');
      return;
    }

    if (invoiceItems.length === 0) {
      toast.error('La cotización no tiene productos para generar una venta.');
      return;
    }

    if (!invoice.customer?.id) {
      toast.error('La cotización no tiene un cliente asociado.');
      return;
    }

    if (!invoice.warehouse?.id) {
      toast.error('La cotización no tiene un almacén asociado.');
      return;
    }

    if (!options?.skipConfirmation) {
      const confirmed = confirm('¿Deseas generar una venta a partir de esta cotización? Se actualizará el estado a pagada y se registrará la salida de inventario si aún no existe.');
      if (!confirmed) {
        return;
      }
    }

    try {
      setIsGeneratingSale(true);

      const client = await supabase.getClient();

      const orderDate = getLocalDateISOString();
      const { data: salesOrder, error: salesOrderError } = await client
        .from('sales_orders')
        .insert({
          customer_id: invoice.customer.id,
          warehouse_id: invoice.warehouse.id,
          order_date: orderDate,
          status: 'completada',
          total_amount: invoice.total_amount ?? 0
        })
        .select()
        .single();

      if (salesOrderError) throw salesOrderError;

      try {
        const saleItemsPayload = invoiceItems.map(item => ({
          sales_order_id: salesOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));

        if (saleItemsPayload.length > 0) {
          const { error: salesItemsError } = await client
            .from('sales_order_items')
            .insert(saleItemsPayload);
          if (salesItemsError) throw salesItemsError;
        }
      } catch (itemsError) {
        await client.from('sales_orders').delete().eq('id', salesOrder.id);
        throw itemsError;
      }

      const { data: existingMovements, error: movementCheckError } = await client
        .from('stock_movements')
        .select('id')
        .eq('related_id', invoice.id)
        .eq('movement_type_id', 2);

      if (movementCheckError) {
        console.error('Error verificando movimientos de inventario:', movementCheckError);
      }

      if (!existingMovements || existingMovements.length === 0) {
        const stockMovements = invoiceItems.map(item => ({
          product_id: item.product_id,
          warehouse_id: invoice.warehouse.id,
          quantity: item.quantity,
          movement_type_id: 2,
          reference: `Cotización ${invoice.invoice_number}`,
          related_id: invoice.id,
          movement_date: new Date().toISOString(),
          notes: `Venta generada desde cotización #${invoice.invoice_number}`
        }));

        if (stockMovements.length > 0) {
          const { error: movementError } = await client
            .from('stock_movements')
            .insert(stockMovements);

          if (movementError) {
            console.error('Error registrando movimientos de inventario:', movementError);
            toast.error('La venta se generó, pero hubo un error registrando el inventario.');
          }
        }
      }

      const { error: updateInvoiceError } = await client
        .from('invoices')
        .update({
          status: 'pagada',
          updated_at: new Date().toISOString(),
          sales_order_id: salesOrder.id
        })
        .eq('id', invoice.id);

      if (updateInvoiceError) throw updateInvoiceError;

      toast.success('Venta generada correctamente a partir de la cotización.');
      fetchInvoiceDetails();

      if (shouldAutoGenerateSale) {
        const params = new URLSearchParams(location.search);
        params.delete('generar-venta');
        const newSearch = params.toString();
        window.history.replaceState({}, '', `${location.pathname}${newSearch ? `?${newSearch}` : ''}`);
      }
    } catch (err: any) {
      console.error('Error al generar la venta:', err);
      toast.error(`Error al generar la venta: ${err.message || err}`);
    } finally {
      setIsGeneratingSale(false);
    }
  }, [invoice, invoiceItems, isAdmin, isGeneratingSale, fetchInvoiceDetails, shouldAutoGenerateSale, location.pathname, location.search]);

  useEffect(() => {
    if (!invoice) return;
    if (!shouldAutoGenerateSale) return;
    if (attemptedAutoSaleRef.current) return;
    // Esperar a que se carguen los items antes de generar la venta
    if (loading) return;
    if (invoiceItems.length === 0) return;
    attemptedAutoSaleRef.current = true;
    handleGenerateSale();
  }, [invoice, invoiceItems, loading, shouldAutoGenerateSale, handleGenerateSale]);



  // Abrir el visor de vista previa
  const handleOpenPreview = () => {
    setShowPrintDialog(false);
    setShowPreviewModal(true);
  };

  // Función de impresión real desde el visor
  const handlePrintFromPreview = useReactToPrint({
    contentRef: printFormat === 'letter' ? letterPrintRef : rollPrintRef,
    documentTitle: `Cotización ${invoice?.invoice_number || 'Desconocida'}`,
    onAfterPrint: () => {
      setShowPreviewModal(false);
      toast.success('Cotización enviada a impresión correctamente');
    },
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(currency.settings.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'borrador':
        return 'bg-gray-100 text-gray-800';
      case 'emitida':
        return 'bg-blue-100 text-blue-800';
      case 'pagada':
        return 'bg-green-100 text-green-800';
      case 'vencida':
        return 'bg-yellow-100 text-yellow-800';
      case 'anulada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'borrador': 'Borrador',
      'emitida': 'Emitida',
      'pagada': 'Pagada',
      'vencida': 'Vencida',
      'anulada': 'Anulada'
    };

    return statusMap[status] || 'Desconocido';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
        <p className="text-red-700">{error}</p>
        <Link to="/ventas/facturas" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Volver a Cotizaciones
        </Link>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Cotización no encontrada</p>
        <Link to="/ventas/facturas" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Volver a Cotizaciones
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas/facturas" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Cotizaciones
          </Link>
          <h1 className="text-2xl font-semibold">
            Cotización #{invoice.invoice_number}
            <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.status)}`}>
              {getStatusText(invoice.status)}
            </span>
          </h1>
        </div>

        <div className="mt-4 md:mt-0 flex flex-wrap gap-2 justify-end">
          {isAdmin && invoice.status !== 'anulada' && invoice.status !== 'pagada' && !invoice.sales_order_id && (
            <button
              onClick={() => handleGenerateSale()}
              disabled={isGeneratingSale}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center disabled:opacity-70"
            >
              {isGeneratingSale ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Generando...
                </>
              ) : (
                <>
                  <i className="fas fa-cash-register mr-2"></i>
                  Generar venta
                </>
              )}
            </button>
          )}

          {invoice.status !== 'anulada' && (
            <button
              onClick={() => setShowPrintDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <i className="fas fa-print mr-2"></i>
              Imprimir
            </button>
          )}

          {isAdmin && (invoice.status === 'borrador' || invoice.status === 'emitida') && (
            <>
              {invoice.status === 'borrador' && (
                <Link
                  to={`/ventas/facturas/editar/${invoice.id}`}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center"
                >
                  <i className="fas fa-edit mr-2"></i>
                  Editar
                </Link>
              )}

              <button
                onClick={handleCancelInvoice}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
              >
                <i className="fas fa-times-circle mr-2"></i>
                Anular
              </button>
            </>
          )}
        </div>
      </div>

      {/* Detalles de cotización */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div>
            <h2 className="text-lg font-medium mb-4 border-b pb-2">Información de Cotización</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Número:</div>
                <div className="font-medium">{invoice.invoice_number}</div>
              </div>
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Fecha de emisión:</div>
                <div>{formatDate(invoice.invoice_date)}</div>
              </div>
              {invoice.due_date && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Fecha de vencimiento:</div>
                  <div>{formatDate(invoice.due_date)}</div>
                </div>
              )}
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Estado:</div>
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </div>
              </div>
              {invoice.sales_order_id && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Venta generada:</div>
                  <div className="font-medium break-words">
                    {invoice.sales_order_id}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Método de pago:</div>
                <div className="capitalize">{invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'}</div>
              </div>
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Almacén:</div>
                <div>{invoice.warehouse.name || 'No especificado'}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4 border-b pb-2">Información de Cliente</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2">
                <div className="text-gray-600">Cliente:</div>
                <div className="font-medium">{invoice.customer.name}</div>
              </div>
              {invoice.customer.identification_type && invoice.customer.identification_number && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Identificación:</div>
                  <div>{invoice.customer.identification_type}: {invoice.customer.identification_number}</div>
                </div>
              )}
              {invoice.customer.address && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Dirección:</div>
                  <div>{invoice.customer.address}</div>
                </div>
              )}
              {invoice.customer.phone && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Teléfono:</div>
                  <div>{invoice.customer.phone}</div>
                </div>
              )}
              {invoice.customer.email && (
                <div className="grid grid-cols-2">
                  <div className="text-gray-600">Email:</div>
                  <div>{invoice.customer.email}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t">
          <h2 className="text-lg font-medium mb-4">Productos</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoiceItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {item.product.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{currency.format(item.unit_price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.discount_percent !== undefined && item.discount_percent > 0 && (
                        <div className="text-xs">Desc: {item.discount_percent}%</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>{item.tax_rate}%</div>
                      <div className="text-sm text-gray-500">{currency.format(item.tax_amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{currency.format(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end">
          <div className="w-full md:w-1/3 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{currency.format(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Descuentos:</span>
              <span>{currency.format(invoice.discount_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA:</span>
              <span>{currency.format(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{currency.format(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="p-6 border-t">
            <h2 className="text-lg font-medium mb-2">Notas</h2>
            <p className="text-gray-700 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Modal de selección de formato de impresión */}
      {showPrintDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Seleccione formato de impresión</h2>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  value="letter"
                  checked={printFormat === 'letter'}
                  onChange={() => setPrintFormat('letter')}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Formato Carta</span>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  value="roll"
                  checked={printFormat === 'roll'}
                  onChange={() => setPrintFormat('roll')}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Formato Rollo</span>
              </label>
            </div>

            <div className="flex justify-end mt-6 space-x-2">
              <button
                onClick={() => setShowPrintDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenPreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <i className="fas fa-eye mr-2"></i>
                Ver Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa - Visor completo */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
          {/* Barra de herramientas superior */}
          <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
            <div className="flex items-center space-x-4">
              <h2 className="text-white text-lg font-semibold">
                Vista Previa - Cotización {invoice.invoice_number}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPrintFormat('letter')}
                  className={`px-3 py-1 rounded text-sm ${printFormat === 'letter'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  <i className="fas fa-file-alt mr-1"></i>
                  Carta
                </button>
                <button
                  onClick={() => setPrintFormat('roll')}
                  className={`px-3 py-1 rounded text-sm ${printFormat === 'roll'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  <i className="fas fa-receipt mr-1"></i>
                  Rollo
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handlePrintFromPreview}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              >
                <i className="fas fa-print mr-2"></i>
                Imprimir
              </button>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
              >
                <i className="fas fa-times mr-2"></i>
                Cerrar
              </button>
            </div>
          </div>

          {/* Área de vista previa con scroll */}
          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div className="bg-gray-100 p-8 rounded-lg shadow-2xl">
              {printFormat === 'letter' ? (
                /* Vista previa formato carta */
                <div className="bg-white p-8 shadow-lg" style={{ width: '8.5in', minHeight: '11in' }}>
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold">COTIZACIÓN</h1>
                    <p className="text-xl">{invoice.invoice_number}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <h2 className="text-lg font-bold mb-2">Información de Empresa</h2>
                      <p>{settings.name}</p>
                      <p>NIT: {settings.taxId}</p>
                      <p>{settings.address}</p>
                      <p>Tel: {settings.phone}</p>
                      {settings.email && <p>{settings.email}</p>}
                      {settings.website && <p>{settings.website}</p>}
                    </div>

                    <div>
                      <h2 className="text-lg font-bold mb-2">Información de Cliente</h2>
                      <p><strong>{invoice.customer.name}</strong></p>
                      {invoice.customer.identification_type && invoice.customer.identification_number && (
                        <p>{invoice.customer.identification_type}: {invoice.customer.identification_number}</p>
                      )}
                      {invoice.customer.address && <p>Dirección: {invoice.customer.address}</p>}
                      {invoice.customer.phone && <p>Teléfono: {invoice.customer.phone}</p>}
                      {invoice.customer.email && <p>Email: {invoice.customer.email}</p>}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-lg font-bold mb-2">Detalles de Cotización</h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p><strong>Fecha de emisión:</strong> {formatDate(invoice.invoice_date)}</p>
                        {invoice.due_date && (
                          <p><strong>Fecha de vencimiento:</strong> {formatDate(invoice.due_date)}</p>
                        )}
                      </div>
                      <div>
                        <p><strong>Método de pago:</strong> {invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'}</p>
                      </div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-black mb-6">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-black p-2 text-left">Producto</th>
                        <th className="border border-black p-2 text-center">Cant.</th>
                        <th className="border border-black p-2 text-right">Precio Unit.</th>
                        <th className="border border-black p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-black p-2">
                            <div>{item.product.name}</div>
                            <div className="text-xs text-gray-600">SKU: {item.product.sku}</div>
                          </td>
                          <td className="border border-black p-2 text-center">{item.quantity}</td>
                          <td className="border border-black p-2 text-right">{currency.format(item.unit_price)}</td>
                          <td className="border border-black p-2 text-right">{currency.format(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end mb-6">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{currency.format(invoice.subtotal)}</span>
                      </div>
                      {invoice.discount_amount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Descuento:</span>
                          <span>-{currency.format(invoice.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>IVA:</span>
                        <span>{currency.format(invoice.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-black">
                        <span>Total:</span>
                        <span>{currency.format(invoice.total_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="mb-6">
                      <h3 className="font-bold mb-2">Notas:</h3>
                      <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
                    </div>
                  )}

                  <div className="text-center text-sm mt-10 text-gray-600">
                    <p>Gracias por su compra</p>
                    <p>{settings.footerText}</p>
                  </div>
                </div>
              ) : (
                /* Vista previa formato rollo */
                <div className="bg-white p-4 shadow-lg" style={{ width: '80mm' }}>
                  <div className="text-center mb-4 text-sm">
                    <h1 className="font-bold text-base">{settings.name.toUpperCase()}</h1>
                    <p className="text-xs">NIT: {settings.taxId}</p>
                    <p className="text-xs">{settings.address}</p>
                    <p className="text-xs">Tel: {settings.phone}</p>
                    <div className="border-t border-dashed border-black my-2"></div>
                    <h2 className="font-bold">COTIZACIÓN {invoice.invoice_number}</h2>
                    <p className="text-xs">Fecha: {formatDate(invoice.invoice_date)}</p>
                  </div>

                  <div className="mb-3 text-xs">
                    <p><strong>Cliente:</strong> {invoice.customer.name}</p>
                    {invoice.customer.identification_type && invoice.customer.identification_number && (
                      <p><strong>{invoice.customer.identification_type}:</strong> {invoice.customer.identification_number}</p>
                    )}
                    {invoice.customer.phone && <p><strong>Tel:</strong> {invoice.customer.phone}</p>}
                  </div>

                  <div className="border-t border-dashed border-black my-2"></div>

                  <div className="mb-3">
                    {invoiceItems.map((item) => (
                      <div key={item.id} className="mb-2 text-xs">
                        <p className="font-semibold">{item.product.name}</p>
                        <div className="flex justify-between">
                          <span>{item.quantity} x {currency.format(item.unit_price)}</span>
                          <span className="font-semibold">{currency.format(item.total_price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-black my-2"></div>

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{currency.format(invoice.subtotal)}</span>
                    </div>
                    {invoice.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Descuento:</span>
                        <span>-{currency.format(invoice.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>IVA:</span>
                      <span>{currency.format(invoice.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                      <span>TOTAL:</span>
                      <span>{currency.format(invoice.total_amount)}</span>
                    </div>
                  </div>

                  {invoice.notes && (
                    <>
                      <div className="border-t border-dashed border-black my-2"></div>
                      <div className="text-xs">
                        <p className="font-semibold">Notas:</p>
                        <p className="whitespace-pre-line">{invoice.notes}</p>
                      </div>
                    </>
                  )}

                  <div className="border-t border-dashed border-black my-3"></div>
                  <p className="text-center text-xs">¡Gracias por su preferencia!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Componentes de impresión (ocultos) */}
      <div className="hidden">
        {/* Formato carta */}
        <div ref={letterPrintRef} className="p-8 bg-white min-h-[11in] w-[8.5in] text-black">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">COTIZACIÓN</h1>
            <p className="text-xl">{invoice.invoice_number}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-lg font-bold mb-2">Información de Empresa</h2>
              <p>{settings.name}</p>
              <p>NIT: {settings.taxId}</p>
              <p>{settings.address}</p>
              <p>Tel: {settings.phone}</p>
              {settings.email && <p>{settings.email}</p>}
              {settings.website && <p>{settings.website}</p>}
            </div>

            <div>
              <h2 className="text-lg font-bold mb-2">Información de Cliente</h2>
              <p><strong>{invoice.customer.name}</strong></p>
              {invoice.customer.identification_type && invoice.customer.identification_number && (
                <p>{invoice.customer.identification_type}: {invoice.customer.identification_number}</p>
              )}
              {invoice.customer.address && <p>Dirección: {invoice.customer.address}</p>}
              {invoice.customer.phone && <p>Teléfono: {invoice.customer.phone}</p>}
              {invoice.customer.email && <p>Email: {invoice.customer.email}</p>}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-2">Detalles de Cotización</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p><strong>Fecha de emisión:</strong> {formatDate(invoice.invoice_date)}</p>
                {invoice.due_date && (
                  <p><strong>Fecha de vencimiento:</strong> {formatDate(invoice.due_date)}</p>
                )}
              </div>
              <div>
                <p><strong>Estado:</strong> {getStatusText(invoice.status)}</p>
                <p><strong>Método de pago:</strong> {invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-2">Productos</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Producto</th>
                  <th className="border p-2 text-right">Cant.</th>
                  <th className="border p-2 text-right">Precio Unit.</th>
                  <th className="border p-2 text-right">Desc.</th>
                  <th className="border p-2 text-right">IVA</th>
                  <th className="border p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border p-2 text-left">
                      <div>{item.product.name}</div>
                      <div className="text-xs">SKU: {item.product.sku}</div>
                    </td>
                    <td className="border p-2 text-right">{item.quantity}</td>
                    <td className="border p-2 text-right">{currency.format(item.unit_price)}</td>
                    <td className="border p-2 text-right">
                      {item.discount_percent !== undefined && item.discount_percent > 0 && (
                        <div className="text-xs">Desc: {item.discount_percent}%</div>
                      )}
                    </td>
                    <td className="border p-2 text-right">{currency.format(item.tax_amount)}</td>
                    <td className="border p-2 text-right font-medium">{currency.format(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-6">
            <div className="w-1/3">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>{currency.format(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Descuentos:</span>
                <span>{currency.format(invoice.discount_amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>IVA:</span>
                <span>{currency.format(invoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold border-t pt-2">
                <span>Total:</span>
                <span>{currency.format(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-2">Notas</h2>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          <div className="text-center text-sm mt-10">
            <p>Gracias por su compra</p>
            <p>Este documento tiene validez como comprobante fiscal de acuerdo a las normas vigentes.</p>
            <p>{settings.footerText}</p>
            <p>{new Date().toLocaleDateString(currency.settings.locale)}</p>
          </div>
        </div>

        {/* Formato rollo */}
        <div ref={rollPrintRef} className="p-3 bg-white w-[80mm] text-black text-sm">
          <div className="text-center mb-4">
            <h1 className="font-bold">{settings.name.toUpperCase()}</h1>
            <p>NIT: {settings.taxId}</p>
            <p>{settings.address}</p>
            <p>Tel: {settings.phone}</p>
            <hr className="my-2" />
            <h2 className="font-bold">COTIZACIÓN {invoice.invoice_number}</h2>
            <p>Fecha: {formatDate(invoice.invoice_date)}</p>
            {invoice.due_date && <p>Vencimiento: {formatDate(invoice.due_date)}</p>}
          </div>

          <div className="mb-4">
            <p><strong>Cliente:</strong> {invoice.customer.name}</p>
            {invoice.customer.identification_type && invoice.customer.identification_number && (
              <p><strong>{invoice.customer.identification_type}:</strong> {invoice.customer.identification_number}</p>
            )}
            {invoice.customer.phone && <p><strong>Tel:</strong> {invoice.customer.phone}</p>}
          </div>

          <hr className="my-2" />

          <div className="mb-4">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Producto</th>
                  <th className="text-right py-1">Cant</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-1">
                      <div>{item.product.name}</div>
                      <div className="text-xs">{currency.format(item.unit_price)} x {item.quantity}</div>
                      {item.discount_percent !== undefined && item.discount_percent > 0 && (
                        <div className="text-xs">Desc: {item.discount_percent}%</div>
                      )}
                    </td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{currency.format(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span>{currency.format(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Descuentos:</span>
              <span>{currency.format(invoice.discount_amount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>IVA:</span>
              <span>{currency.format(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between py-1 font-bold border-t border-b">
              <span>TOTAL:</span>
              <span>{currency.format(invoice.total_amount)}</span>
            </div>
            <div className="pt-1">
              <p>Método de pago: {invoice.payment_method ? `${invoice.payment_method.charAt(0).toUpperCase()}${invoice.payment_method.slice(1)}` : 'No especificado'}</p>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-4 text-xs">
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          <div className="text-center text-xs mb-4">
            <p>*** Gracias por su compra ***</p>
            <p>{settings.footerText}</p>
            <p>{new Date().toLocaleDateString(currency.settings.locale)}</p>
          </div>

          <div className="text-center">
            <p>--------------------------------</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail; 