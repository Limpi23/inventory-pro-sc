import { useEffect, useRef } from 'react';
function isEditableTarget(el) {
    if (!el)
        return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select')
        return true;
    return el.isContentEditable === true;
}
/**
 * Captura lecturas de un escáner de códigos de barras.
 *
 * Los lectores USB se comportan como teclados: teclean el código muy rápido y
 * terminan con Enter. Distinguimos una lectura de una persona escribiendo por
 * la velocidad entre pulsaciones.
 */
export function useBarcodeScanner({ onScan, enabled = true, minLength = 3, interKeyMs = 50, ignoreEditable = true, }) {
    const onScanRef = useRef(onScan);
    const buffer = useRef('');
    const lastKeyAt = useRef(0);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);
    useEffect(() => {
        if (!enabled)
            return;
        const handleKeyDown = (event) => {
            // Atajos de teclado no son lecturas
            if (event.ctrlKey || event.altKey || event.metaKey)
                return;
            if (ignoreEditable && isEditableTarget(document.activeElement)) {
                buffer.current = '';
                return;
            }
            const now = Date.now();
            if (event.key === 'Enter') {
                const code = buffer.current;
                buffer.current = '';
                if (code.length >= minLength) {
                    event.preventDefault();
                    event.stopPropagation();
                    onScanRef.current(code);
                }
                return;
            }
            // Ignorar teclas de control (Shift, F5, flechas…)
            if (event.key.length !== 1)
                return;
            // Una pausa larga significa que empieza una secuencia nueva
            if (now - lastKeyAt.current > interKeyMs) {
                buffer.current = '';
            }
            buffer.current += event.key;
            lastKeyAt.current = now;
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, minLength, interKeyMs, ignoreEditable]);
}
export default useBarcodeScanner;
