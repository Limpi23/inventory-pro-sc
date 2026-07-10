import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase, stockTransfersService, stockMovementService, StockTransfer } from '../lib/supabase';
import { useBranch, ALL_BRANCHES } from '../lib/branch';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

interface ProductOption {
  id: string;
  name: string;
  sku?: string;
}

interface DraftItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  available: number;
}

const STATUS_LABELS: Record<string, { text: string; className: string; icon: string }> = {
  pending: { text: 'Pendiente', className: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock' },
  in_transit: { text: 'En tránsito', className: 'bg-blue-100 text-blue-800', icon: 'fa-truck' },
  received: { text: 'Recibida', className: 'bg-green-100 text-green-800', icon: 'fa-check-circle' },
  cancelled: { text: 'Cancelada', className: 'bg-red-100 text-red-800', icon: 'fa-times-circle' },
};

const Transfers: React.FC = () => {
  const { user } = useAuth();
  const { warehouses, activeBranchId, isAllView, isLocked } = useBranch();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockTransfer | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Formulario de nueva transferencia
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [selectedProductStock, setSelectedProductStock] = useState<number | null>(null);

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
          if (error) throw error;
          setProducts((data as ProductOption[]) || []);
        } catch (e: any) {
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
    } else {
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
    } catch (e: any) {
      // Tabla inexistente → migración pendiente
      if (/stock_transfers/.test(e.message || '')) {
        toast.error('La base de datos no tiene la migración de transferencias. Ejecute las migraciones desde el menú.');
      } else {
        toast.error('Error al cargar transferencias: ' + e.message);
      }
      setTransfers([]);
    } finally {
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

  const removeItem = (productId: string) => {
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
    } catch (e: any) {
      toast.error(e.message || 'Error al crear la transferencia');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShip = async (transfer: StockTransfer) => {
    if (!confirm(`¿Enviar la transferencia ${transfer.transfer_number}? Se descontará el stock del origen.`)) return;
    try {
      setActionInProgress(transfer.id);
      await stockTransfersService.ship(transfer.id, user?.id);
      toast.success('Transferencia enviada (en tránsito)');
      fetchTransfers();
      if (expandedId === transfer.id) loadDetail(transfer.id);
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReceive = async (transfer: StockTransfer) => {
    if (!confirm(`¿Confirmar recepción de ${transfer.transfer_number}? El stock ingresará a la sucursal destino.`)) return;
    try {
      setActionInProgress(transfer.id);
      await stockTransfersService.receive(transfer.id, user?.id);
      toast.success('Transferencia recibida');
      fetchTransfers();
      if (expandedId === transfer.id) loadDetail(transfer.id);
    } catch (e: any) {
      toast.error(e.message || 'Error al recibir');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancel = async (transfer: StockTransfer) => {
    if (!confirm(`¿Cancelar la transferencia ${transfer.transfer_number}?`)) return;
    try {
      setActionInProgress(transfer.id);
      await stockTransfersService.cancel(transfer.id, user?.id);
      toast.success('Transferencia cancelada');
      fetchTransfers();
    } catch (e: any) {
      toast.error(e.message || 'Error al cancelar');
    } finally {
      setActionInProgress(null);
    }
  };

  const loadDetail = async (transferId: string) => {
    try {
      const data = await stockTransfersService.getById(transferId);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  };

  const toggleDetail = (transferId: string) => {
    if (expandedId === transferId) {
      setExpandedId(null);
      setDetail(null);
    } else {
      setExpandedId(transferId);
      setDetail(null);
      loadDetail(transferId);
    }
  };

  // Un usuario restringido solo opera desde/hacia su sucursal
  const canShip = (t: StockTransfer) => !isLocked || t.source_warehouse_id === activeBranchId;
  const canReceive = (t: StockTransfer) => !isLocked || t.destination_warehouse_id === activeBranchId;

  const filteredProducts = products.filter(p =>
    productSearch === '' ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleString() : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Transferencias entre Sucursales</h1>
          <p className="text-muted-foreground text-sm">
            Envíe mercancía de una sucursal a otra con confirmación de recepción.
          </p>
        </div>
        <Button onClick={openForm}>
          <i className="fas fa-plus mr-2"></i>
          Nueva Transferencia
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Estado:</label>
        <select
          className="border rounded-md py-1.5 px-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="in_transit">En tránsito</option>
          <option value="received">Recibidas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-card rounded-md shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No hay transferencias registradas
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map(t => {
                  const st = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
                  return (
                    <React.Fragment key={t.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => toggleDetail(t.id)}
                            title="Ver detalle"
                          >
                            {t.transfer_number}
                          </button>
                        </TableCell>
                        <TableCell>{t.source_warehouse?.name || '-'}</TableCell>
                        <TableCell>{t.destination_warehouse?.name || '-'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${st.className}`}>
                            <i className={`fas ${st.icon} mr-1`}></i>
                            {st.text}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(t.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {t.status === 'pending' && canShip(t) && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleShip(t)}
                                disabled={actionInProgress === t.id}
                              >
                                <i className="fas fa-truck mr-1"></i> Enviar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleCancel(t)}
                                disabled={actionInProgress === t.id}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {t.status === 'in_transit' && canReceive(t) && (
                            <Button
                              size="sm"
                              onClick={() => handleReceive(t)}
                              disabled={actionInProgress === t.id}
                            >
                              <i className="fas fa-check mr-1"></i> Recibir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedId === t.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/40">
                            {!detail ? (
                              <div className="py-3 text-sm text-muted-foreground">Cargando detalle...</div>
                            ) : (
                              <div className="py-2 space-y-2">
                                <div className="text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <span><strong>Enviada:</strong> {formatDate(detail.shipped_at)}</span>
                                  <span><strong>Recibida:</strong> {formatDate(detail.received_at)}</span>
                                  {detail.notes && <span><strong>Notas:</strong> {detail.notes}</span>}
                                </div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="py-1">Producto</th>
                                      <th className="py-1">SKU</th>
                                      <th className="py-1 text-right">Cantidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(detail.items || []).map(item => (
                                      <tr key={item.id} className="border-t">
                                        <td className="py-1">{item.product?.name || item.product_id}</td>
                                        <td className="py-1">{item.product?.sku || '-'}</td>
                                        <td className="py-1 text-right">{item.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de nueva transferencia */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && setIsFormOpen(false)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Nueva Transferencia</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sucursal de origen *</label>
                <select
                  className="w-full border rounded-md py-2 px-3 bg-background disabled:opacity-70"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  disabled={isLocked}
                >
                  <option value="">-- Seleccione origen --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.branch_type === 'matriz' ? ' (Matriz)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sucursal de destino *</label>
                <select
                  className="w-full border rounded-md py-2 px-3 bg-background"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                >
                  <option value="">-- Seleccione destino --</option>
                  {warehouses.filter(w => w.id !== sourceId).map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.branch_type === 'matriz' ? ' (Matriz)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Agregar producto</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Buscar por nombre o SKU..."
                    value={selectedProduct ? `${selectedProduct.name}` : productSearch}
                    onChange={(e) => {
                      setSelectedProduct(null);
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    disabled={!sourceId}
                  />
                  {showProductDropdown && !selectedProduct && productSearch && (
                    <div className="absolute z-50 mt-1 w-full bg-card border rounded-md shadow max-h-56 overflow-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">Sin resultados</div>
                      ) : (
                        filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowProductDropdown(false);
                            }}
                          >
                            <span className="font-medium">{p.name}</span>
                            {p.sku && <span className="text-muted-foreground ml-2 text-xs">{p.sku}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={draftQuantity}
                  onChange={(e) => setDraftQuantity(Number(e.target.value))}
                />
                <Button type="button" variant="outline" onClick={addItem} disabled={!selectedProduct}>
                  <i className="fas fa-plus"></i>
                </Button>
              </div>
              {selectedProduct && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stock disponible en origen: {selectedProductStock === null ? '...' : selectedProductStock}
                </p>
              )}
            </div>

            {items.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3 text-right">Disponible</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.product_id} className="border-t">
                        <td className="py-2 px-3">
                          {i.product_name}
                          {i.product_sku && <span className="text-muted-foreground ml-2 text-xs">{i.product_sku}</span>}
                        </td>
                        <td className="py-2 px-3 text-right">{i.quantity}</td>
                        <td className="py-2 px-3 text-right">{i.available}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeItem(i.product_id)}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <Input
                placeholder="Notas (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={isSaving || items.length === 0}>
              {isSaving ? 'Guardando...' : 'Crear Transferencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transfers;
