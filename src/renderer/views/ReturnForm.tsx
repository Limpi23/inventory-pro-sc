import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLocalDateISOString } from '../lib/dateUtils';
import { ReturnInput, ReturnItemInput, Invoice, InvoiceItem } from '../../types';
import { toast } from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';

const ReturnForm: React.FC = () => {
  const navigate = useNavigate();
  const currency = useCurrency();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoice) {
      fetchInvoiceItems(selectedInvoice.id);
    } else {
      setInvoiceItems([]);
      setReturnItems([]);
    }
  }, [selectedInvoice]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client.from('invoices')
        .select(`
          *,
          customer:customers(id, name, identification_number),
          warehouse:warehouses(id, name)
        `)
        .in('status', ['emitida', 'pagada'])
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices((data as any[]) || []);
    } catch (error: any) {
      console.error('Error al cargar facturas:', error.message);
      toast.error(`Error al cargar facturas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceId: string) => {
    try {
      setLoading(true);
      const client = await supabase.getClient();
      const { data, error } = await client.from('invoice_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('invoice_id', invoiceId);

      if (error) throw error;
      setInvoiceItems((data as any[]) || []);
    } catch (error: any) {
      console.error('Error al cargar items de factura:', error.message);
      toast.error(`Error al cargar items de factura: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setSearchTerm('');
  };

  const handleQuantityChange = (itemId: string, productId: string, value: string) => {
    const quantity = parseFloat(value);
    const invoiceItem = invoiceItems.find(item => item.id === itemId);

    if (!invoiceItem) return;

    if (isNaN(quantity) || quantity <= 0) {
      setReturnItems(prevItems => prevItems.filter(item => item.invoice_item_id !== itemId));
      return;
    }

    if (quantity > invoiceItem.quantity) {
      toast.error(`No puede devolver más de ${invoiceItem.quantity} unidades`);
      return;
    }

    const existingItemIndex = returnItems.findIndex(item => item.invoice_item_id === itemId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...returnItems];
      updatedItems[existingItemIndex].quantity = quantity;
      setReturnItems(updatedItems);
    } else {
      setReturnItems([
        ...returnItems,
        {
          invoice_item_id: itemId,
          product_id: productId,
          quantity: quantity,
          reason: ''
        }
      ]);
    }
  };

  const handleItemReasonChange = (itemId: string, value: string) => {
    const existingItemIndex = returnItems.findIndex(item => item.invoice_item_id === itemId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...returnItems];
      updatedItems[existingItemIndex].reason = value;
      setReturnItems(updatedItems);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice) {
      toast.error('Debe seleccionar una factura');
      return;
    }

    if (returnItems.length === 0) {
      toast.error('Debe seleccionar al menos un producto para devolver');
      return;
    }

    if (!reason.trim()) {
      toast.error('Debe ingresar el motivo general de la devolución');
      return;
    }

    try {
      setSubmitting(true);

      // Calcular el monto total de la devolución
      const totalAmount = returnItems.reduce((sum, item) => {
        const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
        return sum + (invoiceItem ? (invoiceItem.unit_price ?? 0) * item.quantity : 0);
      }, 0);

      // Crear la devolución
      const returnData: ReturnInput = {
        invoice_id: selectedInvoice.id,
        return_date: getLocalDateISOString(),
        reason: reason,
        notes: notes || undefined,
        items: returnItems
      };

      // Insertar la devolución en la base de datos
      const client = await supabase.getClient();
      const { data: returnRecord, error: returnError } = await client.from('returns')
        .insert([{
          invoice_id: returnData.invoice_id,
          return_date: returnData.return_date,
          reason: returnData.reason,
          notes: returnData.notes,
          total_amount: totalAmount,
          status: 'pendiente'
        }])
        .select('id')
        .single();

      if (returnError) throw returnError;

      if (!returnRecord?.id) {
        throw new Error('No se pudo crear la devolución');
      }

      // Insertar los items de la devolución
      const returnItemsData = returnItems.map(item => {
        const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
        return {
          return_id: returnRecord.id,
          invoice_item_id: item.invoice_item_id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: invoiceItem?.unit_price ?? 0,
          total_price: (invoiceItem?.unit_price ?? 0) * item.quantity,
          reason: item.reason
        };
      });

      const { error: itemsError } = await client.from('return_items')
        .insert(returnItemsData);

      if (itemsError) throw itemsError;

      toast.success('Devolución registrada correctamente');
      navigate('/ventas/devoluciones');

    } catch (error: any) {
      console.error('Error al crear devolución:', error.message);
      toast.error(`Error al crear devolución: ${error.message}`);
    } finally {
      setSubmitting(false);
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

  // Calcular el subtotal de la devolución
  const getReturnSubtotal = () => {
    return returnItems.reduce((sum, item) => {
      const invoiceItem = invoiceItems.find(i => i.id === item.invoice_item_id);
      return sum + (invoiceItem ? (invoiceItem.unit_price ?? 0) * item.quantity : 0);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas/devoluciones" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Devoluciones
          </Link>
          <h1 className="text-2xl font-semibold">Nueva Devolución</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            {/* Selección de Factura */}
            <div className="mb-6">
              <h2 className="text-lg font-medium mb-4">Seleccionar Factura</h2>

              {!selectedInvoice ? (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por número de factura o cliente..."
                      className="w-full pl-10 pr-4 py-2 border rounded-md"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invoices
                            .filter(invoice =>
                              searchTerm === '' ||
                              invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .slice(0, 5)
                            .map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {invoice.invoice_number}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {invoice.customer?.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {formatDate(invoice.invoice_date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-medium">
                                  {currency.format(invoice.total_amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleInvoiceSelect(invoice)}
                                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm"
                                  >
                                    Seleccionar
                                  </button>
                                </td>
                              </tr>
                            ))}

                          {invoices.filter(invoice =>
                            searchTerm === '' ||
                            invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
                          ).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                  No se encontraron facturas que coincidan con la búsqueda
                                </td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Factura seleccionada: {selectedInvoice.invoice_number}</h3>
                      <p className="text-sm text-gray-600">Cliente: {selectedInvoice.customer?.name}</p>
                      <p className="text-sm text-gray-600">Fecha: {formatDate(selectedInvoice.invoice_date)}</p>
                      <p className="text-sm text-gray-600">Total: {currency.format(selectedInvoice.total_amount)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(null)}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm"
                    >
                      Cambiar factura
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Datos de la devolución */}
            {selectedInvoice && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-4">Motivo de la Devolución</h2>
                  <textarea
                    placeholder="Ingrese el motivo general de la devolución"
                    className="w-full px-4 py-2 border rounded-md"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <h2 className="text-lg font-medium mb-4">Notas Adicionales (Opcional)</h2>
                  <textarea
                    placeholder="Información adicional sobre la devolución"
                    className="w-full px-4 py-2 border rounded-md"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-medium mb-4">Productos a Devolver</h2>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : invoiceItems.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      Esta factura no tiene productos
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cant. Original</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cant. a Devolver</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo Específico</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invoiceItems.map((item) => {
                            const returnItem = returnItems.find(ri => ri.invoice_item_id === item.id);
                            return (
                              <tr key={item.id}>
                                <td className="px-6 py-4">
                                  <div className="font-medium">{item.product?.name}</div>
                                  <div className="text-xs text-gray-500">{item.product?.sku}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {currency.format(item.unit_price ?? 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {item.quantity}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    step="1"
                                    className="w-20 px-2 py-1 border rounded-md"
                                    value={returnItem?.quantity || ''}
                                    onChange={(e) => handleQuantityChange(item.id, item.product_id, e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    placeholder="Motivo específico (opcional)"
                                    className="w-full px-2 py-1 border rounded-md"
                                    value={returnItem?.reason || ''}
                                    onChange={(e) => handleItemReasonChange(item.id, e.target.value)}
                                    disabled={!returnItem}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Resumen de la devolución */}
                {returnItems.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Resumen de la Devolución</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p>Cantidad de productos: {returnItems.length}</p>
                        <p>Total a devolver: {currency.format(getReturnSubtotal())}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-4 mt-6">
                  <Link
                    to="/ventas/devoluciones"
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting || returnItems.length === 0 || !reason.trim()}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        <span>Registrar Devolución</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReturnForm; 