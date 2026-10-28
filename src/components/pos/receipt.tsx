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
    // Ensure the browser has a moment to paint the receipt before print dialog
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

        {/* Only this block is printed */}
        <div
          id="receipt"
          className="rounded-lg bg-primary p-4 text-primary-foreground print:bg-white print:p-0 print:text-black"
        >
          <div className="text-center">
            <h3 className="font-display text-xl">{settings.storeName}</h3>
            <p className="text-xs opacity-80 print:opacity-100">
              {settings.phone}
              {settings.phone && settings.address ? " · " : ""}
              {settings.address}
            </p>
            <p className="mt-2 font-mono text-xs">{sale.bill_id}</p>
            <p className="text-xs">{when(sale.created_at)}</p>
          </div>
          <p className="mt-3 text-sm">Customer: {sale.customer_name}</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-70 print:opacity-100">
                <th className="py-1">Item</th>
                <th>Qty</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="py-1">{i.name}</td>
                  <td>{i.qty}</td>
                  <td className="tabular text-right">{money(Math.round(i.price * i.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 border-t border-primary-foreground/20 pt-2 text-sm print:border-black/20">
            <p>Subtotal: {money(sale.subtotal)}</p>
            <p>Discount: {money(sale.discount)}</p>
            {sale.tax > 0 ? (
              <p>
                {settings.taxName || "Tax"} ({(sale.tax_rate_bps / 100).toFixed(2)}%): {money(sale.tax)}
              </p>
            ) : null}
            <p className="font-semibold">Total: {money(sale.total)}</p>
            <p>Tendered: {money(sale.paid)}</p>
            <p>Change: {money(sale.change)}</p>
            {sale.balance_due > 0 ? <p>Balance due: {money(sale.balance_due)}</p> : null}
            <p>Payment: {sale.payment}</p>
            {settings.taxRegistration ? <p>Tax ID: {settings.taxRegistration}</p> : null}
          </div>
          <p className="mt-3 text-center text-xs">Thank you</p>
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
