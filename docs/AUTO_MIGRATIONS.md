# Sistema de Migraciones Automáticas

## 🎯 Descripción General

El sistema de migraciones automáticas permite que cada cliente que instale la aplicación pueda conectar su propia base de datos Supabase y configurarla automáticamente sin necesidad de conocimientos técnicos.

## ✨ Características

- ✅ **Detección automática** de bases de datos vacías
- ✅ **Ejecución automática** de todas las migraciones
- ✅ **Progreso visual en tiempo real** con porcentaje y migración actual
- ✅ **Usuario administrador genérico** creado automáticamente
- ✅ **Interfaz amigable** para el usuario final
- ✅ **Sin necesidad de CLI** o herramientas técnicas

## 🔄 Flujo Completo

### Para un Cliente Nuevo:

```
1. Instala la aplicación C.O.M.P.A
   ↓
2. Abre la aplicación (primera vez)
   ↓
3. Ve el modal de "Configurar conexión a Supabase"
   ↓
4. Ingresa:
   - URL de su proyecto Supabase
   - Anon Key de su proyecto
   ↓
5. Click en "Guardar y continuar"
   ↓
6. Sistema detecta que la BD está vacía
   ↓
7. Muestra pantalla de progreso con:
   - Barra de progreso animada
   - Porcentaje de avance
   - Nombre de la migración actual
   - Contador (migración X de Y)
   ↓
8. Ejecuta automáticamente ~40 migraciones
   ↓
9. Muestra mensaje de éxito con credenciales:
   - Email: admin@suitcore.com
   - Contraseña: Suitcore123
   ↓
10. Recarga la aplicación
   ↓
11. Cliente inicia sesión con las credenciales
   ↓
12. ¡Listo para usar! 🎉
```

## 📁 Estructura de Archivos

```
src/renderer/
├── lib/
│   └── migrationService.ts       # Servicio principal de migraciones
└── components/
    ├── SupabaseConfigModal.tsx   # Modal de configuración (modificado)
    └── MigrationProgressUI.tsx   # UI de progreso visual

src/main/
├── index.ts                      # Handler para leer archivos SQL
└── preload.ts                    # Exposición de API readMigrationFile

supabase/migrations/
├── 20250429000000_initial_schema.sql
├── ...                           # ~40 archivos de migración
└── 20251024000001_create_migration_executor.sql

electron-builder.yml              # Configuración para empaquetar SQLs
```

## 🔧 Componentes Técnicos

### 1. **MigrationService** (`migrationService.ts`)

Responsabilidades:
- Verificar si la BD necesita configuración inicial
- Leer archivos SQL de migraciones
- Ejecutar migraciones en orden secuencial
- Reportar progreso en tiempo real

Métodos principales:
```typescript
needsInitialSetup(): Promise<boolean>
runMigrations(onProgress: callback): Promise<void>
getMigrationContent(migrationName: string): Promise<string>
```

### 2. **MigrationProgressUI** (`MigrationProgressUI.tsx`)

Componente React que muestra:
- Barra de progreso animada
- Porcentaje de completitud
- Migración actual en ejecución
- Contador de migraciones
- Mensajes de éxito/error
- Credenciales del usuario admin al finalizar

### 3. **SupabaseConfigModal** (modificado)

Flujo mejorado:
```typescript
1. Usuario ingresa URL + Key
2. Guarda configuración
3. Verifica si necesita setup: await migrationService.needsInitialSetup()
4. Si necesita setup:
   - Muestra MigrationProgressUI
   - Ejecuta migrationService.runMigrations()
   - Actualiza progreso en tiempo real
5. Si no necesita setup:
   - Continúa normalmente
6. Recarga la aplicación
```

### 4. **Función RPC execute_migration**

Función PostgreSQL que permite ejecutar SQL desde la aplicación:

```sql
CREATE FUNCTION execute_migration(migration_sql TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
```

⚠️ **Nota de seguridad**: Esta función tiene permisos elevados y debe ser monitoreada. En versiones futuras, se podría eliminar después del setup inicial.

## 📦 Empaquetado

