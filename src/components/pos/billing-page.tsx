import { Minus, Plus, ScanLine, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/pos/page-header";
import { ScannerDialog } from "@/components/pos/scanner-dialog";
import { useFormat } from "@/lib/pos/format";
import { fromMinor, percentOf, toMinor } from "@/lib/pos/money";
import { taxOn } from "@/lib/pos/ledger";
import { usePosStore } from "@/lib/pos/store";
import { PAYMENTS, TENDER_METHODS, type Payment, type TenderMethod } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

export function BillingPage() {
  const products = usePosStore((s) => s.products);
  const categories = usePosStore((s) => s.categories);
  const customers = usePosStore((s) => s.customers);
  const cart = usePosStore((s) => s.cart);
  const addToCart = usePosStore((s) => s.addToCart);
  const addByCode = usePosStore((s) => s.addByCode);
  const changeQty = usePosStore((s) => s.changeQty);
  const removeLine = usePosStore((s) => s.removeLine);
  const clearCart = usePosStore((s) => s.clearCart);
  const customerId = usePosStore((s) => s.customerId);
  const setCustomerId = usePosStore((s) => s.setCustomerId);
  const payment = usePosStore((s) => s.payment);
  const setPayment = usePosStore((s) => s.setPayment);
  const tenderMethod = usePosStore((s) => s.tenderMethod);
  const setTenderMethod = usePosStore((s) => s.setTenderMethod);
  const discount = usePosStore((s) => s.discount);
  const setDiscount = usePosStore((s) => s.setDiscount);
  const paid = usePosStore((s) => s.paid);
  const setPaid = usePosStore((s) => s.setPaid);
  const checkout = usePosStore((s) => s.checkout);
  const holdSale = usePosStore((s) => s.holdSale);
  const resumeSale = usePosStore((s) => s.resumeSale);
  const deleteHeldSale = usePosStore((s) => s.deleteHeldSale);
  const heldSales = usePosStore((s) => s.held_sales);
  const settings = usePosStore((s) => s.settings);
  const stockAt = usePosStore((s) => s.stockAt);
  const { money: fmt, exponent } = useFormat();

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"fixed" | "percent">("fixed");
  const [percentOff, setPercentOff] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = cat === "all" || String(p.category_id) === cat;
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, query, cat]);

  const subtotal = cart.reduce((a, c) => a + Math.round(c.price * c.qty), 0);
  const discountAmount = discountMode === "percent" ? percentOf(subtotal, percentOff) : discount;
  const priced = taxOn(Math.max(0, subtotal - discountAmount), {
    rateBps: settings.taxRateBps,
    pricesIncludeTax: settings.pricesIncludeTax,
  });
  const total = priced.total;
  const count = cart.reduce((a, c) => a + c.qty, 0);
  const tendered = paid > 0 ? paid : total;
  const due = total - tendered;

  useEffect(() => {
    if (discountMode === "percent") {
      setDiscount(percentOf(subtotal, percentOff));
    }
  }, [discountMode, percentOff, subtotal, setDiscount]);

  function tryAdd(id: number) {
    const err = addToCart(id);
    if (err) toast.error(err);
  }

  function tryQty(id: number, d: number) {
    const err = changeQty(id, d);
    if (err) toast.error(err);
  }

  function tryExact(code: string) {
    const err = addByCode(code);
    if (err) return false;
    const needle = code.trim().toLowerCase();
    const p = products.find(
      (x) => (x.barcode || "").toLowerCase() === needle || x.name.toLowerCase() === needle,
    );
    toast.success(p?.name ?? "Added");
    setQuery("");
    return true;
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (tryExact(q)) return;
    if (filtered.length === 1) {
      tryAdd(filtered[0]!.id);
      setQuery("");
      return;
    }
    toast.error(`No exact match: ${q}`);
  }

  function pay() {
    if (discountMode === "percent") setDiscount(discountAmount);
    const result = checkout();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Sale completed: ${result.sale.bill_id}`);
    setCartOpen(false);
    setPercentOff(0);
    setDiscountMode("fixed");
  }

  const cartPanel = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Cart <Badge className="ml-1">{count} items</Badge>
        </h3>
        {cart.length > 0 ? (
          <button type="button" className="text-xs text-muted hover:text-fg" onClick={clearCart}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="min-h-24 max-h-64 space-y-1 overflow-auto">
        {cart.length === 0 ? (
          <p className="text-sm text-muted">Cart is empty.</p>
        ) : (
          cart.map((line) => (
            <div key={line.product_id} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-muted">
                  {fmt(line.price)} × {line.qty}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="icon" className="size-9" onClick={() => tryQty(line.product_id, -1)}>
                  <Minus className="size-3.5" />
                </Button>
                <span className="tabular w-6 text-center text-sm">{line.qty}</span>
                <Button variant="secondary" size="icon" className="size-9" onClick={() => tryQty(line.product_id, 1)}>
                  <Plus className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => removeLine(line.product_id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="customer">Customer</Label>
          <NativeSelect
            id="customer"
            value={customerId ?? ""}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Walk-in</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="payment">Payment</Label>
          <NativeSelect
            id="payment"
            value={payment}
            onChange={(e) => {
              const next = e.target.value as Payment;
              setPayment(next);
              if (next === "Cash" || next === "Card" || next === "JazzCash" || next === "EasyPaisa") {
                setTenderMethod(next);
              }
            }}
          >
            {PAYMENTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
        </div>
        {payment === "Credit" && (
          <div>
            <Label htmlFor="tender">Tender received</Label>
            <NativeSelect
              id="tender"
              value={tenderMethod}
              onChange={(e) => setTenderMethod(e.target.value as TenderMethod)}
            >
              {TENDER_METHODS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              Cash increases the drawer; card and digital do not.
            </p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="discount">Discount</Label>
            <button
              type="button"
              className="text-xs text-muted underline"
              onClick={() => {
                if (discountMode === "fixed") {
                  setPercentOff(subtotal > 0 ? Math.round((discount / subtotal) * 1000) / 10 : 0);
                  setDiscountMode("percent");
                } else {
                  setDiscount(discountAmount);
                  setDiscountMode("fixed");
                }
              }}
            >
              {discountMode === "fixed" ? "Use %" : "Use Rs"}
            </button>
          </div>
          <Input
            id="discount"
            type="number"
            min={0}
            max={discountMode === "percent" ? 100 : undefined}
            value={discountMode === "percent" ? percentOff || "" : discount ? fromMinor(discount, exponent) : ""}
            onChange={(e) => {
              const n = Number(e.target.value) || 0;
              if (discountMode === "percent") setPercentOff(n);
              else setDiscount(toMinor(n, exponent));
            }}
          />
          <p className="mt-1 text-xs text-muted">
            {discountMode === "percent" ? `${percentOff}% = ${fmt(discountAmount)}` : "Amount off the total"}
          </p>
        </div>
        <div>
          <Label htmlFor="paid">Paid</Label>
          <Input
            id="paid"
            type="number"
            min={0}
            value={paid ? fromMinor(paid, exponent) : ""}
            placeholder={String(fromMinor(total, exponent) || 0)}
            onChange={(e) => setPaid(toMinor(Number(e.target.value) || 0, exponent))}
          />
          <p className="mt-1 text-xs text-muted">Leave blank for exact amount</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setPaid(total)}>
          Exact
        </Button>
        {[500, 1000, 5000].map((n) => (
          <Button key={n} variant="outline" size="sm" className="flex-1" onClick={() => setPaid(toMinor(n, exponent))}>
            {n}
          </Button>
        ))}
      </div>

      {heldSales.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border bg-elevated p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">Parked sales</span>
            <Badge>{heldSales.length}</Badge>
          </div>
          <div className="space-y-1">
            {heldSales
              .slice()
              .reverse()
              .map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <span>
                    {new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                    {h.cart.reduce((a, x) => a + x.qty, 0)} items
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const e = resumeSale(h.id);
                        if (e) toast.error(e);
                        else {
                          setDiscountMode("fixed");
                          setPercentOff(0);
                        }
                      }}
                    >
                      Resume
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteHeldSale(h.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg bg-accent px-4 py-3 text-accent-foreground">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="tabular">{fmt(total)}</span>
        </div>
        <p className="mt-1 text-xs opacity-80">
          Subtotal {fmt(subtotal)}
          {priced.tax > 0 ? ` · ${settings.taxName} ${fmt(priced.tax)}` : ""} · Discount {fmt(discountAmount)} ·{" "}
          {due <= 0 ? `Change ${fmt(Math.max(0, tendered - total))}` : `Due ${fmt(due)}`}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const e = holdSale();
            if (e) toast.error(e);
            else {
              toast.success("Sale parked");
              setCartOpen(false);
              setPercentOff(0);
              setDiscountMode("fixed");
            }
          }}
          disabled={!cart.length}
        >
          Park / Hold
        </Button>
        <Button onClick={pay} disabled={!cart.length}>
          Complete sale
        </Button>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader title="Billing" subtitle="Fast checkout with live stock control" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <Input
                className="pl-9"
                placeholder="Product, barcode, then Enter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                autoComplete="off"
              />
            </div>
            <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-44">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="secondary" onClick={() => setScanOpen(true)}>
              <ScanLine className="size-4" />
              Scan
            </Button>
          </div>
          <div className="grid max-h-[62vh] grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted">No products found.</p>
            ) : (
              filtered.map((p) => {
                const qty = stockAt(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => tryAdd(p.id)}
                    className={cn(
                      "rounded-lg border border-border bg-elevated p-2.5 text-left transition-colors duration-150 hover:border-accent/50 disabled:opacity-40",
                    )}
                  >
                    {p.image ? (
                      <img src={p.image} alt="" className="mb-2 h-20 w-full rounded-md object-cover" />
                    ) : null}
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    <p className="tabular text-sm font-semibold text-accent">{fmt(p.selling)}</p>
                    <p className="text-xs text-muted">
                      Stock {qty}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>
        <Card className="hidden lg:col-span-5 lg:block">{cartPanel}</Card>
      </div>

      <div className="fixed inset-x-3 bottom-20 z-20 lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="flex h-14 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-panel"
        >
          <span>{count} items</span>
          <span className="tabular">{fmt(total)}</span>
          <span>Open cart</span>
        </button>
      </div>

      {cartOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-bg/80" onClick={() => setCartOpen(false)} aria-label="Close cart" />
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-auto rounded-t-xl border border-border bg-surface p-4">
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setCartOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {cartPanel}
          </div>
        </div>
      ) : null}

      <ScannerDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(code) => {
          if (tryExact(code)) {
            setScanOpen(false);
            return;
          }
          toast.error(`Barcode not found: ${code}`);
        }}
      />
    </div>
  );
}
