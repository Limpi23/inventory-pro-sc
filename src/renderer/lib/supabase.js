import { createClient } from '@supabase/supabase-js';
// Cliente Supabase
let supabaseInstance = null;
export const getSupabaseClient = async () => {
    if (supabaseInstance)
        return supabaseInstance;
    // Intentar obtener credenciales desde electron-store primero (configuración guardada por el usuario)
    let supabaseUrl;
    let supabaseKey;
    // En ambiente Electron, usar la configuración guardada
    const win = typeof window !== 'undefined' ? window : {};
    if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
        try {
            const config = await win.supabaseConfig.get();
            if (config?.url && config?.anonKey) {
                supabaseUrl = config.url;
                supabaseKey = config.anonKey;
            }
        }
        catch (e) {
            console.warn('[getSupabaseClient] Error obteniendo configuración de electron-store:', e);
        }
    }
    // Fallback a variables de entorno si no hay configuración guardada
    if (!supabaseUrl || !supabaseKey) {
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Faltan credenciales de Supabase');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
    return supabaseInstance;
};
// Función para reinicializar el cliente (útil después de cambiar credenciales)
export const reinitializeSupabaseClient = () => {
    supabaseInstance = null;
};
export const supabase = {
    getClient: getSupabaseClient,
    reinitialize: reinitializeSupabaseClient
};
// Helper para logs
export const logAppEvent = async (action, entity, entityId, details) => {
    try {
        const client = await getSupabaseClient();
        const { data: { user } } = await client.auth.getUser();
        await client.from('app_events').insert({
            action,
            entity,
            entity_id: entityId,
            details,
            actor_id: user?.id,
            actor_email: user?.email
        });
    }
    catch (e) {
        console.error('Error logging event:', e);
    }
};
// Cache para tipos de movimiento
const movementTypeCache = new Map();
// Servicios
export const productService = {
    getAll: async () => {
        return productService.getAllAll();
    },
    getAllAll: async (batchSize = 1000) => {
        const results = [];
        let offset = 0;
        while (true) {
            const page = await productService.getRange(offset, offset + batchSize - 1);
            if (!page.length)
                break;
            results.push(...page);
            if (page.length < batchSize)
                break;
            offset += batchSize;
            await new Promise((r) => setTimeout(r, 0));
        }
        return results;
    },
    getRange: async (from, to) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .order('name')
            .range(from, to);
        if (error)
            throw error;
        return data || [];
    },
    getProducts: async ({ page = 1, pageSize = 10, search = '', warehouseId = '', locationId = '' }) => {
        const client = await getSupabaseClient();
        let query = client
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`, { count: 'exact' });
        if (search) {
            query = query.or(`name.ilike.%${search}%, sku.ilike.%${search}%, barcode.ilike.%${search}%`);
        }
        if (warehouseId && warehouseId !== 'all') {
            query = query.eq('warehouse_id', warehouseId);
        }
        if (locationId && locationId !== 'all') {
            query = query.eq('location_id', locationId);
        }
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query
            .order('name')
            .range(from, to);
        if (error)
            throw error;
        return { data: data || [], count: count || 0 };
    },
    getById: async (id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (product) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('products')
            .insert([product])
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('product.create', 'product', data?.id ?? null, { name: data?.name, sku: data?.sku });
        return data;
    },
    createBatch: async (products) => {
        if (!products.length)
            return [];
        const client = await getSupabaseClient();
        const batchSize = 100;
        const results = [];
        const errors = [];
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            try {
                const { data, error } = await client
                    .from('products')
                    .insert(batch)
                    .select();
                if (error)
                    throw error;
                if (data)
                    results.push(...data);
            }
            catch (e) {
                errors.push(e);
            }
        }
        await logAppEvent('product.create_batch', 'product', null, { count: results.length, errors: errors.length });
        return results;
    },
    update: async (id, updates) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('product.update', 'product', id, { updates });
        return data;
    },
    delete: async (id) => {
        const client = await getSupabaseClient();
        const { error } = await client
            .from('products')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('product.delete', 'product', id, null);
    },
    search: async (query) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .or(`name.ilike.%${query}%, sku.ilike.%${query}%, barcode.ilike.%${query}%`)
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getLowStockProducts: async ({ page = 1, pageSize = 10, search = '', threshold = 0 }) => {
        const client = await getSupabaseClient();
        let query = client
            .from('current_stock')
            .select('product_id, product_name, sku, warehouse_name, current_quantity', { count: 'exact' })
            .lte('current_quantity', threshold);
        if (search) {
            query = query.or(`product_name.ilike.%${search}%, sku.ilike.%${search}%`);
        }
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query
            .order('current_quantity', { ascending: true })
            .range(from, to);
        if (error)
            throw error;
        // Transformar los datos para mantener compatibilidad con el componente
        const transformedData = data?.map(item => ({
            current_quantity: item.current_quantity,
            warehouse_name: item.warehouse_name,
            product: {
                id: item.product_id,
                name: item.product_name,
                sku: item.sku,
                barcode: null,
                image_url: null
            }
        })) || [];
        return { data: transformedData, count: count || 0 };
    }
};
export const categoriesService = {
    getAll: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('categories')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('categories')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (category) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('categories')
            .insert([category])
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('category.create', 'category', data?.id ?? null, { name: data?.name });
        return data;
    },
    update: async (id, updates) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('category.update', 'category', id, { updates });
        return data;
    },
    delete: async (id) => {
        const client = await getSupabaseClient();
        const { error } = await client
            .from('categories')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('category.delete', 'category', id, null);
    },
    exportToCSV: async () => {
        const categories = await categoriesService.getAll();
        let csv = 'Nombre,Descripción\n';
        categories.forEach(c => {
            const name = c.name?.includes(',') ? `"${c.name}"` : c.name;
            const description = c.description ? (c.description.includes(',') ? `"${c.description}"` : c.description) : '';
            csv += `${name},${description}\n`;
        });
        await logAppEvent('category.export', 'category', null, { format: 'csv' });
        return csv;
    },
    exportToExcel: async () => {
        const XLSX = await import('xlsx');
        const categories = await categoriesService.getAll();
        const excelData = categories.map(c => ({
            'Nombre': c.name,
            'Descripción': c.description || ''
        }));
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Categorías');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        await logAppEvent('category.export', 'category', null, { format: 'excel' });
        return blob;
    },
    importFromCSV: async (fileContent) => {
        const lines = fileContent.split('\n');
        const dataLines = lines.slice(1).filter(l => l.trim() !== '');
        const categories = [];
        const errors = [];
        dataLines.forEach((line, idx) => {
            try {
                const [name, description = ''] = line.split(',').map(i => i.trim().replace(/^"|"$/g, ''));
                if (!name) {
                    errors.push(`Fila ${idx + 2}: nombre requerido`);
                    return;
                }
                categories.push({ name, description: description || undefined });
            }
            catch (e) {
                errors.push(`Fila ${idx + 2}: ${e.message || 'error'}`);
            }
        });
        if (!categories.length) {
            return { success: 0, errors: dataLines.length, messages: ['Sin categorías válidas', ...errors] };
        }
        const client = await getSupabaseClient();
        let successCount = 0;
        for (let i = 0; i < categories.length; i += 50) {
            const batch = categories.slice(i, i + 50);
            try {
                const { data, error } = await client
                    .from('categories')
                    .insert(batch)
                    .select();
                if (error)
                    throw error;
                if (data)
                    successCount += data.length;
            }
            catch (e) {
                if (e.code === '23505')
                    errors.push('Algunas categorías ya existían');
                else
                    errors.push(e.message || 'Error al importar lote');
            }
        }
        return { success: successCount, errors: errors.length, messages: errors };
    },
    importFromExcel: async (file) => {
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const categories = [];
            const errors = [];
            rows.forEach((row, idx) => {
                try {
                    // Adaptar según las columnas de tu Excel
                    const name = row['Nombre'] || row['nombre'] || row['Name'] || row['name'];
                    const description = row['Descripción'] || row['descripcion'] || row['Description'] || row['description'] || '';
                    if (!name) {
                        errors.push(`Fila ${idx + 2}: nombre requerido`);
                        return;
                    }
                    categories.push({ name, description });
                }
                catch (e) {
                    errors.push(`Fila ${idx + 2}: ${e.message || 'error'}`);
                }
            });
            if (!categories.length) {
                return { success: 0, errors: rows.length, messages: ['Sin categorías válidas', ...errors] };
            }
            const client = await getSupabaseClient();
            let successCount = 0;
            for (let i = 0; i < categories.length; i += 50) {
                const batch = categories.slice(i, i + 50);
                try {
                    const { data, error } = await client
                        .from('categories')
                        .insert(batch)
                        .select();
                    if (error)
                        throw error;
                    if (data)
                        successCount += data.length;
                }
                catch (e) {
                    if (e.code === '23505')
                        errors.push('Algunas categorías ya existían');
                    else
                        errors.push(e.message || 'Error al importar lote');
                }
            }
            return { success: successCount, errors: errors.length, messages: errors };
        }
        catch (e) {
            return { success: 0, errors: 1, messages: [e.message || 'Error al leer el archivo Excel'] };
        }
    }
};
export const warehousesService = {
    getAll: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('warehouses')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('warehouses')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (warehouse) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('warehouses')
            .insert([warehouse])
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('warehouse.create', 'warehouse', data?.id ?? null, { name: data?.name });
        return data;
    },
    update: async (id, updates) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('warehouses')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('warehouse.update', 'warehouse', id, { updates });
        return data;
    },
    delete: async (id) => {
        const client = await getSupabaseClient();
        const { error } = await client
            .from('warehouses')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('warehouse.delete', 'warehouse', id, null);
    }
};
export const locationsService = {
    getAll: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('locations')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (location) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('locations')
            .insert([location])
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('location.create', 'location', data?.id ?? null, { name: data?.name, warehouse_id: data?.warehouse_id });
        return data;
    },
    update: async (id, updates) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('locations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        await logAppEvent('location.update', 'location', id, { updates });
        return data;
    },
    delete: async (id) => {
        const client = await getSupabaseClient();
        const { error } = await client
            .from('locations')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('location.delete', 'location', id, null);
    }
};
export const stockMovementService = {
    getAll: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('stock_movements')
            .select(`
        *,
        product:products(id, name, sku),
        warehouse:warehouses(id, name),
        movement_type:movement_types(id, code, description)
      `)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    getFiltered: async (filters) => {
        const client = await getSupabaseClient();
        let query = client
            .from('stock_movements')
            .select(`
        *,
        product:products(id, name, sku),
        warehouse:warehouses(id, name),
        movement_type:movement_types(id, code, description)
      `);
        if (filters.product_id)
            query = query.eq('product_id', filters.product_id);
        if (filters.warehouse_id)
            query = query.eq('warehouse_id', filters.warehouse_id);
        if (filters.location_id)
            query = query.eq('location_id', filters.location_id);
        if (filters.movement_type_id)
            query = query.eq('movement_type_id', filters.movement_type_id);
        if (filters.start_date)
            query = query.gte('movement_date', filters.start_date);
        if (filters.end_date)
            query = query.lte('movement_date', filters.end_date);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('stock_movements')
            .select(`
        *,
        product:products(id, name, sku),
        warehouse:warehouses(id, name),
        movement_type:movement_types(id, code, description)
      `)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (movement) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('stock_movements')
            .insert([movement])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    },
    createBatch: async (movements, opts) => {
        if (!movements.length)
            return 0;
        const client = await getSupabaseClient();
        const batchSize = opts?.chunkSize ?? 100;
        let created = 0;
        for (let i = 0; i < movements.length; i += batchSize) {
            const batch = movements.slice(i, i + batchSize);
            const { data, error } = await client.from('stock_movements').insert(batch).select('id');
            if (error)
                throw error;
            created += data?.length || 0;
            const processed = Math.min(i + batch.length, movements.length);
            opts?.onProgress?.(processed, movements.length);
            await new Promise((r) => setTimeout(r, 0));
        }
        return created;
    },
    getMovementTypes: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('movement_types')
            .select('*')
            .order('id');
        if (error)
            throw error;
        return data || [];
    },
    getInboundInitialTypeId: async () => {
        const types = await stockMovementService.getMovementTypes();
        const preferred = ['IN_INITIAL', 'IN_OPENING', 'IN_ADJUSTMENT', 'IN_PURCHASE'];
        for (const code of preferred) {
            const t = types.find((mt) => (mt.code || '').toUpperCase() === code);
            if (t)
                return t.id;
        }
        const anyInbound = types.find((mt) => (mt.code || '').toUpperCase().startsWith('IN_'));
        if (anyInbound)
            return anyInbound.id;
        if (types.length)
            return types[0].id;
        throw new Error('No hay tipos de movimiento configurados');
    },
    getMovementTypeIdByCode: async (code) => {
        const normalized = (code || '').trim().toUpperCase();
        if (!normalized) {
            throw new Error('Código de tipo de movimiento inválido');
        }
        const cacheKey = normalized;
        if (movementTypeCache.has(cacheKey)) {
            return movementTypeCache.get(cacheKey);
        }
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('movement_types')
            .select('id, code')
            .eq('code', normalized)
            .maybeSingle();
        if (error)
            throw error;
        if (!data?.id) {
            throw new Error(`No se encontró movement_type con código ${normalized}`);
        }
        movementTypeCache.set(cacheKey, data.id);
        return data.id;
    },
    getOutboundSaleTypeId: async () => stockMovementService.getMovementTypeIdByCode('OUT_SALE'),
    getCurrentStock: async (product_id, warehouse_id) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('current_stock')
            .select('current_quantity')
            .eq('product_id', product_id)
            .eq('warehouse_id', warehouse_id)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return 0;
            throw error;
        }
        return data?.current_quantity || 0;
    },
    getCurrentStockByLocation: async (product_id, warehouse_id) => {
        const client = await getSupabaseClient();
        let query = client.from('current_stock_by_location').select('*').eq('product_id', product_id);
        if (warehouse_id)
            query = query.eq('warehouse_id', warehouse_id);
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
    },
    getAllCurrentStock: async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('current_stock')
            .select('*')
            .order('product_name');
        if (error)
            throw error;
        return data || [];
    }
};
export const serialsService = {
    getByProductId: async (productId) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('product_serials')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    create: async (serial) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('product_serials')
            .insert([serial])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    },
    createMany: async (serials, opts) => {
        if (!serials.length)
            return [];
        const client = await getSupabaseClient();
        const batchSize = 50;
        const results = [];
        for (let i = 0; i < serials.length; i += batchSize) {
            const batch = serials.slice(i, i + batchSize);
            const { data, error } = await client
                .from('product_serials')
                .insert(batch)
                .select();
            if (error)
                throw error;
            if (data)
                results.push(...data);
            const processed = Math.min(i + batch.length, serials.length);
            opts?.onProgress?.(processed, serials.length);
        }
        return results;
    },
    updateStatus: async (id, status) => {
        const client = await getSupabaseClient();
        const { error } = await client
            .from('product_serials')
            .update({ status })
            .eq('id', id);
        if (error)
            throw error;
    },
    getBySerial: async (serialNumber) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('product_serials')
            .select('*')
            .eq('serial_code', serialNumber)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return data;
    },
};
export const eventLogService = {
    create: async (log) => {
        const client = await getSupabaseClient();
        const { data, error } = await client
            .from('app_events')
            .insert([{ ...log }])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    },
    list: async (opts) => {
        const client = await getSupabaseClient();
        let q = client.from('app_events').select('*');
        if (opts?.action)
            q = q.eq('action', opts.action);
        if (opts?.entity)
            q = q.eq('entity', opts.entity);
        if (opts?.tenant_id)
            q = q.eq('tenant_id', opts.tenant_id);
        if (opts?.from)
            q = q.gte('created_at', opts.from);
        if (opts?.to)
            q = q.lte('created_at', opts.to);
        if (opts?.search) {
            q = q.or(`actor_email.ilike.%${opts.search}%,action.ilike.%${opts.search}%,entity.ilike.%${opts.search}%,entity_id.ilike.%${opts.search}%`);
        }
        const { data, error } = await q.order('created_at', { ascending: false }).limit(opts?.limit ?? 500);
        if (error)
            throw error;
        return (data || []);
    }
};
export const maintenanceService = {
    resetOperationalData: async () => {
        const client = await getSupabaseClient();
        const tablesInOrder = [
            'return_items',
            'returns',
            'invoice_items',
            'invoices',
            'sales_order_items',
            'sales_orders',
            'purchase_receipts',
            'purchase_order_items',
            'purchase_orders',
            'inventory_count_items',
            'inventory_counts',
            'stock_movements',
            'product_serials',
            'products',
            'customers',
            'locations',
            'warehouses',
            'categories'
        ];
        for (const table of tablesInOrder) {
            try {
                await client
                    .from(table)
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
            }
            catch (error) {
                console.error(`Error limpiando tabla ${table}:`, error);
                throw error;
            }
        }
        await logAppEvent('maintenance.reset', 'maintenance', null, { tables: tablesInOrder });
    }
};
