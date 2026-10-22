import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Users,
  Wallet,
  X,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { canView } from "@/lib/pos/permissions";
import type { View } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

const NAV: { id: View; label: string; icon: typeof Store }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "Billing", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "customers", label: "Customers", icon: Users },
  { id: "sales", label: "Sales", icon: BarChart3 },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIMARY: View[] = ["dashboard", "pos", "inventory", "sales"];

export function AppShell({ children }: { children: ReactNode }) {
  const view = usePosStore((s) => s.view);
  const setView = usePosStore((s) => s.setView);
  const session = usePosStore((s) => s.session);
  const storeName = usePosStore((s) => s.settings.storeName);
  const logout = usePosStore((s) => s.logout);
  const cartCount = usePosStore((s) => s.cart.reduce((a, c) => a + c.qty, 0));
  const branches = usePosStore((s) => s.branches || []);
  const currentBranchId = usePosStore((s) => s.currentBranchId);
  const setCurrentBranch = usePosStore((s) => s.setCurrentBranch);
  const [more, setMore] = useState(false);
  const [online, setOnline] = useState(true);
  const [branchOpen, setBranchOpen] = useState(false);

  const currentBranch = branches.find((b) => b.id === currentBranchId);
  const activeBranches = branches.filter((b) => b.isActive);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const items = NAV.filter((n) => canView(session?.role, n.id));
  const mobileItems = MOBILE_PRIMARY.filter((id) => canView(session?.role, id));

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-elevated text-accent">
            <Store className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg tracking-tight">
              QMS POS <span className="text-accent">Pro</span>
            </p>
            <p className="hidden text-xs text-muted sm:block">{storeName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Switcher */}
          {activeBranches.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBranchOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium hover:bg-surface"
              >
                <Store className="size-3.5 text-accent" />
                <span className="max-w-[100px] truncate sm:max-w-[140px]">
                  {currentBranch?.name || "Branch"}
                </span>
                <ChevronDown className="size-3.5 text-muted" />
              </button>
              {branchOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setBranchOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-surface py-1 shadow-panel">
                    {activeBranches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setCurrentBranch(b.id);
                          setBranchOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-elevated",
                          b.id === currentBranchId && "bg-elevated font-medium",
                        )}
                      >
                        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-muted">
                          {b.code}
                        </span>
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Badge className="capitalize">{session?.role}</Badge>
          <Badge className={online ? "text-accent" : "text-warn"}>
            {online ? "Online" : "Offline"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="lg:flex">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 border-r border-border bg-surface p-3 lg:block">
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {item.id === "pos" && cartCount > 0 ? (
                    <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      {cartCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 pb-28 lg:px-6 lg:pb-6">{children}</main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden">
        <div className="grid grid-cols-5 gap-1 px-1 py-1">
          {mobileItems.map((id) => {
            const item = NAV.find((n) => n.id === id)!;
            const Icon = item.icon;
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMore(false);
                  setView(id);
                }}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.label}
                {id === "pos" && cartCount > 0 ? (
                  <span className="absolute top-1 right-3 size-1.5 rounded-full bg-accent" />
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium",
              more ? "text-fg" : "text-muted",
            )}
          >
            {more ? <X className="size-5" /> : <Menu className="size-5" />}
            More
          </button>
        </div>
      </nav>

      {more ? (
        <div className="fixed inset-0 z-20 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setMore(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-x-3 bottom-20 rounded-xl border border-border bg-surface p-2 shadow-panel">
            {items
              .filter((i) => !mobileItems.includes(i.id))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setView(item.id);
                      setMore(false);
                    }}
                    className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-elevated"
                  >
                    <Icon className="size-4 text-muted" />
                    {item.label}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