El archivo `electron-builder.yml` incluye:

```yaml
extraResources:
  - from: supabase/migrations
    to: migrations
    filter:
      - "**/*.sql"
```

Esto copia todos los archivos `.sql` a la carpeta `resources/migrations` en la aplicación empaquetada.

## 🎨 Experiencia de Usuario

### Estados Visuales:

1. **Preparando** (0%)
   ```
   🔵 Preparando entorno de migración...
   [▓▓▓░░░░░░░░░░░░░░░░░] 0%
   ```

2. **En Progreso** (45%)
   ```
   🔵 20250501000000_create_users_tables
   [▓▓▓▓▓▓▓▓▓░░░░░░░░░░░] 45%
   Migración 18 de 40
   ⏳ Ejecutando...
   ```

3. **Completado** (100%)
   ```
   ✅ Completado
   [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100%
   
   ✅ Base de datos configurada exitosamente
   Se han ejecutado 40 migraciones correctamente.
   
   Credenciales:
   Email: admin@suitcore.com
   Contraseña: Suitcore123
   ```

## 🔐 Seguridad

### Usuario Administrador Genérico

- **Email**: `admin@suitcore.com`
- **Contraseña**: `Suitcore123`
- **Hash bcrypt**: `$2b$10$T3GFyHy0bz5IjsVQJnLcCOVJ7u1F3Wv5P5uX7hXv/rFIApUtNZeLS`

⚠️ **Importante**: El sistema muestra un mensaje recordando al usuario que debe cambiar esta contraseña después del primer inicio de sesión.

### Consideraciones:

1. La función `execute_migration` tiene permisos `SECURITY DEFINER`
2. Los archivos SQL se empaquetan en la aplicación (no modificables por el usuario)
3. Solo se ejecutan migraciones si la BD está vacía (previene ejecución accidental)

## 🚀 Testing

### Para Probar el Sistema:

1. **Crear nuevo proyecto Supabase**
   ```
   - Ve a https://supabase.com
   - Crea un nuevo proyecto
   - Copia URL y Anon Key
   ```

2. **Ejecutar aplicación en desarrollo**
   ```bash
   npm run dev:electron
   ```

3. **Configurar conexión**
   ```
   - Ingresa URL y Anon Key
   - Observa el progreso de migración
   - Verifica creación de usuario admin
   ```

4. **Verificar resultado**
   ```
   - Login con admin@suitcore.com / Suitcore123
   - Verifica que todas las tablas existen
   - Verifica que puede crear productos, etc.
   ```

## 📝 Mantenimiento

### Agregar Nueva Migración:

1. Crear archivo SQL en `supabase/migrations/`
   ```sql
   -- 20251225000000_nueva_funcionalidad.sql
   CREATE TABLE nueva_tabla (...);
   ```

2. Actualizar `migrationService.ts`
   ```typescript
   const MIGRATIONS = [
     // ... migraciones existentes
     '20251225000000_nueva_funcionalidad'
   ];
   ```

3. Rebuildar la aplicación
   ```bash
   npm run build
   npm run make:win
   ```

### Debugging:

Ver logs en la consola del navegador (DevTools):
```
[MigrationService] Verificando si necesita setup...
[MigrationService] Ejecutando migración: 20250429000000_initial_schema
[MigrationService] Progreso: 25% (10/40)
```

## 🎯 Próximas Mejoras

- [ ] Opción para re-ejecutar migraciones en caso de error
- [ ] Backup automático antes de ejecutar migraciones
- [ ] Validación de integridad post-migración
- [ ] Logs de migración guardados localmente
- [ ] Eliminar función `execute_migration` después del setup
- [ ] Soporte para rollback de migraciones

## 📞 Soporte

Si un cliente tiene problemas durante la migración:

1. Los logs están en la consola de DevTools
2. Los archivos SQL se encuentran en `resources/migrations`
3. Puede ejecutarse manualmente con Supabase CLI
4. Contactar soporte técnico con el error específico

---

**Versión**: 1.0.0  
**Fecha**: Octubre 2025  
**Autor**: SuitCore Development Team
