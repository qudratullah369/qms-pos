import type { Expense, Payment, Sale, SaleItem, TenderMethod } from "./types.ts";
import { DEFAULT_TENDER } from "./types.ts";

export type CartQuote = {
  subtotal: number;
  discount: number;
  total: number;
  gross_margin: number;
};

export function lineAmount(priceMinor: number, qty: number): number {
  if (!Number.isFinite(priceMinor) || !Number.isFinite(qty)) return Number.NaN;
  const amount = Math.round(priceMinor * qty);
  if (!Number.isSafeInteger(amount)) return Number.NaN;
  return amount;
}

export function quoteCart(items: Pick<SaleItem, "price" | "cost" | "qty">[], discountMinor: number): CartQuote | { error: string } {
  let subtotal = 0;
  let margin = 0;
  for (const item of items) {
    const sell = lineAmount(item.price, item.qty);
    const cost = lineAmount(item.cost, item.qty);
    if (!Number.isSafeInteger(sell) || !Number.isSafeInteger(cost)) return { error: "Amount is too large" };
    subtotal += sell;
    margin += sell - cost;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(margin)) return { error: "Amount is too large" };
  }
  const discount = Math.min(subtotal, Math.max(0, Math.round(discountMinor) || 0));
  return {
    subtotal,
    discount,
    total: subtotal - discount,
    gross_margin: margin - discount,
  };
}

export type Settlement = {
  total: number;
  subtotal: number;
  discount: number;
  net: number;
  tax: number;
  tax_rate_bps: number;
  paid: number;
  change: number;
  drawer_cash: number;
  balance_due: number;
  gross_margin: number;
  tender_method: TenderMethod;
};

function resolveTender(payment: Payment, tenderMethod?: TenderMethod): TenderMethod {
  if (tenderMethod === "Cash" || tenderMethod === "Card" || tenderMethod === "JazzCash" || tenderMethod === "EasyPaisa") {
    return tenderMethod;
  }
  if (payment === "Card" || payment === "JazzCash" || payment === "EasyPaisa") return payment;
  return DEFAULT_TENDER;
}

export function settlePayment(input: {
  items: Pick<SaleItem, "price" | "cost" | "qty">[];
  discount: number;
  payment: Payment;
  paid: number;
  hasCustomer: boolean;
  tax?: TaxRule;
  /** Actual tender used to receive the paid amount. Required for accurate drawer/reporting on credit sales. */
  tenderMethod?: TenderMethod;
}): { ok: true; sale: Settlement } | { ok: false; error: string } {
  const quote = quoteCart(input.items, input.discount);
  if ("error" in quote) return { ok: false, error: quote.error };
  const { subtotal, discount, gross_margin } = quote;
  const rule = input.tax ?? { rateBps: 0, pricesIncludeTax: false };
  const taxed = taxOn(quote.total, rule);
  if (!Number.isSafeInteger(taxed.total)) return { ok: false, error: "Amount is too large" };
  const total = taxed.total;
  const costTotal = subtotal - (gross_margin + discount);
  const margin = rule.pricesIncludeTax ? taxed.net - costTotal : gross_margin;
  let tendered = Math.round(input.paid) || 0;
  if (tendered < 0 || !Number.isSafeInteger(tendered)) return { ok: false, error: "Enter a valid paid amount" };

  const tender_method = resolveTender(input.payment, input.tenderMethod);

  const base = {
    subtotal,
    discount,
    net: taxed.net,
    tax: taxed.tax,
    tax_rate_bps: Math.min(10000, Math.max(0, Math.round(rule.rateBps) || 0)),
    total,
    gross_margin: margin,
    tender_method,
  };

  if (input.payment === "Credit") {
    if (!input.hasCustomer) return { ok: false, error: "Select a customer for credit sales" };
    if (tendered > total) return { ok: false, error: "Credit payment cannot exceed the total" };
    const drawer_cash = tender_method === "Cash" ? tendered : 0;
    return {
      ok: true,
      sale: { ...base, paid: tendered, change: 0, drawer_cash, balance_due: total - tendered },
    };
  }

  if (tendered <= 0) tendered = total;
  if (tendered < total) return { ok: false, error: "Paid amount is less than total" };
  if (input.payment !== "Cash" && tendered !== total) {
    return { ok: false, error: "This payment method must match the total. Only cash can give change." };
  }
  const change = input.payment === "Cash" ? tendered - total : 0;
  return {
    ok: true,
    sale: {
      ...base,
      paid: tendered,
      change,
      drawer_cash: input.payment === "Cash" ? total : 0,
      balance_due: 0,
    },
  };
}

export function expectedDrawer(sales: Pick<Sale, "drawer_cash">[], expenses: Pick<Expense, "amount" | "affects_cash">[]): number {
  const inn = sales.reduce((a, s) => a + (s.drawer_cash || 0), 0);
  const out = expenses.reduce((a, e) => a + (e.affects_cash ? e.amount : 0), 0);
  return inn - out;
}

export type TaxRule = {
  rateBps: number;
  pricesIncludeTax: boolean;
};

export function taxOn(amountMinor: number, rule: TaxRule): { net: number; tax: number; total: number } {
  const base = Math.max(0, Math.round(amountMinor) || 0);
  const rate = Math.min(10000, Math.max(0, Math.round(rule.rateBps) || 0));
  if (!Number.isSafeInteger(base) || rate === 0) return { net: base, tax: 0, total: base };
  if (rule.pricesIncludeTax) {
    const tax = Math.round((base * rate) / (10000 + rate));
    return { net: base - tax, tax, total: base };
  }
  const tax = Math.round((base * rate) / 10000);
  const total = base + tax;
  if (!Number.isSafeInteger(total)) return { net: base, tax: 0, total: base };
  return { net: base, tax, total };
}

export function marginAfterExpenses(sales: Pick<Sale, "gross_margin">[], expenses: Pick<Expense, "amount">[]): number {
  return sales.reduce((a, s) => a + (s.gross_margin || 0), 0) - expenses.reduce((a, e) => a + e.amount, 0);
}
