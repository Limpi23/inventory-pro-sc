# Matriz y Sucursales

Esta versión convierte los **almacenes** en **sucursales**: una se marca como *Casa Matriz* y las demás operan como sucursales, cada una con su propio stock, ventas, compras y transferencias entre ellas.

## Qué incluye

- **Tipo de almacén**: cada almacén es `matriz` o `sucursal` (solo puede existir una matriz). Se gestiona desde **Almacenes → Agregar/Editar**.
- **Sucursal asignada por usuario**: en **Usuarios** se puede asignar una sucursal a cada usuario. Un usuario no administrador con sucursal asignada queda restringido a ella (ventas, compras, inventario, reportes). Los administradores y los usuarios sin sucursal ven todas.
- **Selector de sucursal activa**: en el encabezado de la aplicación. Fija la sucursal con la que se opera; el Dashboard, Inventario General, Reportes y los formularios se filtran/preseleccionan con ella. La opción *Todas las sucursales* muestra la vista consolidada.
- **Transferencias entre sucursales** (menú **Inventario → Transferencias**): documento con número (`TR-000001`) y flujo *pendiente → en tránsito → recibida*. Al enviar se descuenta el stock del origen (`OUT_TRANSFER`) y al confirmar la recepción ingresa al destino (`IN_TRANSFER`). Las pendientes se pueden cancelar.
- **Devoluciones con reposición**: la devolución registra la sucursal de reposición y, al aprobarse, genera el movimiento `IN_RETURN` que repone el stock en esa sucursal.

## Pasos para activarlo

1. **Aplicar la migración** `supabase/migrations/20260710000000_matriz_sucursales.sql`:
   - con Supabase CLI: `npm run db:migration:apply:remote`, o
   - desde la aplicación: menú → *Ejecutar Migraciones* (la migración ya está registrada en el ejecutor interno).
   - La migración marca automáticamente el almacén más antiguo como matriz si no hay ninguna.
2. En **Almacenes**, revisar cuál quedó como *Casa Matriz* y ajustar si es necesario.
3. En **Usuarios**, asignar la sucursal a cada usuario de sucursal (los administradores pueden quedar sin sucursal para ver todo).

## Limitaciones actuales

- Las transferencias manejan productos por cantidad; los productos serializados (números de serie) deben transferirse desde *Control de Inventario* seleccionando el serial, como hasta ahora.
- La restricción por sucursal se aplica en la aplicación; no hay políticas RLS por sucursal en la base de datos (la app usa autenticación propia con la clave `anon`).
