import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import useCompanySettings from '../hooks/useCompanySettings';
import { useCurrency } from '../hooks/useCurrency';

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
  const { settings } = useCompanySettings();
  const currency = useCurrency();
  
  const letterPrintRef = useRef<HTMLDivElement>(null);
  const rollPrintRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchInvoiceDetails();
  }, [id]);
  
  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch invoice with customer and warehouse data
      const { data: invoiceData, error: invoiceError } = await supabase
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
        const { data: itemsData, error: itemsError } = await supabase
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
  };
  
  const handleCancelInvoice = async () => {
  if (!confirm('¿Está seguro que desea anular esta cotización? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const { error } = await supabase
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
        
        const { error: movementError } = await supabase
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
  
  const handlePrint = useReactToPrint({
    contentRef: printFormat === 'letter' ? letterPrintRef : rollPrintRef,
  documentTitle: `Cotización-${invoice?.invoice_number || 'Desconocida'}`,
    onAfterPrint: () => {
      setShowPrintDialog(false);
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
        
        <div className="mt-4 md:mt-0 flex space-x-2">
          {invoice.status !== 'anulada' && (
            <button
              onClick={() => setShowPrintDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <i className="fas fa-print mr-2"></i>
              Imprimir
            </button>
          )}
          
          {(invoice.status === 'borrador' || invoice.status === 'emitida') && (
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
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Imprimir
              </button>
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