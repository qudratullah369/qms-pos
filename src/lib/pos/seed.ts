import { monogram } from "./image";
import { businessDate } from "./money";
import type { PosDb } from "./types";

const GROCERY = "#24382f";
const DRINKS = "#1d3140";
const GENERAL = "#3a3428";

function daysAgoIso(days: number): string {
  const today = businessDate(new Date(), "Asia/Karachi");
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) - days, 7, 0, 0)).toISOString();
}

/** Demo amounts are integer minor units. PKR uses 2 (250.00 rupees = 25000). */
export const SEED: PosDb = {
  version: 5,
  users: [
    { id: 1, name: "Owner", role: "admin", pin: "1234" },
    { id: 2, name: "Floor manager", role: "manager", pin: "2468" },
    { id: 3, name: "Cashier", role: "cashier", pin: "0000" },
    { id: 4, name: "Accountant", role: "accountant", pin: "1357" },
  ],
  categories: [
    { id: 1, name: "General" },
    { id: 2, name: "Grocery" },
    { id: 3, name: "Drinks" },
  ],
  products: [
    { id: 1, name: "Mango 1kg", barcode: "890100000001", category_id: 2, cost: 18000, selling: 25000, stock: 20, min_stock: 5, image: monogram("Mango", GROCERY) },
    { id: 2, name: "Milk 1L", barcode: "890100000002", category_id: 2, cost: 15000, selling: 19000, stock: 30, min_stock: 8, image: monogram("Milk", GROCERY) },
    { id: 3, name: "Bread", barcode: "890100000003", category_id: 2, cost: 9000, selling: 12000, stock: 15, min_stock: 5, image: monogram("Bread", GROCERY) },
    { id: 4, name: "Eggs 12pc", barcode: "890100000004", category_id: 2, cost: 24000, selling: 30000, stock: 12, min_stock: 4, image: monogram("Eggs", GROCERY) },
    { id: 5, name: "Sugar 1kg", barcode: "890100000006", category_id: 2, cost: 14000, selling: 17000, stock: 25, min_stock: 6, image: monogram("Sugar", GROCERY) },
    { id: 6, name: "Basmati Rice 5kg", barcode: "890100000007", category_id: 2, cost: 110000, selling: 135000, stock: 10, min_stock: 3, image: monogram("Rice", GROCERY) },
    { id: 7, name: "Atta 10kg", barcode: "890100000008", category_id: 2, cost: 95000, selling: 115000, stock: 8, min_stock: 3, image: monogram("Atta", GROCERY) },
    { id: 8, name: "Cooking Oil 1L", barcode: "890100000009", category_id: 2, cost: 48000, selling: 56000, stock: 16, min_stock: 4, image: monogram("Oil", GROCERY) },
    { id: 9, name: "Cold Drink 1.5L", barcode: "890100000005", category_id: 3, cost: 12000, selling: 17000, stock: 18, min_stock: 5, image: monogram("Cold Drink", DRINKS) },
    { id: 10, name: "Mineral Water 1.5L", barcode: "890100000010", category_id: 3, cost: 7000, selling: 10000, stock: 40, min_stock: 10, image: monogram("Water", DRINKS) },
    { id: 11, name: "Orange Juice 1L", barcode: "890100000011", category_id: 3, cost: 18000, selling: 25000, stock: 14, min_stock: 4, image: monogram("Juice", DRINKS) },
    { id: 12, name: "Bath Soap", barcode: "890100000012", category_id: 1, cost: 8000, selling: 12000, stock: 22, min_stock: 6, image: monogram("Soap", GENERAL) },
    { id: 13, name: "Toothpaste", barcode: "890100000013", category_id: 1, cost: 16000, selling: 22000, stock: 18, min_stock: 5, image: monogram("Paste", GENERAL) },
    { id: 14, name: "Detergent 1kg", barcode: "890100000014", category_id: 1, cost: 28000, selling: 36000, stock: 4, min_stock: 5, image: monogram("Wash", GENERAL) },
  ],
  customers: [
    { id: 1, name: "Ahmed Khan", phone: "0300-1112233", address: "Gulberg, Lahore", balance: 45000 },
    { id: 2, name: "Fatima Ali", phone: "0321-5556677", address: "DHA Phase 5, Karachi", balance: 0 },
    { id: 3, name: "Bilal Traders", phone: "042-35789012", address: "Hall Road, Lahore", balance: 120000 },
  ],
  sales: [
    {
      id: 1,
      bill_id: "QMS-00001",
      created_at: daysAgoIso(2),
      customer_id: 2,
      customer_name: "Fatima Ali",
      subtotal: 67000,
      discount: 0,
      total: 67000,
      paid: 67000,
      change: 0,
      drawer_cash: 0,
      balance_due: 0,
      payment: "JazzCash",
      tender_method: "JazzCash",
      gross_margin: 16000,
      net: 67000,
      tax: 0,
      tax_rate_bps: 0,
      items: [
        { product_id: 2, name: "Milk 1L", qty: 2, price: 19000, cost: 15000 },
        { product_id: 3, name: "Bread", qty: 1, price: 12000, cost: 9000 },
        { product_id: 9, name: "Cold Drink 1.5L", qty: 1, price: 17000, cost: 12000 },
      ],
    },
    {
      id: 2,
      bill_id: "QMS-00002",
      created_at: daysAgoIso(1),
      customer_id: 1,
      customer_name: "Ahmed Khan",
      subtotal: 170000,
      discount: 5000,
      total: 165000,
      paid: 120000,
      change: 0,
      drawer_cash: 120000,
      balance_due: 45000,
      payment: "Credit",
      tender_method: "Cash",
      gross_margin: 30000,
      net: 165000,
      tax: 0,
      tax_rate_bps: 0,
      items: [
        { product_id: 6, name: "Basmati Rice 5kg", qty: 1, price: 135000, cost: 110000 },
        { product_id: 1, name: "Mango 1kg", qty: 1, price: 25000, cost: 18000 },
        { product_id: 10, name: "Mineral Water 1.5L", qty: 1, price: 10000, cost: 7000 },
      ],
    },
    {
      id: 3,
      bill_id: "QMS-00003",
      created_at: daysAgoIso(0),
      customer_id: null,
      customer_name: "Walk-in",
      subtotal: 76000,
      discount: 0,
      total: 76000,
      paid: 100000,
      change: 24000,
      drawer_cash: 76000,
      balance_due: 0,
      payment: "Cash",
      tender_method: "Cash",
      gross_margin: 20000,
      net: 76000,
      tax: 0,
      tax_rate_bps: 0,
      items: [
        { product_id: 4, name: "Eggs 12pc", qty: 1, price: 30000, cost: 24000 },
        { product_id: 12, name: "Bath Soap", qty: 2, price: 12000, cost: 8000 },
        { product_id: 13, name: "Toothpaste", qty: 1, price: 22000, cost: 16000 },
      ],
    },
  ],
  end_of_days: [],
  day_amendments: [],
  held_sales: [],
  stock_moves: [],
  expenses: [
    { id: 1, created_at: daysAgoIso(5), category: "Rent", description: "Shop rent — September", amount: 2500000, affects_cash: false },
    { id: 2, created_at: daysAgoIso(1), category: "Utilities", description: "Electricity bill", amount: 480000, affects_cash: false },
  ],
  settings: {
    storeName: "QMS POS Store",
    phone: "042-111-7677",
    address: "Main Market, Lahore",
    currency: "PKR",
    locale: "en-PK",
    timeZone: "Asia/Karachi",
    taxName: "Sales tax",
    taxRateBps: 0,
    pricesIncludeTax: false,
    taxRegistration: "",
  },
  next: { product: 15, category: 4, customer: 4, sale: 4, expense: 3, end_of_day: 1, held_sale: 1, stock_move: 1,
    day_amendment: 1,
  },
};
