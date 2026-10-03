/** Parses "₹1,29,999.00", "Rs. 499", 1299.5 or "1299.00" into minor units (paise). */
export function parsePriceMinor(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) : null;
  }
  if (typeof raw !== 'string') return null;

  const match = raw.replace(/\s+/g, '').match(/\d[\d,.]*/);
  if (!match) return null;
  let digits = match[0].replace(/[.,]+$/, '');

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // The separator that comes last is the decimal mark.
    digits = lastComma > lastDot
      ? digits.replace(/\./g, '').replace(',', '.')
      : digits.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Indian and western grouping always leave 3 digits after the last comma.
    digits = /^\d+,\d{1,2}$/.test(digits) ? digits.replace(',', '.') : digits.replace(/,/g, '');
  } else if (digits.split('.').length > 2) {
    digits = digits.replace(/\./g, '');
  }

  const value = Number.parseFloat(digits);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

export function currencySymbol(currency: string): string {
  return currency === 'INR' ? '₹' : `${currency} `;
}

export function formatMoney(minor: number, currency = 'INR'): string {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(minor / 100);
}

/** Editable text for the price field, without a currency symbol. */
export function formatAmountInput(minor: number): string {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(minor / 100);
}
