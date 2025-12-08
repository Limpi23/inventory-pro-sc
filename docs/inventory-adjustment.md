# Ajuste Directo de Inventario - Super Root

## Descripción

Se ha implementado una funcionalidad especial de **Ajuste Directo de Inventario** que permite al usuario super root (`admin@suitcore.com`) corregir descuadres en el inventario sin generar movimientos visibles en el historial normal.

## Características Principales

### 🔐 Seguridad y Permisos

- **Acceso Exclusivo**: Solo el usuario con email `admin@suitcore.com` puede usar esta función
- **No depende del rol**: Es una verificación a nivel de email específico (super root), no del rol "admin"
- **Validación en Backend**: La función RPC verifica el email del usuario antes de permitir el ajuste
- **Validación en Frontend**: El botón solo se muestra si el usuario es super root

### 📋 Funcionalidad

1. **Ajuste Directo**
   - Permite cambiar la cantidad de un producto en una ubicación específica
   - No requiere crear una venta o compra
   - Ideal para corregir descuadres por conteos físicos, errores de registro, etc.

2. **Sin Movimientos Visibles**
   - Los ajustes NO aparecen en el historial de movimientos regular
   - Se registra técnicamente un movimiento de tipo "adjustment" para mantener la consistencia de las vistas
   - Este movimiento técnico puede ser filtrado en reportes si es necesario

3. **Auditoría Completa**
   - Todos los ajustes se registran en la tabla `inventory_adjustments`
   - Se guarda: fecha, producto, almacén, ubicación, cantidades (anterior/nueva), diferencia, razón, y quién lo hizo
   - Vista de historial dedicada accesible desde Inventario General

### 🚫 Restricciones

- **No permite ajustar productos serializados**: Los productos con tracking_method='serialized' deben gestionarse a través de la gestión de seriales
- **Requiere razón obligatoria**: Se debe explicar el motivo del ajuste
- **Solo cantidades positivas**: No se permiten cantidades negativas

## Componentes Implementados

### 1. Base de Datos (Migration)

**Archivo**: `supabase/migrations/20251207000000_inventory_direct_adjustment.sql`

- **Tabla**: `inventory_adjustments` - Registra todos los ajustes para auditoría
- **Función RPC**: `adjust_inventory_direct()` - Ejecuta el ajuste con validaciones
- **Vista**: `inventory_adjustments_history` - Consulta el historial con información completa

### 2. Frontend

#### Componente de Ajuste
**Archivo**: `src/renderer/components/inventory/InventoryAdjustment.tsx`

Modal que permite:
- Buscar producto por nombre o SKU
- Seleccionar almacén y ubicación
- Ver la cantidad actual
- Ingresar nueva cantidad (muestra la diferencia)
- Explicar la razón del ajuste

#### Componente de Historial
**Archivo**: `src/renderer/components/inventory/InventoryAdjustmentHistory.tsx`

Modal que muestra:
- Tabla con todos los ajustes realizados
- Fecha/hora, producto, almacén, ubicación
- Cantidades anterior/nueva y diferencia
- Razón del ajuste
- Usuario que lo realizó

#### Integración en Inventario General
**Archivo**: `src/renderer/views/InventoryGeneral.tsx`

Modificaciones:
- Verificación al cargar si el usuario es super root
- Botón "Ajuste de Inventario" (naranja) - Solo visible para super root
- Botón "Historial de Ajustes" (morado) en las pestañas - Solo visible para super root

## Uso

### Para el Usuario Super Root (admin@suitcore.com)

1. **Realizar un Ajuste**:
   - Ir a "Inventario General"
   - Hacer clic en el botón naranja "Ajuste de Inventario"
   - Seleccionar producto, almacén y ubicación
   - Ver la cantidad actual en sistema
   - Ingresar la nueva cantidad correcta
   - Explicar la razón del ajuste
   - Confirmar

2. **Ver Historial de Ajustes**:
   - Ir a "Inventario General"
   - Hacer clic en el botón morado "Historial de Ajustes" (en las pestañas)
   - Revisar todos los ajustes realizados

### Para Otros Usuarios

- No verán los botones de ajuste
- No podrán ejecutar la función RPC (retornará error de acceso denegado)
- Los ajustes NO aparecen en el historial normal de movimientos

## Ejemplo de Uso

**Escenario**: Después de un conteo físico, se detecta que hay 150 unidades del producto "Aceite Motor 10W40" en la ubicación "Estante A1" del almacén "Principal", pero el sistema muestra 145.

**Solución**:
1. Super root abre "Ajuste de Inventario"
2. Busca "Aceite Motor 10W40"
3. Selecciona Almacén "Principal" y Ubicación "Estante A1"
4. Ve que la cantidad actual es: 145
5. Ingresa nueva cantidad: 150
6. El sistema muestra: "Diferencia: +5"
7. En razón escribe: "Conteo físico realizado el 07/12/2025 - se encontraron 5 unidades adicionales no registradas"
8. Confirma el ajuste

**Resultado**:
- El inventario ahora muestra 150 unidades
- Se registra el ajuste en la tabla de auditoría
- NO aparece en el historial de movimientos regular
- Queda trazabilidad completa del cambio

## Consideraciones Técnicas

### Cómo Funciona Internamente

1. La función RPC obtiene la cantidad actual desde `current_stock_by_location`
2. Calcula la suma de todos los `stock_movements` para esa ubicación
3. Inserta un movimiento técnico de ajuste para que la suma coincida con la nueva cantidad
4. Registra el ajuste en `inventory_adjustments` para auditoría
5. Las vistas `current_stock` y `current_stock_by_location` reflejan automáticamente el cambio

### Tipo de Movimiento

- Se crea/utiliza el tipo de movimiento con `code='adjustment'`
- Descripción: "Ajuste de Inventario"
- Este tipo puede ser excluido de reportes si se desea ocultar los ajustes técnicos

## Seguridad

- ✅ Validación a nivel de base de datos (SECURITY DEFINER)
- ✅ Verificación de email del usuario
- ✅ Row Level Security (RLS) en tabla de ajustes
- ✅ Solo inserción vía RPC (no directamente a la tabla)
- ✅ Auditoría completa de todas las operaciones
- ✅ Validación en frontend para ocultar la UI

## Migración

Para aplicar esta funcionalidad en una base de datos existente:

```bash
# La migración se aplicará automáticamente al iniciar la aplicación
# O puede aplicarse manualmente desde Supabase Dashboard
```

El archivo de migración es: `supabase/migrations/20251207000000_inventory_direct_adjustment.sql`

## Notas Importantes

⚠️ **Esta funcionalidad debe usarse con precaución**:
- Solo para corregir errores o descuadres
- Siempre proporcionar una razón clara y detallada
- Verificar bien los datos antes de confirmar
- Revisar el historial de ajustes regularmente para auditoría

✅ **Casos de uso apropiados**:
- Corrección después de conteo físico
- Ajuste por producto dañado/vencido
- Corrección de errores de importación
- Reconciliación de inventario

❌ **NO usar para**:
- Registrar ventas o compras normales
- Transferencias entre ubicaciones
- Devoluciones de clientes
- Recepciones de proveedores
