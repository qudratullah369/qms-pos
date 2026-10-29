import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/pos/format";
import { usePosStore } from "@/lib/pos/store";

export function ReceiptOverlay() {
  const sale = usePosStore((s) => s.lastSale);
  const settings = usePosStore((s) => s.settings);
  const dismiss = usePosStore((s) => s.dismissReceipt);
  const { money, when } = useFormat();
  if (!sale) return null;

  function handlePrint() {
    requestAnimationFrame(() => {
      window.print();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 print:static print:bg-white print:p-0">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-panel print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
        <div className="mb-3 flex items-start justify-between print:hidden">
          <h2 className="font-display text-xl">Receipt</h2>
          <button type="button" onClick={dismiss} className="rounded-lg p-2 hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div
          id="receipt"
          className="rounded-lg bg-primary p-4 text-primary-foreground print:bg-white print:p-0 print:text-black"
        >
          <div className="text-center">
            <h3 className="font-display text-xl">{settings.storeName}</h3>
            <p className="text-xs opacity-80 print:opacity-100">
              {[settings.phone, settings.address].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 font-mono text-xs">{sale.bill_id}</p>
            <p className="text-xs">{when(sale.created_at)}</p>
          </div>

          <p className="mt-2 text-sm">Customer: {sale.customer_name}</p>

          <table className="mt-1 w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-70 print:opacity-100">
                <th className="py-0.5">Item</th>
                <th className="py-0.5">Qty</th>
                <th className="py-0.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="py-0.5">{i.name}</td>
                  <td className="py-0.5">{i.qty}</td>
                  <td className="tabular py-0.5 text-right">{money(Math.round(i.price * i.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-totals mt-2 border-t border-primary-foreground/20 pt-1 text-sm print:border-black/30">
            <p>Subtotal: {money(sale.subtotal)}</p>
            {sale.discount > 0 ? <p>Discount: {money(sale.discount)}</p> : null}
            {sale.tax > 0 ? (
              <p>
                {settings.taxName || "Tax"} ({(sale.tax_rate_bps / 100).toFixed(1)}%): {money(sale.tax)}
              </p>
            ) : null}
            <p className="receipt-total-line font-semibold">Total: {money(sale.total)}</p>
            <p>Tendered: {money(sale.paid)}</p>
            <p>Change: {money(sale.change)}</p>
            {sale.balance_due > 0 ? <p>Balance due: {money(sale.balance_due)}</p> : null}
            <p>Payment: {sale.payment}</p>
            {settings.taxRegistration ? <p>Tax ID: {settings.taxRegistration}</p> : null}
          </div>

          <p className="mt-2 text-center text-xs">Thank you</p>
        </div>

        <div className="mt-4 flex gap-2 print:hidden">
          <Button variant="secondary" className="flex-1" onClick={dismiss}>
            Done
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>
    </div>
  );
}
