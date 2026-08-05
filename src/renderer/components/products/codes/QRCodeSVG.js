import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
/**
 * QR renderizado como SVG. El contenido es el mismo valor que el código de
 * barras, así que un lector 2D devuelve exactamente lo que la app ya busca.
 */
export default function QRCodeSVG({ value, size = 120, margin = 2, level = 'M', className, }) {
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');
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
            .then((markup) => {
            if (cancelled)
                return;
            setSvg(markup);
            setError('');
        })
            .catch((e) => {
            if (cancelled)
                return;
            setError(e?.message || 'No se pudo generar el QR');
        });
        return () => {
            cancelled = true;
        };
    }, [value, size, margin, level]);
    if (error) {
        return (_jsx("div", { className: `text-[10px] text-red-600 text-center px-1 leading-tight ${className || ''}`, children: error }));
    }
    // El SVG lo produce la propia librería a partir del valor, no es HTML de usuario.
    return (_jsx("div", { className: className, style: { width: size, maxWidth: '100%', maxHeight: '100%', lineHeight: 0 }, dangerouslySetInnerHTML: { __html: svg } }));
}
