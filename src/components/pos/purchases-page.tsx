import { useState } from "react";
import { Plus, PackageCheck, Banknote, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/pos/page-header";
import { usePosStore } from "@/lib/pos/store";
import { formatMoney } from "@/lib/pos/format";
import { can } from "@/lib/pos/permissions";
import { toast } from "sonner";
import type { TenderMethod } from "@/lib/pos/types";

export function PurchasesPage() {
  const purchases = usePosStore((s) => s.purchases);
  const suppliers = usePosStore((s) => s.suppliers);
  const products = usePosStore((s) => s.products);
  const settings = usePosStore((s) => s.settings);
  const session = usePosStore((s) => s.session);
  const createPurchase = usePosStore((s) => s.createPurchase);
  const receivePurchase = usePosStore((s) => s.receivePurchase);
  const payPurchase = usePosStore((s) => s.payPurchase);
  const cancelPurchase = usePosStore((s) => s.cancelPurchase);

  const [showCreate, setShowCreate] = useState(false);
  const [supplierId, setSupplierId] = useState<number>(suppliers[0]?.id ?? 0);
  const [lines, setLines] = useState<{ product_id: number; qty: number; unit_cost: number }[]>([
    { product_id: products[0]?.id ?? 0, qty: 1, unit_cost: products[0]?.cost ?? 0 },
  ]);
  const [notes, setNotes] = useState("");

  const [receiveId, setReceiveId] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});

  const [payId, setPayId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<TenderMethod | "Bank">("Cash");

  const canWrite = can(session?.role, "purchase.write");
  const canReceive = can(session?.role, "purchase.receive");
  const canPay = can(session?.role, "purchase.pay");
  const canCancel = can(session?.role, "purchase.cancel");

  function handleCreate() {
    const err = createPurchase(supplierId, lines, notes);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Purchase order created");
    setShowCreate(false);
    setLines([{ product_id: products[0]?.id ?? 0, qty: 1, unit_cost: products[0]?.cost ?? 0 }]);
    setNotes("");
  }

  function handleReceive() {
    if (receiveId == null) return;
    const received = Object.entries(receiveQty).map(([pid, qty]) => ({
      product_id: Number(pid),
      qty,
    }));
    const err = receivePurchase(receiveId, received);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Goods received");
    setReceiveId(null);
    setReceiveQty({});
  }

  function handlePay() {
    if (payId == null) return;
    const err = payPurchase(payId, payAmount, payMethod);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Payment recorded");
    setPayId(null);
    setPayAmount(0);
  }

  function handleCancel(id: number) {
    const err = cancelPurchase(id);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Purchase cancelled");
  }

  const sorted = [...purchases].sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              New purchase
            </Button>
          ) : null
        }
      />

      {showCreate && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <Label>Supplier</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
                  value={line.product_id}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const p = products.find((x) => x.id === pid);
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, product_id: pid, unit_cost: p?.cost ?? 0 } : l,
                      ),
                    );
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) } : l)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Unit cost (minor)</Label>
                <Input
                  type="number"
                  min={0}
                  value={line.unit_cost}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, unit_cost: Number(e.target.value) } : l)),
                    )
                  }
                />
              </div>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { product_id: products[0]?.id ?? 0, qty: 1, unit_cost: products[0]?.cost ?? 0 },
              ])
            }
          >
            + Add line
          </Button>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate}>Create order</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {receiveId != null && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="font-medium">Receive goods — Purchase #{receiveId}</p>
          {purchases
            .find((p) => p.id === receiveId)
            ?.items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-xs text-muted">
                  {item.qty_received}/{item.qty_ordered}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={item.qty_ordered - item.qty_received}
                  className="w-24"
                  value={receiveQty[item.product_id] ?? 0}
                  onChange={(e) =>
                    setReceiveQty((prev) => ({
                      ...prev,
                      [item.product_id]: Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          <div className="flex gap-2">
            <Button onClick={handleReceive}>Confirm receive</Button>
            <Button variant="ghost" onClick={() => setReceiveId(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {payId != null && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="font-medium">Record payment — Purchase #{payId}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Amount (minor units)</Label>
              <Input
                type="number"
                min={0}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Method</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePay}>Record payment</Button>
            <Button variant="ghost" onClick={() => setPayId(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-muted">No purchases yet</p>
        ) : (
          sorted.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">#{p.id} — {p.supplier_name}</p>
                  <p className="text-xs text-muted">
                    {new Date(p.created_at).toLocaleString()} · {p.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatMoney(p.total, settings)}</p>
                  <p className="text-xs text-muted">
                    Paid {formatMoney(p.paid, settings)} · Due {formatMoney(p.balance_due, settings)}
                  </p>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {p.items.map((i) => (
                  <li key={i.product_id}>
                    {i.name} × {i.qty_ordered} @ {formatMoney(i.unit_cost, settings)}
                    {i.qty_received > 0 && ` (recv ${i.qty_received})`}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {canReceive && p.status !== "cancelled" && p.status !== "received" && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    setReceiveId(p.id);
                    const init: Record<number, number> = {};
                    p.items.forEach((i) => {
                      init[i.product_id] = i.qty_ordered - i.qty_received;
                    });
                    setReceiveQty(init);
                  }}>
                    <PackageCheck className="size-3.5" /> Receive
                  </Button>
                )}
                {canPay && p.balance_due > 0 && p.status !== "cancelled" && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    setPayId(p.id);
                    setPayAmount(p.balance_due);
                  }}>
                    <Banknote className="size-3.5" /> Pay
                  </Button>
                )}
                {canCancel && p.status !== "cancelled" && p.status !== "received" && (
                  <Button size="sm" variant="ghost" onClick={() => handleCancel(p.id)}>
                    <XCircle className="size-3.5" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
