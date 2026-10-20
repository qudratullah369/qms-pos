import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/pos/page-header";
import { useFormat } from "@/lib/pos/format";
import { toMinor } from "@/lib/pos/money";
import { usePosStore } from "@/lib/pos/store";
import { EXPENSE_CATEGORIES } from "@/lib/pos/types";

export function ExpensesPage() {
  const expenses = usePosStore((s) => s.expenses);
  const saveExpense = usePosStore((s) => s.saveExpense);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [affectsCash, setAffectsCash] = useState(false);
  const { money, when, exponent } = useFormat();
  const rows = [...expenses].reverse();
  const total = expenses.reduce((a, e) => a + e.amount, 0);

  function save() {
    const err = saveExpense(category, description, toMinor(Number(amount) || 0, exponent), affectsCash);
    if (err) return toast.error(err);
    toast.success("Expense saved");
    setOpen(false);
    setDescription("");
    setAmount("");
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Operating costs"
        action={
          <Button variant="warn" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add expense
          </Button>
        }
      />
      <Card className="mb-4">
        <p className="text-xs text-muted">All recorded expenses. Only rows marked cash leave the drawer.</p>
        <p className="font-display mt-1 text-2xl tabular">{money(total)}</p>
      </Card>
      <Card className="overflow-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="font-medium">Category</th>
              <th className="font-medium">Description</th>
              <th className="font-medium">Drawer</th>
              <th className="pr-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-t border-border">
                <td className="px-4 py-3">{when(x.created_at)}</td>
                <td>{x.category}</td>
                <td className="text-muted">{x.description || "—"}</td>
                <td>{x.affects_cash ? "Cash" : "Not cash"}</td>
                <td className="tabular pr-4">{money(x.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add expense">
          <div className="space-y-3">
            <div>
              <Label htmlFor="ec">Category</Label>
              <NativeSelect id="ec" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="ed">Description</Label>
              <Input id="ed" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ea">Amount</Label>
              <Input id="ea" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="cash-drawer"
                type="checkbox"
                checked={affectsCash}
                onChange={(e) => setAffectsCash(e.target.checked)}
              />
              <Label htmlFor="cash-drawer">Paid from the cash drawer</Label>
            </div>
            <Button size="wide" onClick={save}>
              Save expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
