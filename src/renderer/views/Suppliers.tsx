import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Supplier } from '../lib/supabase';

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

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    contact_person: string;
    notes: string;
  }>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    contact_person: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
  const client = await supabase.getClient();
  const { data, error } = await client
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;
  setSuppliers((data as unknown as Supplier[]) || []);
    } catch (err: any) {
      console.error('Error cargando proveedores:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openModal = (supplier: Supplier | null = null) => {
    if (supplier) {
      // Editar proveedor existente
      const contactInfo = supplier.contact_info as ContactInfo || {};
      setFormData({
        name: supplier.name,
        email: contactInfo.email || '',
        phone: contactInfo.phone || '',
        address: contactInfo.address || '',
        city: contactInfo.city || '',
        state: contactInfo.state || '',
        zip: contactInfo.zip || '',
        country: contactInfo.country || '',
        contact_person: contactInfo.contact_person || '',
        notes: contactInfo.notes || ''
      });
      setCurrentSupplier(supplier);
    } else {
      // Nuevo proveedor
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        contact_person: '',
        notes: ''
      });
      setCurrentSupplier(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const contactInfo: ContactInfo = {
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        country: formData.country,
        contact_person: formData.contact_person,
        notes: formData.notes
      };

      if (currentSupplier) {
        // Actualizar proveedor existente
  const client = await supabase.getClient();
  const { error } = await client
          .from('suppliers')
          .update({
            name: formData.name,
            contact_info: contactInfo,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSupplier.id);
        
        if (error) throw error;
      } else {
        // Crear nuevo proveedor
  const client = await supabase.getClient();
  const { error } = await client
          .from('suppliers')
          .insert([{
            name: formData.name,
            contact_info: contactInfo
          }]);
        
        if (error) throw error;
      }
      
      // Recargar la lista de proveedores
      await fetchSuppliers();
      closeModal();
      
    } catch (err: any) {
      console.error('Error guardando proveedor:', err);
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este proveedor? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
  const client = await supabase.getClient();
  const { error } = await client
        .from('suppliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Actualizar la lista
      setSuppliers(suppliers.filter(supplier => supplier.id !== id));
      
    } catch (err: any) {
      console.error('Error eliminando proveedor:', err);
      setError(err.message);
    }
  };

  // Filtrar proveedores por término de búsqueda
  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact_info && 
      ((supplier.contact_info as ContactInfo).email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.contact_info as ContactInfo).phone?.includes(searchTerm)))
  );

  // Calcular paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);

  // Cambiar de página
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          <i className="fas fa-plus mr-2"></i>
          Nuevo Proveedor
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md">
          <p>{error}</p>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              placeholder="Buscar proveedores..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                    Nombre
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                    Contacto
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                    Teléfono
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {currentSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center">
                        <i className="fas fa-users text-gray-300 dark:text-gray-600 text-4xl mb-2"></i>
                        <p>No hay proveedores disponibles</p>
                        {searchTerm && (
                          <p className="text-xs mt-1">
                            No se encontraron resultados para "{searchTerm}"
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentSuppliers.map((supplier) => {
                    const contactInfo = supplier.contact_info as ContactInfo || {};
                    return (
                      <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium dark:text-gray-300">
                          <a 
                            href={`/proveedores/${supplier.id}`} 
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                          >
                            {supplier.name}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-sm dark:text-gray-300">
                          {contactInfo.contact_person || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm dark:text-gray-300">
                          {contactInfo.email ? (
                            <a href={`mailto:${contactInfo.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {contactInfo.email}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm dark:text-gray-300">
                          {contactInfo.phone || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => openModal(supplier)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none rounded-md p-1"
                              title="Editar"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <a 
                              href={`/proveedores/${supplier.id}/compras`}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 focus:outline-none rounded-md p-1"
                              title="Ver historial de compras"
                            >
                              <i className="fas fa-shopping-cart"></i>
                            </a>
                            <button
                              onClick={() => handleDelete(supplier.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 focus:outline-none rounded-md p-1"
                              title="Eliminar"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Paginación */}
            {filteredSuppliers.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredSuppliers.length)} de {filteredSuppliers.length} proveedores
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  
                  {/* Botones de página */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          currentPage === pageNumber
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para agregar/editar proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 dark:text-gray-200">
              {currentSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Persona de contacto
                  </label>
                  <input
                    type="text"
                    id="contact_person"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Dirección
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estado/Provincia
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      id="zip"
                      name="zip"
                      value={formData.zip}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      País
                    </label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notas adicionales
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {currentSupplier ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers; 