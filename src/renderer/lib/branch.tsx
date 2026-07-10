import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useAuth } from './auth';
import { warehousesService, supabase, Warehouse } from './supabase';

// Valor especial para "todas las sucursales" (solo matriz/admin)
export const ALL_BRANCHES = 'all';

interface BranchContextType {
  /** Sucursales (almacenes) disponibles */
  warehouses: Warehouse[];
  /** Sucursal activa: id de warehouse o ALL_BRANCHES */
  activeBranchId: string;
  /** Warehouse activo (null cuando la vista es "todas") */
  activeBranch: Warehouse | null;
  /** true si el usuario está restringido a su sucursal asignada */
  isLocked: boolean;
  /** true cuando se están viendo todas las sucursales */
  isAllView: boolean;
  loading: boolean;
  setActiveBranch: (warehouseId: string) => void;
  refreshWarehouses: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const storageKey = (userId: string) => `active_branch:${userId}`;

export const BranchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [assignedWarehouseId, setAssignedWarehouseId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>(ALL_BRANCHES);
  const [loading, setLoading] = useState(true);

  const roleName = (user?.role_name || '').toLowerCase();
  const isAdmin = roleName.includes('admin') || user?.role_id === 1;
  // Un usuario no-admin con sucursal asignada queda restringido a ella
  const isLocked = !isAdmin && !!assignedWarehouseId;

  const loadWarehouses = async () => {
    try {
      const data = await warehousesService.getAll();
      setWarehouses((data || []).filter((w: any) => w.is_active !== false));
    } catch (e) {
      console.error('Error cargando sucursales:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!user) {
        setAssignedWarehouseId(null);
        setActiveBranchId(ALL_BRANCHES);
        setLoading(false);
        return;
      }
      setLoading(true);
      await loadWarehouses();

      // Obtener la sucursal asignada; la sesión puede no traerla (login antiguo),
      // así que se consulta de forma tolerante (la columna puede no existir aún).
      let assigned: string | null = user.warehouse_id || null;
      if (!assigned) {
        try {
          const client = await supabase.getClient();
          const { data } = await client
            .from('users')
            .select('warehouse_id')
            .eq('id', user.id)
            .maybeSingle();
          assigned = (data as any)?.warehouse_id || null;
        } catch {
          assigned = null;
        }
      }
      if (cancelled) return;
      setAssignedWarehouseId(assigned);

      if (assigned && !isAdmin) {
        setActiveBranchId(assigned);
      } else {
        const saved = localStorage.getItem(storageKey(user.id));
        setActiveBranchId(saved || assigned || ALL_BRANCHES);
      }
      setLoading(false);
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setActiveBranch = (warehouseId: string) => {
    if (isLocked) return;
    setActiveBranchId(warehouseId);
    if (user) {
      localStorage.setItem(storageKey(user.id), warehouseId);
    }
  };

  const activeBranch = useMemo(
    () => warehouses.find(w => w.id === activeBranchId) || null,
    [warehouses, activeBranchId]
  );

  return (
    <BranchContext.Provider value={{
      warehouses,
      activeBranchId,
      activeBranch,
      isLocked,
      isAllView: activeBranchId === ALL_BRANCHES,
      loading,
      setActiveBranch,
      refreshWarehouses: loadWarehouses
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch debe ser usado dentro de un BranchProvider');
  }
  return context;
};
