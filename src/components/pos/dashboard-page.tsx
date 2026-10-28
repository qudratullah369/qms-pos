import { AlertTriangle, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/pos/page-header";
import { useFormat } from "@/lib/pos/format";
import { businessDate } from "@/lib/pos/money";
import { can } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";

export function DashboardPage() {
  const role = usePosStore((s) => s.session?.role);
  const products = usePosStore((s) => s.products);
  const customers = usePosStore((s) => s.customers);
  const sales = usePosStore((s) => s.sales);
  const setView = usePosStore((s) => s.setView);
  const stockAt = usePosStore((s) => s.stockAt);
  const minStockAt = usePosStore((s) => s.minStockAt);
  const { money, when, today, settings } = useFormat();
  const seeMargin = can(role, "sale.profit");
  const canSell = can(role, "sale.checkout");

  const todayKey = today();
  const onDay = (iso: string, key: string) => businessDate(new Date(iso), settings.timeZone) === key;
  const todayRows = sales.filter((s) => onDay(s.created_at, todayKey));
  const todaySales = todayRows.reduce((a, s) => a + s.total, 0);
  const todayMargin = todayRows.reduce((a, s) => a + s.gross_margin, 0);
  const low = products.filter((p) => {
    const qty = stockAt(p.id);
    return qty <= minStockAt(p.id);
  });
  const recent = [...sales].reverse().slice(0, 8);

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = businessDate(d, settings.timeZone);
    const rows = sales.filter((s) => onDay(s.created_at, key));
    return {
      label: new Intl.DateTimeFormat(settings.locale, { weekday: "short", timeZone: settings.timeZone }).format(d),
      sales: rows.reduce((a, s) => a + s.total, 0),
    };
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Business day ${todayKey} · ${settings.timeZone}`}
        action={
          canSell ? (
            <Button onClick={() => setView("pos")}>
              <ShoppingBag className="size-4" />
              New sale
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Today's revenue" value={money(todaySales)} hint={`${todayRows.length} bills`} />
        <Stat
          label="Gross margin"
          value={seeMargin ? money(todayMargin) : "Locked"}
          hint={seeMargin ? "After discounts, before expenses" : "Not available for this role"}
        />
        <Stat label="Products" value={String(products.length)} hint={`${low.length} low stock`} />
        <Stat label="Customers" value={String(customers.length)} hint="On this device" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Seven-day revenue</h3>
            <TrendingUp className="size-4 text-muted" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7}>
                <XAxis dataKey="label" interval={0} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-elevated)" }}
                  contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                  formatter={(v) => money(Number(v ?? 0))}
                />
                <Bar dataKey="sales" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <h3 className="text-sm font-medium">Low stock</h3>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-muted">All stock levels are healthy.</p>
          ) : (
            <ul className="space-y-2">
              {low.map((p) => {
                const qty = stockAt(p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <span className={`tabular font-medium ${qty === 0 ? "text-danger" : "text-warn"}`}>
                      {qty}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-12">
          <div className="mb-3 flex items-center gap-2">
            <Package className="size-4 text-muted" />
            <h3 className="text-sm font-medium">Recent bills</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-mono text-xs text-muted">{s.bill_id}</p>
                    <p>
                      {s.customer_name} · {s.total === 0 && s.paid > 0 ? "Credit collection" : s.payment}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="tabular font-medium">{money(s.total)}</span>
                    <p className="text-xs text-subtle">{when(s.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-subtle">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {customers.filter((c) => c.balance > 0).length} on credit
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl tracking-tight tabular">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </Card>
  );
}
