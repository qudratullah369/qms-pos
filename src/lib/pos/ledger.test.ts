import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedDrawer, marginAfterExpenses, quoteCart, settlePayment, taxOn } from "./ledger.ts";
import { businessDate, percentOf, toMinor } from "./money.ts";
import { can, deny } from "./permissions.ts";

describe("money", () => {
  it("converts major units without binary drift", () => {
    assert.equal(toMinor(189.9, 2), 18990);
    assert.equal(toMinor(0.1, 2), 10);
    assert.equal(toMinor(250, 2), 25000);
    assert.equal(toMinor(1000, 0), 1000);
    assert.equal(toMinor(1.234, 3), 1234);
  });

  it("rounds a percentage of minor units", () => {
    assert.equal(percentOf(19999, 10), 2000);
    assert.equal(percentOf(10000, 0), 0);
  });

  it("uses the business timezone, not UTC, for the calendar day", () => {
    const instant = new Date("2026-01-15T20:30:00Z");
    assert.equal(businessDate(instant, "Asia/Karachi"), "2026-01-16");
    assert.equal(businessDate(instant, "America/New_York"), "2026-01-15");
  });
});

describe("settlement", () => {
  const mango = [{ price: 25000, cost: 18000, qty: 1 }];

  it("keeps only the sale total in the drawer when cash change is given", () => {
    const result = settlePayment({ items: mango, discount: 0, payment: "Cash", paid: 100000, hasCustomer: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.total, 25000);
    assert.equal(result.sale.paid, 100000);
    assert.equal(result.sale.change, 75000);
    assert.equal(result.sale.drawer_cash, 25000);
  });

  it("rejects a short cash tender", () => {
    const result = settlePayment({ items: mango, discount: 0, payment: "Cash", paid: 100, hasCustomer: false });
    assert.deepEqual(result, { ok: false, error: "Paid amount is less than total" });
  });

  it("puts a partial credit payment in the drawer and the rest on the balance", () => {
    const result = settlePayment({
      items: [{ price: 19000, cost: 15000, qty: 1 }],
      discount: 0,
      payment: "Credit",
      paid: 5000,
      hasCustomer: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 5000);
    assert.equal(result.sale.balance_due, 14000);
    assert.equal(result.sale.change, 0);
    assert.equal(result.sale.gross_margin, 4000);
  });

  it("keeps a card tender on a credit sale out of the drawer", () => {
    const result = settlePayment({
      items: [{ price: 19000, cost: 15000, qty: 1 }],
      discount: 0,
      payment: "Credit",
      paid: 5000,
      hasCustomer: true,
      tenderMethod: "Card",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 0);
    assert.equal(result.sale.balance_due, 14000);
    assert.equal(result.sale.paid, 5000);
    assert.equal(result.sale.tender_method, "Card");
  });

  it("records a JazzCash credit tender without calling it drawer cash", () => {
    const result = settlePayment({
      items: [{ price: 19000, cost: 15000, qty: 1 }],
      discount: 0,
      payment: "Credit",
      paid: 5000,
      hasCustomer: true,
      tenderMethod: "JazzCash",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 0);
    assert.equal(result.sale.tender_method, "JazzCash");
    assert.equal(result.sale.balance_due, 14000);
  });

  it("records an EasyPaisa credit tender without calling it drawer cash", () => {
    const result = settlePayment({
      items: [{ price: 19000, cost: 15000, qty: 1 }],
      discount: 0,
      payment: "Credit",
      paid: 5000,
      hasCustomer: true,
      tenderMethod: "EasyPaisa",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 0);
    assert.equal(result.sale.tender_method, "EasyPaisa");
    assert.equal(result.sale.balance_due, 14000);
  });

  it("defaults credit partial payment to cash drawer when no tender is given", () => {
    const result = settlePayment({
      items: [{ price: 19000, cost: 15000, qty: 1 }],
      discount: 0,
      payment: "Credit",
      paid: 5000,
      hasCustomer: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 5000);
    assert.equal(result.sale.tender_method, "Cash");
  });

  it("records a full JazzCash sale without drawer cash", () => {
    const result = settlePayment({ items: mango, discount: 0, payment: "JazzCash", paid: 0, hasCustomer: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.drawer_cash, 0);
    assert.equal(result.sale.paid, 25000);
    assert.equal(result.sale.tender_method, "JazzCash");
  });

  it("rejects card overpayment instead of inventing cash change", () => {
    const result = settlePayment({ items: mango, discount: 0, payment: "Card", paid: 30000, hasCustomer: false });
    assert.equal(result.ok, false);
  });

  it("subtracts only cash expenses from the drawer, and every expense from margin", () => {
    const sales = [{ drawer_cash: 76000, gross_margin: 20000 }];
    const expenses = [
      { amount: 2500000, affects_cash: false },
      { amount: 5000, affects_cash: true },
    ];
    assert.equal(expectedDrawer(sales, expenses), 71000);
    assert.equal(marginAfterExpenses(sales, expenses), 20000 - 2505000);
  });

  it("adds exclusive tax on the discounted total and keeps it out of margin", () => {
    const result = settlePayment({
      items: [{ price: 10000, cost: 8000, qty: 1 }],
      discount: 0,
      payment: "Cash",
      paid: 0,
      hasCustomer: false,
      tax: { rateBps: 1800, pricesIncludeTax: false },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.tax, 1800);
    assert.equal(result.sale.total, 11800);
    assert.equal(result.sale.drawer_cash, 11800);
    assert.equal(result.sale.gross_margin, 2000);
  });

  it("extracts inclusive tax and margins the net amount", () => {
    const result = settlePayment({
      items: [{ price: 11800, cost: 8000, qty: 1 }],
      discount: 0,
      payment: "Cash",
      paid: 0,
      hasCustomer: false,
      tax: { rateBps: 1800, pricesIncludeTax: true },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.total, 11800);
    assert.equal(result.sale.tax, 1800);
    assert.equal(result.sale.net, 10000);
    assert.equal(result.sale.gross_margin, 2000);
  });

  it("quotes a discount without floating point", () => {
    const quote = quoteCart([{ price: 19000, cost: 15000, qty: 1 }], 10);
    assert.ok(!("error" in quote));
    if ("error" in quote) return;
    assert.equal(quote.total, 18990);
    assert.equal(quote.gross_margin, 3990);
  });
});

describe("permissions", () => {
  it("lets a cashier sell but not change expenses, pins, or margin visibility", () => {
    assert.equal(can("cashier", "sale.checkout"), true);
    assert.equal(can("cashier", "expense.write"), false);
    assert.equal(can("cashier", "sale.profit"), false);
    assert.equal(can("cashier", "settings.reset"), false);
    assert.equal(deny("cashier", "catalog.delete"), "You do not have permission for this action");
  });

  it("keeps destructive controls with the admin", () => {
    assert.equal(can("manager", "sale.close-day"), true);
    assert.equal(can("manager", "settings.reset"), false);
    assert.equal(can("manager", "catalog.delete"), false);
    assert.equal(can("accountant", "expense.write"), true);
    assert.equal(can("accountant", "sale.checkout"), false);
    assert.equal(can("cashier", "sale.export"), false);
    assert.equal(can("accountant", "sale.export"), true);
    assert.equal(can("admin", "sale.amend-day"), true);
    assert.equal(can("accountant", "sale.amend-day"), false);
    assert.equal(can("manager", "sale.amend-day"), false);
  });
});
