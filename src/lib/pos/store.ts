import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { expectedDrawer, marginAfterExpenses, settlePayment } from "./ledger";
import { businessDate, CURRENCIES, currencyExponent, toMinor } from "./money";
import { parseProductCsv } from "./csv";
import { deny, canView, type Permission } from "./permissions";
import { SEED } from "./seed";
import {
  DATA_VERSION,
  DEFAULT_TENDER,
  type CartLine,
  type DayAmendment,
  type EndOfDay,
  type HeldSale,
  type Payment,
  type PosDb,
  type Product,
  type Role,
  type Sale,
  type Settings,
  type TenderMethod,
  type View,
} from "./types";

const KEY = "qms_pos_offline_v1";

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeDemoPin(pin: string): string {
  return "demo:" + (typeof btoa === "function" ? btoa(pin) : Buffer.from(pin).toString("base64"));
}

function matchesDemoPin(hash: string, pin: string): boolean {
  if (!hash.startsWith("demo:")) return false;
  const encoded = hash.slice(5);
  const expect = typeof btoa === "function" ? btoa(pin) : Buffer.from(pin).toString("base64");
  return encoded === expect;
}

function normalizeTender(payment: Payment | undefined, tender: unknown): TenderMethod {
  if (tender === "Cash" || tender === "Card" || tender === "JazzCash" || tender === "EasyPaisa") return tender;
  if (payment === "Card" || payment === "JazzCash" || payment === "EasyPaisa") return payment;
  return DEFAULT_TENDER;
}


const MAX_PRODUCTS = 10000;

export type Session = { userId: number; role: Role } | null;

type ProductInput = Omit<Product, "id"> & { id?: number };
type CustomerInput = { name: string; phone: string; address: string };

type PosState = PosDb & {
  session: Session;
  view: View;
  cart: CartLine[];
  customerId: number | null;
  payment: Payment;
  tenderMethod: TenderMethod;
  discount: number;
  paid: number;
  lastSale: Sale | null;
  failedLogins?: number;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setView: (view: View) => void;
  addToCart: (productId: number) => string | null;
  addByCode: (code: string) => string | null;
  changeQty: (productId: number, delta: number) => string | null;
  removeLine: (productId: number) => void;
  clearCart: () => void;
  setCustomerId: (id: number | null) => void;
  setPayment: (p: Payment) => void;
  setTenderMethod: (t: TenderMethod) => void;
  setDiscount: (n: number) => void;
  setPaid: (n: number) => void;
  checkout: () => { ok: true; sale: Sale } | { ok: false; error: string };
  holdSale: () => string | null;
  resumeSale: (id: number) => string | null;
  deleteHeldSale: (id: number) => void;
  adjustStock: (productId: number, delta: number, reason: string) => string | null;
  saveProduct: (data: ProductInput) => string | null;
  importProductsCsv: (text: string) => { imported: number; errors: string[] };
  deleteProduct: (id: number) => string | null;
  saveCategory: (name: string, id?: number) => string | null;
  saveCustomer: (data: CustomerInput, id?: number) => string | null;
  receiveCredit: (customerId: number, amount: number) => string | null;
  saveExpense: (category: string, description: string, amount: number, affectsCash: boolean) => string | null;
  closeDay: (date: string, cashCounted: number, notes: string) => string | null;
  amendDay: (date: string, cashCounted: number, notes: string) => string | null;
  saveSettings: (s: Settings) => string | null;
  changePin: (userId: number, pin: string) => string | null;
  importDb: (raw: unknown) => string | null;
  exportDb: () => PosDb | null;
  resetDemo: () => string | null;
  dismissReceipt: () => void;
};

function cloneSeed(): PosDb {
  return structuredClone(SEED);
}

function emptyCart(): Pick<PosState, "cart" | "customerId" | "payment" | "tenderMethod" | "discount" | "paid"> {
  return { cart: [], customerId: null, payment: "Cash", tenderMethod: "Cash", discount: 0, paid: 0 };
}

function emptyTill(): Pick<PosState, "cart" | "customerId" | "payment" | "discount" | "paid" | "lastSale" | "view"> {
  return { ...emptyCart(), lastSale: null, view: "dashboard" };
}

