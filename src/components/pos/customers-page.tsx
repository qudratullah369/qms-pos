import { Banknote, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/pos/page-header";
import { useFormat } from "@/lib/pos/format";
import { fromMinor, toMinor } from "@/lib/pos/money";
import { can } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";
import type { Customer } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

export function CustomersPage() {
  const customers = usePosStore((s) => s.customers);
  const saveCustomer = usePosStore((s) => s.saveCustomer);
  const receiveCredit = usePosStore((s) => s.receiveCredit);
  const role = usePosStore((s) => s.session?.role);
  const { money, exponent } = useFormat();
  const canWrite = can(role, "customer.write");
  const canCollect = can(role, "customer.collect");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ id?: number; name: string; phone: string; address: string } | null>(null);
  const [pay, setPay] = useState<{ id: number; amount: string } | null>(null);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter(
      (c) => !query || c.name.toLowerCase().includes(query) || (c.phone || "").includes(query),
    );
  }, [customers, q]);

  function start(c?: Customer) {
    setForm(c ? { id: c.id, name: c.name, phone: c.phone, address: c.address } : { name: "", phone: "", address: "" });
  }

  function save() {
    if (!form) return;
    const err = saveCustomer(form, form.id);
    if (err) return toast.error(err);
    toast.success("Customer saved");
    setForm(null);
  }

  function collect() {
    if (!pay) return;
    const err = receiveCredit(pay.id, toMinor(Number(pay.amount) || 0, exponent));
    if (err) return toast.error(err);
    toast.success("Payment recorded");
    setPay(null);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Contacts and credit balances"
        action={
          canWrite ? (
            <Button onClick={() => start()}>
              <Plus className="size-4" />
              Add customer
            </Button>
          ) : null
        }
      />
      <Card>
        <Input placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-medium">Name</th>
                <th className="font-medium">Phone</th>
                <th className="font-medium">Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="text-muted">{c.phone || "—"}</td>
                  <td className={cn("tabular", c.balance > 0 ? "text-warn" : "")}>{money(c.balance || 0)}</td>
                  <td className="text-right">
                    {canWrite ? (
                      <Button variant="ghost" size="icon" className="size-9" onClick={() => start(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    {canCollect && c.balance > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        onClick={() => setPay({ id: c.id, amount: String(fromMinor(c.balance, exponent)) })}
                      >
                        <Banknote className="size-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent title={form?.id ? "Edit customer" : "Add customer"}>
          {form ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cn">Name</Label>
                <Input id="cn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cp">Phone</Label>
                <Input id="cp" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ca">Address</Label>
                <Textarea id="ca" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <Button size="wide" onClick={save}>
                Save
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent title="Receive credit payment">
          {pay ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="amt">Amount</Label>
                <Input
                  id="amt"
                  type="number"
                  value={pay.amount}
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                />
              </div>
              <Button size="wide" onClick={collect}>
                Record payment
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
