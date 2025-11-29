/**
 * Returns the current local date in ISO format (YYYY-MM-DD).
 * This avoids the issue where new Date().toISOString() returns UTC date,
 * which might be a day ahead/behind depending on the timezone.
 */
export const getLocalDateISOString = (date) => {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
