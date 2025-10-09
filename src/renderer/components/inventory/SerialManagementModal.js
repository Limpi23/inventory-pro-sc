import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
export default function SerialManagementModal({ productId, productName, productSku, onClose, onUpdate }) {
    const [serials, setSerials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [warehouses, setWarehouses] = useState([]);
    const [locations, setLocations] = useState([]);
    const [formData, setFormData] = useState({
        serial_code: '',
        vin: '',
        engine_number: '',
        year: '',
        color: '',
        warehouse_id: '',
        location_id: ''
    });
    useEffect(() => {
        fetchSerials();
        fetchWarehouses();
    }, [productId]);
    const fetchSerials = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('product_serials')
                .select(`
          *,
          warehouse:warehouses(name),
          location:locations(name)
        `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            setSerials(data || []);
        }
        catch (error) {
            console.error('Error fetching serials:', error);
            toast.error('Error al cargar seriales');
        }
        finally {
            setIsLoading(false);
        }
    };
    const fetchWarehouses = async () => {
        try {
            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .order('name');
            if (error)
                throw error;
            setWarehouses(data || []);
        }
        catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };
    const fetchLocations = async (warehouseId) => {
        try {
            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('warehouse_id', warehouseId)
                .order('name');
            if (error)
                throw error;
            setLocations(data || []);
        }
        catch (error) {
            console.error('Error fetching locations:', error);
        }
    };
    useEffect(() => {
        if (formData.warehouse_id) {
            fetchLocations(formData.warehouse_id);
        }
        else {
            setLocations([]);
            setFormData(prev => ({ ...prev, location_id: '' }));
        }
    }, [formData.warehouse_id]);
    const handleAdd = () => {
        setIsAdding(true);
        setEditingId(null);
        setFormData({
            serial_code: '',
            vin: '',
            engine_number: '',
            year: '',
            color: '',
            warehouse_id: '',
            location_id: ''
        });
    };
    const handleEdit = (serial) => {
        setEditingId(serial.id);
        setIsAdding(true);
        setFormData({
            serial_code: serial.serial_code,
            vin: serial.vin || '',
            engine_number: serial.engine_number || '',
            year: serial.year?.toString() || '',
            color: serial.color || '',
            warehouse_id: serial.warehouse_id || '',
            location_id: serial.location_id || ''
        });
    };
    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({
            serial_code: '',
            vin: '',
            engine_number: '',
            year: '',
            color: '',
            warehouse_id: '',
            location_id: ''
        });
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.serial_code.trim()) {
            toast.error('El código de serie es obligatorio');
            return;
        }
        try {
            const serialData = {
                product_id: productId,
                serial_code: formData.serial_code.trim(),
                vin: formData.vin.trim() || null,
                engine_number: formData.engine_number.trim() || null,
                year: formData.year ? parseInt(formData.year) : null,
                color: formData.color.trim() || null,
                warehouse_id: formData.warehouse_id || null,
                location_id: formData.location_id || null,
                status: 'in_stock'
            };
            if (editingId) {
                // Actualizar
                const { error } = await supabase
                    .from('product_serials')
                    .update(serialData)
                    .eq('id', editingId);
                if (error)
                    throw error;
                toast.success('Serial actualizado correctamente');
            }
            else {
                // Crear
                const { error } = await supabase
                    .from('product_serials')
                    .insert([serialData]);
                if (error)
                    throw error;
                toast.success('Serial agregado correctamente');
            }
            handleCancel();
            fetchSerials();
            onUpdate?.();
        }
        catch (error) {
            console.error('Error saving serial:', error);
            toast.error(error.message || 'Error al guardar serial');
        }
    };
    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este serial?'))
            return;
        try {
            const { error } = await supabase
                .from('product_serials')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
            toast.success('Serial eliminado correctamente');
            fetchSerials();
            onUpdate?.();
        }
        catch (error) {
            console.error('Error deleting serial:', error);
            toast.error('Error al eliminar serial');
        }
    };
    const getStatusBadge = (status) => {
        const statusMap = {
            in_stock: { label: 'En Stock', className: 'bg-green-100 text-green-800' },
            sold: { label: 'Vendido', className: 'bg-blue-100 text-blue-800' },
            reserved: { label: 'Reservado', className: 'bg-yellow-100 text-yellow-800' },
        };
        const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
        return (_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${config.className}`, children: config.label }));
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col", children: [_jsx("div", { className: "p-6 border-b", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Gesti\u00F3n de Seriales" }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: [productName, " - SKU: ", productSku] })] }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx("i", { className: "fas fa-times text-xl" }) })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6", children: [!isAdding && (_jsx("div", { className: "mb-4", children: _jsxs("button", { onClick: handleAdd, className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2", children: [_jsx("i", { className: "fas fa-plus" }), "Agregar Serial"] }) })), isAdding && (_jsxs("form", { onSubmit: handleSubmit, className: "bg-gray-50 p-4 rounded-lg mb-6", children: [_jsx("h3", { className: "font-semibold mb-4", children: editingId ? 'Editar Serial' : 'Nuevo Serial' }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["C\u00F3digo de Serie / VIN ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", required: true, value: formData.serial_code, onChange: (e) => setFormData({ ...formData, serial_code: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "VIN (alternativo)" }), _jsx("input", { type: "text", value: formData.vin, onChange: (e) => setFormData({ ...formData, vin: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "N\u00FAmero de Motor" }), _jsx("input", { type: "text", value: formData.engine_number, onChange: (e) => setFormData({ ...formData, engine_number: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "A\u00F1o" }), _jsx("input", { type: "number", min: "1900", max: "2100", value: formData.year, onChange: (e) => setFormData({ ...formData, year: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Color" }), _jsx("input", { type: "text", value: formData.color, onChange: (e) => setFormData({ ...formData, color: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Almac\u00E9n" }), _jsxs("select", { value: formData.warehouse_id, onChange: (e) => setFormData({ ...formData, warehouse_id: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500", children: [_jsx("option", { value: "", children: "Seleccionar almac\u00E9n" }), warehouses.map(w => (_jsx("option", { value: w.id, children: w.name }, w.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ubicaci\u00F3n" }), _jsxs("select", { value: formData.location_id, onChange: (e) => setFormData({ ...formData, location_id: e.target.value }), className: "w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500", disabled: !formData.warehouse_id, children: [_jsx("option", { value: "", children: "Seleccionar ubicaci\u00F3n" }), locations.map(l => (_jsx("option", { value: l.id, children: l.name }, l.id)))] })] })] }), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600", children: editingId ? 'Actualizar' : 'Guardar' }), _jsx("button", { type: "button", onClick: handleCancel, className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Cancelar" })] })] })), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Serial/VIN" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Motor" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "A\u00F1o" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Color" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Estado" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Ubicaci\u00F3n" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Acciones" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-8 text-center text-gray-500", children: _jsx("div", { className: "flex justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" }) }) }) })) : serials.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-8 text-center text-gray-500", children: "No hay seriales registrados" }) })) : (serials.map((serial) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-4 py-3 text-sm", children: [_jsx("div", { className: "font-medium", children: serial.serial_code }), serial.vin && serial.vin !== serial.serial_code && (_jsxs("div", { className: "text-xs text-gray-500", children: ["VIN: ", serial.vin] }))] }), _jsx("td", { className: "px-4 py-3 text-sm", children: serial.engine_number || '-' }), _jsx("td", { className: "px-4 py-3 text-sm", children: serial.year || '-' }), _jsx("td", { className: "px-4 py-3 text-sm", children: serial.color || '-' }), _jsx("td", { className: "px-4 py-3 text-sm", children: getStatusBadge(serial.status) }), _jsxs("td", { className: "px-4 py-3 text-sm", children: [_jsx("div", { children: serial.warehouse?.name || '-' }), serial.location?.name && (_jsx("div", { className: "text-xs text-gray-500", children: serial.location.name }))] }), _jsx("td", { className: "px-4 py-3 text-sm", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleEdit(serial), className: "text-blue-600 hover:text-blue-800", title: "Editar", children: _jsx("i", { className: "fas fa-edit" }) }), _jsx("button", { onClick: () => handleDelete(serial.id), className: "text-red-600 hover:text-red-800", title: "Eliminar", children: _jsx("i", { className: "fas fa-trash" }) })] }) })] }, serial.id)))) })] }) })] }), _jsx("div", { className: "p-4 border-t bg-gray-50", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("p", { className: "text-sm text-gray-600", children: ["Total de seriales: ", _jsx("span", { className: "font-semibold", children: serials.length })] }), _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Cerrar" })] }) })] }) }));
}
