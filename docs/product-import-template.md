# Plantilla de importación de productos (Excel)

Desde la pantalla **Productos → Importar Productos Masivamente** ahora puedes descargar una plantilla en formato `.xlsx`. Esta hoja incluye todas las columnas soportadas por el importador y valores de ejemplo.

## Columnas soportadas

| Columna         | Requerido | Descripción |
|----------------|-----------|-------------|
| `name`         | ✅        | Nombre del producto. |
| `description`  | Opcional  | Texto descriptivo. |
| `sku`          | Opcional pero recomendado | Código único. Si se repite en el archivo o ya existe en la base de datos, se rechazará la fila. |
| `barcode`      | Opcional  | Código de barras. |
| `category`     | Opcional  | Nombre de la categoría. Si el nombre existe en Supabase, se asignará automáticamente. |
| `category_id`  | Opcional  | UUID de la categoría. Úsalo solo si necesitas apuntar a un ID específico. Si el valor no existe en Supabase la fila se rechazará. |
| `location`     | Opcional  | Nombre de la ubicación. Si existe en Supabase se usará su UUID automáticamente. |
| `location_id`  | Opcional  | UUID de la ubicación. Debe existir en Supabase. |
| `min_stock`    | Opcional  | Entero ≥ 0. Si se deja vacío se toma 0. |
| `max_stock`    | Opcional  | Entero ≥ `min_stock` o vacío para sin límite. |
| `purchase_price` | Opcional | Número ≥ 0. |
| `sale_price`   | Opcional  | Número ≥ 0. |
| `tax_rate`     | Opcional  | Porcentaje ≥ 0. |
| `status`       | Opcional  | Estado del producto (`active`, `inactive` o `archived`).

> **Tip:** Si proporcionas un nombre de categoría y el ID no existe, el importador mostrará un error indicando cuál falta. Lo mismo sucede con las ubicaciones.

## Formatos admitidos

- **Excel** (`.xlsx`, `.xls`): recomendado.
- **CSV** (`.csv`): sigue siendo compatible para integraciones existentes.

## Validaciones destacadas

- Se rechazan filas con números inválidos o negativos donde no corresponden.
- `max_stock` no puede ser menor a `min_stock`.
- Se detalla hasta 5 errores en pantalla y puedes expandir para ver la lista completa.

## Flujo sugerido

1. Descarga la plantilla desde el botón **Descargar Plantilla** del importador.
2. Completa los datos en Excel.
3. Verifica que las categorías y ubicaciones usadas existan (puedes exportarlas desde la app o consultarlas en Supabase).
4. Guarda el archivo y súbelo; el importador acepta tanto `.xlsx` como `.csv`.
