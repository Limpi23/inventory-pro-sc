import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CustomerInput } from '../../types';
import { toast } from 'react-hot-toast';

const CustomerForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<CustomerInput>({
    name: '',
    identification_type: 'DNI',
    identification_number: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    tax_status: 'Regular',
    payment_terms: 'Contado',
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchCustomerData();
    }
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFormData(data || formData);
    } catch (error: any) {
      console.error('Error al cargar datos del cliente:', error.message);
      toast.error(`Error al cargar datos del cliente: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    }));
  };

  const validateForm = (): boolean => {
    // Validación básica
    if (!formData.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return false;
    }
    
    // Validar email si está presente
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Formato de email inválido');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      // Preparar el objeto de cliente con todos los campos individuales
      const customerData = {
        ...formData,
        updated_at: new Date().toISOString()
      };
      
      if (isEditMode) {
        // Actualizar cliente existente
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', id);
        
        if (error) throw error;
        toast.success('Cliente actualizado correctamente');
      } else {
        // Crear nuevo cliente
        const { error } = await supabase
          .from('customers')
          .insert([{
            ...customerData,
            created_at: new Date().toISOString()
          }]);
        
        if (error) throw error;
        toast.success('Cliente creado correctamente');
      }
      
      // Redirigir a la lista de clientes
      navigate('/ventas/clientes');
    } catch (error: any) {
      console.error('Error al guardar cliente:', error.message);
      toast.error(`Error al guardar cliente: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const identificationTypes = [
    { value: 'DNI', label: 'DNI' },
    { value: 'RUC', label: 'RUC' },
    { value: 'Pasaporte', label: 'Pasaporte' },
    { value: 'Otro', label: 'Otro' }
  ];

  const taxStatusOptions = [
    { value: 'Regular', label: 'Contribuyente Regular' },
    { value: 'Especial', label: 'Contribuyente Especial' },
    { value: 'Exento', label: 'Exento de Impuestos' }
  ];

  const paymentTermsOptions = [
    { value: 'Contado', label: 'Contado' },
    { value: '15dias', label: '15 días' },
    { value: '30dias', label: '30 días' },
    { value: '60dias', label: '60 días' },
    { value: '90dias', label: '90 días' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/ventas/clientes" className="text-blue-600 hover:text-blue-800 flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i>
            Volver a Clientes
          </Link>
          <h1 className="text-2xl font-semibold">
            {isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información básica */}
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Información Básica</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Nombre o Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="identification_type" className="block text-sm font-medium text-gray-700">
                        Tipo de Identificación
                      </label>
                      <select
                        id="identification_type"
                        name="identification_type"
                        value={formData.identification_type}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {identificationTypes.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="identification_number" className="block text-sm font-medium text-gray-700">
                        Número de Identificación
                      </label>
                      <input
                        type="text"
                        id="identification_number"
                        name="identification_number"
                        value={formData.identification_number || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700">
                      Nombre de Contacto
                    </label>
                    <input
                      type="text"
                      id="contact_name"
                      name="contact_name"
                      value={formData.contact_name || ''}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        id="phone"
                        name="phone"
                        value={formData.phone || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Información fiscal y comercial */}
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Información Fiscal</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="tax_status" className="block text-sm font-medium text-gray-700">
                      Régimen Tributario
                    </label>
                    <select
                      id="tax_status"
                      name="tax_status"
                      value={formData.tax_status || ''}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {taxStatusOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="payment_terms" className="block text-sm font-medium text-gray-700">
                        Condiciones de Pago
                      </label>
                      <select
                        id="payment_terms"
                        name="payment_terms"
                        value={formData.payment_terms || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {paymentTermsOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="credit_limit" className="block text-sm font-medium text-gray-700">
                        Límite de Crédito
                      </label>
                      <input
                        type="number"
                        id="credit_limit"
                        name="credit_limit"
                        value={formData.credit_limit || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active || false}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Cliente Activo</span>
                    </label>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-md font-medium text-gray-900 mb-2">Estado</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    formData.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <i className={`fas ${formData.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i>
                    {formData.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Dirección */}
            <div className="pt-4">
              <h2 className="text-lg font-medium text-gray-900 border-b pb-2">
                Dirección <span className="text-sm font-normal text-gray-500">(Opcional)</span>
              </h2>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Dirección <span className="text-xs text-gray-500">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    Estado/Provincia
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    id="zip_code"
                    name="zip_code"
                    value={formData.zip_code || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    País
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-5 border-t">
              <Link
                to="/ventas/clientes"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {isEditMode ? 'Actualizando...' : 'Guardando...'}
                  </>
                ) : (
                  isEditMode ? 'Actualizar Cliente' : 'Crear Cliente'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm; 