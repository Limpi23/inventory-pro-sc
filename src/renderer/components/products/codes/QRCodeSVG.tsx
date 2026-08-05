import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeSVGProps {
  value: string;
  /** Lado del QR en px (se escala al contenedor al imprimir). */
  size?: number;
  /** Zona muda en módulos. Menos de 2 y muchos lectores no enganchan. */
  margin?: number;
  /**
   * Corrección de errores. 'M' es el equilibrio habitual; 'H' aguanta
   * etiquetas rayadas o mal impresas a costa de un QR más denso.
   */
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
}

/**
 * QR renderizado como SVG. El contenido es el mismo valor que el código de
 * barras, así que un lector 2D devuelve exactamente lo que la app ya busca.
 */
export default function QRCodeSVG({
  value,
  size = 120,
  margin = 2,
  level = 'M',
  className,
}: QRCodeSVGProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setSvg('');
      setError('Sin código');
      return;
    }

    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin,
      errorCorrectionLevel: level,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((markup: string) => {
        if (cancelled) return;
        setSvg(markup);
        setError('');
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || 'No se pudo generar el QR');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size, margin, level]);

  if (error) {
    return (
      <div className={`text-[10px] text-red-600 text-center px-1 leading-tight ${className || ''}`}>
        {error}
      </div>
    );
  }

  // El SVG lo produce la propia librería a partir del valor, no es HTML de usuario.
  return (
    <div
      className={className}
      style={{ width: size, maxWidth: '100%', maxHeight: '100%', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
