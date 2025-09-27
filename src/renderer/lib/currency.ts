export type CurrencyCode = 'USD' | 'BOB' | 'VES' | 'COP';

export interface CurrencySettings {
  baseCurrency: CurrencyCode; // Moneda en la que guardas los precios base (ahora siempre BOB)
  displayCurrency: CurrencyCode; // Moneda para mostrar (en esta versión se fija a BOB)
  exchangeRate: number; // Cuántos displayCurrency por 1 baseCurrency (se fija a 1 cuando todo es BOB)
  locale: string; // Locale para formatear (p.ej. 'es-BO' o 'es-VE')
  lastUpdated?: string; // ISO date de la última actualización del tipo de cambio
}

const STORAGE_KEY = 'currencySettings';

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  baseCurrency: 'BOB',
  displayCurrency: 'BOB',
  exchangeRate: 1,
  locale: 'es-BO',
  lastUpdated: new Date().toISOString(),
};

function coerceToBolivianos(settings?: Partial<CurrencySettings>): CurrencySettings {
  const merged = {
    ...DEFAULT_CURRENCY_SETTINGS,
    ...(settings || {}),
  };

  return {
    ...merged,
    baseCurrency: 'BOB',
    displayCurrency: 'BOB',
    exchangeRate: 1,
    lastUpdated: merged.lastUpdated || DEFAULT_CURRENCY_SETTINGS.lastUpdated,
  };
}

export function getCurrencySettings(): CurrencySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = coerceToBolivianos();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const coerced = coerceToBolivianos(parsed);
    if (
      parsed.baseCurrency !== coerced.baseCurrency ||
      parsed.displayCurrency !== coerced.displayCurrency ||
      parsed.exchangeRate !== coerced.exchangeRate
    ) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coerced));
    }
    return coerced;
  } catch {
    const defaults = coerceToBolivianos();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function setCurrencySettings(settings: Partial<CurrencySettings>): CurrencySettings {
  const current = getCurrencySettings();
  const next = coerceToBolivianos({
    ...current,
    ...settings,
    lastUpdated: settings.lastUpdated || current.lastUpdated || new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
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

function formatAsBolivianos(value: number, locale?: string): string {
  const resolvedLocale = locale || 'es-BO';
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Bs. ${formatter.format(safeValue)}`;
  } catch {
    return `Bs. ${safeValue.toFixed(2)}`;
  }
}

export function formatCurrency(amountInBase: number, s: CurrencySettings = getCurrencySettings()): string {
  const value = toDisplay(amountInBase, s);
  return formatAsBolivianos(value, s.locale);
}

export function formatCurrencyRaw(amountInDisplay: number, s: CurrencySettings = getCurrencySettings()): string {
  return formatAsBolivianos(amountInDisplay, s.locale);
}
