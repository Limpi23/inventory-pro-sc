# Inventario por Ubicación

Este documento explica cómo funciona el control de inventario por ubicación (bin-level) en la app.

## Conceptos

- Ubicación: un punto físico dentro de un almacén (ej. Pasillo A - Estante 1). Las ubicaciones se gestionan en el módulo "Ubicaciones" y opcionalmente se asocian a un almacén.
- Movimiento de stock: puede incluir `location_id` para indicar desde/hacia qué ubicación se mueve el stock.
- Vistas de stock:
  - `current_stock_by_location`: stock actual por producto, bodega y ubicación.
  - `current_stock`: stock agregado por bodega (suma de ubicaciones).

## Flujo de uso

1. Crear Ubicaciones
   - En el módulo "Ubicaciones", crea ubicaciones manualmente o usa la importación con plantilla.

2. Operar Movimientos con Ubicación
   - En entradas, salidas y movimientos internos, selecciona `location_id` para indicar el bin/ubicación involucrado. Si omites la ubicación, el movimiento no se desagrega por ubicación.

3. Consultar stock por Ubicación
   - Usa la vista `current_stock_by_location` (a través de reportes o módulos UI) para ver cantidades por ubicación.

## Notas

- La vista `current_stock` se mantiene para compatibilidad, agregando todas las ubicaciones de un almacén.
- Asegúrate de tener permisos de lectura sobre `stock_movements` para consumir las vistas.
