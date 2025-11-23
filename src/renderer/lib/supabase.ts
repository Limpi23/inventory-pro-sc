import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Tipos
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  price: number;
  cost?: number;
  min_stock?: number;
  max_stock?: number;
  image_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  category?: Category;
  location?: Location;
  location_id?: string;
  warehouse_id?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Location {
  id: string;
  warehouse_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  warehouse?: Warehouse;
}

export interface MovementType {
  id: number;
  code: string;
  description: string;
  is_system: boolean;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id?: string;
  movement_type_id: number;
  quantity: number;
  reference?: string;
  notes?: string;
  movement_date: string;
  created_at?: string;
  created_by?: string;
  product?: Product;
  warehouse?: Warehouse;
  location?: Location;
  movement_type?: MovementType;
}

export interface ProductSerial {
  id: string;
  product_id: string;
  serial_number: string;
  status: 'available' | 'sold' | 'returned' | 'defective' | 'lost';
  purchase_order_id?: string;
  sales_order_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppEventLog {
  id?: string;
  created_at?: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: any;
  tenant_id?: string;
}

// Cliente Supabase
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = async () => {
  if (supabaseInstance) return supabaseInstance;

  // En una aplicación real, estas credenciales vendrían de variables de entorno
  // o de un proceso de configuración seguro.
  // Para este ejemplo, asumimos que están disponibles en window.env o similar
  // O usamos valores por defecto para desarrollo
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan credenciales de Supabase');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
};

// Helper para logs
const logAppEvent = async (action: string, entity: string, entityId: string | null, details: any) => {
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
  } catch (e) {
    console.error('Error logging event:', e);
  }
};

// Cache para tipos de movimiento
const movementTypeCache = new Map<string, number>();

