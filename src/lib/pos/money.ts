/** ISO 4217 minor-unit exponents. Subset, not a claim that every currency is supported. */
export const CURRENCIES: Record<string, { name: string; exponent: number }> = {
  PKR: { name: "Pakistani rupee", exponent: 2 },
  USD: { name: "US dollar", exponent: 2 },
  EUR: { name: "Euro", exponent: 2 },
  GBP: { name: "Pound sterling", exponent: 2 },
  AED: { name: "UAE dirham", exponent: 2 },
  SAR: { name: "Saudi riyal", exponent: 2 },
  QAR: { name: "Qatari riyal", exponent: 2 },
  INR: { name: "Indian rupee", exponent: 2 },
  BDT: { name: "Bangladeshi taka", exponent: 2 },
  AFN: { name: "Afghan afghani", exponent: 2 },
  CAD: { name: "Canadian dollar", exponent: 2 },
  AUD: { name: "Australian dollar", exponent: 2 },
  CNY: { name: "Chinese yuan", exponent: 2 },
  TRY: { name: "Turkish lira", exponent: 2 },
  JPY: { name: "Japanese yen", exponent: 0 },
  KWD: { name: "Kuwaiti dinar", exponent: 3 },
  BHD: { name: "Bahraini dinar", exponent: 3 },
  OMR: { name: "Omani rial", exponent: 3 },
};

export const LOCALES = [
  { id: "en-PK", label: "English (Pakistan)" },
  { id: "en-US", label: "English (United States)" },
  { id: "en-GB", label: "English (United Kingdom)" },
  { id: "ur-PK", label: "Urdu (Pakistan)" },
  { id: "ar-AE", label: "Arabic (UAE)" },
] as const;

export const TIME_ZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Kabul",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

export function currencyExponent(code: string): number {
  return CURRENCIES[code]?.exponent ?? 2;
}

export function isRtlLocale(locale: string): boolean {
  return locale.startsWith("ar") || locale.startsWith("ur");
}

/** Major-unit user input → integer minor units. Rounds with toFixed to avoid binary drift. */
export function toMinor(major: number, exponent: number): number {
  if (!Number.isFinite(major)) return Number.NaN;
  const neg = major < 0;
  const fixed = Math.abs(major).toFixed(exponent);
  const [whole, frac = ""] = fixed.split(".");
  const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  const n = Number(digits || "0");
  if (!Number.isSafeInteger(n)) return Number.NaN;
  return neg ? -n : n;
}

export function fromMinor(minor: number, exponent: number): number {
  return minor / 10 ** exponent;
}

export function formatMoney(minor: number | null | undefined, currency: string, locale: string): string {
  const exponent = currencyExponent(currency);
  const amount = fromMinor(Number(minor) || 0, exponent);
  try {
    return new Intl.NumberFormat(locale || "en-PK", {
      style: "currency",
      currency: CURRENCIES[currency] ? currency : "PKR",
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(amount);
  } catch {
    return `${amount.toFixed(exponent)} ${currency}`;
  }
}

export function businessDate(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "0000";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return businessDate(date, "UTC");
  }
}

export function formatWhen(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale || "en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || "UTC",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function percentOf(subtotalMinor: number, percent: number): number {
  if (!Number.isFinite(subtotalMinor) || !Number.isFinite(percent) || subtotalMinor <= 0 || percent <= 0) {
    return 0;
  }
  const p = Math.min(100, percent);
  return Math.round((subtotalMinor * p) / 100);
}
