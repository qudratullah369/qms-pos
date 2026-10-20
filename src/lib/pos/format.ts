import { usePosStore } from "./store";
import { businessDate, currencyExponent, formatMoney, formatWhen } from "./money";

export function useFormat() {
  const settings = usePosStore((s) => s.settings);
  return {
    settings,
    exponent: currencyExponent(settings.currency),
    money: (n: number | null | undefined) => formatMoney(n, settings.currency, settings.locale),
    when: (iso: string) => formatWhen(iso, settings.locale, settings.timeZone),
    today: () => businessDate(new Date(), settings.timeZone),
  };
}
