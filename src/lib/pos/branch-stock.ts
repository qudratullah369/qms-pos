import type { Branch, BranchStock, PosDb, Product } from "./types";
import { DATA_VERSION } from "./types";

export function stockKey(productId: number, branchId: number): string {
  return `${productId}:${branchId}`;
}

export function getBranchStock(
  stocks: BranchStock[],
  productId: number,
  branchId: number,
): BranchStock {
  const found = stocks.find((s) => s.product_id === productId && s.branch_id === branchId);
  return found ?? { product_id: productId, branch_id: branchId, stock: 0, min_stock: 0 };
}

export function getStockQty(stocks: BranchStock[], productId: number, branchId: number): number {
  return getBranchStock(stocks, productId, branchId).stock;
}

/** Upsert a branch stock row. Returns a new array (immutable). */
export function setBranchStock(
  stocks: BranchStock[],
  productId: number,
  branchId: number,
  patch: Partial<Pick<BranchStock, "stock" | "min_stock">>,
): BranchStock[] {
  const idx = stocks.findIndex((s) => s.product_id === productId && s.branch_id === branchId);
  if (idx >= 0) {
    const next = [...stocks];
    next[idx] = {
      ...next[idx]!,
      stock: patch.stock !== undefined ? Math.max(0, Math.round(patch.stock)) : next[idx]!.stock,
      min_stock:
        patch.min_stock !== undefined ? Math.max(0, Math.round(patch.min_stock)) : next[idx]!.min_stock,
    };
    return next;
  }
  return [
    ...stocks,
    {
      product_id: productId,
      branch_id: branchId,
      stock: Math.max(0, Math.round(patch.stock ?? 0)),
      min_stock: Math.max(0, Math.round(patch.min_stock ?? 0)),
    },
  ];
}

/** Apply a signed delta; returns null if resulting stock would be negative. */
export function applyStockDelta(
  stocks: BranchStock[],
  productId: number,
  branchId: number,
  delta: number,
): { stocks: BranchStock[]; stock_after: number } | { error: string } {
  const current = getStockQty(stocks, productId, branchId);
  const after = current + delta;
  if (after < 0) return { error: "Insufficient stock at this branch" };
  return {
    stocks: setBranchStock(stocks, productId, branchId, { stock: after }),
    stock_after: after,
  };
}

/**
 * Migrate legacy Product.stock into BranchStock for the default branch only.
 * Idempotent: if branch_stocks already covers a product+default branch, leave it.
 * Other branches are NOT given a copy of the stock.
 */
export function migrateToBranchStocks(db: any, defaultBranchId: number): BranchStock[] {
  const existing: BranchStock[] = Array.isArray(db.branch_stocks)
    ? db.branch_stocks.map((s: any) => ({
        product_id: Number(s.product_id),
        branch_id: Number(s.branch_id),
        stock: Math.max(0, Math.round(Number(s.stock) || 0)),
        min_stock: Math.max(0, Math.round(Number(s.min_stock) || 0)),
      }))
    : [];

  const products: Product[] = Array.isArray(db.products) ? db.products : [];
  let stocks = [...existing];

  for (const p of products) {
    const hasRow = stocks.some((s) => s.product_id === p.id && s.branch_id === defaultBranchId);
    if (hasRow) continue;
    // Only migrate if legacy stock field exists (undefined means already cleaned)
    const legacyStock = p.stock;
    const legacyMin = p.min_stock;
    if (legacyStock === undefined && legacyMin === undefined && existing.length > 0) {
      // Already on v8 with no legacy fields — ensure zero row only if needed later at runtime
      continue;
    }
    stocks = setBranchStock(stocks, p.id, defaultBranchId, {
      stock: Math.max(0, Math.round(Number(legacyStock) || 0)),
      min_stock: Math.max(0, Math.round(Number(legacyMin) || 5)),
    });
  }

  return stocks;
}

export function stripLegacyProductStock(products: Product[]): Product[] {
  return products.map(({ stock: _s, min_stock: _m, ...rest }) => rest as Product);
}

export function ensureNextIds(next: any) {
  return {
    product: Math.max(1, Number(next?.product) || 1),
    category: Math.max(1, Number(next?.category) || 1),
    customer: Math.max(1, Number(next?.customer) || 1),
    sale: Math.max(1, Number(next?.sale) || 1),
    expense: Math.max(1, Number(next?.expense) || 1),
    end_of_day: Math.max(1, Number(next?.end_of_day) || 1),
    held_sale: Math.max(1, Number(next?.held_sale) || 1),
    stock_move: Math.max(1, Number(next?.stock_move) || 1),
    day_amendment: Math.max(1, Number(next?.day_amendment) || 1),
    branch: Math.max(1, Number(next?.branch) || 1),
    supplier: Math.max(1, Number(next?.supplier) || 1),
    purchase: Math.max(1, Number(next?.purchase) || 1),
    purchase_payment: Math.max(1, Number(next?.purchase_payment) || 1),
    transfer: Math.max(1, Number(next?.transfer) || 1),
  };
}

/** Full v8 upgrade of a PosDb-shaped object. Safe to re-run. */
export function upgradeToV8(db: any, branches: Branch[]): any {
  const defaultBranchId = branches.find((b) => b.isActive)?.id ?? branches[0]?.id ?? 1;
  const branch_stocks = migrateToBranchStocks(db, defaultBranchId);
  const products = stripLegacyProductStock(Array.isArray(db.products) ? db.products : []);
  return {
    ...db,
    version: DATA_VERSION,
    products,
    branch_stocks,
    suppliers: Array.isArray(db.suppliers) ? db.suppliers : [],
    purchases: Array.isArray(db.purchases) ? db.purchases : [],
    purchase_payments: Array.isArray(db.purchase_payments) ? db.purchase_payments : [],
    transfers: Array.isArray(db.transfers) ? db.transfers : [],
    next: ensureNextIds(db.next),
  };
}
