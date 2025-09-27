# Inventario serializado (unidades únicas)

Este diseño permite manejar productos que se controlan por unidad con serial único (ej. motos: VIN/chasis y número de motor), además del inventario estándar por cantidad.

## Cambios de esquema

- products.tracking_method: `standard` (por cantidad) o `serialized` (por unidad).
- Nueva tabla `product_serials`: almacena cada unidad con campos: `serial_code` (VIN u otro), `vin`, `engine_number`, `year`, `color`, `attributes` (JSON), `status`, `warehouse_id`, `location_id`, `acquired_at`, `sold_at` y vínculos a `purchase_receipt_id` / `invoice_item_id`.
- stock_movements.serial_id: vínculo opcional al serial movido. Si el producto es `serialized`, es obligatorio y `quantity` debe ser 1 o -1.
- Triggers:
  - `enforce_serialized_rules`: valida serial_id y cantidad para productos serializados.
  - `apply_serial_side_effects`: sincroniza estado/ubicación del serial en función del tipo de movimiento.
- Vistas:
  - `current_serials_in_stock`: listado de seriales en stock con su ubicación.
  - `current_stock_serialized`: conteo por producto/almacén/ubicación basado en seriales.

## Flujos operativos

### Recepción de compra (IN_PURCHASE)
1. Crear seriales (`product_serials`) para cada unidad recibida con `warehouse_id`/`location_id` destino.
2. Registrar un `stock_movements` por unidad con `quantity = 1` y `serial_id`.
3. El trigger establece `status = in_stock` y completa `acquired_at`.

### Traslado entre almacenes/ubicaciones (OUT_TRANSFER / IN_TRANSFER)
- Salida: registrar movimiento `OUT_TRANSFER` por cada `serial_id` (quantity = -1) -> serial pasa a `in_transit`.
- Entrada en destino: registrar `IN_TRANSFER` (quantity = 1) con `warehouse_id`/`location_id` destino -> serial vuelve a `in_stock` y se actualiza la ubicación.

### Venta (OUT_SALE)
- En la línea de venta, seleccionar explícitamente los seriales a vender.
- Por cada serial, registrar `stock_movements` con `quantity = -1`, `serial_id` y asociar `invoice_item_id` en `product_serials` (opcional) para trazabilidad.
- El trigger marcará `status = sold`, seteará `sold_at` y limpiará ubicación.

### Devolución
- Crear nuevo serial si corresponde (mercadería reemplazada) o revertir a `in_stock` el serial devuelto (según política de negocio) y registrar `IN_RETURN`.

## UI mínima requerida

- Productos: seleccionar `Método de seguimiento` (Cantidad vs Serializado).
- Recepción: para productos serializados, formulario de seriales (VIN, motor, año, color) con validación de unicidad.
- Ventas: selector de seriales disponibles por producto y ubicación.
- Transferencias: mover por seriales específicos.
- Consulta: vista por unidades (`current_serials_in_stock`) y agregado por cantidades (existente y `current_stock_serialized`).

## Decisiones abiertas

- Políticas RLS específicas para `product_serials` (por tenant/rol).
- Reglas finas para `OUT_ADJUST` (pérdida/daño) y `IN_ADJUST` (reingreso tras reparación).
- Posible soporte futuro para lotes/caducidad (tabla `product_lots`).

## Ejemplos

- Crear producto serializado:
  ```sql
  UPDATE products SET tracking_method = 'serialized' WHERE id = '...';
  ```
- Insertar serial (moto):
  ```sql
  INSERT INTO product_serials (product_id, serial_code, vin, engine_number, year, color, warehouse_id)
  VALUES ('prod-uuid', 'VIN123', 'VIN123', 'ENG456', 2024, 'Rojo', 'wh-uuid');
  ```
- Movimiento de venta:
  ```sql
  INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type_id, reference, movement_date, serial_id)
  SELECT p.id, 'wh-uuid', -1, mt.id, 'Venta INV-001', now(), ps.id
  FROM products p, movement_types mt, product_serials ps
  WHERE p.id = 'prod-uuid' AND mt.code = 'OUT_SALE' AND ps.id = 'serial-uuid';
  ```

## Importación inicial vía Excel

- Desde **Inventario General → Importar Inventario Inicial** puedes descargar una plantilla Excel (`.xlsx`) para carga masiva. Incluye ejemplos tanto para modo estándar (por cantidades) como para modo serializado (por unidad).
- El importador acepta archivos `.xlsx`, `.xls` o `.csv` y valida SKU, almacén, ubicación y, en modo serializado, los códigos de serie antes de generar los movimientos iniciales.
- Las columnas de fecha admiten formatos ISO (`2025-09-01`) o locales comunes (`01/09/2025`). Usa `movement_date` para indicar el día en que entró la cantidad al inventario (si se deja vacío se tomará la fecha actual) y `acquired_at` para la fecha de recepción de cada serial.
