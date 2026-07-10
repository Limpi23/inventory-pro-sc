import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './auth';
import { warehousesService, supabase } from './supabase';
// Valor especial para "todas las sucursales" (solo matriz/admin)
export const ALL_BRANCHES = 'all';
const BranchContext = createContext(undefined);
const storageKey = (userId) => `active_branch:${userId}`;
export const BranchProvider = ({ children }) => {
    const { user } = useAuth();
    const [warehouses, setWarehouses] = useState([]);
    const [assignedWarehouseId, setAssignedWarehouseId] = useState(null);
    const [activeBranchId, setActiveBranchId] = useState(ALL_BRANCHES);
    const [loading, setLoading] = useState(true);
    const roleName = (user?.role_name || '').toLowerCase();
    const isAdmin = roleName.includes('admin') || user?.role_id === 1;
    // Un usuario no-admin con sucursal asignada queda restringido a ella
    const isLocked = !isAdmin && !!assignedWarehouseId;
    const loadWarehouses = async () => {
        try {
            const data = await warehousesService.getAll();
            setWarehouses((data || []).filter((w) => w.is_active !== false));
        }
        catch (e) {
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
            let assigned = user.warehouse_id || null;
            if (!assigned) {
                try {
                    const client = await supabase.getClient();
                    const { data } = await client
                        .from('users')
                        .select('warehouse_id')
                        .eq('id', user.id)
                        .maybeSingle();
                    assigned = data?.warehouse_id || null;
                }
                catch {
                    assigned = null;
                }
            }
            if (cancelled)
                return;
            setAssignedWarehouseId(assigned);
            if (assigned && !isAdmin) {
                setActiveBranchId(assigned);
            }
            else {
                const saved = localStorage.getItem(storageKey(user.id));
                setActiveBranchId(saved || assigned || ALL_BRANCHES);
            }
            setLoading(false);
        };
        init();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);
    const setActiveBranch = (warehouseId) => {
        if (isLocked)
            return;
        setActiveBranchId(warehouseId);
        if (user) {
            localStorage.setItem(storageKey(user.id), warehouseId);
        }
    };
    const activeBranch = useMemo(() => warehouses.find(w => w.id === activeBranchId) || null, [warehouses, activeBranchId]);
    return (_jsx(BranchContext.Provider, { value: {
            warehouses,
            activeBranchId,
            activeBranch,
            isLocked,
            isAllView: activeBranchId === ALL_BRANCHES,
            loading,
            setActiveBranch,
            refreshWarehouses: loadWarehouses
        }, children: children }));
};
export const useBranch = () => {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch debe ser usado dentro de un BranchProvider');
    }
    return context;
};
