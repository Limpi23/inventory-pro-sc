import type { BarcodeSymbology } from '../../types';

export type { BarcodeSymbology };

export const DEFAULT_SYMBOLOGY: BarcodeSymbology = 'CODE128';

export const SYMBOLOGY_LABELS: Record<BarcodeSymbology, string> = {
  CODE128: 'Código de barras (Code128)',
  EAN13: 'Código de barras (EAN-13)',
  QR: 'Código QR',
};

/**
 * Code128 codifica ASCII imprimible (32-126). Cualquier acento, ñ o símbolo
 * fuera de ese rango produce un código que el lector no puede interpretar.
 */
const CODE128_SAFE = /^[\x20-\x7E]+$/;

/** Caracteres del texto que Code128 no puede representar, sin repetir. */
export function unsupportedCode128Chars(value: string): string[] {
  const bad = new Set<string>();
  for (const ch of value || '') {
    if (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126) bad.add(ch);
  }
  return [...bad];
}

/** Dígito verificador de un EAN-13 a partir de sus primeros 12 dígitos. */
export function ean13CheckDigit(first12: string): number {
  const digits = first12.slice(0, 12).split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  const v = (value || '').trim();
  if (!/^\d{13}$/.test(v)) return false;
  return ean13CheckDigit(v) === Number(v[12]);
}

/**
 * Valor que se imprime para un producto. El código propio manda; si no hay,
 * cae al SKU — que es exactamente lo que el trigger de la base de datos
 * escribe al crear el producto.
 */
export function resolveCodeValue(product: { barcode?: string | null; sku?: string | null }): string {
  const barcode = (product?.barcode || '').trim();
  if (barcode) return barcode;
  return (product?.sku || '').trim();
}

export interface CodeValidation {
  ok: boolean;
  error?: string;
  /** El problema no impide imprimir, pero conviene avisarlo. */
  warning?: string;
}

/** Valida que un valor se pueda representar en la simbología indicada. */
export function validateCode(value: string, type: BarcodeSymbology): CodeValidation {
  const v = (value || '').trim();

  if (!v) {
    return { ok: false, error: 'El producto no tiene código ni SKU, no se puede generar una etiqueta.' };
  }

  if (type === 'QR') {
    // El QR admite cualquier texto UTF-8; solo avisamos si es muy largo.
    if (v.length > 300) {
      return { ok: true, warning: 'El texto es muy largo: el QR quedará muy denso y puede costar leerlo.' };
    }
    return { ok: true };
  }

  if (type === 'EAN13') {
    if (!/^\d{12,13}$/.test(v)) {
      return { ok: false, error: 'EAN-13 requiere 12 o 13 dígitos numéricos.' };
    }
    if (v.length === 13 && !isValidEan13(v)) {
      return { ok: false, error: `Dígito verificador incorrecto. Debería terminar en ${ean13CheckDigit(v)}.` };
    }
    return { ok: true };
  }

  // CODE128
  if (!CODE128_SAFE.test(v)) {
    const bad = unsupportedCode128Chars(v);
    return {
      ok: false,
      error: `Code128 no admite estos caracteres: ${bad.join(' ')}. Usa solo letras sin tilde, números y guiones, o cambia a QR.`,
    };
  }
  if (v.length > 48) {
    return { ok: true, warning: 'Un Code128 tan largo sale muy ancho y puede no caber en la etiqueta.' };
  }
  return { ok: true };
}

/**
 * Simbología a usar realmente para un producto: respeta la configurada, pero
 * cae a Code128 si viene vacía (productos anteriores a la migración).
 */
export function effectiveSymbology(product: { barcode_type?: BarcodeSymbology | null }): BarcodeSymbology {
  const t = product?.barcode_type;
  if (t === 'CODE128' || t === 'EAN13' || t === 'QR') return t;
  return DEFAULT_SYMBOLOGY;
}
