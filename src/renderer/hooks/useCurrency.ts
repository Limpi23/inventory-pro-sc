import { useEffect, useMemo, useState } from 'react';
import { CurrencySettings, DEFAULT_CURRENCY_SETTINGS, getCurrencySettings, setCurrencySettings, formatCurrency, toDisplay, toBase } from '../lib/currency';

export function useCurrency() {
  const [settings, setSettings] = useState<CurrencySettings>(() => getCurrencySettings());

  // Escucha cambios en localStorage para sincronizar entre pestañas/ventanas del renderer
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'currencySettings') {
        setSettings(getCurrencySettings());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo(() => ({
    settings,
    set: (partial: Partial<CurrencySettings>) => {
      const next = setCurrencySettings(partial);
      setSettings(next);
    },
    reset: () => {
      const next = setCurrencySettings(DEFAULT_CURRENCY_SETTINGS);
      setSettings(next);
    },
    toDisplay: (amountInBase: number) => toDisplay(amountInBase, settings),
    toBase: (amountInDisplay: number) => toBase(amountInDisplay, settings),
    format: (amountInBase: number) => formatCurrency(amountInBase, settings),
  }), [settings]);

  return api;
}
