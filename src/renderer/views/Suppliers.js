import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, } from '../components/ui/dropdown-menu';
const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState(null);
    const [formData, setFormData] = useState({
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
            if (error)
                throw error;
            setSuppliers(data || []);
        }
        catch (err) {
            console.error('Error cargando proveedores:', err);
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const openModal = (supplier = null) => {
        if (supplier) {
            // Editar proveedor existente
            const contactInfo = supplier.contact_info || {};
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
        }
        else {
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
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const contactInfo = {
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
                if (error)
                    throw error;
            }
            else {
                // Crear nuevo proveedor
                const client = await supabase.getClient();
                const { error } = await client
                    .from('suppliers')
                    .insert([{
                        name: formData.name,
                        contact_info: contactInfo
                    }]);
                if (error)
                    throw error;
            }
            // Recargar la lista de proveedores
            await fetchSuppliers();
            closeModal();
        }
        catch (err) {
            console.error('Error guardando proveedor:', err);
            setError(err.message);
        }
    };
    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este proveedor? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const client = await supabase.getClient();
            const { error } = await client
                .from('suppliers')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
            // Actualizar la lista
            setSuppliers(suppliers.filter(supplier => supplier.id !== id));
        }
        catch (err) {
            console.error('Error eliminando proveedor:', err);
            setError(err.message);
        }
    };
    // Filtrar proveedores por término de búsqueda
    const filteredSuppliers = suppliers.filter(supplier => supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.contact_info &&
            (supplier.contact_info.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                supplier.contact_info.phone?.includes(searchTerm))));
    // Calcular paginación
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSuppliers = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
    // Cambiar de página
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Proveedores" }), _jsxs("button", { onClick: () => openModal(), className: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors", children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nuevo Proveedor"] })] }), error && (_jsx("div", { className: "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md", children: _jsx("p", { children: error }) })), _jsxs("div", { className: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md", children: [_jsx("div", { className: "mb-6", children: _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("i", { className: "fas fa-search text-gray-400" }) }), _jsx("input", { type: "text", placeholder: "Buscar proveedores...", value: searchTerm, onChange: (e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }, className: "w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" })] }) }), isLoading ? (_jsx("div", { className: "flex justify-center items-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200 dark:divide-gray-700", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-700", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Nombre" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Contacto" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Email" }), _jsx("th", { className: "text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Tel\u00E9fono" }), _jsx("th", { className: "text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider py-3 px-4", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700", children: currentSuppliers.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "py-6 text-center text-sm text-gray-500 dark:text-gray-400", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("i", { className: "fas fa-users text-gray-300 dark:text-gray-600 text-4xl mb-2" }), _jsx("p", { children: "No hay proveedores disponibles" }), searchTerm && (_jsxs("p", { className: "text-xs mt-1", children: ["No se encontraron resultados para \"", searchTerm, "\""] }))] }) }) })) : (currentSuppliers.map((supplier) => {
                                            const contactInfo = supplier.contact_info || {};
                                            return (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors", children: [_jsx("td", { className: "py-3 px-4 text-sm font-medium dark:text-gray-300", children: _jsx(Link, { to: `/proveedores/${supplier.id}`, className: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline", children: supplier.name }) }), _jsx("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: contactInfo.contact_person || '-' }), _jsx("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: contactInfo.email ? (_jsx("a", { href: `mailto:${contactInfo.email}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contactInfo.email })) : ('-') }), _jsx("td", { className: "py-3 px-4 text-sm dark:text-gray-300", children: contactInfo.phone ? (_jsx("a", { href: `tel:${contactInfo.phone}`, className: "text-blue-600 dark:text-blue-400 hover:underline", children: contactInfo.phone })) : ('-') }), _jsx("td", { className: "py-3 px-4 text-sm text-center", children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", size: "sm", className: "h-8 px-2", children: [_jsx("i", { className: "fas fa-ellipsis-v mr-2" }), "Acciones"] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "min-w-[180px]", children: [_jsxs(DropdownMenuItem, { onClick: () => openModal(supplier), children: [_jsx("i", { className: "fas fa-edit text-muted-foreground" }), _jsx("span", { className: "ml-2", children: "Editar" })] }), _jsx(DropdownMenuItem, { asChild: true, children: _jsxs(Link, { to: `/proveedores/${supplier.id}/compras`, className: "flex items-center gap-2 w-full", children: [_jsx("i", { className: "fas fa-shopping-cart text-green-600" }), _jsx("span", { children: "Historial de compras" })] }) }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => handleDelete(supplier.id), className: "text-red-600 focus:text-red-700", children: [_jsx("i", { className: "fas fa-trash" }), _jsx("span", { className: "ml-2", children: "Eliminar" })] })] })] }) })] }, supplier.id));
                                        })) })] }), filteredSuppliers.length > itemsPerPage && (_jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: ["Mostrando ", indexOfFirstItem + 1, "-", Math.min(indexOfLastItem, filteredSuppliers.length), " de ", filteredSuppliers.length, " proveedores"] }), _jsxs("div", { className: "flex space-x-1", children: [_jsx("button", { onClick: () => paginate(currentPage - 1), disabled: currentPage === 1, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1
                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`, children: _jsx("i", { className: "fas fa-chevron-left" }) }), Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                                let pageNumber;
                                                if (totalPages <= 5) {
                                                    pageNumber = i + 1;
                                                }
                                                else if (currentPage <= 3) {
                                                    pageNumber = i + 1;
                                                }
                                                else if (currentPage >= totalPages - 2) {
                                                    pageNumber = totalPages - 4 + i;
                                                }
                                                else {
                                                    pageNumber = currentPage - 2 + i;
                                                }
                                                return (_jsx("button", { onClick: () => paginate(pageNumber), className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === pageNumber
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`, children: pageNumber }, pageNumber));
                                            }), _jsx("button", { onClick: () => paginate(currentPage + 1), disabled: currentPage === totalPages, className: `px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages
                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`, children: _jsx("i", { className: "fas fa-chevron-right" }) })] })] }))] }))] }), isModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto", children: [_jsx("h2", { className: "text-xl font-semibold mb-4 dark:text-gray-200", children: currentSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor' }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "name", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Nombre *" }), _jsx("input", { type: "text", id: "name", name: "name", value: formData.name, onChange: handleInputChange, required: true, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "contact_person", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Persona de contacto" }), _jsx("input", { type: "text", id: "contact_person", name: "contact_person", value: formData.contact_person, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", value: formData.email, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "phone", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Tel\u00E9fono" }), _jsx("input", { type: "text", id: "phone", name: "phone", value: formData.phone, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "address", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Direcci\u00F3n" }), _jsx("input", { type: "text", id: "address", name: "address", value: formData.address, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "city", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Ciudad" }), _jsx("input", { type: "text", id: "city", name: "city", value: formData.city, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "state", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Estado/Provincia" }), _jsx("input", { type: "text", id: "state", name: "state", value: formData.state, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "zip", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "C\u00F3digo Postal" }), _jsx("input", { type: "text", id: "zip", name: "zip", value: formData.zip, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "country", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Pa\u00EDs" }), _jsx("input", { type: "text", id: "country", name: "country", value: formData.country, onChange: handleInputChange, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "notes", className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "Notas adicionales" }), _jsx("textarea", { id: "notes", name: "notes", value: formData.notes, onChange: handleInputChange, rows: 3, className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" })] })] }), _jsxs("div", { className: "mt-6 flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: closeModal, className: "px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400", children: "Cancelar" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400", children: currentSupplier ? 'Actualizar' : 'Guardar' })] })] })] }) }))] }));
};
export default Suppliers;
