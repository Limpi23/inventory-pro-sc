# Códigos de producto: barras, QR y escaneo

## Regla de negocio

El código de un producto **es su SKU**. El mismo valor se dibuja como código de
barras Code128 o como QR según lo que se necesite al imprimir la etiqueta: no
son dos datos distintos, son dos representaciones del mismo.

La columna `barcode` sigue siendo editable para productos que llegan con un
EAN-13 impreso de fábrica; en ese caso se guarda ese número y no el SKU.

## Esquema

Migración: `supabase/migrations/20260805000000_product_codes.sql`

- `products.barcode_type` — `CODE128` (por defecto), `EAN13` o `QR`.
- Trigger `set_product_barcode` (BEFORE INSERT OR UPDATE OF barcode, sku):
  si `barcode` llega vacío o en blanco, lo rellena con el SKU.
- Índice único parcial `uq_products_barcode` sobre `barcode` cuando no es NULL.

La autogeneración vive en el trigger y no en el formulario **a propósito**: los
productos se crean desde tres sitios distintos (`ProductModal`, `ProductImport`
y `productService.createBatch`) y así los tres quedan cubiertos sin duplicar
lógica.

Las cadenas vacías se normalizan a NULL. Sin eso el índice único parcial no
filtra nada y colisiona con todos los productos sin código.

## Impresión de etiquetas

`src/renderer/components/products/codes/LabelPrintModal.tsx`

Desde Productos: menú de una fila → *Imprimir etiqueta*, o selección múltiple →
*Imprimir etiquetas*.

Plantillas incluidas (A4 y Carta). Al elegir «Personalizado» se comprueba que
la rejilla quepa en la hoja y se avisa en rojo si se pasa, indicando por cuántos
milímetros; una plantilla que no cabe recorta la última fila sin avisar.

Opción **«Empezar en»**: salta las etiquetas ya usadas de una hoja a medio
gastar.

### Cuidado con el tamaño

- Un Code128 largo se escala para caber en la etiqueta. Si el ancho del módulo
  queda demasiado fino, el lector deja de engancharlo: conviene una etiqueta más
  grande o un SKU más corto.
- El QR necesita **lector 2D**. Los lectores láser de código de barras no lo leen.
- Code128 solo codifica ASCII imprimible. Un SKU con tildes o `ñ` se rechaza al
  guardar el producto, con el detalle de qué caracteres sobran.

## Escaneo

`src/renderer/hooks/useBarcodeScanner.ts`

Los lectores USB se comportan como teclados: teclean el código muy rápido y
terminan con Enter. El hook distingue una lectura de una persona escribiendo por
la velocidad entre pulsaciones (por defecto, menos de 50 ms por carácter).

Integrado en:

| Pantalla | Al escanear |
|---|---|
| Productos | Filtra la lista por el código leído |
| Facturas (nueva venta) | Selecciona el producto y trae su precio e impuesto |
| Inventario | Selecciona el producto del movimiento |

Si el foco está dentro de un campo de texto el hook **no intercepta**: el lector
escribe en el campo como haría un teclado y el Enter dispara lo que corresponda.
Así una misma lectura no se procesa dos veces.

### Si un lector no dispara

Algunos lectores lentos superan los 50 ms entre teclas. El umbral es
configurable por llamada:

```ts
useBarcodeScanner({ onScan, interKeyMs: 80 });
```

Subirlo demasiado hace que un mecanógrafo rápido pueda disparar lecturas falsas.
