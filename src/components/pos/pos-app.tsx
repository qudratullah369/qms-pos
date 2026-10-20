import { useEffect } from "react";
import { AppShell } from "@/components/pos/app-shell";
import { BillingPage } from "@/components/pos/billing-page";
import { CategoriesPage } from "@/components/pos/categories-page";
import { CustomersPage } from "@/components/pos/customers-page";
import { DashboardPage } from "@/components/pos/dashboard-page";
import { ExpensesPage } from "@/components/pos/expenses-page";
import { InventoryPage } from "@/components/pos/inventory-page";
import { LoginScreen } from "@/components/pos/login-screen";
import { ReceiptOverlay } from "@/components/pos/receipt";
import { SalesPage } from "@/components/pos/sales-page";
import { SettingsPage } from "@/components/pos/settings-page";
import { isRtlLocale } from "@/lib/pos/money";
import { canView } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";

export function PosApp() {
  const session = usePosStore((s) => s.session);
  const view = usePosStore((s) => s.view);
  const locale = usePosStore((s) => s.settings.locale);

  useEffect(() => {
    void usePosStore.persist.rehydrate();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    if (session && !canView(session.role, view)) usePosStore.getState().setView("dashboard");
  }, [session, view]);

  if (!session) return <LoginScreen />;

  return (
    <AppShell>
      {view === "dashboard" ? <DashboardPage /> : null}
      {view === "pos" ? <BillingPage /> : null}
      {view === "inventory" ? <InventoryPage /> : null}
      {view === "categories" ? <CategoriesPage /> : null}
      {view === "customers" ? <CustomersPage /> : null}
      {view === "sales" ? <SalesPage /> : null}
      {view === "expenses" ? <ExpensesPage /> : null}
      {view === "settings" ? <SettingsPage /> : null}
      <ReceiptOverlay />
    </AppShell>
  );
}
