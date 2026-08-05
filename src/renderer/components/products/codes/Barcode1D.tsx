import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface Barcode1DProps {
  value: string;
  /** Code128 acepta texto; EAN13 exige 12 o 13 dígitos. */
  format?: 'CODE128' | 'EAN13';
  /** Alto de las barras en px. */
  height?: number;
  /** Ancho del módulo (barra más fina). Por debajo de 1 el lector empieza a fallar. */
  moduleWidth?: number;
  displayValue?: boolean;
  fontSize?: number;
  /** Zona muda alrededor del código. Obligatoria para que el lector enganche. */
  margin?: number;
  className?: string;
}

/**
 * Código de barras 1D renderizado como SVG (vectorial, imprime nítido a
 * cualquier tamaño). JsBarcode dibuja directamente sobre el nodo <svg>.
 */
export default function Barcode1D({
  value,
  format = 'CODE128',
  height = 50,
  moduleWidth = 1.6,
  displayValue = true,
  fontSize = 14,
  margin = 8,
  className,
}: Barcode1DProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!svgRef.current) return;

    if (!value) {
      setError('Sin código');
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format,
        height,
        width: moduleWidth,
        displayValue,
        fontSize,
        margin,
        textMargin: 2,
        lineColor: '#000000',
        background: '#ffffff',
      });
      setError('');
    } catch (e: any) {
      // JsBarcode lanza cuando el valor no es válido para la simbología
      setError(e?.message || `"${value}" no es válido para ${format}`);
    }
  }, [value, format, height, moduleWidth, displayValue, fontSize, margin]);

  if (error) {
    return (
      <div className={`text-[10px] text-red-600 text-center px-1 leading-tight ${className || ''}`}>
        {error}
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ maxWidth: '100%', maxHeight: '100%', height: 'auto' }}
    />
  );
}
