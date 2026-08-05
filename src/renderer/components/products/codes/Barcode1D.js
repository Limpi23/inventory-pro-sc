import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
/**
 * Código de barras 1D renderizado como SVG (vectorial, imprime nítido a
 * cualquier tamaño). JsBarcode dibuja directamente sobre el nodo <svg>.
 */
export default function Barcode1D({ value, format = 'CODE128', height = 50, moduleWidth = 1.6, displayValue = true, fontSize = 14, margin = 8, className, }) {
    const svgRef = useRef(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!svgRef.current)
            return;
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
        }
        catch (e) {
            // JsBarcode lanza cuando el valor no es válido para la simbología
            setError(e?.message || `"${value}" no es válido para ${format}`);
        }
    }, [value, format, height, moduleWidth, displayValue, fontSize, margin]);
    if (error) {
        return (_jsx("div", { className: `text-[10px] text-red-600 text-center px-1 leading-tight ${className || ''}`, children: error }));
    }
    return (_jsx("svg", { ref: svgRef, className: className, style: { maxWidth: '100%', maxHeight: '100%', height: 'auto' } }));
}
