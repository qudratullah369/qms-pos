import { Download, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/pos/page-header";
import { useFormat } from "@/lib/pos/format";
import { expectedDrawer, marginAfterExpenses } from "@/lib/pos/ledger";
import { businessDate, fromMinor, toMinor } from "@/lib/pos/money";
import { can } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";
import { PAYMENTS } from "@/lib/pos/types";

export function SalesPage() {
  const sales = usePosStore((s) => s.sales);
  const expenses = usePosStore((s) => s.expenses);
  const endOfDays = usePosStore((s) => s.end_of_days);
  const dayAmendments = usePosStore((s) => s.day_amendments ?? []);
  const amendDay = usePosStore((s) => s.amendDay);
  const role = usePosStore((s) => s.session?.role);
  const closeDay = usePosStore((s) => s.closeDay);
  const { money, when, today, settings, exponent } = useFormat();
  const seeMargin = can(role, "sale.profit");
  const canClose = can(role, "sale.close-day");
  const canAmend = can(role, "sale.amend-day");
  const canExport = can(role, "sale.export");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pay, setPay] = useState("all");
  const [eodOpen, setEodOpen] = useState(false);
  const [eodDate, setEodDate] = useState(today());
  const [cashCounted, setCashCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendDate, setAmendDate] = useState("");
  const [amendCashCounted, setAmendCashCounted] = useState("");
  const [amendNotes, setAmendNotes] = useState("");

  const onDay = (iso: string) => businessDate(new Date(iso), settings.timeZone);

  const rows = useMemo(() => {
    let list = [...sales].reverse();
    if (from) list = list.filter((s) => onDay(s.created_at) >= from);
    if (to) list = list.filter((s) => onDay(s.created_at) <= to);
    if (pay !== "all") list = list.filter((s) => s.payment === pay);
    return list;
    // settings.timeZone is the only extra input the filter closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, from, to, pay, settings.timeZone]);

  const revenue = rows.reduce((a, s) => a + s.total, 0);
  const margin = rows.reduce((a, s) => a + s.gross_margin, 0);
  const eodSales = sales.filter((s) => onDay(s.created_at) === eodDate);
  const eodExpenses = expenses.filter((e) => onDay(e.created_at) === eodDate);
  const drawer = expectedDrawer(eodSales, eodExpenses);
  const existingEod = endOfDays.find((e) => e.date === eodDate);

  function exportCsv() {
    if (!can(role, "sale.export")) return toast.error("You do not have permission for this action");
    const head = ["Bill", "Date", "Customer", "Total", "Tendered", "Change", "Drawer cash", "Payment", "Balance due"];
    if (seeMargin) head.push("Gross margin");
    const csv = [
      head,
      ...rows.map((s) => {
        const row = [
          s.bill_id,
          when(s.created_at),
          s.customer_name,
          fromMinor(s.total, exponent),
          fromMinor(s.paid, exponent),
          fromMinor(s.change, exponent),
          fromMinor(s.drawer_cash, exponent),
          s.payment,
          fromMinor(s.balance_due, exponent),
        ];
        if (seeMargin) row.push(fromMinor(s.gross_margin, exponent));
        return row;
      }),
    ]
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "qms-sales-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(seeMargin ? "Report exported with gross margin" : "Report exported without margin");
  }

  function doClose() {
    const result = closeDay(eodDate, toMinor(Number(cashCounted), exponent), notes);
    if (result) {
      toast.error(result);
      return;
    }
    toast.success(`End of day closed for ${eodDate}`);
    setEodOpen(false);
    setCashCounted("");
    setNotes("");
  }

  function doAmend() {
    if (amendCashCounted.trim() === "" || amendNotes.trim() === "") {
      toast.error("Enter the counted cash and a reason for the amendment.");
      return;
    }

    const result = amendDay(
      amendDate,
      toMinor(Number(amendCashCounted), exponent),
      amendNotes.trim()
    );

    if (result) {
      toast.error(result);
      return;
    }

    toast.success(`Cash count amendment recorded for ${amendDate}`);
    setAmendOpen(false);
    setAmendCashCounted("");
    setAmendNotes("");
  }

  return (
    <div>
      <PageHeader
        title="Sales & reports"
        subtitle="Revenue, gross margin, and drawer cash. Margin is not operating profit."
        action={
          <div className="flex gap-2">
            {canExport ? (
              <Button variant="secondary" onClick={exportCsv}>
                <Download className="size-4" /> Export CSV
              </Button>
            ) : null}
            {canClose ? (
              <Button onClick={() => setEodOpen(true)} disabled={!!existingEod}>
                <LockKeyhole className="size-4" /> End of day
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Filtered revenue</p>
          <p className="font-display mt-1 text-2xl tabular">{money(revenue)}</p>
          <p className="text-xs text-subtle">{rows.length} bills</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Gross margin</p>
          <p className="font-display mt-1 text-2xl tabular">{seeMargin ? money(margin) : "Locked"}</p>
          <p className="text-xs text-subtle">After discounts, before expenses</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Expected drawer</p>
          <p className="font-display mt-1 text-2xl tabular">{money(drawer)}</p>
          <p className="text-xs text-subtle">Net cash in, minus cash expenses</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">EOD status</p>
          <p className="mt-1 text-lg font-semibold">{existingEod ? "Closed" : "Open"}</p>
          <p className="text-xs text-subtle">{eodDate}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          <NativeSelect value={pay} onChange={(e) => setPay(e.target.value)} className="sm:w-40">
            <option value="all">All payments</option>
            {PAYMENTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-medium">Bill</th>
                <th className="font-medium">Date</th>
                <th className="font-medium">Customer</th>
                <th className="font-medium">Total</th>
                <th className="font-medium">Tendered</th>
                <th className="font-medium">Change</th>
                <th className="font-medium">Payment</th>
                <th className="font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{s.bill_id}</td>
                  <td className="text-muted">{when(s.created_at)}</td>
                  <td>{s.customer_name}</td>
                  <td className="tabular">{money(s.total)}</td>
                  <td className="tabular">{money(s.paid)}</td>
                  <td className="tabular">{money(s.change)}</td>
                  <td>{s.total === 0 && s.paid > 0 ? "Credit collection" : s.payment}</td>
                  <td className="tabular">{seeMargin ? money(s.gross_margin) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No sales in this range.</p> : null}
        </div>
      </Card>

      {endOfDays.length > 0 ? (
        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-medium">Closed days</h3>
            <p className="text-xs text-muted">A closed day rejects new sales and cash expenses for that business date.</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
  <tr className="text-xs text-muted">
    <th className="py-2">Date</th>
    <th>Bills</th>
    <th>Revenue</th>
    <th>Margin after expenses</th>
    <th>Cash counted</th>
    <th>Variance</th>
    {canAmend ? <th>Actions</th> : null}
  </tr>
</thead>
<tbody>
  {[...endOfDays].reverse().map((e) => {
    const latestAmendment = [...dayAmendments].reverse().find((a) => a.date === e.date);
    const displayedCashCounted = latestAmendment?.cash_counted ?? e.cash_counted;
    const expectedCash = e.cash_counted - e.cash_variance;
    const displayedVariance = displayedCashCounted - expectedCash;

    return (
      <tr key={e.id} className="border-t border-border">
        <td className="py-2 font-medium">{e.date}</td>
        <td>{e.bills}</td>
        <td className="tabular">{money(e.sales_total)}</td>
        <td className="tabular">{seeMargin ? money(e.margin_after_expenses) : "—"}</td>
        <td className="tabular">
          {money(displayedCashCounted)}
          {latestAmendment ? (
            <p className="text-xs text-muted">Amended</p>
          ) : null}
        </td>
        <td className={`tabular ${displayedVariance === 0 ? "" : displayedVariance > 0 ? "text-accent" : "text-danger"}`}>
          {money(displayedVariance)}
        </td>
        {canAmend ? (
          <td className="py-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAmendDate(e.date);
                setAmendCashCounted(String(fromMinor(displayedCashCounted, exponent)));
                setAmendNotes("");
                setAmendOpen(true);
              }}
            >
              Amend Day
            </Button>
          </td>
        ) : null}
      </tr>
    );
  })}
</tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Dialog open={eodOpen} onOpenChange={setEodOpen}>
        <DialogContent title="End of day closing">
          <div className="space-y-3">
            <div>
              <Label htmlFor="eod-date">Business date</Label>
              <Input id="eod-date" type="date" value={eodDate} onChange={(e) => setEodDate(e.target.value)} />
            </div>
            <div className="rounded-lg bg-elevated p-3 text-sm">
              <div className="flex justify-between">
                <span>Drawer cash from sales</span>
                <b>{money(eodSales.reduce((a, s) => a + s.drawer_cash, 0))}</b>
              </div>
              <div className="flex justify-between">
                <span>Cash expenses</span>
                <b>{money(eodExpenses.filter((e) => e.affects_cash).reduce((a, e) => a + e.amount, 0))}</b>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span>Expected drawer</span>
                <b>{money(drawer)}</b>
              </div>
              {seeMargin ? (
                <p className="mt-2 text-xs text-muted">
                  Margin after every expense: {money(marginAfterExpenses(eodSales, eodExpenses))}. This is not operating profit.
                </p>
              ) : null}
            </div>
            {existingEod ? (
              <p className="text-sm text-danger">This date is already closed.</p>
            ) : (
              <>
                <div>
                  <Label htmlFor="cash-counted">Actual cash counted</Label>
                  <Input
                    id="cash-counted"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    placeholder={String(fromMinor(drawer, exponent))}
                  />
                </div>
                <div>
                  <Label htmlFor="eod-notes">Notes</Label>
                  <Input id="eod-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional closing notes" />
                </div>
                <Button size="wide" onClick={doClose} disabled={cashCounted === ""}>
                  Close day
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent title="Amend closed day cash count">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              This records a new amendment and preserves the original end-of-day record.
            </p>
            <div>
              <Label htmlFor="amend-date">Closed business date</Label>
              <Input id="amend-date" type="date" value={amendDate} disabled />
            </div>
            <div>
              <Label htmlFor="amend-cash-counted">Recounted cash</Label>
              <Input
                id="amend-cash-counted"
                type="number"
                min="0"
                inputMode="decimal"
                value={amendCashCounted}
                onChange={(e) => setAmendCashCounted(e.target.value)}
                placeholder="Enter the actual cash counted"
              />
            </div>
            <div>
              <Label htmlFor="amend-notes">Reason for amendment</Label>
              <Input
                id="amend-notes"
                value={amendNotes}
                onChange={(e) => setAmendNotes(e.target.value)}
                placeholder="Explain why the cash count is being corrected"
              />
            </div>
            <Button
              size="wide"
              onClick={doAmend}
              disabled={
                amendCashCounted.trim() === "" ||
                Number(amendCashCounted) < 0 ||
                !Number.isFinite(Number(amendCashCounted)) ||
                amendNotes.trim() === ""
              }
            >
              Save amendment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