// Servicios
export const productService = {
  getAll: async (): Promise<Product[]> => {
    return productService.getAllAll();
  },

  getAllAll: async (batchSize = 1000): Promise<Product[]> => {
    const results: Product[] = [];
    let offset = 0;
    while (true) {
      const page = await productService.getRange(offset, offset + batchSize - 1);
      if (!page.length) break;
      results.push(...page);
      if (page.length < batchSize) break;
      offset += batchSize;
      await new Promise((r) => setTimeout(r, 0));
    }
    return results;
  },

  getRange: async (from: number, to: number): Promise<Product[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
      .order('name')
      .range(from, to);
    if (error) throw error;
    return data || [];
  },

  getProducts: async ({ page = 1, pageSize = 10, search = '', warehouseId = '', locationId = '' }) => {
    const supabase = await getSupabaseClient();
    let query = supabase
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

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  getById: async (id: string): Promise<Product | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();

    if (error) throw error;
    await logAppEvent('product.create', 'product', (data as any)?.id ?? null, { name: (data as any)?.name, sku: (data as any)?.sku });
    return data;
  },

  createBatch: async (products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<Product[]> => {
    if (!products.length) return [];
    const supabase = await getSupabaseClient();
    const batchSize = 100;
    const results: Product[] = [];
    const errors: any[] = [];
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase
          .from('products')
          .insert(batch as any)
          .select();
        if (error) throw error;
        if (data) results.push(...(data as Product[]));
      } catch (e) {
        errors.push(e);
      }
    }
    await logAppEvent('product.create_batch', 'product', null, { count: results.length, errors: errors.length });
    return results;
  },

  update: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logAppEvent('product.update', 'product', id, { updates });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await logAppEvent('product.delete', 'product', id, null);
  },

  search: async (query: string): Promise<Product[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`)
      .or(`name.ilike.%${query}%, sku.ilike.%${query}%, barcode.ilike.%${query}%`)
      .order('name');
    if (error) throw error;
    return data || [];
  }
};

export const categoriesService = {
  getAll: async (): Promise<Category[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },
  getById: async (id: string): Promise<Category | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  create: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('category.create', 'category', (data as any)?.id ?? null, { name: (data as any)?.name });
    return data;
  },
  update: async (id: string, updates: Partial<Category>): Promise<Category> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('category.update', 'category', id, { updates });
    return data;
  },
  delete: async (id: string): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await logAppEvent('category.delete', 'category', id, null);
  },
  exportToCSV: async (): Promise<string> => {
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
  exportToExcel: async (): Promise<Blob> => {
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
  importFromCSV: async (fileContent: string): Promise<{ success: number; errors: number; messages: string[] }> => {
    const lines = fileContent.split('\n');
    const dataLines = lines.slice(1).filter(l => l.trim() !== '');
    const categories: any[] = [];
    const errors: string[] = [];
    dataLines.forEach((line, idx) => {
      try {
        const [name, description = ''] = line.split(',').map(i => i.trim().replace(/^"|"$/g, ''));
        if (!name) {
          errors.push(`Fila ${idx + 2}: nombre requerido`);
          return;
        }
        categories.push({ name, description: description || undefined });
      } catch (e: any) {
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
        if (error) throw error;
        if (data) successCount += data.length;
      } catch (e: any) {
        if (e.code === '23505') errors.push('Algunas categorías ya existían'); else errors.push(e.message || 'Error al importar lote');
      }
    }
    return { success: successCount, errors: errors.length, messages: errors };
  }
};

export const warehousesService = {
  getAll: async (): Promise<Warehouse[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },
  getById: async (id: string): Promise<Warehouse | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  create: async (warehouse: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>): Promise<Warehouse> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('warehouses')
      .insert([warehouse])
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('warehouse.create', 'warehouse', (data as any)?.id ?? null, { name: (data as any)?.name });
    return data;
  },
  update: async (id: string, updates: Partial<Warehouse>): Promise<Warehouse> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('warehouse.update', 'warehouse', id, { updates });
    return data;
  },
  delete: async (id: string): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await logAppEvent('warehouse.delete', 'warehouse', id, null);
  }
};

export const locationsService = {
  getAll: async (): Promise<Location[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },
  getById: async (id: string): Promise<Location | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  create: async (location: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<Location> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .insert([location])
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('location.create', 'location', (data as any)?.id ?? null, { name: (data as any)?.name, warehouse_id: (data as any)?.warehouse_id });
    return data;
  },
  update: async (id: string, updates: Partial<Location>): Promise<Location> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAppEvent('location.update', 'location', id, { updates });
    return data;
  },
  delete: async (id: string): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await logAppEvent('location.delete', 'location', id, null);
  }
};

export const stockMovementService = {
  getAll: async (): Promise<StockMovement[]> => {
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

    if (error) throw error;
    return data || [];
  },

  getFiltered: async (filters: {
    product_id?: string;
    warehouse_id?: string;
    location_id?: string;
    movement_type_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<StockMovement[]> => {
    const supabase = await getSupabaseClient();
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        product:products(id, name, sku),
        warehouse:warehouses(id, name),
        movement_type:movement_types(id, code, description)
      `);

    if (filters.product_id) query = query.eq('product_id', filters.product_id);
    if (filters.warehouse_id) query = query.eq('warehouse_id', filters.warehouse_id);
    if (filters.location_id) query = query.eq('location_id', filters.location_id);
    if (filters.movement_type_id) query = query.eq('movement_type_id', filters.movement_type_id);
    if (filters.start_date) query = query.gte('movement_date', filters.start_date);
    if (filters.end_date) query = query.lte('movement_date', filters.end_date);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<StockMovement | null> => {
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

    if (error) throw error;
    return data;
  },

  create: async (movement: Omit<StockMovement, 'id' | 'created_at'>): Promise<StockMovement> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('stock_movements')
      .insert([movement])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  createBatch: async (
    movements: Array<Omit<StockMovement, 'id' | 'created_at'>>,
    opts?: { chunkSize?: number; onProgress?: (processed: number, total: number) => void }
  ): Promise<number> => {
    if (!movements.length) return 0;
    const supa = await getSupabaseClient();
    const batchSize = opts?.chunkSize ?? 100;
    let created = 0;
    for (let i = 0; i < movements.length; i += batchSize) {
      const batch = movements.slice(i, i + batchSize);
      const { data, error } = await supa.from('stock_movements').insert(batch as any).select('id');
      if (error) throw error;
      created += data?.length || 0;
      const processed = Math.min(i + batch.length, movements.length);
      opts?.onProgress?.(processed, movements.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    return created;
  },

  getMovementTypes: async (): Promise<MovementType[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('movement_types')
      .select('*')
      .order('id');

    if (error) throw error;
    return data || [];
  },

  getInboundInitialTypeId: async (): Promise<number> => {
    const types = await stockMovementService.getMovementTypes();
    const preferred = ['IN_INITIAL', 'IN_OPENING', 'IN_ADJUSTMENT', 'IN_PURCHASE'];
    for (const code of preferred) {
      const t = types.find((mt) => (mt.code || '').toUpperCase() === code);
      if (t) return t.id;
    }
    const anyInbound = types.find((mt) => (mt.code || '').toUpperCase().startsWith('IN_'));
    if (anyInbound) return anyInbound.id;
    if (types.length) return types[0].id;
    throw new Error('No hay tipos de movimiento configurados');
  },

  getMovementTypeIdByCode: async (code: string): Promise<number> => {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) {
      throw new Error('Código de tipo de movimiento inválido');
    }
    const cacheKey = normalized;
    if (movementTypeCache.has(cacheKey)) {
      return movementTypeCache.get(cacheKey)!;
    }
    const supabaseClient = await getSupabaseClient();
    const { data, error } = await supabaseClient
      .from('movement_types')
      .select('id, code')
      .eq('code', normalized)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      throw new Error(`No se encontró movement_type con código ${normalized}`);
    }
    movementTypeCache.set(cacheKey, data.id);
    return data.id;
  },

  getOutboundSaleTypeId: async (): Promise<number> => stockMovementService.getMovementTypeIdByCode('OUT_SALE'),

  getCurrentStock: async (product_id: string, warehouse_id: string): Promise<number> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('current_stock')
      .select('current_quantity')
      .eq('product_id', product_id)
      .eq('warehouse_id', warehouse_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return 0;
      throw error;
    }

    return data?.current_quantity || 0;
  },

  getCurrentStockByLocation: async (product_id: string, warehouse_id?: string) => {
    const supabase = await getSupabaseClient();
    let query = supabase.from('current_stock_by_location').select('*').eq('product_id', product_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getAllCurrentStock: async (): Promise<any[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('current_stock')
      .select('*')
      .order('product_name');

    if (error) throw error;
    return data || [];
  }
};

export const serialsService = {
  getByProductId: async (productId: string): Promise<ProductSerial[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('product_serials')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  create: async (serial: Omit<ProductSerial, 'id' | 'created_at' | 'updated_at'>): Promise<ProductSerial> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('product_serials')
      .insert([serial])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  updateStatus: async (id: string, status: ProductSerial['status']): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('product_serials')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },
  getBySerial: async (serialNumber: string): Promise<ProductSerial | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('product_serials')
      .select('*')
      .eq('serial_number', serialNumber)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
};

export const eventLogService = {
  create: async (log: AppEventLog) => {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('app_events')
      .insert([{ ...log }])
      .select()
      .single();
    if (error) throw error;
    return data as AppEventLog;
  },
  list: async (opts?: { limit?: number; search?: string; action?: string; entity?: string; from?: string; to?: string; tenant_id?: string }) => {
    const client = await getSupabaseClient();
    let q = client.from('app_events').select('*');
    if (opts?.action) q = q.eq('action', opts.action);
    if (opts?.entity) q = q.eq('entity', opts.entity);
    if (opts?.tenant_id) q = q.eq('tenant_id', opts.tenant_id);
    if (opts?.from) q = q.gte('created_at', opts.from);
    if (opts?.to) q = q.lte('created_at', opts.to);
    if (opts?.search) {
      q = q.or(
        `actor_email.ilike.%${opts.search}%,action.ilike.%${opts.search}%,entity.ilike.%${opts.search}%,entity_id.ilike.%${opts.search}%`
      );
    }
    const { data, error } = await q.order('created_at', { ascending: false }).limit(opts?.limit ?? 500);
    if (error) throw error;
    return (data || []) as AppEventLog[];
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
      } catch (error: any) {
        console.error(`Error limpiando tabla ${table}:`, error);
        throw error;
      }
    }

    await logAppEvent('maintenance.reset', 'maintenance', null, { tables: tablesInOrder });
  }
};

export const supabase = {
  getClient: getSupabaseClient
};