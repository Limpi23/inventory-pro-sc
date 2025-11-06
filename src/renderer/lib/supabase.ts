import { createClient } from '@supabase/supabase-js';

// Carga config desde el archivo guardado por la app y hace fallback a variables de entorno Vite
async function loadSupabaseConfig() {
  let saved: any = {};
  const win = window as any;
  if (win?.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
    try {
      saved = await win.supabaseConfig.get();
    } catch {
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
  const client = createClient(url as string, anonKey as string, {
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
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = {
  getClient: async () => {
    if (!supabaseInstance) {
      const { url, anonKey } = await loadSupabaseConfig();
      if (!url || !anonKey) {
        throw new Error('Supabase no configurado: faltan URL o anon key');
      }
      supabaseInstance = createClient(url as string, anonKey as string, {
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
  // Reinicializar el cliente con nuevas credenciales
  reinitialize: async () => {
    supabaseInstance = null; // Limpiar instancia existente
    return await supabase.getClient(); // Crear nueva instancia con credenciales actualizadas
  },
  // Compat: permite usar supabase.from('tabla') como antes
  from: (table: string) => {
    if (!supabaseInstance) {
      throw new Error('Supabase aún no inicializado. Usa await supabase.getClient() primero.');
    }
    return (supabaseInstance as any).from(table);
  }
};

const movementTypeCache = new Map<string, number>();

// Tipos basados en el esquema de la base de datos
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  location_id?: string;
  tracking_method?: 'standard' | 'serialized';
  min_stock?: number;
  max_stock?: number;
  purchase_price?: number;
  sale_price?: number;
  tax_rate?: number;
  status?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductSerial {
  id: string;
  product_id: string;
  serial_code: string;
  vin?: string | null;
  engine_number?: string | null;
  year?: number | null;
  color?: string | null;
  attributes?: any;
  status: 'in_stock' | 'reserved' | 'sold' | 'returned' | 'maintenance' | 'lost' | 'scrapped' | 'in_transit';
  warehouse_id?: string | null;
  location_id?: string | null;
  acquired_at?: string | null;
  sold_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_info?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  warehouse_id?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_info?: any;
  created_at?: string;
  updated_at?: string;
}

export interface MovementType {
  id: number;
  code: string;
  description?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id?: string | null;
  // Para productos serializados, movimiento por unidad
  serial_id?: string | null;
  quantity: number;
  movement_type_id: number;
  reference?: string;
  related_id?: string;
  movement_date: string;
  notes?: string;
  created_at?: string;
  created_by?: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  warehouse_id: string;
  order_date: string;
  status: string;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface SalesOrder {
  id: string;
  customer_id: string;
  warehouse_id: string;
  order_date: string;
  status: string;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface InventoryCount {
  id: string;
  warehouse_id: string;
  count_date: string;
  status: string;
  created_at?: string;
  performed_by?: string;
}

export interface InventoryCountItem {
  id: string;
  inventory_count_id: string;
  product_id: string;
  system_quantity: number;
  counted_quantity: number;
  difference?: number;
}

export interface PurchaseReceipt {
  id: string;
  purchase_order_id: string;
  purchase_order_item_id: string;
  product_id: string;
  quantity: number;
  warehouse_id: string;
  received_at: string;
  created_at: string;
  created_by?: string;
}

// Auditoría de eventos de aplicación
export interface AppEventLog {
  id?: string;
  created_at?: string;
  tenant_id?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string; // p.ej. "product.delete"
  entity?: string | null; // p.ej. "product"
  entity_id?: string | null;
  details?: any; // JSONB
}

// Helper centralizado para registrar eventos de aplicación sin romper el flujo si falla
export const logAppEvent = async (
  action: string,
  entity?: string | null,
  entity_id?: string | null,
  details?: any
) => {
  try {
    const client = await getSupabaseClient();
    const { data: udata } = await (client as any).auth.getUser();
    const user = (udata as any)?.user;
    const actor_id = user?.id ?? null;
    const actor_email = user?.email ?? null;
    await eventLogService.create({ action, entity: entity ?? null, entity_id: entity_id ?? null, details, actor_id, actor_email });
  } catch (e) {
    // No-op: nunca bloqueamos la UI por un fallo de logging
    /* swallow logging errors */
  }
};
// Servicios para interactuar con Supabase
export const productService = {
  getAll: async (): Promise<Product[]> => {
    // Usar getAllAll para evitar el límite de 1000 filas de Supabase
    return productService.getAllAll();
  },
  // Paginado para superar el límite de 1000 filas del API
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
  // Trae todos los productos en lotes (por defecto 1000)
  getAllAll: async (batchSize = 1000): Promise<Product[]> => {
    const results: Product[] = [];
    let offset = 0;
    while (true) {
      const page = await productService.getRange(offset, offset + batchSize - 1);
      if (!page.length) break;
      results.push(...page);
      if (page.length < batchSize) break;
      offset += batchSize;
      // Evitar bloqueos largos en UI
      await new Promise((r) => setTimeout(r, 0));
    }
    return results;
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

  getByCategory: async (categoryId: string): Promise<Product[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select(`*, category:categories(id, name), location:locations(id, name, warehouse_id)`) 
      .eq('category_id', categoryId)
      .order('name');
    if (error) throw error;
    return data || [];
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
  },
  
  create: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
  .from('products')
      .insert([product])
      .select()
      .single();
    
    if (error) throw error;
    // Log de creación
    await logAppEvent('product.create', 'product', (data as any)?.id ?? null, { name: (data as any)?.name, sku: (data as any)?.sku });
    return data;
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
  deleteMany: async (ids: string[]): Promise<number> => {
    if (!ids.length) return 0;
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .delete()
      .in('id', ids)
      .select('id');
    if (error) throw error;
    const count = data?.length || 0;
    await logAppEvent('product.delete_many', 'product', null, { count, ids });
    return count;
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
        /* batch insert error swallowed; aggregated below */
      }
    }
    // optionally handle aggregated errors via UI toast upstream
    await logAppEvent('product.create_batch', 'product', null, { count: results.length, errors: errors.length });
    return results;
  }
};

// Servicio básico de seriales
export const serialsService = {
  listInStockByProduct: async (productId: string, warehouseId?: string) => {
    const supabase = await getSupabaseClient();
    let query = supabase
      .from('current_serials_in_stock')
      .select('*')
      .eq('product_id', productId);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    const { data, error } = await query;
    if (error) throw error;
    return data as any[];
  },
  createMany: async (
    serials: Partial<ProductSerial>[],
    opts?: { chunkSize?: number; onProgress?: (processed: number, total: number) => void }
  ) => {
    if (!serials.length) return [];
    const supabase = await getSupabaseClient();
    const batchSize = opts?.chunkSize ?? 100;
    const results: ProductSerial[] = [];
    for (let i = 0; i < serials.length; i += batchSize) {
      const batch = serials.slice(i, i + batchSize);
      const { data, error } = await supabase.from('product_serials').insert(batch).select();
      if (error) throw error;
      if (data) {
        results.push(...(data as ProductSerial[]));
      }
      const processed = Math.min(i + batch.length, serials.length);
      opts?.onProgress?.(processed, serials.length);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return results;
  }
};

// Servicio de categorías
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
  exportToExcel: async (): Promise<Blob> => {
    const XLSX = await import('xlsx');
    const categories = await categoriesService.getAll();
    
    // Crear datos para Excel
    const excelData = categories.map(c => ({
      'Nombre': c.name,
      'Descripción': c.description || ''
    }));
    
    // Crear worksheet y workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categorías');
    
    // Generar archivo Excel como blob
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
    const result = { success: successCount, errors: dataLines.length - successCount, messages: errors };
    await logAppEvent('category.import', 'category', null, { ...result });
    return result;
  },
  importFromExcel: async (file: File): Promise<{ success: number; errors: number; messages: string[] }> => {
    const XLSX = await import('xlsx');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Leer la primera hoja
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          if (rows.length < 2) {
            resolve({ success: 0, errors: 0, messages: ['El archivo está vacío'] });
            return;
          }
          
          const categories: any[] = [];
          const errors: string[] = [];
          
          // Saltar la primera fila (encabezados) y procesar el resto
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const name = row[0] ? String(row[0]).trim() : '';
            const description = row[1] ? String(row[1]).trim() : '';
            
            if (!name) {
              errors.push(`Fila ${i + 1}: nombre requerido`);
              continue;
            }
            
            categories.push({ 
              name, 
              description: description || undefined 
            });
          }
          
          if (categories.length === 0) {
            resolve({ success: 0, errors: rows.length - 1, messages: ['Sin categorías válidas', ...errors] });
            return;
          }
          
          const supabase = await getSupabaseClient();
          let successCount = 0;
          
          // Insertar en lotes de 50
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
              if (e.code === '23505') {
                errors.push('Algunas categorías ya existían');
              } else {
                errors.push(e.message || 'Error al importar lote');
              }
            }
          }
          
          const result = { 
            success: successCount, 
            errors: categories.length - successCount, 
            messages: errors 
          };
          
          await logAppEvent('category.import', 'category', null, { ...result, format: 'excel' });
          resolve(result);
          
        } catch (error: any) {
          reject(new Error(error.message || 'Error al procesar el archivo Excel'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
      
      reader.readAsBinaryString(file);
    });
  }
};

// Servicio de almacenes
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

// Servicio de ubicaciones
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
  // Obtener todos los movimientos de stock
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
  
  // Obtener movimientos con filtros (por producto, almacén, tipo, fechas)
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
    
    if (error) throw error;
    return data || [];
  },
  
  // Obtener un movimiento por su ID
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
  
  // Crear un nuevo movimiento de stock (entrada o salida)
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
  
  // Crear movimientos en lote (para importaciones)
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
      // Ceder control al event loop para no bloquear UI en lotes grandes
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 0));
    }
    return created;
  },
  
  // Obtener los tipos de movimiento disponibles
  getMovementTypes: async (): Promise<MovementType[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('movement_types')
      .select('*')
      .order('id');
    
    if (error) throw error;
    return data || [];
  },
  // Helper: obtener movement_type_id para entradas iniciales
  getInboundInitialTypeId: async (): Promise<number> => {
    const types = await stockMovementService.getMovementTypes();
    // Preferencias por c3digo
    const preferred = ['IN_INITIAL', 'IN_OPENING', 'IN_ADJUSTMENT', 'IN_PURCHASE'];
    for (const code of preferred) {
      const t = types.find((mt) => (mt.code || '').toUpperCase() === code);
      if (t) return t.id;
    }
    // Si no hay coincidencia exacta, tomar el primer tipo de entrada (c3digo que empiece con IN_)
    const anyInbound = types.find((mt) => (mt.code || '').toUpperCase().startsWith('IN_'));
    if (anyInbound) return anyInbound.id;
    // Fallback extremo: primer tipo
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

  // Obtener el stock actual de un producto en un almacén específico
  getCurrentStock: async (product_id: string, warehouse_id: string): Promise<number> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('current_stock')
      .select('current_quantity')
      .eq('product_id', product_id)
      .eq('warehouse_id', warehouse_id)
      .single();
    
    if (error) {
      // Si no hay stock registrado, devolver 0
      if (error.code === 'PGRST116') return 0;
      throw error;
    }
    
    return data?.current_quantity || 0;
  },
  // Obtener el stock actual por ubicación
  getCurrentStockByLocation: async (product_id: string, warehouse_id?: string) => {
    const supabase = await getSupabaseClient();
    let query = supabase.from('current_stock_by_location').select('*').eq('product_id', product_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  
  // Obtener el stock actual de todos los productos
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

// Servicio de logs de eventos
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

// ...otros servicios 