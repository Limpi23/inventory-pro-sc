import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
const CustomerForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const [formData, setFormData] = useState({
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
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();
            if (error)
                throw error;
            // Cast porque select('*') retorna any
            setFormData(data || formData);
        }
        catch (error) {
            console.error('Error al cargar datos del cliente:', error.message);
            toast.error(`Error al cargar datos del cliente: ${error.message}`);
        }
        finally {
            setLoading(false);
        }
    };
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox'
                ? e.target.checked
                : value
        }));
    };
    const validateForm = () => {
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
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm())
            return;
        try {
            setIsSubmitting(true);
            // Preparar el objeto de cliente con todos los campos individuales
            const customerData = {
                ...formData,
                updated_at: new Date().toISOString()
            };
            if (isEditMode) {
                // Actualizar cliente existente
                const client = await supabase.getClient();
                const { error } = await client
                    .from('customers')
                    .update(customerData)
                    .eq('id', id);
                if (error)
                    throw error;
                toast.success('Cliente actualizado correctamente');
            }
            else {
                // Crear nuevo cliente
                const client = await supabase.getClient();
                const { error } = await client
                    .from('customers')
                    .insert([{
                        ...customerData,
                        created_at: new Date().toISOString()
                    }]);
                if (error)
                    throw error;
                toast.success('Cliente creado correctamente');
            }
            // Redirigir a la lista de clientes
            navigate('/ventas/clientes');
        }
        catch (error) {
            console.error('Error al guardar cliente:', error.message);
            toast.error(`Error al guardar cliente: ${error.message}`);
        }
        finally {
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
        return (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsxs("div", { children: [_jsxs(Link, { to: "/ventas/clientes", className: "text-blue-600 hover:text-blue-800 flex items-center mb-2", children: [_jsx("i", { className: "fas fa-arrow-left mr-2" }), "Volver a Clientes"] }), _jsx("h1", { className: "text-2xl font-semibold", children: isEditMode ? 'Editar Cliente' : 'Nuevo Cliente' })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsx("div", { className: "p-6", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 border-b pb-2", children: "Informaci\u00F3n B\u00E1sica" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "name", className: "block text-sm font-medium text-gray-700", children: ["Nombre o Raz\u00F3n Social ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", id: "name", name: "name", value: formData.name, onChange: handleChange, required: true, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "identification_type", className: "block text-sm font-medium text-gray-700", children: "Tipo de Identificaci\u00F3n" }), _jsx("select", { id: "identification_type", name: "identification_type", value: formData.identification_type, onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: identificationTypes.map(option => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "identification_number", className: "block text-sm font-medium text-gray-700", children: "N\u00FAmero de Identificaci\u00F3n" }), _jsx("input", { type: "text", id: "identification_number", name: "identification_number", value: formData.identification_number || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "contact_name", className: "block text-sm font-medium text-gray-700", children: "Nombre de Contacto" }), _jsx("input", { type: "text", id: "contact_name", name: "contact_name", value: formData.contact_name || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", value: formData.email || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "phone", className: "block text-sm font-medium text-gray-700", children: "Tel\u00E9fono" }), _jsx("input", { type: "text", id: "phone", name: "phone", value: formData.phone || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-lg font-medium text-gray-900 border-b pb-2", children: "Informaci\u00F3n Fiscal" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "tax_status", className: "block text-sm font-medium text-gray-700", children: "R\u00E9gimen Tributario" }), _jsx("select", { id: "tax_status", name: "tax_status", value: formData.tax_status || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: taxStatusOptions.map(option => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "payment_terms", className: "block text-sm font-medium text-gray-700", children: "Condiciones de Pago" }), _jsx("select", { id: "payment_terms", name: "payment_terms", value: formData.payment_terms || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500", children: paymentTermsOptions.map(option => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "credit_limit", className: "block text-sm font-medium text-gray-700", children: "L\u00EDmite de Cr\u00E9dito" }), _jsx("input", { type: "number", id: "credit_limit", name: "credit_limit", value: formData.credit_limit || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", name: "is_active", checked: formData.is_active || false, onChange: handleChange, className: "h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" }), _jsx("span", { className: "ml-2 text-sm text-gray-700", children: "Cliente Activo" })] }) })] }), _jsxs("div", { className: "mt-4 pt-4 border-t", children: [_jsx("h3", { className: "text-md font-medium text-gray-900 mb-2", children: "Estado" }), _jsxs("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${formData.is_active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'}`, children: [_jsx("i", { className: `fas ${formData.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-1` }), formData.is_active ? 'Activo' : 'Inactivo'] })] })] })] }), _jsxs("div", { className: "pt-4", children: [_jsxs("h2", { className: "text-lg font-medium text-gray-900 border-b pb-2", children: ["Direcci\u00F3n ", _jsx("span", { className: "text-sm font-normal text-gray-500", children: "(Opcional)" })] }), _jsxs("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "address", className: "block text-sm font-medium text-gray-700", children: ["Direcci\u00F3n ", _jsx("span", { className: "text-xs text-gray-500", children: "(opcional)" })] }), _jsx("input", { type: "text", id: "address", name: "address", value: formData.address || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "city", className: "block text-sm font-medium text-gray-700", children: "Ciudad" }), _jsx("input", { type: "text", id: "city", name: "city", value: formData.city || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "state", className: "block text-sm font-medium text-gray-700", children: "Estado/Provincia" }), _jsx("input", { type: "text", id: "state", name: "state", value: formData.state || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "zip_code", className: "block text-sm font-medium text-gray-700", children: "C\u00F3digo Postal" }), _jsx("input", { type: "text", id: "zip_code", name: "zip_code", value: formData.zip_code || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "country", className: "block text-sm font-medium text-gray-700", children: "Pa\u00EDs" }), _jsx("input", { type: "text", id: "country", name: "country", value: formData.country || '', onChange: handleChange, className: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-5 border-t", children: [_jsx(Link, { to: "/ventas/clientes", className: "px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500", children: "Cancelar" }), _jsx("button", { type: "submit", disabled: isSubmitting, className: `px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`, children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx("i", { className: "fas fa-spinner fa-spin mr-2" }), isEditMode ? 'Actualizando...' : 'Guardando...'] })) : (isEditMode ? 'Actualizar Cliente' : 'Crear Cliente') })] })] }) }) })] }));
};
export default CustomerForm;
