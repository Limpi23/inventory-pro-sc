import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { resolveCodeValue } from '../../../lib/codes';
import Barcode1D from './Barcode1D';
import QRCodeSVG from './QRCodeSVG';
/**
 * Una etiqueta individual. Se dimensiona en milímetros para que lo que se ve
 * en pantalla sea exactamente lo que sale en la hoja adhesiva.
 */
const MM = 3.7795275591; // px por mm a 96 dpi
// Alto que ocupa cada línea de texto, en mm. Debe coincidir con los estilos de abajo.
// Dos líneas de 2.6mm × 1.15 son 5.98mm; redondeamos a 6.5 para que los
// trazos descendentes (g, j, y) no se corten contra el borde de la caja.
const NAME_MM = 6.5;
const SKU_MM = 2.4 * 1.1;
const PRICE_MM = 3 * 1.15;
const PADDING_MM = 3; // 1.5 arriba + 1.5 abajo
export default function ProductLabel({ product, options, priceLabel, showGuide }) {
    const value = resolveCodeValue(product);
    const isQr = options.symbology === 'QR';
    // El código sólo puede ocupar lo que sobra después del texto. Sin este
    // descuento el contenido desborda la celda y `overflow: hidden` recorta el
    // nombre — o peor, el propio código.
    const reservedMm = (options.showName ? NAME_MM : 0) +
        (options.showSku ? SKU_MM : 0) +
        (options.showPrice && priceLabel ? PRICE_MM : 0) +
        PADDING_MM;
    const availableHmm = Math.max(5, options.heightMm - reservedMm);
    const availableWmm = Math.max(10, options.widthMm - PADDING_MM);
    // El QR es cuadrado: manda el lado más corto de lo disponible.
    const qrSize = Math.max(30, Math.min(availableHmm, availableWmm) * MM);
    // El código de barras aprovecha todo el alto libre; si además lleva su
    // propio texto, hay que dejarle sitio.
    const barcodeHeight = Math.max(16, availableHmm * MM - (options.showSku ? 0 : 14));
    return (_jsxs("div", { className: showGuide ? 'border border-dashed border-gray-300' : '', style: {
            width: `${options.widthMm}mm`,
            height: `${options.heightMm}mm`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5mm',
            boxSizing: 'border-box',
            background: '#ffffff',
            color: '#000000',
            textAlign: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
        }, children: [options.showName && (_jsx("div", { style: {
                    fontSize: '2.6mm',
                    lineHeight: 1.15,
                    fontWeight: 600,
                    width: '100%',
                    flexShrink: 0,
                    height: `${NAME_MM}mm`,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                }, children: product.name })), _jsx("div", { style: {
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 0,
                    width: '100%',
                    overflow: 'hidden',
                }, children: isQr ? (_jsx(QRCodeSVG, { value: value, size: qrSize, margin: 2 })) : (_jsx(Barcode1D, { value: value, format: options.symbology === 'EAN13' ? 'EAN13' : 'CODE128', height: barcodeHeight, moduleWidth: 1.4, displayValue: !options.showSku, fontSize: 11, margin: 4 })) }), options.showSku && (_jsx("div", { style: { fontSize: '2.4mm', fontFamily: 'monospace', lineHeight: 1.1, flexShrink: 0 }, children: value })), options.showPrice && priceLabel && (_jsx("div", { style: { fontSize: '3mm', fontWeight: 700, lineHeight: 1.15, flexShrink: 0 }, children: priceLabel }))] }));
}
