import type { Role, View } from "./types";

export type Permission =
  | "report.view"
  | "sale.checkout"
  | "sale.hold"
  | "sale.discount"
  | "sale.credit"
  | "sale.view"
  | "sale.export"
  | "sale.profit"
  | "sale.close-day"
  | "sale.amend-day"
  | "catalog.view"
  | "catalog.write"
  | "catalog.stock"
  | "catalog.import"
  | "catalog.delete"
  | "customer.view"
  | "customer.write"
  | "customer.collect"
  | "expense.view"
  | "expense.write"
  | "settings.write"
  | "settings.pin"
  | "settings.backup"
  | "settings.restore"
  | "settings.reset";

const ALL: Permission[] = [
  "report.view",
  "sale.checkout",
  "sale.hold",
  "sale.discount",
  "sale.credit",
  "sale.view",
  "sale.export",
  "sale.profit",
  "sale.close-day",
  "sale.amend-day",
  "catalog.view",
  "catalog.write",
  "catalog.stock",
  "catalog.import",
  "catalog.delete",
  "customer.view",
  "customer.write",
  "customer.collect",
  "expense.view",
  "expense.write",
  "settings.write",
  "settings.pin",
  "settings.backup",
  "settings.restore",
  "settings.reset",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  manager: ALL.filter((p) => p !== "settings.pin" && p !== "settings.restore" && p !== "settings.reset" && p !== "catalog.delete" && p !== "sale.amend-day"),
  cashier: [
    "report.view",
    "sale.checkout",
    "sale.hold",
    "sale.discount",
    "sale.credit",
    "sale.view",
    "catalog.view",
    "customer.view",
    "customer.write",
    "customer.collect",
  ],
  accountant: [
    "report.view",
    "sale.view",
    "sale.export",
    "sale.profit",
    "sale.close-day",
    "catalog.view",
    "customer.view",
    "expense.view",
    "expense.write",
  ],
};

export const PERMISSION_LABELS: { id: Permission; label: string }[] = [
  { id: "sale.checkout", label: "Take payment and complete a sale" },
  { id: "sale.hold", label: "Park and resume a sale" },
  { id: "sale.discount", label: "Apply a cart discount" },
  { id: "sale.credit", label: "Sell on customer credit" },
  { id: "sale.view", label: "View sales" },
  { id: "sale.export", label: "Export sales" },
  { id: "sale.profit", label: "See gross margin" },
  { id: "sale.close-day", label: "Close the business day" },
  { id: "sale.amend-day", label: "Amend a closed business day cash count" },
  { id: "catalog.view", label: "View products and categories" },
  { id: "catalog.write", label: "Add or edit products and categories" },
  { id: "catalog.stock", label: "Adjust stock" },
  { id: "catalog.import", label: "Import a product CSV" },
  { id: "catalog.delete", label: "Delete a product" },
  { id: "customer.view", label: "View customers" },
  { id: "customer.write", label: "Add or edit customers" },
  { id: "customer.collect", label: "Collect a credit payment" },
  { id: "expense.view", label: "View expenses" },
  { id: "expense.write", label: "Record an expense" },
  { id: "settings.write", label: "Edit store profile, currency, and timezone" },
  { id: "settings.pin", label: "Change staff PINs" },
  { id: "settings.backup", label: "Download a backup" },
  { id: "settings.restore", label: "Restore a backup" },
  { id: "settings.reset", label: "Erase data and restore the demo" },
  { id: "report.view", label: "Open the dashboard" },
];

const VIEW_PERMISSION: Record<View, Permission> = {
  dashboard: "report.view",
  pos: "sale.checkout",
  inventory: "catalog.view",
  categories: "catalog.view",
  customers: "customer.view",
  sales: "sale.view",
  expenses: "expense.view",
  settings: "settings.write",
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canView(role: Role | null | undefined, view: View): boolean {
  return can(role, VIEW_PERMISSION[view]);
}

export function deny(role: Role | null | undefined, permission: Permission): string | null {
  if (!role) return "Sign in required";
  if (!can(role, permission)) return "You do not have permission for this action";
  return null;
}

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}
