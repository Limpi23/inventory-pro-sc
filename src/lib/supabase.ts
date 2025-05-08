import { createClient } from '@supabase/supabase-js';
import { CategoryInput, ProductInput, WarehouseInput } from '../types';

// Estas URL y clave deberían estar en variables de entorno en producción 
// Para desarrollo local, puedes obtener estos valores de tu Supabase local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Crear el cliente de Supabase con caché forzada
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-cache-control': 'no-cache' }
  }
});

// Funciones de utilidad para el manejo de categorías
export const categoriesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  },
  
  async getById(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async create(category: CategoryInput) {
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async update(id: string, category: Partial<CategoryInput>) {
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async delete(id: string) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },
  
  async exportToCSV(): Promise<string> {
    const categories = await this.getAll();
    
    // Crear encabezado CSV
    let csvContent = "Nombre,Descripción\n";
    
    // Añadir filas para cada categoría
    categories.forEach(category => {
      // Escapar comillas y manejar campos vacíos
      const name = category.name.includes(',') ? `"${category.name}"` : category.name;
      const description = category.description 
        ? (category.description.includes(',') ? `"${category.description}"` : category.description)
        : '';
      
      csvContent += `${name},${description}\n`;
    });
    
    return csvContent;
  },
  
  async importFromCSV(fileContent: string): Promise<{ success: number; errors: number; messages: string[] }> {
    const lines = fileContent.split('\n');
    // Eliminar línea de encabezado y líneas vacías
    const dataLines = lines.slice(1).filter(line => line.trim() !== '');
    
    const categories: CategoryInput[] = [];
    const errorMessages: string[] = [];
    
    // Procesar cada línea del archivo CSV
    for (let i = 0; i < dataLines.length; i++) {
      try {
        const line = dataLines[i].trim();
        const [name, description = ''] = line.split(',').map(item => item.trim().replace(/^"|"$/g, ''));
        
        if (!name) {
          errorMessages.push(`Fila ${i + 2}: El nombre de categoría es obligatorio`);
          continue;
        }
        
        categories.push({
          name,
          description: description || undefined
        });
      } catch (error) {
        errorMessages.push(`Error al procesar fila ${i + 2}: ${error instanceof Error ? error.message : 'Formato inválido'}`);
      }
    }
    
    // Si no hay categorías válidas para importar
    if (categories.length === 0) {
      return {
        success: 0,
        errors: dataLines.length,
        messages: ['No se encontraron categorías válidas para importar', ...errorMessages]
      };
    }
    
    // Insertar categorías en lotes
    const batchSize = 50;
    let successCount = 0;
    
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert(batch)
          .select();
        
        if (error) throw error;
        if (data) successCount += data.length;
      } catch (error: any) {
        if (error.code === '23505') { // código de error para violación de restricción única
          errorMessages.push(`Algunas categorías no se pudieron importar porque ya existen`);
        } else {
          errorMessages.push(`Error al importar lote: ${error.message || 'Error desconocido'}`);
        }
      }
    }
    
    return {
      success: successCount,
      errors: dataLines.length - successCount,
      messages: errorMessages
    };
  }
};

// Funciones de utilidad para el manejo de almacenes
export const warehousesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  },
  
  async getById(id: string) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async create(warehouse: WarehouseInput) {
    const { data, error } = await supabase
      .from('warehouses')
      .insert([warehouse])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async update(id: string, warehouse: Partial<WarehouseInput>) {
    const { data, error } = await supabase
      .from('warehouses')
      .update(warehouse)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async delete(id: string) {
    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
};

// Funciones de utilidad para el manejo de productos
export const productsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name)
      `)
      .order('name');
    
    if (error) throw error;
    return data;
  },
  
  async getById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByCategory(categoryId: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name)
      `)
      .eq('category_id', categoryId)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  async search(query: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name)
      `)
      .or(`name.ilike.%${query}%, sku.ilike.%${query}%, barcode.ilike.%${query}%`)
      .order('name');
    
    if (error) throw error;
    return data;
  },
  
  async create(product: ProductInput) {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async createBatch(products: ProductInput[]) {
    if (!products.length) return [];
    
    // Supabase tiene un límite de 1000 filas por inserción, por lo que dividimos el array si es necesario
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
        
        if (error) throw error;
        if (data) results.push(...data);
      } catch (error) {
        errors.push(error);
        console.error(`Error al insertar lote ${i / batchSize + 1}:`, error);
      }
    }
    
    if (errors.length) {
      console.warn(`Se completó con ${errors.length} errores. Se insertaron ${results.length} de ${products.length} productos.`);
    }
    
    return results;
  },
  
  async update(id: string, product: Partial<ProductInput>) {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async delete(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
}; 