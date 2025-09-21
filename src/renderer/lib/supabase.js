import { createClient } from '@supabase/supabase-js';
// Carga config desde el archivo guardado por la app y hace fallback a variables de entorno Vite
async function loadSupabaseConfig() {
    let saved = {};
    const win = window;
    if (win?.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
        try {
            saved = await win.supabaseConfig.get();
        }
        catch {
            // ignorar
        }
    }
    const url = saved?.url || saved?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const anonKey = saved?.anonKey || saved?.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
    return { url, anonKey };
}
// Cliente de Supabase dinámico según entorno
export const getSupabaseClient = async () => {
    const { url, anonKey } = await loadSupabaseConfig();
    if (!url || !anonKey) {
        throw new Error('Supabase no configurado: faltan URL o anon key');
    }
    const client = createClient(url, anonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        global: {
            headers: { 'x-cache-control': 'no-cache' }
        }
    });
    return client;
};
// Cliente de Supabase global
let supabaseInstance = null;
export const supabase = {
    getClient: async () => {
        if (!supabaseInstance) {
            const { url, anonKey } = await loadSupabaseConfig();
            if (!url || !anonKey) {
                throw new Error('Supabase no configurado: faltan URL o anon key');
            }
            supabaseInstance = createClient(url, anonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                },
                global: {
                    headers: { 'x-cache-control': 'no-cache' }
                }
            });
        }
        return supabaseInstance;
    },
    // Compat: permite usar supabase.from('tabla') como antes
    from: (table) => {
        if (!supabaseInstance) {
            throw new Error('Supabase aún no inicializado. Usa await supabase.getClient() primero.');
        }
        return supabaseInstance.from(table);
    }
};
// Helper centralizado para registrar eventos de aplicación sin romper el flujo si falla
export const logAppEvent = async (action, entity, entity_id, details) => {
    try {
        const client = await getSupabaseClient();
        const { data: udata } = await client.auth.getUser();
        const user = udata?.user;
        const actor_id = user?.id ?? null;
        const actor_email = user?.email ?? null;
        await eventLogService.create({ action, entity: entity ?? null, entity_id: entity_id ?? null, details, actor_id, actor_email });
    }
    catch (e) {
        // No-op: nunca bloqueamos la UI por un fallo de logging
        try {
            console.debug('[logAppEvent] fallo al registrar', action, e);
        }
        catch { }
    }
};
// Servicios para interactuar con Supabase
export const productService = {
    getAll: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    // Paginado para superar el límite de 1000 filas del API
    getRange: async (from, to) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .order('name')
            .range(from, to);
        if (error)
            throw error;
        return data || [];
    },
    // Trae todos los productos en lotes (por defecto 1000)
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
            // Evitar bloqueos largos en UI
            await new Promise((r) => setTimeout(r, 0));
        }
        return results;
    },
    getById: async (id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    getByCategory: async (categoryId) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .eq('category_id', categoryId)
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    search: async (query) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
            .or(`name.ilike.%${query}%, sku.ilike.%${query}%, barcode.ilike.%${query}%`)
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    create: async (product) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .insert([product])
            .select()
            .single();
        if (error)
            throw error;
        // Log de creación
        await logAppEvent('product.create', 'product', data?.id ?? null, { name: data?.name, sku: data?.sku });
        return data;
    },
    update: async (id, updates) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('product.delete', 'product', id, null);
    },
    deleteMany: async (ids) => {
        if (!ids.length)
            return 0;
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('products')
            .delete()
            .in('id', ids)
            .select('id');
        if (error)
            throw error;
        const count = data?.length || 0;
        await logAppEvent('product.delete_many', 'product', null, { count, ids });
        return count;
    },
    createBatch: async (products) => {
        if (!products.length)
            return [];
        const supabase = await getSupabaseClient();
        const batchSize = 100;
        const results = [];
        const errors = [];
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            try {
                const { data, error } = await supabase
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
                console.error('Error lote productos', e);
            }
        }
        if (errors.length) {
            console.warn(`Insertados ${results.length} con ${errors.length} errores`);
        }
        await logAppEvent('product.create_batch', 'product', null, { count: results.length, errors: errors.length });
        return results;
    }
};
// Servicio básico de seriales
export const serialsService = {
    listInStockByProduct: async (productId, warehouseId) => {
        const supabase = await getSupabaseClient();
        let query = supabase
            .from('current_serials_in_stock')
            .select('*')
            .eq('product_id', productId);
        if (warehouseId)
            query = query.eq('warehouse_id', warehouseId);
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    },
    createMany: async (serials) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.from('product_serials').insert(serials).select();
        if (error)
            throw error;
        return data;
    }
};
// Servicio de categorías
export const categoriesService = {
    getAll: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (category) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('category.delete', 'category', id, null);
    },
    exportToCSV: async () => {
        const categories = await (await categoriesService.getAll());
        let csv = 'Nombre,Descripción\n';
        categories.forEach(c => {
            const name = c.name?.includes(',') ? `"${c.name}"` : c.name;
            const description = c.description ? (c.description.includes(',') ? `"${c.description}"` : c.description) : '';
            csv += `${name},${description}\n`;
        });
        await logAppEvent('category.export', 'category', null, { format: 'csv' });
        return csv;
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
        const supabase = await getSupabaseClient();
        let successCount = 0;
        for (let i = 0; i < categories.length; i += 50) {
            const batch = categories.slice(i, i + 50);
            try {
                const { data, error } = await supabase
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
        const result = { success: successCount, errors: dataLines.length - successCount, messages: errors };
        await logAppEvent('category.import', 'category', null, { ...result });
        return result;
    }
};
// Servicio de almacenes
export const warehousesService = {
    getAll: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (warehouse) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { error } = await supabase
            .from('warehouses')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('warehouse.delete', 'warehouse', id, null);
    }
};
// Servicio de ubicaciones
export const locationsService = {
    getAll: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('name');
        if (error)
            throw error;
        return data || [];
    },
    getById: async (id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return data;
    },
    create: async (location) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
        const supabase = await getSupabaseClient();
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        await logAppEvent('location.delete', 'location', id, null);
    }
};
export const stockMovementService = {
    // Obtener todos los movimientos de stock
    getAll: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
    // Obtener movimientos con filtros (por producto, almacén, tipo, fechas)
    getFiltered: async (filters) => {
        const supabase = await getSupabaseClient();
        let query = supabase
            .from('stock_movements')
            .select(`
        *,
        product:products(id, name, sku),
        warehouse:warehouses(id, name),
        movement_type:movement_types(id, code, description)
      `);
        // Aplicar filtros si existen
        if (filters.product_id) {
            query = query.eq('product_id', filters.product_id);
        }
        if (filters.warehouse_id) {
            query = query.eq('warehouse_id', filters.warehouse_id);
        }
        if (filters.location_id) {
            query = query.eq('location_id', filters.location_id);
        }
        if (filters.movement_type_id) {
            query = query.eq('movement_type_id', filters.movement_type_id);
        }
        if (filters.start_date) {
            query = query.gte('movement_date', filters.start_date);
        }
        if (filters.end_date) {
            query = query.lte('movement_date', filters.end_date);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    },
    // Obtener un movimiento por su ID
    getById: async (id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
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
    // Crear un nuevo movimiento de stock (entrada o salida)
    create: async (movement) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('stock_movements')
            .insert([movement])
            .select()
            .single();
        if (error)
            throw error;
        return data;
    },
    // Obtener los tipos de movimiento disponibles
    getMovementTypes: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('movement_types')
            .select('*')
            .order('id');
        if (error)
            throw error;
        return data || [];
    },
    // Obtener el stock actual de un producto en un almacén específico
    getCurrentStock: async (product_id, warehouse_id) => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('current_stock')
            .select('current_quantity')
            .eq('product_id', product_id)
            .eq('warehouse_id', warehouse_id)
            .single();
        if (error) {
            // Si no hay stock registrado, devolver 0
            if (error.code === 'PGRST116')
                return 0;
            throw error;
        }
        return data?.current_quantity || 0;
    },
    // Obtener el stock actual por ubicación
    getCurrentStockByLocation: async (product_id, warehouse_id) => {
        const supabase = await getSupabaseClient();
        let query = supabase.from('current_stock_by_location').select('*').eq('product_id', product_id);
        if (warehouse_id)
            query = query.eq('warehouse_id', warehouse_id);
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
    },
    // Obtener el stock actual de todos los productos
    getAllCurrentStock: async () => {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from('current_stock')
            .select('*')
            .order('product_name');
        if (error)
            throw error;
        return data || [];
    }
};
// Servicio de logs de eventos
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
// ...otros servicios 
