export type CurrencyCode = 'USD' | 'BOB' | 'VES' | 'COP';

export interface CurrencySettings {
  baseCurrency: CurrencyCode; // Moneda en la que guardas los precios base (p.ej. USD)
  displayCurrency: CurrencyCode; // Moneda para mostrar (p.ej. BOB o VES)
  exchangeRate: number; // Cuántos displayCurrency por 1 baseCurrency (p.ej. 1 USD = 7.00 BOB)
  locale: string; // Locale para formatear (p.ej. 'es-BO' o 'es-VE')
  lastUpdated?: string; // ISO date de la última actualización del tipo de cambio
}

const STORAGE_KEY = 'currencySettings';

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  baseCurrency: 'USD',
  displayCurrency: 'BOB',
  exchangeRate: 7,
  locale: 'es-BO',
  lastUpdated: new Date().toISOString(),
};

export function getCurrencySettings(): CurrencySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CURRENCY_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CURRENCY_SETTINGS, ...parsed } as CurrencySettings;
  } catch {
    return DEFAULT_CURRENCY_SETTINGS;
  }
}

export function setCurrencySettings(settings: Partial<CurrencySettings>) {
  const current = getCurrencySettings();
  const next: CurrencySettings = {
    ...current,
    ...settings,
    lastUpdated: settings.lastUpdated || new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// Convierte un monto en la moneda base hacia la moneda de visualización
export function toDisplay(amountInBase: number, s: CurrencySettings = getCurrencySettings()): number {
  if (s.baseCurrency === s.displayCurrency) return amountInBase;
  // Por ahora soportamos conversión lineal base->display mediante exchangeRate
  return amountInBase * (s.exchangeRate || 1);
}

// Convierte un monto en la moneda de visualización hacia la base
export function toBase(amountInDisplay: number, s: CurrencySettings = getCurrencySettings()): number {
  if (s.baseCurrency === s.displayCurrency) return amountInDisplay;
  const r = s.exchangeRate || 1;
  return r === 0 ? amountInDisplay : amountInDisplay / r;
}

export function formatCurrency(amountInBase: number, s: CurrencySettings = getCurrencySettings()): string {
  const value = toDisplay(amountInBase, s);
  try {
    return new Intl.NumberFormat(s.locale || 'es-BO', {
      style: 'currency',
      currency: s.displayCurrency || 'BOB',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${s.displayCurrency || 'BOB'}`;
  }
}

export function formatCurrencyRaw(amountInDisplay: number, s: CurrencySettings = getCurrencySettings()): string {
  try {
    return new Intl.NumberFormat(s.locale || 'es-BO', {
      style: 'currency',
      currency: s.displayCurrency || 'BOB',
      minimumFractionDigits: 2,
    }).format(amountInDisplay);
  } catch {
    return `${amountInDisplay.toFixed(2)} ${s.displayCurrency || 'BOB'}`;
  }
}
