import { useState } from "react";
import { Plus, Truck, PackageCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/pos/page-header";
import { usePosStore } from "@/lib/pos/store";
import { can } from "@/lib/pos/permissions";
import { toast } from "sonner";

export function TransfersPage() {
  const transfers = usePosStore((s) => s.transfers);
  const branches = usePosStore((s) => s.branches);
  const products = usePosStore((s) => s.products);
  const currentBranchId = usePosStore((s) => s.currentBranchId);
  const session = usePosStore((s) => s.session);
  const createTransfer = usePosStore((s) => s.createTransfer);
  const dispatchTransfer = usePosStore((s) => s.dispatchTransfer);
  const receiveTransfer = usePosStore((s) => s.receiveTransfer);
  const cancelTransfer = usePosStore((s) => s.cancelTransfer);
  const stockAt = usePosStore((s) => s.stockAt);

  const [showCreate, setShowCreate] = useState(false);
  const [toBranchId, setToBranchId] = useState(
    branches.find((b) => b.id !== currentBranchId && b.isActive)?.id ?? 0,
  );
  const [lines, setLines] = useState<{ product_id: number; qty: number }[]>([
    { product_id: products[0]?.id ?? 0, qty: 1 },
  ]);
  const [notes, setNotes] = useState("");

  const [receiveId, setReceiveId] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});

  const canWrite = can(session?.role, "transfer.write");
  const canDispatch = can(session?.role, "transfer.dispatch");
  const canReceive = can(session?.role, "transfer.receive");
  const canCancel = can(session?.role, "transfer.cancel");

  const otherBranches = branches.filter((b) => b.isActive && b.id !== currentBranchId);

  function handleCreate() {
    const err = createTransfer(toBranchId, lines, notes);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Transfer created (draft)");
    setShowCreate(false);
    setLines([{ product_id: products[0]?.id ?? 0, qty: 1 }]);
    setNotes("");
  }

  function handleDispatch(id: number) {
    const err = dispatchTransfer(id);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Transfer dispatched");
  }

  function handleReceive() {
    if (receiveId == null) return;
    const received = Object.entries(receiveQty).map(([pid, qty]) => ({
      product_id: Number(pid),
      qty,
    }));
    const err = receiveTransfer(receiveId, received);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Transfer received");
    setReceiveId(null);
    setReceiveQty({});
  }

  function handleCancel(id: number) {
    const err = cancelTransfer(id);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Transfer cancelled");
  }

  const sorted = [...transfers].sort((a, b) => b.id - a.id);
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Transfers"
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              New transfer
            </Button>
          ) : null
        }
      />

      {showCreate && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div>
            <Label>To branch</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
              value={toBranchId}
              onChange={(e) => setToBranchId(Number(e.target.value))}
            >
              {otherBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
                  value={line.product_id}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, product_id: Number(e.target.value) } : l,
                      ),
                    )
                  }
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock: {stockAt(p.id)})
                    </option>
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
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setLines((prev) => [...prev, { product_id: products[0]?.id ?? 0, qty: 1 }])
            }
          >
            + Add line
          </Button>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate}>Create draft</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {receiveId != null && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="font-medium">Receive transfer #{receiveId}</p>
          {transfers
            .find((t) => t.id === receiveId)
            ?.items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-xs text-muted">
                  {item.qty_received}/{item.qty_dispatched}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={item.qty_dispatched - item.qty_received}
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

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-muted">No transfers yet</p>
        ) : (
          sorted.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    #{t.id} · {branchName(t.from_branch_id)} → {branchName(t.to_branch_id)}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(t.created_at).toLocaleString()} · {t.status}
                  </p>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {t.items.map((i) => (
                  <li key={i.product_id}>
                    {i.name} · req {i.qty_requested}
                    {i.qty_dispatched > 0 && ` · disp ${i.qty_dispatched}`}
                    {i.qty_received > 0 && ` · recv ${i.qty_received}`}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {canDispatch && t.status === "draft" && t.from_branch_id === currentBranchId && (
                  <Button size="sm" variant="secondary" onClick={() => handleDispatch(t.id)}>
                    <Truck className="size-3.5" /> Dispatch
                  </Button>
                )}
                {canReceive &&
                  (t.status === "dispatched" || t.status === "partial") &&
                  t.to_branch_id === currentBranchId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReceiveId(t.id);
                        const init: Record<number, number> = {};
                        t.items.forEach((i) => {
                          init[i.product_id] = i.qty_dispatched - i.qty_received;
                        });
                        setReceiveQty(init);
                      }}
                    >
                      <PackageCheck className="size-3.5" /> Receive
                    </Button>
                  )}
                {canCancel && t.status !== "cancelled" && t.status !== "received" && (
                  <Button size="sm" variant="ghost" onClick={() => handleCancel(t.id)}>
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
