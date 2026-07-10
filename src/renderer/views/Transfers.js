import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase, stockTransfersService, stockMovementService } from '../lib/supabase';
import { useBranch, ALL_BRANCHES } from '../lib/branch';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from '../components/ui/dialog';
const STATUS_LABELS = {
    pending: { text: 'Pendiente', className: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock' },
    in_transit: { text: 'En tránsito', className: 'bg-blue-100 text-blue-800', icon: 'fa-truck' },
    received: { text: 'Recibida', className: 'bg-green-100 text-green-800', icon: 'fa-check-circle' },
    cancelled: { text: 'Cancelada', className: 'bg-red-100 text-red-800', icon: 'fa-times-circle' },
};
const Transfers = () => {
    const { user } = useAuth();
    const { warehouses, activeBranchId, isAllView, isLocked } = useBranch();
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(null);
    // Formulario de nueva transferencia
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [sourceId, setSourceId] = useState('');
    const [destinationId, setDestinationId] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [draftQuantity, setDraftQuantity] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedProductStock, setSelectedProductStock] = useState(null);
    useEffect(() => {
        fetchTransfers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBranchId, statusFilter]);
    useEffect(() => {
        // Cargar productos una sola vez al abrir el formulario
        if (isFormOpen && products.length === 0) {
            (async () => {
                try {
                    const client = await supabase.getClient();
                    const { data, error } = await client
                        .from('products')
                        .select('id, name, sku')
                        .order('name');
                    if (error)
                        throw error;
                    setProducts(data || []);
                }
                catch (e) {
                    toast.error('Error al cargar productos: ' + e.message);
                }
            })();
        }
    }, [isFormOpen, products.length]);
    // Consultar stock disponible del producto seleccionado en el origen
    useEffect(() => {
        if (selectedProduct && sourceId) {
            stockMovementService.getCurrentStock(selectedProduct.id, sourceId)
                .then(setSelectedProductStock)
                .catch(() => setSelectedProductStock(null));
        }
        else {
            setSelectedProductStock(null);
        }
    }, [selectedProduct, sourceId]);
    const fetchTransfers = async () => {
        try {
            setLoading(true);
            const data = await stockTransfersService.getAll({
                warehouseId: isAllView ? undefined : activeBranchId,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
            setTransfers(data);
        }
        catch (e) {
            // Tabla inexistente → migración pendiente
            if (/stock_transfers/.test(e.message || '')) {
                toast.error('La base de datos no tiene la migración de transferencias. Ejecute las migraciones desde el menú.');
            }
            else {
                toast.error('Error al cargar transferencias: ' + e.message);
            }
            setTransfers([]);
        }
        finally {
            setLoading(false);
        }
    };
    const openForm = () => {
        setSourceId(!isAllView && activeBranchId !== ALL_BRANCHES ? activeBranchId : '');
        setDestinationId('');
        setNotes('');
        setItems([]);
        setSelectedProduct(null);
        setProductSearch('');
        setDraftQuantity(1);
        setIsFormOpen(true);
    };
    const addItem = () => {
        if (!selectedProduct) {
            toast.error('Seleccione un producto');
            return;
        }
        if (!sourceId) {
            toast.error('Seleccione la sucursal de origen primero');
            return;
        }
        if (draftQuantity <= 0) {
            toast.error('La cantidad debe ser mayor a cero');
            return;
        }
        const available = selectedProductStock ?? 0;
        const alreadyAdded = items.find(i => i.product_id === selectedProduct.id)?.quantity || 0;
        if (draftQuantity + alreadyAdded > available) {
            toast.error(`Stock insuficiente en origen (disponible: ${available})`);
            return;
        }
        setItems(prev => {
            const existing = prev.find(i => i.product_id === selectedProduct.id);
            if (existing) {
                return prev.map(i => i.product_id === selectedProduct.id
                    ? { ...i, quantity: i.quantity + draftQuantity }
                    : i);
            }
            return [...prev, {
                    product_id: selectedProduct.id,
                    product_name: selectedProduct.name,
                    product_sku: selectedProduct.sku,
                    quantity: draftQuantity,
                    available,
                }];
        });
        setSelectedProduct(null);
        setProductSearch('');
        setDraftQuantity(1);
    };
    const removeItem = (productId) => {
        setItems(prev => prev.filter(i => i.product_id !== productId));
    };
    const handleCreate = async () => {
        if (!sourceId || !destinationId) {
            toast.error('Seleccione sucursal de origen y destino');
            return;
        }
        if (sourceId === destinationId) {
            toast.error('El origen y el destino no pueden ser la misma sucursal');
            return;
        }
        if (items.length === 0) {
            toast.error('Agregue al menos un producto');
            return;
        }
        try {
            setIsSaving(true);
            const result = await stockTransfersService.create({
                source_warehouse_id: sourceId,
                destination_warehouse_id: destinationId,
                notes,
                items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
            }, user?.id);
            toast.success(`Transferencia ${result.transfer_number} creada`);
            setIsFormOpen(false);
            fetchTransfers();
        }
        catch (e) {
            toast.error(e.message || 'Error al crear la transferencia');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleShip = async (transfer) => {
        if (!confirm(`¿Enviar la transferencia ${transfer.transfer_number}? Se descontará el stock del origen.`))
            return;
        try {
            setActionInProgress(transfer.id);
            await stockTransfersService.ship(transfer.id, user?.id);
            toast.success('Transferencia enviada (en tránsito)');
            fetchTransfers();
            if (expandedId === transfer.id)
                loadDetail(transfer.id);
        }
        catch (e) {
            toast.error(e.message || 'Error al enviar');
        }
        finally {
            setActionInProgress(null);
        }
    };
    const handleReceive = async (transfer) => {
        if (!confirm(`¿Confirmar recepción de ${transfer.transfer_number}? El stock ingresará a la sucursal destino.`))
            return;
        try {
            setActionInProgress(transfer.id);
            await stockTransfersService.receive(transfer.id, user?.id);
            toast.success('Transferencia recibida');
            fetchTransfers();
            if (expandedId === transfer.id)
                loadDetail(transfer.id);
        }
        catch (e) {
            toast.error(e.message || 'Error al recibir');
        }
        finally {
            setActionInProgress(null);
        }
    };
    const handleCancel = async (transfer) => {
        if (!confirm(`¿Cancelar la transferencia ${transfer.transfer_number}?`))
            return;
        try {
            setActionInProgress(transfer.id);
            await stockTransfersService.cancel(transfer.id, user?.id);
            toast.success('Transferencia cancelada');
            fetchTransfers();
        }
        catch (e) {
            toast.error(e.message || 'Error al cancelar');
        }
        finally {
            setActionInProgress(null);
        }
    };
    const loadDetail = async (transferId) => {
        try {
            const data = await stockTransfersService.getById(transferId);
            setDetail(data);
        }
        catch {
            setDetail(null);
        }
    };
    const toggleDetail = (transferId) => {
        if (expandedId === transferId) {
            setExpandedId(null);
            setDetail(null);
        }
        else {
            setExpandedId(transferId);
            setDetail(null);
            loadDetail(transferId);
        }
    };
    // Un usuario restringido solo opera desde/hacia su sucursal
    const canShip = (t) => !isLocked || t.source_warehouse_id === activeBranchId;
    const canReceive = (t) => !isLocked || t.destination_warehouse_id === activeBranchId;
    const filteredProducts = products.filter(p => productSearch === '' ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8);
    const formatDate = (d) => d ? new Date(d).toLocaleString() : '-';
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Transferencias entre Sucursales" }), _jsx("p", { className: "text-muted-foreground text-sm", children: "Env\u00EDe mercanc\u00EDa de una sucursal a otra con confirmaci\u00F3n de recepci\u00F3n." })] }), _jsxs(Button, { onClick: openForm, children: [_jsx("i", { className: "fas fa-plus mr-2" }), "Nueva Transferencia"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-sm text-muted-foreground", children: "Estado:" }), _jsxs("select", { className: "border rounded-md py-1.5 px-2 text-sm bg-background", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "Todos" }), _jsx("option", { value: "pending", children: "Pendientes" }), _jsx("option", { value: "in_transit", children: "En tr\u00E1nsito" }), _jsx("option", { value: "received", children: "Recibidas" }), _jsx("option", { value: "cancelled", children: "Canceladas" })] })] }), loading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) })) : (_jsx("div", { className: "bg-card rounded-md shadow", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "N\u00FAmero" }), _jsx(TableHead, { children: "Origen" }), _jsx(TableHead, { children: "Destino" }), _jsx(TableHead, { children: "Estado" }), _jsx(TableHead, { children: "Creada" }), _jsx(TableHead, { className: "text-right", children: "Acciones" })] }) }), _jsx(TableBody, { children: transfers.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "text-center py-10 text-muted-foreground", children: "No hay transferencias registradas" }) })) : (transfers.map(t => {
                                const st = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
                                return (_jsxs(React.Fragment, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: _jsx("button", { className: "text-blue-600 hover:underline", onClick: () => toggleDetail(t.id), title: "Ver detalle", children: t.transfer_number }) }), _jsx(TableCell, { children: t.source_warehouse?.name || '-' }), _jsx(TableCell, { children: t.destination_warehouse?.name || '-' }), _jsx(TableCell, { children: _jsxs("span", { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${st.className}`, children: [_jsx("i", { className: `fas ${st.icon} mr-1` }), st.text] }) }), _jsx(TableCell, { children: formatDate(t.created_at) }), _jsxs(TableCell, { className: "text-right space-x-2", children: [t.status === 'pending' && canShip(t) && (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", onClick: () => handleShip(t), disabled: actionInProgress === t.id, children: [_jsx("i", { className: "fas fa-truck mr-1" }), " Enviar"] }), _jsx(Button, { size: "sm", variant: "outline", className: "text-red-600", onClick: () => handleCancel(t), disabled: actionInProgress === t.id, children: "Cancelar" })] })), t.status === 'in_transit' && canReceive(t) && (_jsxs(Button, { size: "sm", onClick: () => handleReceive(t), disabled: actionInProgress === t.id, children: [_jsx("i", { className: "fas fa-check mr-1" }), " Recibir"] }))] })] }), expandedId === t.id && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "bg-muted/40", children: !detail ? (_jsx("div", { className: "py-3 text-sm text-muted-foreground", children: "Cargando detalle..." })) : (_jsxs("div", { className: "py-2 space-y-2", children: [_jsxs("div", { className: "text-sm grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsxs("span", { children: [_jsx("strong", { children: "Enviada:" }), " ", formatDate(detail.shipped_at)] }), _jsxs("span", { children: [_jsx("strong", { children: "Recibida:" }), " ", formatDate(detail.received_at)] }), detail.notes && _jsxs("span", { children: [_jsx("strong", { children: "Notas:" }), " ", detail.notes] })] }), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-muted-foreground", children: [_jsx("th", { className: "py-1", children: "Producto" }), _jsx("th", { className: "py-1", children: "SKU" }), _jsx("th", { className: "py-1 text-right", children: "Cantidad" })] }) }), _jsx("tbody", { children: (detail.items || []).map(item => (_jsxs("tr", { className: "border-t", children: [_jsx("td", { className: "py-1", children: item.product?.name || item.product_id }), _jsx("td", { className: "py-1", children: item.product?.sku || '-' }), _jsx("td", { className: "py-1 text-right", children: item.quantity })] }, item.id))) })] })] })) }) }))] }, t.id));
                            })) })] }) })), _jsx(Dialog, { open: isFormOpen, onOpenChange: (open) => !open && setIsFormOpen(false), children: _jsxs(DialogContent, { className: "sm:max-w-[640px]", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Nueva Transferencia" }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Sucursal de origen *" }), _jsxs("select", { className: "w-full border rounded-md py-2 px-3 bg-background disabled:opacity-70", value: sourceId, onChange: (e) => setSourceId(e.target.value), disabled: isLocked, children: [_jsx("option", { value: "", children: "-- Seleccione origen --" }), warehouses.map(w => (_jsxs("option", { value: w.id, children: [w.name, w.branch_type === 'matriz' ? ' (Matriz)' : ''] }, w.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Sucursal de destino *" }), _jsxs("select", { className: "w-full border rounded-md py-2 px-3 bg-background", value: destinationId, onChange: (e) => setDestinationId(e.target.value), children: [_jsx("option", { value: "", children: "-- Seleccione destino --" }), warehouses.filter(w => w.id !== sourceId).map(w => (_jsxs("option", { value: w.id, children: [w.name, w.branch_type === 'matriz' ? ' (Matriz)' : ''] }, w.id)))] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Agregar producto" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Input, { placeholder: "Buscar por nombre o SKU...", value: selectedProduct ? `${selectedProduct.name}` : productSearch, onChange: (e) => {
                                                                setSelectedProduct(null);
                                                                setProductSearch(e.target.value);
                                                                setShowProductDropdown(true);
                                                            }, onFocus: () => setShowProductDropdown(true), disabled: !sourceId }), showProductDropdown && !selectedProduct && productSearch && (_jsx("div", { className: "absolute z-50 mt-1 w-full bg-card border rounded-md shadow max-h-56 overflow-auto", children: filteredProducts.length === 0 ? (_jsx("div", { className: "p-2 text-sm text-muted-foreground", children: "Sin resultados" })) : (filteredProducts.map(p => (_jsxs("button", { type: "button", className: "w-full text-left px-3 py-2 hover:bg-muted text-sm", onClick: () => {
                                                                    setSelectedProduct(p);
                                                                    setShowProductDropdown(false);
                                                                }, children: [_jsx("span", { className: "font-medium", children: p.name }), p.sku && _jsx("span", { className: "text-muted-foreground ml-2 text-xs", children: p.sku })] }, p.id)))) }))] }), _jsx(Input, { type: "number", min: 1, className: "w-24", value: draftQuantity, onChange: (e) => setDraftQuantity(Number(e.target.value)) }), _jsx(Button, { type: "button", variant: "outline", onClick: addItem, disabled: !selectedProduct, children: _jsx("i", { className: "fas fa-plus" }) })] }), selectedProduct && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Stock disponible en origen: ", selectedProductStock === null ? '...' : selectedProductStock] }))] }), items.length > 0 && (_jsx("div", { className: "border rounded-md overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-muted/50", children: _jsxs("tr", { className: "text-left", children: [_jsx("th", { className: "py-2 px-3", children: "Producto" }), _jsx("th", { className: "py-2 px-3 text-right", children: "Cantidad" }), _jsx("th", { className: "py-2 px-3 text-right", children: "Disponible" }), _jsx("th", { className: "py-2 px-3" })] }) }), _jsx("tbody", { children: items.map(i => (_jsxs("tr", { className: "border-t", children: [_jsxs("td", { className: "py-2 px-3", children: [i.product_name, i.product_sku && _jsx("span", { className: "text-muted-foreground ml-2 text-xs", children: i.product_sku })] }), _jsx("td", { className: "py-2 px-3 text-right", children: i.quantity }), _jsx("td", { className: "py-2 px-3 text-right", children: i.available }), _jsx("td", { className: "py-2 px-3 text-right", children: _jsx("button", { type: "button", className: "text-red-500 hover:text-red-700", onClick: () => removeItem(i.product_id), children: _jsx("i", { className: "fas fa-trash" }) }) })] }, i.product_id))) })] }) })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Notas" }), _jsx(Input, { placeholder: "Notas (opcional)", value: notes, onChange: (e) => setNotes(e.target.value) })] })] }), _jsxs(DialogFooter, { className: "mt-4", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setIsFormOpen(false), children: "Cancelar" }), _jsx(Button, { type: "button", onClick: handleCreate, disabled: isSaving || items.length === 0, children: isSaving ? 'Guardando...' : 'Crear Transferencia' })] })] }) })] }));
};
export default Transfers;
