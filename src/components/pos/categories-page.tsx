import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/pos/page-header";
import { usePosStore } from "@/lib/pos/store";
import { can } from "@/lib/pos/permissions";

export function CategoriesPage() {
  const categories = usePosStore((s) => s.categories);
  const products = usePosStore((s) => s.products);
  const role = usePosStore((s) => s.session?.role);
  const saveCategory = usePosStore((s) => s.saveCategory);
  const isAdmin = can(role, "catalog.write");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [id, setId] = useState<number | undefined>();

  function start(editId?: number) {
    const c = categories.find((x) => x.id === editId);
    setId(editId);
    setName(c?.name ?? "");
    setOpen(true);
  }

  function save() {
    const err = saveCategory(name, id);
    if (err) return toast.error(err);
    toast.success("Category saved");
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize your catalog"
        action={
          isAdmin ? (
            <Button onClick={() => start()}>
              <Plus className="size-4" />
              Add category
            </Button>
          ) : null
        }
      />
      <Card className="overflow-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="font-medium">Products</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td>{products.filter((p) => p.category_id === c.id).length}</td>
                <td className="pr-3 text-right">
                  {isAdmin ? (
                    <Button variant="ghost" size="icon" className="size-9" onClick={() => start(c.id)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={id ? "Edit category" : "Add category"}>
          <Label htmlFor="cname">Name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          <Button className="mt-4" size="wide" onClick={save}>
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
