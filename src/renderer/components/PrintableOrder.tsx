import React from 'react';
// Definimos tipos locales extendidos porque las interfaces base no incluyen relaciones y campos calculados
interface PurchaseOrderBase {
  id: string;
  order_date: string;
  status: string;
  total_amount?: number;
}
interface PurchaseOrderWithRelations extends PurchaseOrderBase {
  supplier?: {
    name?: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  warehouse?: {
    name?: string;
    location?: string;
  };
}
interface OrderItemBase {
  id: string;
  product_id?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}
interface OrderItemExtended extends OrderItemBase {
  received_quantity?: number;
  product?: { name?: string; sku?: string };
}
import useCompanySettings from '../hooks/useCompanySettings';

interface PrintableOrderProps {
  order: PurchaseOrderWithRelations;
  orderItems: OrderItemExtended[];
  format: 'letter' | 'roll';
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

const PrintableOrder: React.FC<PrintableOrderProps> = ({ 
  order, 
  orderItems, 
  format, 
  formatCurrency,
  formatDate 
}) => {
  const { settings } = useCompanySettings();
  
  // Calcular totales
  const totalReceived = orderItems.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
  const totalOrdered = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const progressPercentage = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  // Renderizar formato carta
  if (format === 'letter') {
    return (
      <div className="w-full max-w-[216mm] mx-auto bg-white p-10 font-sans">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="mb-3">
              <h1 className="text-xl font-bold">{settings.name}</h1>
              <p className="text-sm">NIT: {settings.taxId}</p>
              <p className="text-sm">{settings.address}</p>
              <p className="text-sm">Tel: {settings.phone}</p>
              {settings.email && <p className="text-sm">{settings.email}</p>}
              {settings.website && <p className="text-sm">{settings.website}</p>}
            </div>
            <h2 className="text-2xl font-bold mb-1">Orden de Compra #{order.id.substring(0, 8)}</h2>
            <p className="text-gray-600 mb-2">Fecha: {formatDate(order.order_date)}</p>
          </div>
          <div className="text-right">
            <div className="mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {order.status === 'borrador' ? 'Borrador' : 
                order.status === 'enviada' ? 'Enviada' :
                order.status === 'recibida_parcialmente' ? 'Recibida Parcialmente' :
                order.status === 'completada' ? 'Completada' : 'Cancelada'}
              </span>
            </div>
            <p className="text-sm">ID: {order.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="border border-gray-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-1">Información del Proveedor</h2>
            <p className="text-base"><strong>Nombre:</strong> {order.supplier?.name ?? ''}</p>
            {order.supplier?.contact_name && (
              <p className="text-base"><strong>Contacto:</strong> {order.supplier.contact_name}</p>
            )}
            {order.supplier?.phone && (
              <p className="text-base"><strong>Teléfono:</strong> {order.supplier.phone}</p>
            )}
            {order.supplier?.email && (
              <p className="text-base"><strong>Email:</strong> {order.supplier.email}</p>
            )}
            {order.supplier?.address && (
              <p className="text-base"><strong>Dirección:</strong> {order.supplier.address}</p>
            )}
          </div>
          
          <div className="border border-gray-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-1">Almacén de Destino</h2>
            <p className="text-base"><strong>Nombre:</strong> {order.warehouse?.name ?? ''}</p>
            {order.warehouse?.location && (
              <p className="text-base"><strong>Ubicación:</strong> {order.warehouse.location}</p>
            )}
            
            {['recibida_parcialmente', 'completada'].includes(order.status) && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-500 mb-1">Progreso de recepción: {progressPercentage}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <table className="w-full border-collapse mb-8">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2 text-sm font-semibold text-gray-600">Producto</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-600">Cantidad</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-600">Precio Unitario</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-600">Total</th>
              {['recibida_parcialmente', 'completada'].includes(order.status) && (
                <th className="px-4 py-2 text-sm font-semibold text-gray-600">Recibidos</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="px-4 py-2">
                  <div className="font-medium">{item.product?.name ?? ''}</div>
                  <div className="text-xs text-gray-500">SKU: {item.product?.sku ?? ''}</div>
                </td>
                <td className="px-4 py-2">{item.quantity}</td>
                <td className="px-4 py-2">{formatCurrency(item.unit_price ?? 0)}</td>
                <td className="px-4 py-2">{formatCurrency(item.total_price ?? 0)}</td>
                {['recibida_parcialmente', 'completada'].includes(order.status) && (
                  <td className="px-4 py-2">
                    <span className={item.received_quantity === item.quantity ? 'text-green-600' : 'text-yellow-600'}>
                      {item.received_quantity || 0} / {item.quantity}
                    </span>
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td colSpan={3} className="px-4 py-2 text-right font-medium">
                Total:
              </td>
              <td className="px-4 py-2 font-bold">
                {formatCurrency(order.total_amount ?? 0)}
              </td>
              {['recibida_parcialmente', 'completada'].includes(order.status) && <td></td>}
            </tr>
          </tbody>
        </table>

        <div className="border-t border-gray-200 pt-4 mt-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-semibold mb-10">Elaborado por:</p>
              <div className="border-t border-gray-400 w-40"></div>
              <p className="text-sm mt-1">Firma</p>
            </div>
            
            <div>
              <p className="text-sm font-semibold mb-10">Autorizado por:</p>
              <div className="border-t border-gray-400 w-40"></div>
              <p className="text-sm mt-1">Firma</p>
            </div>
            
            <div>
              <p className="text-sm font-semibold mb-10">Recibido por:</p>
              <div className="border-t border-gray-400 w-40"></div>
              <p className="text-sm mt-1">Firma</p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 mt-8">
          <p>Este documento es un comprobante de recepción de mercancía</p>
          <p>{settings.footerText}</p>
          <p>Generado el {new Date().toLocaleDateString('es-CO')} a las {new Date().toLocaleTimeString('es-CO')}</p>
        </div>
      </div>
    );
  }

  // Renderizar formato rollo (ticket)
  return (
    <div className="w-full max-w-[80mm] mx-auto bg-white p-4 font-sans">
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold mb-1">{settings.name.toUpperCase()}</h1>
        <p className="text-xs">NIT: {settings.taxId}</p>
        <p className="text-xs">{settings.address}</p>
        <p className="text-xs">Tel: {settings.phone}</p>
        <hr className="my-2" />
        <h2 className="text-base font-bold">ORDEN DE COMPRA</h2>
        <p className="text-xs mb-1">#{order.id.substring(0, 8)}</p>
        <p className="text-xs mb-1">Fecha: {formatDate(order.order_date)}</p>
      </div>

      <div className="mb-4">
        <p className="text-xs mb-1">
          <span className="font-semibold">Estado: </span>
          {order.status === 'borrador' ? 'Borrador' : 
          order.status === 'enviada' ? 'Enviada' :
          order.status === 'recibida_parcialmente' ? 'Recibida Parcialmente' :
          order.status === 'completada' ? 'Completada' : 'Cancelada'}
        </p>
        <p className="text-xs mb-1"><span className="font-semibold">Proveedor: </span>{order.supplier?.name ?? ''}</p>
        <p className="text-xs mb-1"><span className="font-semibold">Almacén: </span>{order.warehouse?.name ?? ''}</p>
        
        {['recibida_parcialmente', 'completada'].includes(order.status) && (
          <p className="text-xs mb-1"><span className="font-semibold">Progreso: </span>{progressPercentage}%</p>
        )}
      </div>

      <table className="w-full text-xs mb-4">
        <thead className="border-t border-b border-gray-200">
          <tr>
            <th className="py-1 text-xs font-semibold" style={{ width: '50%', textAlign: 'left' }}>Producto</th>
            <th className="py-1 text-xs font-semibold" style={{ width: '15%', textAlign: 'center' }}>Cant</th>
            <th className="py-1 text-xs font-semibold" style={{ width: '35%', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-1" style={{ textAlign: 'left' }}>
                {item.product?.name ?? ''}
                <br />
                <span className="text-[10px]">SKU: {item.product?.sku ?? ''}</span>
              </td>
              <td className="py-1" style={{ textAlign: 'center' }}>
                {item.quantity}
                {['recibida_parcialmente', 'completada'].includes(order.status) && (
                  <><br /><span className="text-[10px]">Rec: {item.received_quantity || 0}</span></>
                )}
              </td>
              <td className="py-1" style={{ textAlign: 'right' }}>{formatCurrency(item.total_price ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #ccc', marginTop: '8px', paddingTop: '8px' }}>
        <p className="text-xs mb-1" style={{ textAlign: 'right' }}>
          <span className="font-semibold">Total: </span>
          {formatCurrency(order.total_amount ?? 0)}
        </p>
      </div>

      {['recibida_parcialmente', 'completada'].includes(order.status) && (
        <div style={{ marginTop: '8px' }}>
          <p className="text-xs mb-1" style={{ textAlign: 'center' }}>
            <span className="font-semibold">Artículos Recibidos: </span>
            {totalReceived} de {totalOrdered}
          </p>
        </div>
      )}

      <div className="text-center text-xs mt-4 border-t border-gray-200 pt-2">
        <p>{settings.footerText}</p>
        <p>{new Date().toLocaleDateString('es-CO')} {new Date().toLocaleTimeString('es-CO')}</p>
      </div>
    </div>
  );
};

export default PrintableOrder; 