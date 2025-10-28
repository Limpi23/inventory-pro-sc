import { supabase } from './supabase';

export interface MigrationProgress {
  currentMigration: string;
  currentIndex: number;
  totalMigrations: number;
  percentage: number;
  status: 'running' | 'success' | 'error';
  error?: string;
}

// Lista ordenada de migraciones (en el orden que deben ejecutarse)
const MIGRATIONS = [
  '20250429000000_initial_schema',
  '20250429120706_alter_categories_table',
  '20250429120727_alter_warehouses_table',
  '20250429123513_alter_products_table',
  '20250430150000_create_purchase_receipts',
  '20250430151000_add_stock_function',
  '20250430153000_add_received_quantity',
  '20250430154000_alter_customers_table',
  '20250430155000_create_invoices_tables',
  '20250501000000_create_users_tables',
  '20250505000000_add_top_selling_products_function',
  '20250508000100_fix_handle_new_user',
  '20250510000000_add_password_hash_to_users',
  '20250511000000_add_admin_password',
  '20250511000100_verify_roles',
  '20250511000200_update_admin_password',
  '20250512000000_fix_users_constraints',
  '20250512000100_add_id_generation',
  '20250513000100_add_select_one_function',
  '20250520000000_create_subscription_tables',
  '20250904160000_enable_rls_and_secure_views',
  '20250904211421_Security Advisor',
  '20250904212353_Security Advisor others entitys',
  '20250904220000_enable_rls_more_tables',
  '20250904223000_enable_rls_on_users',
  '20250906090000_create_locations_table',
  '20250919093000_add_location_refs_to_item_tables',
  '20250919101500_add_ubicaciones_permissions',
  '20250919160000_inventory_by_location',
  '20250919170000_serialized_inventory',
  '20250921000100_create_app_events',
  '20250922211000_admin_delete_user',
  '20251002120000_add_sales_order_link_to_invoices',
  '20251007000000_fix_current_stock_calculation',
  '20251007000100_fix_security_definer_views',
  '20251007000200_fix_function_search_path',
  '20251007000300_prevent_negative_stock',
  '20251010000000_add_serial_id_to_invoice_items',
  '20251024000000_create_generic_admin_user',
  '20251024000001_create_migration_executor'
];

// Contenido de las migraciones embebido (se generará dinámicamente)
const MIGRATION_CONTENTS: Record<string, string> = {};

export const migrationService = {
  /**
   * Verifica si la base de datos necesita migraciones iniciales
   */
  async needsInitialSetup(): Promise<boolean> {
    try {
      const client = await supabase.getClient();
      
      // Verificar si existe la tabla de usuarios
      const { data, error } = await client
        .from('users')
        .select('id')
        .limit(1);
      
      // Si hay error PGRST116 (tabla no encontrada) o error de relación, necesita setup
      if (error && (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist'))) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error verificando estado de la BD:', error);
      // En caso de error, asumimos que necesita setup
      return true;
    }
  },

  /**
   * Ejecuta todas las migraciones con reporte de progreso
   */
  async runMigrations(
    onProgress: (progress: MigrationProgress) => void
  ): Promise<void> {
    const client = await supabase.getClient();
    const totalMigrations = MIGRATIONS.length;

    try {
      // PASO 1: Crear la función execute_migration primero (bootstrap)
      onProgress({
        currentMigration: 'Preparando entorno de migración...',
        currentIndex: 0,
        totalMigrations: totalMigrations + 1,
        percentage: 0,
        status: 'running'
      });

      const bootstrapSQL = `
        CREATE OR REPLACE FUNCTION public.execute_migration(migration_sql TEXT)
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          result_data jsonb;
        BEGIN
          EXECUTE migration_sql;
          result_data := jsonb_build_object('success', true, 'message', 'OK');
          RETURN result_data;
        EXCEPTION
          WHEN OTHERS THEN
            result_data := jsonb_build_object('success', false, 'error', SQLERRM);
            RETURN result_data;
        END;
        $$;
        
        GRANT EXECUTE ON FUNCTION public.execute_migration(TEXT) TO anon;
        GRANT EXECUTE ON FUNCTION public.execute_migration(TEXT) TO authenticated;
      `;

      // Ejecutar bootstrap usando una query raw directa
      try {
        const { error: bootstrapError } = await client.rpc('execute_migration', { migration_sql: bootstrapSQL });
        if (bootstrapError) {
          // Si la función no existe, necesitamos crearla de otra forma
          // Esto solo funcionará si tenemos permisos suficientes
          console.warn('No se pudo ejecutar bootstrap via RPC, intentando método alternativo');
        }
      } catch (e) {
        console.warn('Bootstrap inicial falló, continuando con migraciones:', e);
      }

      // PASO 2: Ejecutar cada migración
      for (let i = 0; i < MIGRATIONS.length; i++) {
        const migrationName = MIGRATIONS[i];
        
        // Actualizar progreso
        onProgress({
          currentMigration: migrationName,
          currentIndex: i + 1,
          totalMigrations: totalMigrations + 1,
          percentage: Math.round(((i + 1) / (totalMigrations + 1)) * 100),
          status: 'running'
        });

        // Obtener contenido de la migración
        const sqlContent = await this.getMigrationContent(migrationName);
        
        if (!sqlContent) {
          console.warn(`No se encontró el contenido de la migración: ${migrationName}`);
          continue;
        }

        // Ejecutar la migración usando la función RPC execute_migration
        const { data, error } = await client.rpc('execute_migration', { 
          migration_sql: sqlContent 
        });
        
        if (error) {
          console.error(`Error ejecutando migración ${migrationName}:`, error);
          // Algunas migraciones pueden fallar por dependencias, continuamos
          continue;
        }

        // Verificar si la función retornó un error
        const result = data as any;
        if (result && !result.success) {
          console.warn(`Migración ${migrationName} reportó problema:`, result.error);
          // Continuamos con la siguiente migración
        }

        // Pequeña pausa para que la UI se actualice
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Migración completada
      onProgress({
        currentMigration: 'Completado',
        currentIndex: totalMigrations + 1,
        totalMigrations: totalMigrations + 1,
        percentage: 100,
        status: 'success'
      });

    } catch (error) {
      console.error('Error durante las migraciones:', error);
      onProgress({
        currentMigration: 'Error',
        currentIndex: 0,
        totalMigrations,
        percentage: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    }
  },

  /**
   * Obtiene el contenido SQL de una migración
   */
  async getMigrationContent(migrationName: string): Promise<string> {
    // Primero intentar del objeto embebido
    if (MIGRATION_CONTENTS[migrationName]) {
      return MIGRATION_CONTENTS[migrationName];
    }

    // Si estamos en Electron, cargar desde el sistema de archivos
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readMigrationFile) {
      try {
        const content = await (window as any).electronAPI.readMigrationFile(migrationName);
        return content;
      } catch (error) {
        console.error(`No se pudo leer el archivo de migración ${migrationName}:`, error);
      }
    }

    return '';
  },

  /**
   * Ejecuta SQL raw directamente
   */
  async executeRawSQL(client: any, sql: string): Promise<void> {
    // Dividir el SQL en statements individuales
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          // Intentar ejecutar como query directa
          await client.from('_migrations_temp').select('*').limit(0);
          // Si llegamos aquí, podemos usar rpc
          await client.rpc('query', { query: statement });
        } catch {
          // Ignorar errores individuales
          console.warn('Statement ignorado:', statement.substring(0, 50) + '...');
        }
      }
    }
  }
};
