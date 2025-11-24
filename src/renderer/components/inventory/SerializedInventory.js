import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
export default function SerializedInventory() {
    const [serials, setSerials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        sku: '',
        vin: '',
        engine: '',
        year: '',
        color: '',
        status: ''
    });
    useEffect(() => {
        fetchSerials();
    }, []);
    const fetchSerials = async () => {
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            const { data, error } = await client
                .from('product_serials')
                .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name),
          location:locations(id, name)
        `)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            setSerials(data || []);
        }
        catch (error) {
            console.error('Error fetching serials:', error);
            toast.error('Error al cargar inventario serializado');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSearch = async () => {
        try {
            setIsLoading(true);
            const client = await supabase.getClient();
            let query = client
                .from('product_serials')
                .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name),
          location:locations(id, name)
        `);
            // Aplicar filtros
            if (filters.sku) {
                query = query.ilike('product.sku', `%${filters.sku}%`);
            }
            if (filters.vin) {
                query = query.ilike('vin', `%${filters.vin}%`);
            }
            if (filters.engine) {
                query = query.ilike('engine_number', `%${filters.engine}%`);
            }
            if (filters.year) {
                query = query.eq('year', parseInt(filters.year));
            }
            if (filters.color) {
                query = query.ilike('color', `%${filters.color}%`);
            }
            if (filters.status && filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error)
                throw error;
            setSerials(data || []);
        }
        catch (error) {
            console.error('Error searching serials:', error);
            toast.error('Error al buscar');
        }
        finally {
            setIsLoading(false);
        }
    };
    const getStatusBadge = (status) => {
        const statusMap = {
            in_stock: { label: 'En Stock', className: 'bg-green-100 text-green-800' },
            sold: { label: 'Vendido', className: 'bg-blue-100 text-blue-800' },
            reserved: { label: 'Reservado', className: 'bg-yellow-100 text-yellow-800' },
            maintenance: { label: 'Mantenimiento', className: 'bg-orange-100 text-orange-800' },
            lost: { label: 'Perdido', className: 'bg-red-100 text-red-800' },
            scrapped: { label: 'Desechado', className: 'bg-gray-100 text-gray-800' },
            in_transit: { label: 'En Tránsito', className: 'bg-purple-100 text-purple-800' },
            returned: { label: 'Devuelto', className: 'bg-cyan-100 text-cyan-800' },
        };
        const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
        return (_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${config.className}`, children: config.label }));
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Inventario Serializado" }), _jsx("p", { className: "text-sm text-gray-500", children: "Vista detallada de productos con n\u00FAmeros de serie (VIN, Motor, etc.)" })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4", children: [_jsx(Input, { placeholder: "SKU...", value: filters.sku, onChange: (e) => setFilters({ ...filters, sku: e.target.value }), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsx(Input, { placeholder: "VIN/Chasis...", value: filters.vin, onChange: (e) => setFilters({ ...filters, vin: e.target.value }), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsx(Input, { placeholder: "N\u00BA Motor...", value: filters.engine, onChange: (e) => setFilters({ ...filters, engine: e.target.value }), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsx(Input, { placeholder: "A\u00F1o...", type: "number", value: filters.year, onChange: (e) => setFilters({ ...filters, year: e.target.value }), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsx(Input, { placeholder: "Color...", value: filters.color, onChange: (e) => setFilters({ ...filters, color: e.target.value }), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsxs("select", { className: "border border-gray-300 rounded-md px-3 py-2 text-sm", value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), children: [_jsx("option", { value: "", children: "Todos los estados" }), _jsx("option", { value: "in_stock", children: "En Stock" }), _jsx("option", { value: "sold", children: "Vendido" }), _jsx("option", { value: "reserved", children: "Reservado" }), _jsx("option", { value: "maintenance", children: "Mantenimiento" }), _jsx("option", { value: "lost", children: "Perdido" })] })] }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsxs(Button, { onClick: handleSearch, className: "flex items-center gap-2", children: [_jsx(Search, { className: "h-4 w-4" }), "Buscar"] }), _jsx(Button, { variant: "outline", onClick: () => {
                                    setFilters({ sku: '', vin: '', engine: '', year: '', color: '', status: '' });
                                    fetchSerials();
                                }, children: "Limpiar Filtros" })] }), isLoading ? (_jsx("p", { children: "Cargando..." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "SKU" }), _jsx(TableHead, { children: "VIN/Chasis" }), _jsx(TableHead, { children: "N\u00BA Motor" }), _jsx(TableHead, { children: "A\u00F1o" }), _jsx(TableHead, { children: "Color" }), _jsx(TableHead, { children: "Estado" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { children: "Ubicaci\u00F3n" })] }) }), _jsx(TableBody, { children: serials.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 9, className: "text-center text-gray-500", children: "No hay productos serializados registrados" }) })) : (serials.map((serial) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: serial.product?.name || '-' }), _jsx(TableCell, { children: serial.product?.sku || '-' }), _jsx(TableCell, { className: "font-mono text-sm", children: serial.vin || serial.serial_code || '-' }), _jsx(TableCell, { className: "font-mono text-sm", children: serial.engine_number || '-' }), _jsx(TableCell, { children: serial.year || '-' }), _jsxs(TableCell, { children: [serial.color && (_jsx("span", { className: "px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs", children: serial.color })), !serial.color && '-'] }), _jsx(TableCell, { children: getStatusBadge(serial.status) }), _jsx(TableCell, { children: serial.warehouse?.name || '-' }), _jsx(TableCell, { children: serial.location?.name || '-' })] }, serial.id)))) })] }) })), serials.length > 0 && (_jsxs("div", { className: "mt-4 text-sm text-gray-500", children: ["Total: ", serials.length, " serial", serials.length !== 1 ? 'es' : ''] }))] })] }));
}
