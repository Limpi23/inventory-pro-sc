/**
 * Returns the current local date in ISO format (YYYY-MM-DD).
 * This avoids the issue where new Date().toISOString() returns UTC date,
 * which might be a day ahead/behind depending on the timezone.
 */
export const getLocalDateISOString = (date?: Date): string => {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Formats a date string (YYYY-MM-DD) to a localized date string
 * without timezone conversion issues.
 * @param dateString - Date string in format YYYY-MM-DD
 * @param locale - Locale for formatting (default: 'es-VE')
 * @returns Formatted date string
 */
export const formatDateString = (dateString: string, locale: string = 'es-VE'): string => {
    if (!dateString) return '';
    
    // Si la fecha viene como timestamp, extraer solo la parte de la fecha
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    
    // Crear fecha usando los componentes directamente para evitar conversión de zona horaria
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
