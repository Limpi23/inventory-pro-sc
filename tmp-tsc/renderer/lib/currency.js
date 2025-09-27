const STORAGE_KEY = 'currencySettings';
export const DEFAULT_CURRENCY_SETTINGS = {
    baseCurrency: 'BOB',
    displayCurrency: 'BOB',
    exchangeRate: 1,
    locale: 'es-BO',
    lastUpdated: new Date().toISOString(),
};
function coerceToBolivianos(settings) {
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
export function getCurrencySettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const defaults = coerceToBolivianos();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
            return defaults;
        }
        const parsed = JSON.parse(raw);
        const coerced = coerceToBolivianos(parsed);
        if (parsed.baseCurrency !== coerced.baseCurrency ||
            parsed.displayCurrency !== coerced.displayCurrency ||
            parsed.exchangeRate !== coerced.exchangeRate) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(coerced));
        }
        return coerced;
    }
    catch {
        const defaults = coerceToBolivianos();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
    }
}
export function setCurrencySettings(settings) {
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
export function toDisplay(amountInBase, s = getCurrencySettings()) {
    if (s.baseCurrency === s.displayCurrency)
        return amountInBase;
    // Por ahora soportamos conversión lineal base->display mediante exchangeRate
    return amountInBase * (s.exchangeRate || 1);
}
// Convierte un monto en la moneda de visualización hacia la base
export function toBase(amountInDisplay, s = getCurrencySettings()) {
    if (s.baseCurrency === s.displayCurrency)
        return amountInDisplay;
    const r = s.exchangeRate || 1;
    return r === 0 ? amountInDisplay : amountInDisplay / r;
}
export function formatCurrency(amountInBase, s = getCurrencySettings()) {
    const value = toDisplay(amountInBase, s);
    try {
        return new Intl.NumberFormat(s.locale || 'es-BO', {
            style: 'currency',
            currency: s.displayCurrency || 'BOB',
            minimumFractionDigits: 2,
        }).format(value);
    }
    catch {
        return `${value.toFixed(2)} ${s.displayCurrency || 'BOB'}`;
    }
}
export function formatCurrencyRaw(amountInDisplay, s = getCurrencySettings()) {
    try {
        return new Intl.NumberFormat(s.locale || 'es-BO', {
            style: 'currency',
            currency: s.displayCurrency || 'BOB',
            minimumFractionDigits: 2,
        }).format(amountInDisplay);
    }
    catch {
        return `${amountInDisplay.toFixed(2)} ${s.displayCurrency || 'BOB'}`;
    }
}
