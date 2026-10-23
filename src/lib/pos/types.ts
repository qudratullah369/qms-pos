export type Role = "admin" | "manager" | "cashier" | "accountant";

export type Payment = "Cash" | "JazzCash" | "EasyPaisa" | "Card" | "Credit";

/** Physical/digital tender used to receive money. Independent of commercial payment status (Credit vs paid-in-full). */
export type TenderMethod = "Cash" | "Card" | "JazzCash" | "EasyPaisa";

export type Branch = {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
};

export const MAX_BRANCHES = 10;

export type HeldSale = {
  id: number;
  branch_id: number;
  created_at: string;
  customer_id: number | null;
  payment: Payment;
  /** How money was actually received; defaults to Cash for legacy held sales. */
  tender_method?: TenderMethod;
  discount: number;
  paid: number;
  cart: CartLine[];
};

export type View =
  | "dashboard"
  | "pos"
  | "inventory"
  | "categories"
  | "customers"
  | "sales"
  | "expenses"
  | "purchases"
  | "transfers"
  | "suppliers"
  | "settings";

export type User = { id: number; name: string; role: Role; pin?: string; pinHash?: string; pinSalt?: string };

export type Category = { id: number; name: string };

/**
 * Shared product catalog. Stock lives in BranchStock — never treat Product.stock
 * as authoritative after DATA_VERSION 8. Legacy fields are kept only for migration.
 */
export type Product = {
  id: number;
  name: string;
  barcode: string | null;
  category_id: number;
  /** Integer minor units of the store currency. */
  cost: number;
  /** Integer minor units of the store currency. */
  selling: number;
  /**
   * @deprecated Legacy global stock. Migrated into BranchStock for the default branch.
   * Runtime code must use getBranchStock() / setBranchStock().
   */
  stock?: number;
  /**
   * @deprecated Legacy global min_stock. Migrated into BranchStock.
   */
  min_stock?: number;
  image: string | null;
};

/** Authoritative per-branch inventory quantity and reorder threshold. */
export type BranchStock = {
  product_id: number;
  branch_id: number;
  stock: number;
  min_stock: number;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string;
  /** Integer minor units owed by the customer (shared across branches). */
  balance: number;
};

export type SaleItem = {
  product_id: number;
  name: string;
  qty: number;
  price: number;
  cost: number;
};

export type Sale = {
  id: number;
  branch_id: number;
  bill_id: string;
  created_at: string;
  customer_id: number | null;
  customer_name: string;
  net: number;
  tax: number;
  tax_rate_bps: number;
  total: number;
  subtotal: number;
  discount: number;
  paid: number;
  change: number;
  drawer_cash: number;
  balance_due: number;
  payment: Payment;
  tender_method: TenderMethod;
  gross_margin: number;
  items: SaleItem[];
};

export type Expense = {
  id: number;
  branch_id: number;
  created_at: string;
  category: string;
  description: string;
  amount: number;
  affects_cash: boolean;
};

export type Settings = {
  storeName: string;
  phone: string;
  address: string;
  currency: string;
  locale: string;
  timeZone: string;
  taxName: string;
  taxRateBps: number;
  pricesIncludeTax: boolean;
  taxRegistration: string;
};

export type EndOfDay = {
  id: number;
  branch_id: number;
  date: string;
  closed_at: string;
  closed_by: number;
  sales_total: number;
  cash_sales: number;
  card_sales: number;
  digital_sales: number;
  credit_sales: number;
  expenses_total: number;
  cash_expenses: number;
  margin_after_expenses: number;
  bills: number;
  cash_counted: number;
  cash_variance: number;
  notes: string;
};

export type DayAmendment = {
  id: number;
  branch_id: number;
  end_of_day_id: number;
  date: string;
  amended_at: string;
  amended_by: number;
  cash_counted: number;
  notes: string;
};

export type StockMove = {
  id: number;
  branch_id: number;
  created_at: string;
  product_id: number;
  product_name: string;
  delta: number;
  stock_after: number;
  reason: string;
  user_id: number;
  /** Optional link to transfer / purchase for audit. */
  ref_type?: "sale" | "purchase" | "transfer_out" | "transfer_in" | "adjustment" | "return";
  ref_id?: number;
};

export type CartLine = {
  product_id: number;
  qty: number;
  name: string;
  price: number;
  cost: number;
};

/* ── Purchases & suppliers ─────────────────────────────────────────── */

export type Supplier = {
  id: number;
  name: string;
  phone: string;
  address: string;
  /** Amount we owe the supplier (accounts payable), minor units. */
  balance: number;
};

export type PurchaseStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

export type PurchaseItem = {
  product_id: number;
  name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
};

export type Purchase = {
  id: number;
  branch_id: number;
  supplier_id: number;
  supplier_name: string;
  created_at: string;
  received_at: string | null;
  status: PurchaseStatus;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance_due: number;
  notes: string;
  created_by: number;
};

export type PurchasePayment = {
  id: number;
  purchase_id: number;
  branch_id: number;
  created_at: string;
  amount: number;
  method: TenderMethod | "Bank";
  notes: string;
  user_id: number;
};

/* ── Inter-branch transfers ────────────────────────────────────────── */

export type TransferStatus = "draft" | "dispatched" | "partial" | "received" | "cancelled";

export type TransferItem = {
  product_id: number;
  name: string;
  qty_requested: number;
  qty_dispatched: number;
  qty_received: number;
};

export type StockTransfer = {
  id: number;
  from_branch_id: number;
  to_branch_id: number;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  status: TransferStatus;
  items: TransferItem[];
  notes: string;
  created_by: number;
};

export type NextIds = {
  product: number;
  category: number;
  customer: number;
  sale: number;
  expense: number;
  end_of_day: number;
  held_sale: number;
  stock_move: number;
  day_amendment: number;
  branch: number;
  supplier: number;
  purchase: number;
  purchase_payment: number;
  transfer: number;
};

/** DATA_VERSION 8 introduces branch_stocks, suppliers, purchases, transfers. */
export const DATA_VERSION = 8;

export type PosDb = {
  version: number;
  users: User[];
  branches: Branch[];
  categories: Category[];
  products: Product[];
  /** Authoritative per-branch stock. Key conceptually (product_id, branch_id). */
  branch_stocks: BranchStock[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  end_of_days: EndOfDay[];
  day_amendments: DayAmendment[];
  stock_moves: StockMove[];
  suppliers: Supplier[];
  purchases: Purchase[];
  purchase_payments: PurchasePayment[];
  transfers: StockTransfer[];
  settings: Settings;
  held_sales: HeldSale[];
  next: NextIds;
};

export const PAYMENTS: Payment[] = ["Cash", "JazzCash", "EasyPaisa", "Card", "Credit"];

export const TENDER_METHODS: TenderMethod[] = ["Cash", "Card", "JazzCash", "EasyPaisa"];

export const DEFAULT_TENDER: TenderMethod = "Cash";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salary",
  "Transport",
  "Supplies",
  "Other",
] as const;

export const ROLES: Role[] = ["admin", "manager", "cashier", "accountant"];

export const PURCHASE_STATUSES: PurchaseStatus[] = [
  "draft",
  "ordered",
  "partial",
  "received",
  "cancelled",
];

export const TRANSFER_STATUSES: TransferStatus[] = [
  "draft",
  "dispatched",
  "partial",
  "received",
  "cancelled",
];
