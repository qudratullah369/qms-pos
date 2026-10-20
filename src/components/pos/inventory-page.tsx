import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, SlidersHorizontal, Upload } from "lucide-react";
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
import { fileToDataUrl } from "@/lib/pos/image";
import { fromMinor, toMinor } from "@/lib/pos/money";
import { can } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";
import type { Product } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

const empty: Omit<Product, "id"> = {
  name: "",
  barcode: "",
  category_id: 0,
  cost: 0,
  selling: 0,
  stock: 0,
  min_stock: 5,
  image: null,
};

export function InventoryPage() {
  const products = usePosStore((s) => s.products);
  const categories = usePosStore((s) => s.categories);
  const role = usePosStore((s) => s.session?.role);
  const saveProduct = usePosStore((s) => s.saveProduct);
  const deleteProduct = usePosStore((s) => s.deleteProduct);
  const adjustStock = usePosStore((s) => s.adjustStock);
  const importProductsCsv = usePosStore((s) => s.importProductsCsv);
  const { money, exponent } = useFormat();
  const canWrite = can(role, "catalog.write");
  const canImport = can(role, "catalog.import");
  const canStock = can(role, "catalog.stock");
  const canDelete = can(role, "catalog.delete");
  const canCost = can(role, "sale.profit");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<(Omit<Product, "id"> & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const pageSize = 50;

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = products.filter(
      (p) => !query || p.name.toLowerCase().includes(query) || (p.barcode || "").includes(query),
    );
    if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= p.min_stock);
    if (filter === "out") list = list.filter((p) => p.stock <= 0);
    return list;
  }, [products, q, filter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function openNew() {
    setPage(1);
    setEditing({ ...empty, category_id: categories[0]?.id ?? 0 });
  }

  function openEdit(product: Product) {
    setEditing({
      ...product,
      cost: fromMinor(product.cost, exponent),
      selling: fromMinor(product.selling, exponent),
    });
  }

  async function onSave() {
    if (!editing) return;
    setBusy(true);
    const err = saveProduct({
      ...editing,
      barcode: editing.barcode || null,
      cost: toMinor(Number(editing.cost) || 0, exponent),
      selling: toMinor(Number(editing.selling) || 0, exponent),
      stock: Number(editing.stock) || 0,
      min_stock: Number(editing.min_stock) || 0,
    });
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Product saved");
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Products, pricing and stock"
        action={
          canWrite || canImport ? (
            <div className="flex gap-2">
              {canImport ? (
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-elevated">
                <Upload className="size-4" /> Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const result = importProductsCsv(text);
                    if (result.imported) toast.success(`${result.imported} products imported`);
                    else toast.error(result.errors[0] ?? "No products imported");
                    if (result.errors.length && result.imported) {
                      toast.error(`${result.errors.length} rows skipped`);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              ) : null}
              {canWrite ? <Button onClick={openNew}><Plus className="size-4" /> Add product</Button> : null}
            </div>
          ) : null
        }
      />
      <Card>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <NativeSelect value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="sm:w-40">
            <option value="all">All</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </NativeSelect>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-medium">Product</th>
                <th className="font-medium">Cost</th>
                <th className="font-medium">Sell</th>
                <th className="font-medium">Stock</th>
                <th className="font-medium">Barcode</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {p.image ? (
                        <img src={p.image} alt="" className="size-9 rounded-md object-cover" />
                      ) : null}
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="tabular">{canCost ? money(p.cost) : "—"}</td>
                  <td className="tabular">{money(p.selling)}</td>
                  <td
                    className={cn(
                      "tabular",
                      p.stock === 0 ? "text-danger" : p.stock <= p.min_stock ? "text-warn" : "",
                    )}
                  >
                    {p.stock}
                  </td>
                  <td className="font-mono text-xs text-muted">{p.barcode || "—"}</td>
                  <td className="text-right">
                    {canStock || canWrite || canDelete ? (
                      <div className="flex justify-end gap-1">
                        {canStock ? (
                        <Button variant="ghost" size="icon" className="size-9" onClick={() => { setAdjusting(p); setAdjustment(""); setReason(""); }}>
                          <SlidersHorizontal className="size-3.5" />
                        </Button>
                        ) : null}
                        {canWrite ? (
                        <Button variant="ghost" size="icon" className="size-9" onClick={() => openEdit(p)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        ) : null}
                        {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          onClick={() => {
                            if (!confirm(`Remove ${p.name}? Sales history keeps the item name.`)) return;
                            const err = deleteProduct(p.id);
                            if (err) toast.error(err);
                            else toast.success("Product removed");
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
          <span>{rows.length} matching products · capacity 10,000</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <span>Page {currentPage} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent title="Adjust stock">
          {adjusting ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{adjusting.name} · Current stock: <b>{adjusting.stock}</b></p>
              <div><Label htmlFor="stock-adjust">Quantity change</Label><Input id="stock-adjust" type="number" inputMode="numeric" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="+10 or -3" /></div>
              <div><Label htmlFor="stock-reason">Reason</Label><Input id="stock-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Received, damaged, count correction" /></div>
              <p className="text-xs text-subtle">Use a positive number to add stock or a negative number to remove stock. The reason is kept on this device.</p>
              <Button size="wide" onClick={() => { const err = adjustStock(adjusting.id, Number(adjustment), reason); if (err) toast.error(err); else { toast.success("Stock adjusted"); setAdjusting(null); } }}>Save adjustment</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.id ? "Edit product" : "Add product"}>
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="pname">Name</Label>
                <Input id="pname" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="pcat">Category</Label>
                <NativeSelect
                  id="pcat"
                  value={editing.category_id}
                  onChange={(e) => setEditing({ ...editing, category_id: Number(e.target.value) })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="pbar">Barcode</Label>
                <Input
                  id="pbar"
                  inputMode="numeric"
                  value={editing.barcode ?? ""}
                  onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="pcost">Cost</Label>
                  <Input
                    id="pcost"
                    type="number"
                    value={editing.cost}
                    onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="psell">Selling</Label>
                  <Input
                    id="psell"
                    type="number"
                    value={editing.selling}
                    onChange={(e) => setEditing({ ...editing, selling: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="pstock">Stock</Label>
                  <Input
                    id="pstock"
                    type="number"
                    value={editing.stock}
                    onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="pmin">Minimum stock</Label>
                  <Input
                    id="pmin"
                    type="number"
                    value={editing.min_stock}
                    onChange={(e) => setEditing({ ...editing, min_stock: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="pimg">Product image</Label>
                <Input
                  id="pimg"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const image = await fileToDataUrl(file);
                    setEditing({ ...editing, image });
                  }}
                />
              </div>
              <Button size="wide" onClick={() => void onSave()} disabled={busy}>
                Save product
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