function asRecord(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object") return null;
  return x as Record<string, unknown>;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function minorFromMajor(value: unknown): number {
  return toMinor(num(value), 2);
}

function taxDefaults(settings: Partial<Settings> | null | undefined): Settings {
  return {
    storeName: settings?.storeName?.trim() || "QMS POS Store",
    phone: settings?.phone?.trim() || "",
    address: settings?.address?.trim() || "",
    currency: settings?.currency || "PKR",
    locale: settings?.locale || "en-PK",
    timeZone: settings?.timeZone || "Asia/Karachi",
    taxName: (settings?.taxName || "Sales tax").trim() || "Sales tax",
    taxRateBps: Math.min(10000, Math.max(0, Math.round(Number(settings?.taxRateBps) || 0))),
    pricesIncludeTax: Boolean(settings?.pricesIncludeTax),
    taxRegistration: settings?.taxRegistration?.trim() || "",
  };
}

function withTax(db: any): PosDb {
  const next = {
    product: Math.max(1, num(db.next?.product) || 1),
    category: Math.max(1, num(db.next?.category) || 1),
    customer: Math.max(1, num(db.next?.customer) || 1),
    sale: Math.max(1, num(db.next?.sale) || 1),
    expense: Math.max(1, num(db.next?.expense) || 1),
    end_of_day: Math.max(1, num(db.next?.end_of_day) || 1),
    held_sale: Math.max(1, num(db.next?.held_sale) || 1),
    stock_move: Math.max(1, num(db.next?.stock_move) || 1),
    day_amendment: Math.max(1, num(db.next?.day_amendment) || 1),
  };
  return {
    ...db,
    version: DATA_VERSION,
    settings: taxDefaults(db.settings),
    sales: (db.sales ?? []).map((s: any) => ({
      ...s,
      net: Number.isFinite(s.net) ? s.net : s.total,
      tax: Number.isFinite(s.tax) ? s.tax : 0,
      tax_rate_bps: Number.isFinite(s.tax_rate_bps) ? s.tax_rate_bps : 0,
      tender_method: normalizeTender(s.payment, s.tender_method),
      drawer_cash: Number.isFinite(s.drawer_cash) ? s.drawer_cash : 0,
      balance_due: Number.isFinite(s.balance_due) ? s.balance_due : 0,
      change: Number.isFinite(s.change) ? s.change : 0,
    })),
    day_amendments: Array.isArray(db.day_amendments) ? db.day_amendments : [],
    end_of_days: Array.isArray(db.end_of_days) ? db.end_of_days : [],
    stock_moves: Array.isArray(db.stock_moves) ? db.stock_moves : [],
    held_sales: Array.isArray(db.held_sales) ? db.held_sales : [],
    next,
  };
}

function upgradeV4(raw: unknown): PosDb {
  const base = cloneSeed();
  const d = asRecord(raw);
  if (!d || !Array.isArray(d.users) || !Array.isArray(d.products) || !Array.isArray(d.sales)) return withTax(base);
  const products = (d.products as Product[]).map((p) => ({
    ...p,
    cost: minorFromMajor(p.cost),
    selling: minorFromMajor(p.selling),
  }));
  const sales = (d.sales as Sale[]).map((s) => {
    const total = minorFromMajor(s.total);
    const paid = minorFromMajor(s.paid);
    const payment = s.payment;
    const change = payment === "Cash" ? Math.max(0, paid - total) : 0;
    const drawer = payment === "Cash" ? total : payment === "Credit" ? Math.min(paid, total) : 0;
    return {
      ...s,
      subtotal: minorFromMajor(s.subtotal),
      discount: minorFromMajor(s.discount),
      total,
      paid,
      change,
      drawer_cash: drawer,
      balance_due: payment === "Credit" ? Math.max(0, total - Math.min(paid, total)) : 0,
      gross_margin: minorFromMajor((s as Sale & { profit?: number }).gross_margin ?? (s as { profit?: number }).profit),
      net: total,
      tax: 0,
      tax_rate_bps: 0,
      tender_method: normalizeTender(payment, (s as any).tender_method),
      items: (s.items ?? []).map((item) => ({
        ...item,
        price: minorFromMajor(item.price),
        cost: minorFromMajor(item.cost),
      })),
    };
  });
  const users = (d.users as PosDb["users"]).map((u) => ({
    id: u.id,
    name: u.name || u.role,
    role: u.role,
    pin: u.pin ?? "",
  }));
  const ensure = (roleUser: { id: number; name: string; role: Role; pin?: string }) => {
    if (users.some((u) => u.role === roleUser.role)) return;
    const id = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    users.push({ ...roleUser, id, pin: roleUser.pin ?? "" });
  };
  ensure(base.users[1]!);
  ensure(base.users[2]!);
  ensure(base.users[3]!);
  const oldSettings = asRecord(d.settings);
  return withTax({
    version: 5,
    users,
    categories: Array.isArray(d.categories) ? (d.categories as PosDb["categories"]) : base.categories,
    products,
    customers: Array.isArray(d.customers)
      ? (d.customers as PosDb["customers"]).map((c) => ({ ...c, balance: minorFromMajor(c.balance) }))
      : [],
    sales,
    expenses: Array.isArray(d.expenses)
      ? (d.expenses as PosDb["expenses"]).map((e) => ({
          ...e,
          amount: minorFromMajor(e.amount),
          affects_cash: false,
        }))
      : [],
    end_of_days: Array.isArray(d.end_of_days)
      ? (d.end_of_days as PosDb["end_of_days"]).map((e) => ({
          ...e,
          sales_total: minorFromMajor(e.sales_total),
          cash_sales: minorFromMajor(e.cash_sales),
          card_sales: minorFromMajor(e.card_sales),
          digital_sales: minorFromMajor(e.digital_sales),
          credit_sales: minorFromMajor(e.credit_sales),
          expenses_total: minorFromMajor(e.expenses_total),
          cash_expenses: minorFromMajor(e.cash_expenses),
          margin_after_expenses: minorFromMajor(
            (e as EndOfDay & { profit?: number }).margin_after_expenses ?? (e as { profit?: number }).profit,
          ),
          cash_counted: minorFromMajor(e.cash_counted),
          cash_variance: minorFromMajor(e.cash_variance),
        }))
      : [],
    stock_moves: [],
    held_sales: Array.isArray(d.held_sales)
      ? (d.held_sales as HeldSale[]).map((h) => ({
          ...h,
          discount: minorFromMajor(h.discount),
          paid: minorFromMajor(h.paid),
          cart: (h.cart ?? []).map((line) => ({
            ...line,
            price: minorFromMajor(line.price),
            cost: minorFromMajor(line.cost),
          })),
        }))
      : [],
    settings: {
      storeName: String(oldSettings?.storeName || base.settings.storeName),
      phone: String(oldSettings?.phone || ""),
      address: String(oldSettings?.address || ""),
      currency: "PKR",
      locale: "en-PK",
      timeZone: "Asia/Karachi",
      taxName: "Sales tax",
      taxRateBps: 0,
      pricesIncludeTax: false,
      taxRegistration: "",
    },
    next: {
      ...base.next,
      ...(asRecord(d.next) as Partial<PosDb["next"]> | null),
      stock_move: num(asRecord(d.next)?.stock_move) || 1,
    },
  });
}

function isDb(x: unknown): x is PosDb {
  const d = asRecord(x);
  return !!d && Array.isArray(d.users) && Array.isArray(d.products) && Array.isArray(d.sales);
}

function matchProduct(products: Product[], code: string): Product | undefined {
  const q = code.trim().toLowerCase();
  if (!q) return undefined;
  return (
    products.find((p) => (p.barcode || "").toLowerCase() === q) ||
    products.find((p) => p.name.toLowerCase() === q)
  );
}

function guard(role: Role | undefined, permission: Permission): string | null {
  return deny(role, permission);
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      session: null,
      ...emptyTill(),
      tenderMethod: "Cash" as const,
      failedLogins: 0,

      login: async (pin) => {
        const state = get();
        const attempts = state.failedLogins ?? 0;
        if (attempts >= 5) return false;
        const trimmed = pin.trim();
        let user = state.users.find((u) => u.pin === trimmed);
        if (!user) {
          for (const u of state.users) {
            if (u.pinHash && matchesDemoPin(u.pinHash, trimmed)) {
              user = u;
              break;
            }
          }
        }
        if (!user) {
          set({ failedLogins: attempts + 1 });
          return false;
        }
        const view = canView(user.role, "dashboard") ? "dashboard" : "sales";
        set({ session: { userId: user.id, role: user.role }, view, failedLogins: 0 });
        return true;
      },

      logout: () => set({ session: null, ...emptyTill() }),

      setView: (view) => {
        const role = get().session?.role;
        if (!canView(role, view)) return;
        set({ view });
      },

      addToCart: (productId) => {
        const denied = guard(get().session?.role, "sale.checkout");
        if (denied) return denied;
        const p = get().products.find((x) => x.id === productId);
        if (!p) return "Product not found";
        if (p.stock <= 0) return "Out of stock";
        const cart = get().cart.slice();
        const line = cart.find((c) => c.product_id === productId);
        if (line) {
          if (line.qty >= p.stock) return "Stock limit reached";
          line.qty += 1;
        } else {
          cart.push({ product_id: p.id, qty: 1, name: p.name, price: p.selling, cost: p.cost });
        }
        set({ cart });
        return null;
      },

      addByCode: (code) => {
        const denied = guard(get().session?.role, "sale.checkout");
        if (denied) return denied;
        const p = matchProduct(get().products, code);
        if (!p) return `Barcode not found: ${code.trim()}`;
        return get().addToCart(p.id);
      },

      changeQty: (productId, delta) => {
        const denied = guard(get().session?.role, "sale.checkout");
        if (denied) return denied;
        const p = get().products.find((x) => x.id === productId);
        const cart = get().cart.slice();
        const line = cart.find((c) => c.product_id === productId);
        if (!line || !p) return "Not in cart";
        if (delta > 0 && line.qty >= p.stock) return "Stock limit reached";
        line.qty += delta;
        set({ cart: line.qty <= 0 ? cart.filter((c) => c.product_id !== productId) : cart });
        return null;
      },

      removeLine: (productId) => {
        if (guard(get().session?.role, "sale.checkout")) return;
        set({ cart: get().cart.filter((c) => c.product_id !== productId) });
      },

      clearCart: () => {
        if (guard(get().session?.role, "sale.checkout")) return;
        set(emptyCart());
      },

      setCustomerId: (id) => set({ customerId: id }),
      setPayment: (p) => set({ payment: p }),
      setTenderMethod: (t) => set({ tenderMethod: t }),
      setDiscount: (n) => set({ discount: Math.max(0, Math.round(n) || 0) }),
      setPaid: (n) => set({ paid: Math.max(0, Math.round(n) || 0) }),

      holdSale: () => {
        const denied = guard(get().session?.role, "sale.hold");
        if (denied) return denied;
        const state = get();
        if (!state.cart.length) return "Cart is empty";
        const held: HeldSale = {
          id: state.next.held_sale,
          created_at: new Date().toISOString(),
          customer_id: state.customerId,
          payment: state.payment,
          tender_method: state.tenderMethod,
          discount: state.discount,
          paid: state.paid,
          cart: state.cart.map((x) => ({ ...x })),
        };
        set({
          held_sales: [...state.held_sales, held],
          next: { ...state.next, held_sale: state.next.held_sale + 1 },
          ...emptyCart(),
        });
        return null;
      },

      resumeSale: (id) => {
        const denied = guard(get().session?.role, "sale.hold");
        if (denied) return denied;
        const held = get().held_sales.find((x) => x.id === id);
        if (!held) return "Held sale not found";
        if (get().cart.length) return "Clear or hold the current cart first";
        set({
          cart: held.cart.map((x) => ({ ...x })),
          customerId: held.customer_id,
          payment: held.payment,
          tenderMethod: held.tender_method ?? "Cash",
          discount: held.discount,
          paid: held.paid,
          held_sales: get().held_sales.filter((x) => x.id !== id),
          view: "pos",
        });
        return null;
      },

      deleteHeldSale: (id) => {
        if (guard(get().session?.role, "sale.hold")) return;
        set({ held_sales: get().held_sales.filter((x) => x.id !== id) });
      },

      adjustStock: (productId, delta, reason) => {
        const denied = guard(get().session?.role, "catalog.stock");
        if (denied) return denied;
        if (!Number.isFinite(delta) || delta === 0) return "Enter a valid stock adjustment";
        const why = reason.trim();
        if (why.length < 3) return "Enter a reason for the stock change";
        const p = get().products.find((x) => x.id === productId);
        if (!p) return "Product not found";
        const nextStock = p.stock + delta;
        if (nextStock < 0) return "Stock cannot be negative";
        const move = {
          id: get().next.stock_move,
          created_at: new Date().toISOString(),
          product_id: p.id,
          product_name: p.name,
          delta,
          stock_after: nextStock,
          reason: why,
          user_id: get().session?.userId ?? 0,
        };
        set({
          products: get().products.map((x) => (x.id === productId ? { ...x, stock: nextStock } : x)),
          stock_moves: [...get().stock_moves, move],
          next: { ...get().next, stock_move: get().next.stock_move + 1 },
        });
        return null;
      },

      checkout: () => {
        const denied = guard(get().session?.role, "sale.checkout");
        if (denied) return { ok: false, error: denied };
        const state = get();
        if (!state.cart.length) return { ok: false, error: "Cart is empty" };
        const day = businessDate(new Date(), state.settings.timeZone);
        if (state.end_of_days.some((e) => e.date === day)) {
          return { ok: false, error: "This business day is already closed" };
        }
        if (state.payment === "Credit" && guard(state.session?.role, "sale.credit")) {
          return { ok: false, error: "You do not have permission for credit sales" };
        }
        if (state.discount > 0 && guard(state.session?.role, "sale.discount")) {
          return { ok: false, error: "You do not have permission to discount a sale" };
        }
        for (const line of state.cart) {
          const p = state.products.find((x) => x.id === line.product_id);
          if (!p || p.stock < line.qty) return { ok: false, error: `Insufficient stock: ${p?.name ?? "product"}` };
        }
        const settled = settlePayment({
          items: state.cart,
          discount: state.discount,
          payment: state.payment,
          paid: state.paid,
          hasCustomer: state.customerId != null,
          tax: { rateBps: state.settings.taxRateBps, pricesIncludeTax: state.settings.pricesIncludeTax },
          tenderMethod: state.tenderMethod,
        });
        if (!settled.ok) return settled;
        const customer = state.customers.find((c) => c.id === state.customerId) ?? null;
        const sale: Sale = {
          id: state.next.sale,
          bill_id: "QMS-" + String(state.next.sale).padStart(5, "0"),
          created_at: new Date().toISOString(),
          customer_id: state.customerId,
          customer_name: customer?.name ?? "Walk-in",
          payment: state.payment,
          items: state.cart.map((c) => ({ ...c })),
          ...settled.sale,
        };
        const nextProducts = state.products.map((p) => {
          const line = state.cart.find((c) => c.product_id === p.id);
          return line ? { ...p, stock: p.stock - line.qty } : p;
        });
        const nextCustomers =
          sale.balance_due > 0 && customer
            ? state.customers.map((c) => (c.id === customer.id ? { ...c, balance: (c.balance || 0) + sale.balance_due } : c))
            : state.customers;
        set({
          products: nextProducts,
          customers: nextCustomers,
          sales: [...state.sales, sale],
          next: { ...state.next, sale: state.next.sale + 1 },
          ...emptyCart(),
          lastSale: sale,
        });
        return { ok: true, sale };
      },

      saveProduct: (data) => {
        const denied = guard(get().session?.role, "catalog.write");
        if (denied) return denied;
        if (!data.name.trim() || data.selling <= 0 || data.cost < 0 || data.stock < 0) return "Enter valid product data";
        if (!Number.isSafeInteger(data.selling) || !Number.isSafeInteger(data.cost)) return "Prices must be in minor units";
        const { products, next } = get();
        const barcode = data.barcode?.trim() || null;
        if (barcode && products.some((p) => p.barcode === barcode && p.id !== data.id)) return "Barcode already exists";
        if (!data.id && products.length >= MAX_PRODUCTS) return `Product capacity reached (${MAX_PRODUCTS})`;
        if (data.id) {
          set({
            products: products.map((p) => (p.id === data.id ? { ...p, ...data, id: p.id, barcode } : p)),
          });
        } else {
          set({
            products: [...products, { ...data, id: next.product, name: data.name.trim(), barcode }],
            next: { ...next, product: next.product + 1 },
          });
        }
        return null;
      },

      importProductsCsv: (text) => {
        const denied = guard(get().session?.role, "catalog.import");
        if (denied) return { imported: 0, errors: [denied] };
        const parsed = parseProductCsv(text);
        const exponent = currencyExponent(get().settings.currency);
        let imported = 0;
        const errors = [...parsed.errors];
        for (const row of parsed.rows) {
          let categoryId = get().categories[0]?.id ?? 0;
          if (row.category) {
            const existing = get().categories.find((c) => c.name.toLowerCase() === row.category!.toLowerCase());
            if (existing) categoryId = existing.id;
            else {
              const catErr = get().saveCategory(row.category);
              if (catErr) {
                errors.push(`${row.name}: ${catErr}`);
                continue;
              }
              const created = get().categories.find((c) => c.name.toLowerCase() === row.category!.toLowerCase());
              if (created) categoryId = created.id;
            }
          }
          const cost = toMinor(row.cost, exponent);
          const selling = toMinor(row.selling, exponent);
          const err = get().saveProduct({
            name: row.name,
            barcode: row.barcode,
            category_id: categoryId,
            cost: Number.isFinite(cost) ? cost : -1,
            selling: Number.isFinite(selling) ? selling : 0,
            stock: row.stock,
            min_stock: row.min_stock,
            image: null,
          });
          if (err) errors.push(`${row.name}: ${err}`);
          else imported += 1;
        }
        return { imported, errors };
      },

      deleteProduct: (id) => {
        const denied = guard(get().session?.role, "catalog.delete");
        if (denied) return denied;
        set({ products: get().products.filter((p) => p.id !== id) });
        return null;
      },

      saveCategory: (name, id) => {
        const denied = guard(get().session?.role, "catalog.write");
        if (denied) return denied;
        const trimmed = name.trim();
        if (!trimmed) return "Enter category name";
        const { categories, next } = get();
        if (id) {
          set({ categories: categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) });
        } else {
          if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return "Category already exists";
          set({
            categories: [...categories, { id: next.category, name: trimmed }],
            next: { ...next, category: next.category + 1 },
          });
        }
        return null;
      },

      saveCustomer: (data, id) => {
        const denied = guard(get().session?.role, "customer.write");
        if (denied) return denied;
        const name = data.name.trim();
        if (!name) return "Enter customer name";
        const { customers, next } = get();
        if (id) {
          set({
            customers: customers.map((c) =>
              c.id === id ? { ...c, name, phone: data.phone.trim(), address: data.address.trim() } : c,
            ),
          });
        } else {
          set({
            customers: [
              ...customers,
              { id: next.customer, name, phone: data.phone.trim(), address: data.address.trim(), balance: 0 },
            ],
            next: { ...next, customer: next.customer + 1 },
          });
        }
        return null;
      },

      receiveCredit: (customerId, amount) => {
        const denied = guard(get().session?.role, "customer.collect");
        if (denied) return denied;
        if (!Number.isSafeInteger(amount) || amount <= 0) return "Enter a valid amount";
        const day = businessDate(new Date(), get().settings.timeZone);
        if (get().end_of_days.some((e) => e.date === day)) return "This business day is already closed";
        const c = get().customers.find((x) => x.id === customerId);
        if (!c) return "Customer not found";
        const applied = Math.min(c.balance || 0, amount);
        if (applied <= 0) return "This customer has nothing to collect";
        const sale: Sale = {
          id: get().next.sale,
          bill_id: "QMS-" + String(get().next.sale).padStart(5, "0"),
          created_at: new Date().toISOString(),
          customer_id: customerId,
          customer_name: c.name,
          subtotal: 0,
          discount: 0,
          net: 0,
          tax: 0,
          tax_rate_bps: 0,
          total: 0,
          paid: applied,
          change: 0,
          drawer_cash: applied,
          balance_due: 0,
          payment: "Cash",
          tender_method: "Cash",
          gross_margin: 0,
          items: [],
        };
        set({
          customers: get().customers.map((x) => (x.id === customerId ? { ...x, balance: (x.balance || 0) - applied } : x)),
          sales: [...get().sales, sale],
          next: { ...get().next, sale: get().next.sale + 1 },
        });
        return null;
      },

      saveExpense: (category, description, amount, affectsCash) => {
        const denied = guard(get().session?.role, "expense.write");
        if (denied) return denied;
        if (!Number.isSafeInteger(amount) || amount <= 0) return "Enter a valid amount";
        const day = businessDate(new Date(), get().settings.timeZone);
        if (get().end_of_days.some((e) => e.date === day)) return "This business day is already closed";
        const { expenses, next } = get();
        set({
          expenses: [
            ...expenses,
            {
              id: next.expense,
              created_at: new Date().toISOString(),
              category,
              description: description.trim(),
              amount,
              affects_cash: affectsCash,
            },
          ],
          next: { ...next, expense: next.expense + 1 },
        });
        return null;
      },

      closeDay: (date, cashCounted, notes) => {
        const denied = guard(get().session?.role, "sale.close-day");
        if (denied) return denied;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Invalid business date";
        if (!Number.isSafeInteger(cashCounted) || cashCounted < 0) return "Enter a valid cash count";
        const state = get();
        if (state.end_of_days.some((e) => e.date === date)) return "This day is already closed";
        const salesForDay = state.sales.filter((s) => businessDate(new Date(s.created_at), state.settings.timeZone) === date);
        const expensesForDay = state.expenses.filter(
          (e) => businessDate(new Date(e.created_at), state.settings.timeZone) === date,
        );
        let card_sales = 0;
        let digital_sales = 0;
        for (const s of salesForDay) {
          const tender = s.tender_method ?? normalizeTender(s.payment, undefined);
          if (tender === "Card") card_sales += s.payment === "Credit" ? s.paid : s.total;
          else if (tender === "JazzCash" || tender === "EasyPaisa") digital_sales += s.payment === "Credit" ? s.paid : s.total;
        }
        const record: EndOfDay = {
          id: state.next.end_of_day,
          date,
          closed_at: new Date().toISOString(),
          closed_by: state.session?.userId ?? 0,
          sales_total: salesForDay.reduce((a, s) => a + s.total, 0),
          cash_sales: salesForDay.reduce((a, s) => a + (s.drawer_cash || 0), 0),
          card_sales,
          digital_sales,
          credit_sales: salesForDay.filter((s) => s.payment === "Credit").reduce((a, s) => a + s.balance_due, 0),
          expenses_total: expensesForDay.reduce((a, e) => a + e.amount, 0),
          cash_expenses: expensesForDay.filter((e) => e.affects_cash).reduce((a, e) => a + e.amount, 0),
          margin_after_expenses: marginAfterExpenses(salesForDay, expensesForDay),
          bills: salesForDay.length,
          cash_counted: cashCounted,
          cash_variance: cashCounted - expectedDrawer(salesForDay, expensesForDay),
          notes: notes.trim(),
        };
        set({
          end_of_days: [...state.end_of_days, record],
          next: { ...state.next, end_of_day: state.next.end_of_day + 1 },
        });
        return null;
      },

      amendDay: (date, cashCounted, notes) => {
        const denied = guard(get().session?.role, "sale.amend-day");
        if (denied) return denied;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Invalid business date";
        if (!Number.isSafeInteger(cashCounted) || cashCounted < 0) return "Enter a valid cash count";
        const state = get();
        const original = state.end_of_days.find((e) => e.date === date);
        if (!original) return "No closed day found for this date";
        const amendment: DayAmendment = {
          id: state.next.day_amendment,
          end_of_day_id: original.id,
          date,
          amended_at: new Date().toISOString(),
          amended_by: state.session?.userId ?? 0,
          cash_counted: cashCounted,
          notes: notes.trim(),
        };
        set({
          day_amendments: [...(state.day_amendments ?? []), amendment],
          next: { ...state.next, day_amendment: state.next.day_amendment + 1 },
        });
        return null;
      },

      saveSettings: (s) => {
        const denied = guard(get().session?.role, "settings.write");
        if (denied) return denied;
        if (!CURRENCIES[s.currency]) return "Choose a supported currency";
        if (!s.timeZone.trim()) return "Choose a timezone";
        set({ settings: taxDefaults(s) });
        return null;
      },

      changePin: (userId, pin) => {
        const denied = guard(get().session?.role, "settings.pin");
        if (denied) return denied;
        const trimmed = pin.trim();
        if (!/^\d{4,8}$/.test(trimmed)) return "PIN must be 4–8 digits";
        if (get().users.some((u) => u.pin === trimmed && u.id !== userId)) return "PIN already in use";
        if (!get().users.some((u) => u.id === userId)) return "Staff member not found";
        set({
          users: get().users.map((u) => {
            if (u.id !== userId) return u;
            const { pin: _p, ...rest } = u as any;
            return { ...rest, pinHash: encodeDemoPin(trimmed), pinSalt: randomSalt() };
          }),
        });
        return null;
      },

      importDb: (raw) => {
        const denied = guard(get().session?.role, "settings.restore");
        if (denied) return denied;
        if (!isDb(raw)) return "Invalid backup file";
        const incoming = asRecord(raw);
        const version = num(incoming?.version);
        const db = withTax(version >= 5 ? (raw as PosDb) : upgradeV4(raw));
        const currentUsers = get().users;
        set({
          ...db,
          version: DATA_VERSION,
          users: currentUsers,
          stock_moves: Array.isArray(db.stock_moves) ? db.stock_moves : [],
          end_of_days: Array.isArray(db.end_of_days) ? db.end_of_days : [],
          day_amendments: Array.isArray((db as any).day_amendments) ? (db as any).day_amendments : [],
          held_sales: Array.isArray(db.held_sales) ? db.held_sales : [],
          session: get().session,
          ...emptyTill(),
        });
        return null;
      },

      exportDb: () => {
        if (guard(get().session?.role, "settings.backup")) return null;
        const s = get();
        return {
          version: DATA_VERSION,
          users: s.users.map((u) => {
            const { pin, pinHash, pinSalt, ...rest } = u as any;
            return rest;
          }),
          categories: s.categories,
          products: s.products,
          customers: s.customers,
          sales: s.sales,
          expenses: s.expenses,
          end_of_days: s.end_of_days,
          day_amendments: s.day_amendments ?? [],
          stock_moves: s.stock_moves,
          settings: s.settings,
          held_sales: s.held_sales,
          next: s.next,
        };
      },

      resetDemo: () => {
        const denied = guard(get().session?.role, "settings.reset");
        if (denied) return denied;
        const seed = cloneSeed();
        const users = seed.users.map((u) => {
          const pin = u.pin || "";
          const { pin: _drop, ...rest } = u as any;
          return { ...rest, pinHash: encodeDemoPin(pin), pinSalt: randomSalt() };
        });
        set({ ...seed, users, session: get().session, ...emptyTill(), failedLogins: 0 } as any);
        return null;
      },

      dismissReceipt: () => set({ lastSale: null }),
    }),
    {
      name: KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persisted, version) => {
        const db = version < 5 ? upgradeV4(persisted) : withTax({ ...cloneSeed(), ...(persisted as PosDb) });
        return db as PosState;
      },
      partialize: (s) => ({
        version: s.version,
        users: s.users,
        categories: s.categories,
        products: s.products,
        customers: s.customers,
        sales: s.sales,
        expenses: s.expenses,
        end_of_days: s.end_of_days,
        day_amendments: s.day_amendments,
        stock_moves: s.stock_moves,
        settings: s.settings,
        next: s.next,
        session: s.session,
        view: s.view,
        cart: s.cart,
        customerId: s.customerId,
        payment: s.payment,
        tenderMethod: s.tenderMethod,
        discount: s.discount,
        paid: s.paid,
        held_sales: s.held_sales,
      }),
    },
  ),
);


export function migrateLegacyPos(raw: unknown, version: number): PosDb {
  if (version < 5) return withTax(upgradeV4(raw));
  return withTax({ ...cloneSeed(), ...(raw as PosDb) });
}
