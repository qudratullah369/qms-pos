import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/pos/page-header";
import { usePosStore } from "@/lib/pos/store";
import { formatMoney } from "@/lib/pos/money";
import { can } from "@/lib/pos/permissions";
import { toast } from "sonner";

export function SuppliersPage() {
  const suppliers = usePosStore((s) => s.suppliers);
  const settings = usePosStore((s) => s.settings);
  const session = usePosStore((s) => s.session);
  const saveSupplier = usePosStore((s) => s.saveSupplier);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [showForm, setShowForm] = useState(false);

  const canWrite = can(session?.role, "supplier.write");

  function openNew() {
    setEditing(null);
    setName("");
    setPhone("");
    setAddress("");
    setShowForm(true);
  }

  function openEdit(id: number) {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setEditing(id);
    setName(s.name);
    setPhone(s.phone);
    setAddress(s.address);
    setShowForm(true);
  }

  function handleSave() {
    const err = saveSupplier({ id: editing ?? undefined, name, phone, address });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setShowForm(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers"
        action={
          canWrite ? (
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4" />
              Add supplier
            </Button>
          ) : null
        }
      />

      {showForm && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Address</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
              {canWrite && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No suppliers yet
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-muted">{s.address || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(s.balance, settings.currency, settings.locale)}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s.id)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
