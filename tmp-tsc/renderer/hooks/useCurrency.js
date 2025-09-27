import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CURRENCY_SETTINGS, getCurrencySettings, setCurrencySettings, formatCurrency, toDisplay, toBase } from '../lib/currency';
export function useCurrency() {
    const [settings, setSettings] = useState(() => getCurrencySettings());
    // Escucha cambios en localStorage para sincronizar entre pestañas/ventanas del renderer
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === 'currencySettings') {
                setSettings(getCurrencySettings());
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const api = useMemo(() => ({
        settings,
        set: (partial) => {
            const next = setCurrencySettings(partial);
            setSettings(next);
        },
        reset: () => {
            const next = setCurrencySettings(DEFAULT_CURRENCY_SETTINGS);
            setSettings(next);
        },
        toDisplay: (amountInBase) => toDisplay(amountInBase, settings),
        toBase: (amountInDisplay) => toBase(amountInDisplay, settings),
        format: (amountInBase) => formatCurrency(amountInBase, settings),
    }), [settings]);
    return api;
}
