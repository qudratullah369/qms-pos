import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { expectedDrawer, marginAfterExpenses, settlePayment } from "./ledger";
import { businessDate, currencyExponent, toMinor } from "./money";
import { parseProductCsv } from "./csv";
import { deny, canView, type Permission } from "./permissions";
import { applyStockDelta, getStockQty, setBranchStock, upgradeToV8, ensureNextIds } from "./branch-stock";
import { SEED } from "./seed";
import {
  DATA_VERSION,
  DEFAULT_TENDER,
  MAX_BRANCHES,
  type Branch,
  type CartLine,
  type Payment,
  type PosDb,
  type Product,
  type Role,
  type Sale,
  type Settings,
  type TenderMethod,
  type User,
  type View,
} from "./types";

const KEY = "qms_pos_offline_v1";
const MAX_FAILED_LOGINS = 5;

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function syncHash(pin: string, salt: string): string {
  let h = 2166136261;
  const s = `${salt}:${pin}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `sync:${(h >>> 0).toString(16).padStart(8, "0")}`;
}
async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return syncHash(pin, salt);
}
function ensureBranches(db: any): Branch[] {
  if (Array.isArray(db.branches) && db.branches.length > 0) {
    return db.branches.map((b: any) => ({
      id: Number(b.id) || 1,
      name: String(b.name || "Branch"),
      code: String(b.code || "BR"),
      address: String(b.address || ""),
      phone: String(b.phone || ""),
      isActive: b.isActive !== false,
    }));
  }
  return [{ id: 1, name: "Main Store", code: "MAIN", address: "", phone: "", isActive: true }];
}
function taxDefaults(s: Partial<Settings> | null | undefined): Settings {
  return {
    storeName: s?.storeName?.trim() || "QMS POS Store",
    phone: s?.phone?.trim() || "",
    address: s?.address?.trim() || "",
    currency: s?.currency || "PKR",
    locale: s?.locale || "en-PK",
    timeZone: s?.timeZone || "Asia/Karachi",
    taxName: (s?.taxName || "Sales tax").trim() || "Sales tax",
    taxRateBps: Math.min(10000, Math.max(0, Math.round(Number(s?.taxRateBps) || 0))),
    pricesIncludeTax: Boolean(s?.pricesIncludeTax),
    taxRegistration: s?.taxRegistration?.trim() || "",
  };
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function withTax(db: any): PosDb {
  const branches = ensureBranches(db);
  return upgradeToV8({ ...db, branches, settings: taxDefaults(db.settings) }, branches) as PosDb;
}
function guard(role: Role | undefined, permission: Permission): string | null {
  return deny(role, permission);
}
function dayClosed(state: any, date: string, branchId: number): boolean {
  return (state.end_of_days || []).some((e: any) => e.date === date && e.branch_id === branchId);
}
function billId(seq: number): string {
  return `QMS-${String(seq).padStart(5, "0")}`;
}

export type Session = { userId: number; role: Role } | null;
type ProductInput = Omit<Product, "id"> & { id?: number; stock?: number; min_stock?: number };

type PosState = PosDb & {
  session: Session;
  currentBranchId: number;
  view: View;
  cart: CartLine[];
  customerId: number | null;
  payment: Payment;
  tenderMethod: TenderMethod;
  discount: number;
  paid: number;
  lastSale: Sale | null;
  failedLogins?: number;
  stockAt: (productId: number) => number;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  setView: (view: View) => void;
  setCurrentBranch: (id: number) => void;
  saveBranch: (data: Omit<Branch, "id"> & { id?: number }) => string | null;
  deleteBranch: (id: number) => string | null;
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
  saveCustomer: (data: { name: string; phone: string; address: string }, id?: number) => string | null;
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
  saveSupplier: (data: { name: string; phone?: string; address?: string; id?: number }) => string | null;
  createPurchase: (...args: any[]) => string | null;
  receivePurchase: (...args: any[]) => string | null;
  payPurchase: (...args: any[]) => string | null;
  cancelPurchase: (...args: any[]) => string | null;
  createTransfer: (...args: any[]) => string | null;
  dispatchTransfer: (...args: any[]) => string | null;
  receiveTransfer: (...args: any[]) => string | null;
  cancelTransfer: (...args: any[]) => string | null;
};

function emptyCart() {
  return { cart: [] as CartLine[], customerId: null as number | null, payment: "Cash" as Payment, tenderMethod: "Cash" as TenderMethod, discount: 0, paid: 0 };
}
function emptyTill() {
  return { ...emptyCart(), lastSale: null as Sale | null, view: "dashboard" as View };
}
function cloneSeed(): PosDb {
  return structuredClone(SEED);
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      session: null,
      currentBranchId: 1,
      ...emptyTill(),
      tenderMethod: "Cash" as const,
      failedLogins: 0,

      stockAt: (productId) => getStockQty(get().branch_stocks || [], productId, get().currentBranchId),

      login: async (pin) => {
        const state = get();
        const attempts = state.failedLogins ?? 0;
        if (attempts >= MAX_FAILED_LOGINS) return false;
        const trimmed = pin.trim();
        if (!trimmed) { set({ failedLogins: attempts + 1 }); return false; }
        let matched: User | undefined;
        for (const u of state.users) {
          if (u.pinHash && u.pinSalt) {
            if (u.pinHash.startsWith("sync:") && u.pinHash === syncHash(trimmed, u.pinSalt)) { matched = u; break; }
            if ((await hashPin(trimmed, u.pinSalt)) === u.pinHash) { matched = u; break; }
          } else if (u.pin === trimmed) { matched = u; break; }
        }
        if (!matched) { set({ failedLogins: attempts + 1 }); return false; }
        let users = state.users;
        if (matched.pin && !matched.pinHash) {
          const salt = randomSalt();
          const pinHash = await hashPin(trimmed, salt);
          users = state.users.map((u) => u.id === matched!.id ? { id: u.id, name: u.name, role: u.role, pinHash, pinSalt: salt } : u);
        }
        const view = canView(matched.role, "dashboard") ? "dashboard" : "pos";
        const branchId = (state.branches || []).filter((b) => b.isActive)[0]?.id ?? 1;
        set({ users, session: { userId: matched.id, role: matched.role }, view, currentBranchId: branchId, failedLogins: 0 });
        return true;
      },
      logout: () => set({ session: null, ...emptyTill() }),
      setCurrentBranch: (id) => {
        if (!get().branches.find((b) => b.id === id && b.isActive)) return;
        set({ currentBranchId: id, ...emptyCart(), lastSale: null });
      },
      saveBranch: (data) => {
        const denied = guard(get().session?.role, "settings.write");
        if (denied) return denied;
        const name = (data.name || "").trim();
        const code = (data.code || "").trim().toUpperCase();
        if (!name) return "Branch name is required";
        if (!code) return "Branch code is required";
        if (code.length > 8) return "Branch code must be 8 characters or fewer";
        const state = get();
        const branches = state.branches || [];
        const codeTaken = branches.some(
          (b) => b.code.toUpperCase() === code && b.id !== data.id,
        );
        if (codeTaken) return "Branch code already in use";

        if (data.id) {
          const existing = branches.find((b) => b.id === data.id);
          if (!existing) return "Branch not found";
          const becomingActive = data.isActive !== false;
          if (becomingActive && !existing.isActive) {
            const activeCount = branches.filter((b) => b.isActive).length;
            if (activeCount >= MAX_BRANCHES) {
              return `Maximum of ${MAX_BRANCHES} active branches reached`;
            }
          }
          set({
            branches: branches.map((b) =>
              b.id === data.id
                ? {
                    ...b,
                    name,
                    code,
                    address: (data.address || "").trim(),
                    phone: (data.phone || "").trim(),
                    isActive: data.isActive !== false,
                  }
                : b,
            ),
          });
        } else {
          const activeCount = branches.filter((b) => b.isActive).length;
          const willBeActive = data.isActive !== false;
          if (willBeActive && activeCount >= MAX_BRANCHES) {
            return `Maximum of ${MAX_BRANCHES} active branches reached`;
          }
          if (branches.length >= MAX_BRANCHES * 2) {
            return "Too many branch records; deactivate unused branches first";
          }
          const id = state.next.branch;
          set({
            branches: [
              ...branches,
              {
                id,
                name,
                code,
                address: (data.address || "").trim(),
                phone: (data.phone || "").trim(),
                isActive: willBeActive,
              },
            ],
            next: { ...state.next, branch: id + 1 },
          });
        }
        return null;
      },
      deleteBranch: (id) => {
        const denied = guard(get().session?.role, "settings.write");
        if (denied) return denied;
        const state = get();
        const branches = state.branches || [];
        const branch = branches.find((b) => b.id === id);
        if (!branch) return "Branch not found";
        if (!branch.isActive) return null;
        if (state.currentBranchId === id) {
          return "Switch to another branch before deactivating this one";
        }
        const activeCount = branches.filter((b) => b.isActive).length;
        if (activeCount <= 1) {
          return "Cannot deactivate the last active branch";
        }
        set({
          branches: branches.map((b) =>
            b.id === id ? { ...b, isActive: false } : b,
          ),
        });
        return null;
      },
      setView: (view) => { if (!canView(get().session?.role, view)) return; set({ view }); },

      addToCart: (productId) => {
        const denied = guard(get().session?.role, "sale.checkout"); if (denied) return denied;
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return "Product not found";
        const branchStock = getStockQty(state.branch_stocks || [], productId, state.currentBranchId);
        if (branchStock <= 0) return "Out of stock at this branch";
        const existing = state.cart.find((c) => c.product_id === productId);
        const nextQty = (existing?.qty ?? 0) + 1;
        if (nextQty > branchStock) return "Not enough stock at this branch";
        const line: CartLine = { product_id: product.id, qty: nextQty, name: product.name, price: product.selling, cost: product.cost };
        set({ cart: existing ? state.cart.map((c) => (c.product_id === productId ? line : c)) : [...state.cart, line] });
        return null;
      },
      addByCode: (code) => {
        const denied = guard(get().session?.role, "sale.checkout"); if (denied) return denied;
        const needle = code.trim().toLowerCase();
        if (!needle) return "Enter a barcode or name";
        const state = get();
        const product = state.products.find((p) => (p.barcode || "").toLowerCase() === needle) || state.products.find((p) => p.name.toLowerCase() === needle);
        if (!product) return `No match for ${code.trim()}`;
        return get().addToCart(product.id);
      },
      changeQty: (productId, delta) => {
        const denied = guard(get().session?.role, "sale.checkout"); if (denied) return denied;
        const state = get();
        const existing = state.cart.find((c) => c.product_id === productId);
        if (!existing) return "Item not in cart";
        const nextQty = existing.qty + delta;
        if (nextQty <= 0) { set({ cart: state.cart.filter((c) => c.product_id !== productId) }); return null; }
        if (nextQty > getStockQty(state.branch_stocks || [], productId, state.currentBranchId)) return "Not enough stock at this branch";
        set({ cart: state.cart.map((c) => (c.product_id === productId ? { ...c, qty: nextQty } : c)) });
        return null;
      },
      removeLine: (productId) => set({ cart: get().cart.filter((c) => c.product_id !== productId) }),
      clearCart: () => set(emptyCart()),
      setCustomerId: (id) => set({ customerId: id }),
      setPayment: (p) => { set({ payment: p }); if (p === "Cash" || p === "Card" || p === "JazzCash" || p === "EasyPaisa") set({ tenderMethod: p }); },
      setTenderMethod: (t) => set({ tenderMethod: t }),
      setDiscount: (n) => set({ discount: Math.max(0, Math.round(n) || 0) }),
      setPaid: (n) => set({ paid: Math.max(0, Math.round(n) || 0) }),

      checkout: () => {
        const denied = guard(get().session?.role, "sale.checkout"); if (denied) return { ok: false, error: denied };
        const state = get();
        if (!state.cart.length) return { ok: false, error: "Cart is empty" };
        const today = businessDate(new Date(), state.settings.timeZone);
        if (dayClosed(state, today, state.currentBranchId)) return { ok: false, error: "This business day is already closed" };
        let stocks = state.branch_stocks || [];
        for (const line of state.cart) {
          if (getStockQty(stocks, line.product_id, state.currentBranchId) < line.qty)
            return { ok: false, error: `Not enough stock for ${line.name} at this branch` };
        }
        const settlement = settlePayment({
          items: state.cart, discount: state.discount, payment: state.payment, paid: state.paid,
          hasCustomer: state.customerId != null,
          tax: { rateBps: state.settings.taxRateBps, pricesIncludeTax: state.settings.pricesIncludeTax },
          tenderMethod: state.tenderMethod,
        });
        if (!settlement.ok) return settlement;
        const customer = state.customerId != null ? state.customers.find((c) => c.id === state.customerId) : null;
        const id = state.next.sale;
        const sale: Sale = {
          id, branch_id: state.currentBranchId, bill_id: billId(id), created_at: new Date().toISOString(),
          customer_id: customer?.id ?? null, customer_name: customer?.name ?? "Walk-in",
          net: settlement.sale.net, tax: settlement.sale.tax, tax_rate_bps: settlement.sale.tax_rate_bps,
          total: settlement.sale.total, subtotal: settlement.sale.subtotal, discount: settlement.sale.discount,
          paid: settlement.sale.paid, change: settlement.sale.change, drawer_cash: settlement.sale.drawer_cash,
          balance_due: settlement.sale.balance_due, payment: state.payment, tender_method: settlement.sale.tender_method,
          gross_margin: settlement.sale.gross_margin,
          items: state.cart.map((c) => ({ product_id: c.product_id, name: c.name, qty: c.qty, price: c.price, cost: c.cost })),
        };
        const stockMoves = [];
        for (const line of state.cart) {
          const result = applyStockDelta(stocks, line.product_id, state.currentBranchId, -line.qty);
          if ("error" in result) return { ok: false, error: result.error };
          stocks = result.stocks;
          stockMoves.push({
            id: state.next.stock_move + stockMoves.length, branch_id: state.currentBranchId, created_at: sale.created_at,
            product_id: line.product_id, product_name: line.name, delta: -line.qty, stock_after: result.stock_after,
            reason: `Sale ${sale.bill_id}`, user_id: state.session!.userId, ref_type: "sale" as const, ref_id: id,
          });
        }
        let customers = state.customers;
        if (sale.balance_due > 0 && customer) {
          customers = state.customers.map((c) => c.id === customer.id ? { ...c, balance: c.balance + sale.balance_due } : c);
        }
        set({
          branch_stocks: stocks, customers, sales: [...state.sales, sale], stock_moves: [...state.stock_moves, ...stockMoves],
          next: { ...state.next, sale: id + 1, stock_move: state.next.stock_move + stockMoves.length },
          lastSale: sale, ...emptyCart(),
        });
        return { ok: true, sale };
      },

      holdSale: () => {
        const denied = guard(get().session?.role, "sale.hold"); if (denied) return denied;
        const state = get(); if (!state.cart.length) return "Cart is empty";
        const id = state.next.held_sale;
        set({
          held_sales: [...state.held_sales, { id, branch_id: state.currentBranchId, created_at: new Date().toISOString(), customer_id: state.customerId, payment: state.payment, tender_method: state.tenderMethod, discount: state.discount, paid: state.paid, cart: state.cart.map((c) => ({ ...c })) }],
          next: { ...state.next, held_sale: id + 1 }, ...emptyCart(),
        });
        return null;
      },
      resumeSale: (id) => {
        const denied = guard(get().session?.role, "sale.hold"); if (denied) return denied;
        const state = get(); const held = state.held_sales.find((h) => h.id === id);
        if (!held) return "Parked sale not found";
        if (state.cart.length) return "Clear or complete the current cart first";
        if (held.branch_id !== state.currentBranchId) return "Switch to the branch where this sale was parked";
        set({ cart: held.cart.map((c) => ({ ...c })), customerId: held.customer_id, payment: held.payment, tenderMethod: held.tender_method ?? DEFAULT_TENDER, discount: held.discount, paid: held.paid, held_sales: state.held_sales.filter((h) => h.id !== id) });
        return null;
      },
      deleteHeldSale: (id) => set({ held_sales: get().held_sales.filter((h) => h.id !== id) }),

      adjustStock: (productId, delta, reason) => {
        const denied = guard(get().session?.role, "catalog.stock"); if (denied) return denied;
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return "Product not found";
        const result = applyStockDelta(state.branch_stocks || [], productId, state.currentBranchId, delta);
        if ("error" in result) return result.error;
        const moveId = state.next.stock_move;
        set({
          branch_stocks: result.stocks,
          stock_moves: [...state.stock_moves, { id: moveId, branch_id: state.currentBranchId, created_at: new Date().toISOString(), product_id: productId, product_name: product.name, delta, stock_after: result.stock_after, reason: reason.trim() || "Adjustment", user_id: state.session!.userId, ref_type: "adjustment" as const }],
          next: { ...state.next, stock_move: moveId + 1 },
        });
        return null;
      },

      saveProduct: (data) => {
        const denied = guard(get().session?.role, "catalog.write"); if (denied) return denied;
        const name = data.name.trim(); if (!name) return "Product name is required";
        const state = get();
        if (data.id) {
          let stocks = state.branch_stocks || [];
          if (data.stock !== undefined || data.min_stock !== undefined) {
            stocks = setBranchStock(stocks, data.id, state.currentBranchId, { stock: data.stock, min_stock: data.min_stock });
          }
          set({
            products: state.products.map((p) => p.id === data.id ? { id: p.id, name, barcode: data.barcode ? String(data.barcode).trim() || null : null, category_id: data.category_id, cost: Math.round(data.cost), selling: Math.round(data.selling), image: data.image ?? p.image } : p),
            branch_stocks: stocks,
          });
        } else {
          const id = state.next.product;
          set({
            products: [...state.products, { id, name, barcode: data.barcode ? String(data.barcode).trim() || null : null, category_id: data.category_id, cost: Math.round(data.cost), selling: Math.round(data.selling), image: data.image ?? null }],
            branch_stocks: setBranchStock(state.branch_stocks || [], id, state.currentBranchId, { stock: data.stock ?? 0, min_stock: data.min_stock ?? 5 }),
            next: { ...state.next, product: id + 1 },
          });
        }
        return null;
      },
      importProductsCsv: () => ({ imported: 0, errors: ["Use inventory page"] }),
      deleteProduct: (id) => {
        const denied = guard(get().session?.role, "catalog.delete"); if (denied) return denied;
        const state = get();
        set({ products: state.products.filter((p) => p.id !== id), branch_stocks: (state.branch_stocks || []).filter((s) => s.product_id !== id), cart: state.cart.filter((c) => c.product_id !== id) });
        return null;
      },
      saveCategory: (name, id) => {
        const denied = guard(get().session?.role, "catalog.write"); if (denied) return denied;
        const trimmed = name.trim(); if (!trimmed) return "Category name is required";
        const state = get();
        if (id) {
          set({ categories: state.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) });
        } else {
          const nextId = state.next.category;
          set({ categories: [...state.categories, { id: nextId, name: trimmed }], next: { ...state.next, category: nextId + 1 } });
        }
        return null;
      },
      saveCustomer: (data, id) => {
        const denied = guard(get().session?.role, "customer.write"); if (denied) return denied;
        const name = data.name.trim(); if (!name) return "Customer name is required";
        const state = get();
        if (id) {
          set({ customers: state.customers.map((c) => (c.id === id ? { ...c, name, phone: data.phone.trim(), address: data.address.trim() } : c)) });
        } else {
          const nextId = state.next.customer;
          set({ customers: [...state.customers, { id: nextId, name, phone: data.phone.trim(), address: data.address.trim(), balance: 0 }], next: { ...state.next, customer: nextId + 1 } });
        }
        return null;
      },
      receiveCredit: (customerId, amount) => {
        const denied = guard(get().session?.role, "customer.collect"); if (denied) return denied;
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        if (!customer) return "Customer not found";
        const amt = Math.round(amount);
        if (amt <= 0) return "Amount must be positive";
        if (amt > customer.balance) return "Amount exceeds balance";
        set({ customers: state.customers.map((c) => (c.id === customerId ? { ...c, balance: c.balance - amt } : c)) });
        return null;
      },
      saveExpense: (category, description, amount, affectsCash) => {
        const denied = guard(get().session?.role, "expense.write"); if (denied) return denied;
        const state = get();
        const id = state.next.expense;
        set({
          expenses: [...state.expenses, { id, branch_id: state.currentBranchId, created_at: new Date().toISOString(), category: category.trim() || "Other", description: description.trim(), amount: Math.round(amount), affects_cash: Boolean(affectsCash) }],
          next: { ...state.next, expense: id + 1 },
        });
        return null;
      },
      closeDay: (date, cashCounted, notes) => {
        const denied = guard(get().session?.role, "sale.close-day"); if (denied) return denied;
        const state = get();
        if (dayClosed(state, date, state.currentBranchId)) return "This business day is already closed";
        const sales = state.sales.filter((s) => s.branch_id === state.currentBranchId && s.created_at.startsWith(date));
        const expenses = state.expenses.filter((e) => e.branch_id === state.currentBranchId && e.created_at.startsWith(date));
        const salesTotal = sales.reduce((a, s) => a + s.total, 0);
        const cashSales = sales.filter((s) => s.tender_method === "Cash").reduce((a, s) => a + s.drawer_cash, 0);
        const cardSales = sales.filter((s) => s.tender_method === "Card").reduce((a, s) => a + s.total, 0);
        const digitalSales = sales.filter((s) => s.tender_method === "JazzCash" || s.tender_method === "EasyPaisa").reduce((a, s) => a + s.total, 0);
        const creditSales = sales.filter((s) => s.payment === "Credit").reduce((a, s) => a + s.balance_due, 0);
        const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);
        const cashExpenses = expenses.filter((e) => e.affects_cash).reduce((a, e) => a + e.amount, 0);
        const margin = marginAfterExpenses(sales, expenses);
        const expected = expectedDrawer(sales, expenses);
        const id = state.next.end_of_day;
        set({
          end_of_days: [...state.end_of_days, {
            id, branch_id: state.currentBranchId, date, closed_at: new Date().toISOString(), closed_by: state.session!.userId,
            sales_total: salesTotal, cash_sales: cashSales, card_sales: cardSales, digital_sales: digitalSales, credit_sales: creditSales,
            expenses_total: expensesTotal, cash_expenses: cashExpenses, margin_after_expenses: margin, bills: sales.length,
            cash_counted: Math.round(cashCounted), cash_variance: Math.round(cashCounted) - expected, notes: notes.trim(),
          }],
          next: { ...state.next, end_of_day: id + 1 },
        });
        return null;
      },
      amendDay: (date, cashCounted, notes) => {
        const denied = guard(get().session?.role, "sale.amend-day"); if (denied) return denied;
        const state = get();
        const eod = state.end_of_days.find((e) => e.date === date && e.branch_id === state.currentBranchId);
        if (!eod) return "No closed day found for this date";
        const id = state.next.day_amendment;
        set({
          day_amendments: [...state.day_amendments, {
            id, branch_id: state.currentBranchId, end_of_day_id: eod.id, date, amended_at: new Date().toISOString(),
            amended_by: state.session!.userId, cash_counted: Math.round(cashCounted), notes: notes.trim(),
          }],
          end_of_days: state.end_of_days.map((e) => e.id === eod.id ? { ...e, cash_counted: Math.round(cashCounted), cash_variance: Math.round(cashCounted) - (e.cash_counted - e.cash_variance) } : e),
          next: { ...state.next, day_amendment: id + 1 },
        });
        return null;
      },
      saveSettings: (s) => {
        const denied = guard(get().session?.role, "settings.write"); if (denied) return denied;
        set({ settings: taxDefaults(s) });
        return null;
      },
      changePin: async (userId, pin) => {
        const denied = guard(get().session?.role, "settings.pin"); if (denied) return denied;
        const trimmed = pin.trim();
        if (trimmed.length < 4) return "PIN must be at least 4 characters";
        const state = get();
        const user = state.users.find((u) => u.id === userId);
        if (!user) return "User not found";
        const salt = randomSalt();
        const pinHash = await hashPin(trimmed, salt);
        set({ users: state.users.map((u) => u.id === userId ? { id: u.id, name: u.name, role: u.role, pinHash, pinSalt: salt } : u) });
        return null;
      },
      importDb: (raw) => {
        const denied = guard(get().session?.role, "settings.restore"); if (denied) return denied;
        try {
          const db = withTax(raw as any);
          set({ ...db, session: get().session, currentBranchId: get().currentBranchId, ...emptyTill() });
          return null;
        } catch {
          return "Invalid backup data";
        }
      },
      exportDb: () => {
        const denied = guard(get().session?.role, "settings.backup"); if (denied) return null;
        const state = get();
        const { session, currentBranchId, view, cart, customerId, payment, tenderMethod, discount, paid, lastSale, failedLogins, ...db } = state as any;
        return structuredClone(db) as PosDb;
      },
      resetDemo: () => {
        const denied = guard(get().session?.role, "settings.reset"); if (denied) return denied;
        set({ ...cloneSeed(), session: null, currentBranchId: 1, ...emptyTill(), failedLogins: 0 });
        return null;
      },
      dismissReceipt: () => set({ lastSale: null }),

      saveSupplier: (data) => {
        const denied = guard(get().session?.role, "supplier.write");
        if (denied) return denied;
        const name = (data.name || "").trim();
        if (!name) return "Supplier name is required";
        const state = get();
        const phone = (data.phone || "").trim();
        const address = (data.address || "").trim();
        if (data.id) {
          const existing = state.suppliers.find((s) => s.id === data.id);
          if (!existing) return "Supplier not found";
          set({
            suppliers: state.suppliers.map((s) =>
              s.id === data.id ? { ...s, name, phone, address } : s
            ),
          });
        } else {
          const id = state.next.supplier;
          set({
            suppliers: [
              ...state.suppliers,
              { id, name, phone, address, balance: 0 },
            ],
            next: { ...state.next, supplier: id + 1 },
          });
        }
        return null;
      },
      createPurchase: () => "Coming in next commit",
      receivePurchase: () => "Coming in next commit",
      payPurchase: () => "Coming in next commit",
      cancelPurchase: () => "Coming in next commit",
      createTransfer: () => "Coming in next commit",
      dispatchTransfer: () => "Coming in next commit",
      receiveTransfer: () => "Coming in next commit",
      cancelTransfer: () => "Coming in next commit",
    }),
    {
      name: KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version, users: s.users, branches: s.branches, categories: s.categories, products: s.products,
        branch_stocks: s.branch_stocks, customers: s.customers, sales: s.sales, expenses: s.expenses,
        end_of_days: s.end_of_days, day_amendments: s.day_amendments, stock_moves: s.stock_moves,
        suppliers: s.suppliers, purchases: s.purchases, purchase_payments: s.purchase_payments, transfers: s.transfers,
        settings: s.settings, held_sales: s.held_sales, next: s.next, session: s.session, currentBranchId: s.currentBranchId, view: s.view,
        cart: s.cart, customerId: s.customerId, payment: s.payment, tenderMethod: s.tenderMethod,
        discount: s.discount, paid: s.paid, failedLogins: s.failedLogins,
      }),
      migrate: (persisted, version) => withTax(persisted as any),
    },
  ),
);

export function migrateLegacyPos(raw: unknown, version: number): PosDb {
  return withTax({ ...cloneSeed(), ...(raw as object) });
}
