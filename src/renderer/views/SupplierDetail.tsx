import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, Supplier } from '../lib/supabase';

interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  contact_person?: string;
  notes?: string;
}

const SupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!id) {
          setError('Proveedor no encontrado');
          return;
        }
        const client = await supabase.getClient();
        const { data, error } = await client
          .from('suppliers')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setSupplier((data as unknown) as Supplier);
      } catch (e: any) {
        setError(e.message || 'Error cargando proveedor');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const contact = (supplier?.contact_info as ContactInfo) || {};

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/proveedores" className="text-blue-600 hover:text-blue-800 inline-flex items-center">
          <i className="fas fa-arrow-left mr-2" />
          Volver a Proveedores
        </Link>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">{error}</div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-4">
        <Link to="/proveedores" className="text-blue-600 hover:text-blue-800 inline-flex items-center">
          <i className="fas fa-arrow-left mr-2" />
          Volver a Proveedores
        </Link>
        <div className="text-gray-600">Proveedor no encontrado</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/proveedores" className="text-blue-600 hover:text-blue-800 inline-flex items-center">
            <i className="fas fa-arrow-left mr-2" />
            Volver a Proveedores
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{supplier.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/proveedores/${supplier.id}/compras`} className="px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700">
            <i className="fas fa-shopping-cart mr-1" /> Compras
          </Link>
          <button
            onClick={() => navigate(`/ordenes-compra/nueva?supplier=${supplier.id}`)}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <i className="fas fa-plus mr-1" /> Nueva Orden de Compra
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Contacto</h2>
          <div className="space-y-2 text-sm">
            {contact.contact_person && (
              <div><span className="text-gray-500">Contacto: </span>{contact.contact_person}</div>
            )}
            {contact.email && (
              <div><span className="text-gray-500">Email: </span><a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a></div>
            )}
            {contact.phone && (
              <div><span className="text-gray-500">Teléfono: </span>{contact.phone}</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Dirección</h2>
          <div className="space-y-2 text-sm">
            {contact.address && (<div>{contact.address}</div>)}
            <div className="text-gray-500">
              {[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}
            </div>
            {contact.country && (<div className="text-gray-500">{contact.country}</div>)}
          </div>
        </div>
      </div>

      {contact.notes && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-2">Notas</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{contact.notes}</p>
        </div>
      )}
    </div>
  );
};

export default SupplierDetail;
