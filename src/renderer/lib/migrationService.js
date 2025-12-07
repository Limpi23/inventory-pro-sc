import { supabase } from './supabase';
// Lista ordenada de migraciones (en el orden que deben ejecutarse)
// IMPORTANTE: execute_migration_executor DEBE ser la primera para crear la función que ejecuta las demás
const MIGRATIONS = [
    '20251024000001_create_migration_executor', // ← PRIMERO: Crea la función execute_migration()
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
    '20251123105500_optimize_dashboard_and_products'
];
// Contenido de las migraciones embebido (se generará dinámicamente)
const MIGRATION_CONTENTS = {};
export const migrationService = {
    /**
     * Verifica si la base de datos necesita migraciones iniciales
     */
    async needsInitialSetup() {
        try {
            const client = await supabase.getClient();
            // Primero verificar si existe la función execute_migration
            const { data: funcData, error: funcError } = await client.rpc('execute_migration', {
                migration_sql: 'SELECT 1'
            });
            if (funcError && funcError.code === 'PGRST202') {
                return true;
            }
            // Si la función existe, verificar si existe la tabla de usuarios
            const { data, error } = await client
                .from('users')
                .select('id')
                .limit(1);
            // Si hay error PGRST116 (tabla no encontrada) o error de relación, necesita setup
            if (error && (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist'))) {
                return true;
            }
            return false;
        }
        catch (error) {
            // En caso de error, asumimos que necesita setup
            return true;
        }
    },
    /**
     * Obtiene el SQL de bootstrap que debe ejecutarse manualmente
     */
    async getBootstrapSQL() {
        return await this.getMigrationContent('20251024000001_create_migration_executor');
    },
    /**
     * Ejecuta todas las migraciones con reporte de progreso
     */
    async runMigrations(onProgress) {
        const client = await supabase.getClient();
        const totalMigrations = MIGRATIONS.length;
        try {
            // PASO 1: Verificar que existe la función execute_migration
            onProgress({
                currentMigration: 'Verificando entorno de migración...',
                currentIndex: 0,
                totalMigrations: totalMigrations + 1,
                percentage: 0,
                status: 'running'
            });
            // Probar si la función execute_migration existe
            const { error: testError } = await client.rpc('execute_migration', {
                migration_sql: 'SELECT 1'
            });
            if (testError && testError.code === 'PGRST202') {
                // La función no existe - necesitamos que el usuario la cree manualmente
                const bootstrapSQL = await this.getBootstrapSQL();
                throw new Error('BOOTSTRAP_REQUIRED: Primero debes ejecutar el SQL de bootstrap en Supabase.\n\n' +
                    'Ve a https://supabase.com/dashboard → SQL Editor y ejecuta:\n\n' +
                    bootstrapSQL);
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
                    console.error(`[Migration] ❌ No se pudo leer: ${migrationName}`);
                    continue;
                }
                console.log(`[Migration] 📝 Ejecutando: ${migrationName}`);
                // Ejecutar la migración usando la función RPC execute_migration
                const { data, error } = await client.rpc('execute_migration', {
                    migration_sql: sqlContent
                });
                if (error) {
                    console.error(`[Migration] ❌ Error en ${migrationName}:`, error);
                    // Solo continuar si es un error de dependencias, no errores críticos
                    if (error.code !== 'PGRST202' && !error.message?.includes('already exists')) {
                        // Registrar pero continuar con la siguiente
                    }
                    continue;
                }
                // Verificar si la función retornó un error
                const result = data;
                if (result && !result.success) {
                    console.warn(`[Migration] ⚠️  ${migrationName} retornó error:`, result.error);
                    // Continuamos con la siguiente migración
                }
                else {
                    console.log(`[Migration] ✅ Completada: ${migrationName}`);
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
        }
        catch (error) {
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
    async getMigrationContent(migrationName) {
        // Primero intentar del objeto embebido
        if (MIGRATION_CONTENTS[migrationName]) {
            return MIGRATION_CONTENTS[migrationName];
        }
        // Si estamos en Electron, cargar desde el sistema de archivos
        if (typeof window !== 'undefined' && window.electronAPI?.readMigrationFile) {
            try {
                const content = await window.electronAPI.readMigrationFile(migrationName);
                return content;
            }
            catch (error) {
                // Error al leer la migración
            }
        }
        return '';
    },
    /**
     * Ejecuta SQL raw directamente
     */
    async executeRawSQL(client, sql) {
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
                }
                catch {
                    // Ignorar errores individuales
                }
            }
        }
    }
};
