import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessDate } from "./money.ts";

const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  },
});

const { usePosStore, migrateLegacyPos } = await import("./store.ts");

function day() {
  return businessDate(new Date(), "Asia/Karachi");
}

describe("till permissions and cash", () => {
  it("blocks a cashier from recording an expense and lets an admin close the drawer on net cash", async () => {
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().resetDemo(), null);
    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("0000"), true);
    assert.equal(
      usePosStore.getState().saveExpense("Supplies", "bags", 50000, true),
      "You do not have permission for this action",
    );

    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().addByCode("890100000010"), null);
    usePosStore.getState().setPayment("Cash");
    usePosStore.getState().setPaid(50000);
    const sale = usePosStore.getState().checkout();
    assert.equal(sale.ok, true);
    if (!sale.ok) return;
    assert.equal(sale.sale.total, 10000);
    assert.equal(sale.sale.change, 40000);
    assert.equal(sale.sale.drawer_cash, 10000);

    const closed = usePosStore.getState().closeDay(day(), sale.sale.drawer_cash, "counted the new sale only");
    assert.equal(closed, null);
    assert.equal(usePosStore.getState().addByCode("890100000010"), null);
    const blocked = usePosStore.getState().checkout();
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.error, "This business day is already closed");
    assert.equal(usePosStore.getState().closeDay(day(), 0, "again"), "This day is already closed");
  });

  it("keeps a non-cash expense out of the drawer and records credit cash-in", async () => {
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().resetDemo(), null);
    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("1357"), true);
    assert.equal(usePosStore.getState().saveExpense("Supplies", "tape", 5000, false), null);
    assert.match(usePosStore.getState().addByCode("890100000002") ?? "", /permission/i);

    usePosStore.getState().logout();
    usePosStore.getState().login("1234");
    usePosStore.getState().setPayment("Credit");
    usePosStore.getState().setCustomerId(2);
    usePosStore.getState().setPaid(5000);
    assert.equal(usePosStore.getState().addByCode("890100000002"), null);
    const credit = usePosStore.getState().checkout();
    assert.equal(credit.ok, true);
    if (!credit.ok) return;
    assert.equal(credit.sale.drawer_cash, 5000);
    assert.equal(credit.sale.balance_due, 14000);
    const fatima = usePosStore.getState().customers.find((c) => c.id === 2);
    assert.equal(fatima?.balance, 14000);
    assert.equal(usePosStore.getState().closeDay(day(), 81000, "rent stays out of the drawer"), null);
    const closed = usePosStore.getState().end_of_days.find((e) => e.date === day());
    assert.equal(closed?.cash_variance, 0);
    assert.equal(closed?.cash_expenses, 0);
  });

  it("keeps a card payment on a credit sale out of the drawer and off the original close", async () => {
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().resetDemo(), null);
    usePosStore.getState().setPayment("Credit");
    usePosStore.getState().setTenderMethod("Card");
    usePosStore.getState().setCustomerId(2);
    usePosStore.getState().setPaid(5000);
    assert.equal(usePosStore.getState().addByCode("890100000002"), null);
    const credit = usePosStore.getState().checkout();
    assert.equal(credit.ok, true);
    if (!credit.ok) return;
    assert.equal(credit.sale.drawer_cash, 0);
    assert.equal(credit.sale.balance_due, 14000);
    assert.equal(credit.sale.tender_method, "Card");
    const fatima = usePosStore.getState().customers.find((c) => c.id === 2);
    assert.equal(fatima?.balance, 14000);
    const today = day();
    assert.equal(usePosStore.getState().closeDay(today, 76000, "card tender is not cash"), null);
    const original = usePosStore.getState().end_of_days.find((e) => e.date === today);
    assert.ok(original);
    assert.equal(original?.cash_variance, 0);
    assert.equal(usePosStore.getState().addByCode("890100000010"), null);
    const blocked = usePosStore.getState().checkout();
    assert.equal(blocked.ok, false);
    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("1357"), true);
    assert.match(usePosStore.getState().amendDay(today, 75000, "recount") ?? "", /permission/i);
    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().amendDay(today, 75000, "recount"), null);
    const still = usePosStore.getState().end_of_days.find((e) => e.date === today);
    assert.equal(still?.cash_counted, original?.cash_counted);
    assert.equal(still?.notes, original?.notes);
    assert.equal(still?.cash_variance, original?.cash_variance);
    const amendment = usePosStore.getState().day_amendments.find((a) => a.date === today);
    assert.equal(amendment?.cash_counted, 75000);
    assert.equal(amendment?.notes, "recount");
    assert.equal(amendment?.end_of_day_id, original?.id);
  });

  it("exports no PIN material and ignores PIN fields in a restored file", async () => {
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().resetDemo(), null);
    assert.equal(await usePosStore.getState().login("1234"), true);
    const backup = usePosStore.getState().exportDb();
    assert.ok(backup);
    if (!backup) return;
    const encoded = JSON.stringify(backup);
    assert.equal(encoded.includes("1234"), false);
    
    for (const user of backup.users) {
      assert.equal("pin" in user, false);
      assert.equal("pinHash" in user, false);
      assert.equal("pinSalt" in user, false);
    }
    const poisoned = {
      ...backup,
      users: backup.users.map((user) => ({ ...user, pin: "9999", pinHash: "deadbeef", pinSalt: "cafebabe" })),
    };
    assert.equal(usePosStore.getState().importDb(poisoned), null);
    usePosStore.getState().logout();
    assert.equal(await usePosStore.getState().login("9999"), false);
    assert.equal(await usePosStore.getState().login("1234"), true);
  });

  it("locks sign-in after repeated failures without storing a plaintext PIN", async () => {
    assert.equal(await usePosStore.getState().login("1234"), true);
    assert.equal(usePosStore.getState().resetDemo(), null);
    usePosStore.getState().logout();
    for (let i = 0; i < 5; i++) assert.equal(await usePosStore.getState().login("9999"), false);
    assert.equal(await usePosStore.getState().login("1234"), false);
    const admin = usePosStore.getState().users.find((u) => u.role === "admin");
    assert.equal(admin?.pin, undefined);
    assert.ok(admin?.pinHash);
    assert.ok(admin?.pinSalt);
  });
});

