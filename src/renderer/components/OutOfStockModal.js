import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { productService } from '../lib/supabase';
export const OutOfStockModal = ({ isOpen, onClose }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;
    useEffect(() => {
        if (isOpen) {
            fetchProducts();
        }
        else {
            // Reset state when closed
            setPage(1);
            setSearch('');
            setProducts([]);
        }
    }, [isOpen, page, search]);
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, count } = await productService.getLowStockProducts({
                page,
                pageSize,
                search,
                threshold: 0 // Productos agotados
            });
            // Supabase returns data as any[], need to cast or ensure type
            setProducts(data);
            setTotalCount(count);
            setTotalPages(Math.ceil(count / pageSize));
        }
        catch (error) {
            console.error('Error fetching out of stock products:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setPage(1); // Reset to first page on search
    };
    return (_jsx(Dialog, { open: isOpen, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "max-w-4xl max-h-[80vh] overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Productos Agotados" }), _jsxs(DialogDescription, { children: ["Listado de productos con stock 0 o menor. Total: ", totalCount] })] }), _jsx("div", { className: "flex items-center space-x-2 my-4", children: _jsx(Input, { placeholder: "Buscar por nombre o SKU...", value: search, onChange: handleSearchChange, className: "max-w-sm" }) }), _jsx("div", { className: "rounded-md border", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Producto" }), _jsx(TableHead, { children: "SKU" }), _jsx(TableHead, { children: "Almac\u00E9n" }), _jsx(TableHead, { className: "text-right", children: "Stock Actual" })] }) }), _jsx(TableBody, { children: loading ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 4, className: "h-24 text-center", children: "Cargando..." }) })) : products.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 4, className: "h-24 text-center", children: "No se encontraron productos agotados." }) })) : (products.map((item, index) => (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: item.product.name }), _jsx(TableCell, { children: item.product.sku || '-' }), _jsx(TableCell, { children: item.warehouse_name }), _jsx(TableCell, { className: "text-right", children: _jsx("span", { className: "px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800", children: item.current_quantity }) })] }, `${item.product.id}-${index}`)))) })] }) }), _jsxs("div", { className: "flex items-center justify-end space-x-2 py-4", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1 || loading, children: "Anterior" }), _jsxs("span", { className: "text-sm text-gray-500", children: ["P\u00E1gina ", page, " de ", totalPages || 1] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages || loading, children: "Siguiente" })] })] }) }));
};
