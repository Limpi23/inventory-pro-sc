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
  }
};

// Tipos basados en el esquema de la base de datos
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
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

// Servicios para interactuar con Supabase
export const productService = {
  getAll: async (): Promise<Product[]> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*');
    if (error) throw error;
    return data || [];
  },
  
  getById: async (id: string): Promise<Product | null> => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
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
    return data;
  },
  
  delete: async (id: string): Promise<void> => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Puedes agregar servicios similares para las demás tablas
export const categoryService = {
  // Implementación similar a productService
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

// ...otros servicios 