describe("version 4 migration", () => {
  it("converts rupee amounts to minor units once and keeps the stored margin", () => {
    const legacy = {
      users: [{ id: 1, role: "admin", pin: "1234" }],
      products: [
        { id: 1, name: "Eggs 12pc", barcode: "890100000004", category_id: 1, cost: 240, selling: 300, stock: 12, min_stock: 4, image: null },
      ],
      customers: [{ id: 1, name: "Ahmed Khan", phone: "0300", address: "Lahore", balance: 450 }],
      sales: [
        {
          id: 1,
          bill_id: "QMS-00003",
          created_at: "2026-10-03T08:00:00.000Z",
          customer_id: null,
          customer_name: "Walk-in",
          subtotal: 720,
          discount: 0,
          total: 720,
          paid: 1000,
          payment: "Cash",
          profit: 170,
          items: [{ product_id: 4, name: "Eggs 12pc", qty: 1, price: 300, cost: 240 }],
        },
      ],
      expenses: [{ id: 1, created_at: "2026-10-01T08:00:00.000Z", category: "Rent", description: "Shop", amount: 25000 }],
      settings: { storeName: "QMS POS Store", phone: "", address: "" },
      next: { product: 2, category: 2, customer: 2, sale: 2, expense: 2 },
    };
    const once = migrateLegacyPos(legacy, 4);
    assert.equal(once.products[0]?.selling, 30000);
    assert.equal(once.products[0]?.cost, 24000);
    assert.equal(once.sales[0]?.total, 72000);
    assert.equal(once.sales[0]?.paid, 100000);
    assert.equal(once.sales[0]?.change, 28000);
    assert.equal(once.sales[0]?.drawer_cash, 72000);
    assert.equal(once.sales[0]?.gross_margin, 17000);
    assert.equal(once.customers[0]?.balance, 45000);
    assert.equal(once.expenses[0]?.amount, 2500000);
    const twice = migrateLegacyPos(once, once.version);
    assert.equal(twice.sales[0]?.total, 72000);
    assert.equal(twice.sales[0]?.gross_margin, 17000);
    assert.equal(twice.products[0]?.selling, 30000);
  });
});
