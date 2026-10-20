import { Download, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/pos/page-header";
import { CURRENCIES, LOCALES, TIME_ZONES } from "@/lib/pos/money";
import { can, PERMISSION_LABELS, permissionsFor } from "@/lib/pos/permissions";
import { usePosStore } from "@/lib/pos/store";
import { ROLES, type Settings } from "@/lib/pos/types";

export function SettingsPage() {
  const settings = usePosStore((s) => s.settings);
  const users = usePosStore((s) => s.users);
  const role = usePosStore((s) => s.session?.role);
  const saveSettings = usePosStore((s) => s.saveSettings);
  const exportDb = usePosStore((s) => s.exportDb);
  const importDb = usePosStore((s) => s.importDb);
  const resetDemo = usePosStore((s) => s.resetDemo);
  const changePin = usePosStore((s) => s.changePin);
  const [form, setForm] = useState<Settings>(settings);
  const [pins, setPins] = useState<Record<number, string>>({});

  function saveProfile() {
    if (form.currency !== settings.currency) {
      const ok = confirm("Changing currency does not convert existing prices or sales. Continue?");
      if (!ok) return;
    }
    const err = saveSettings(form);
    if (err) return toast.error(err);
    toast.success("Settings saved");
  }

  function backup() {
    const data = exportDb();
    if (!data) return toast.error("You do not have permission for this action");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qms-pos-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup downloaded. It contains staff PINs — keep it private.");
  }

  function restore() {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = ".json,application/json";
    i.onchange = () => {
      const f = i.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const err = importDb(JSON.parse(String(r.result)));
          if (err) throw new Error(err);
          toast.success("Backup restored");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Invalid backup file");
        }
      };
      r.readAsText(f);
    };
    i.click();
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Store profile, currency, timezone, and staff permissions" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium">Store profile</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="storePhone">Phone</Label>
              <Input id="storePhone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="storeAddress">Address</Label>
              <Textarea id="storeAddress" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <NativeSelect id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {Object.entries(CURRENCIES).map(([code, meta]) => (
                  <option key={code} value={code}>
                    {code} — {meta.name} ({meta.exponent} decimal{meta.exponent === 1 ? "" : "s"})
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="locale">Number and date locale</Label>
              <NativeSelect id="locale" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                {LOCALES.map((locale) => (
                  <option key={locale.id} value={locale.id}>
                    {locale.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="tz">Business timezone</Label>
              <NativeSelect id="tz" value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
                {TIME_ZONES.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="taxName">Tax name</Label>
              <Input id="taxName" value={form.taxName} onChange={(e) => setForm({ ...form, taxName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax rate %</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.taxRateBps ? form.taxRateBps / 100 : ""}
                placeholder="0"
                onChange={(e) => {
                  const percent = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  setForm({ ...form, taxRateBps: Math.round(percent * 100) });
                }}
              />
              <p className="mt-1 text-xs text-subtle">
                {form.pricesIncludeTax ? "Shelf prices already include this tax." : "Tax is added on top of the discounted total."} Zero turns tax off. This is a calculation, not a legal filing.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pricesIncludeTax}
                onChange={(e) => setForm({ ...form, pricesIncludeTax: e.target.checked })}
              />
              Prices include tax
            </label>
            <div>
              <Label htmlFor="taxId">Tax registration</Label>
              <Input
                id="taxId"
                value={form.taxRegistration}
                onChange={(e) => setForm({ ...form, taxRegistration: e.target.value })}
                placeholder="Printed on the receipt"
              />
            </div>
            <Button onClick={saveProfile}>Save settings</Button>
            <p className="text-xs text-subtle">
              Arabic and Urdu locales switch the layout to right-to-left. Amounts stay in integer minor units of the selected currency.
            </p>
          </div>
        </Card>

        {can(role, "settings.pin") ? (
          <Card>
            <h3 className="mb-3 text-sm font-medium">Staff PINs</h3>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor={`pin-${user.id}`}>
                      {user.name} · {user.role}
                    </Label>
                    <Input
                      id={`pin-${user.id}`}
                      inputMode="numeric"
                      value={pins[user.id] ?? ""}
                      onChange={(e) => setPins({ ...pins, [user.id]: e.target.value })}
                      placeholder="New 4–8 digit PIN"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const err = changePin(user.id, pins[user.id] ?? "");
                      if (err) return toast.error(err);
                      setPins({ ...pins, [user.id]: "" });
                      toast.success(`${user.name} PIN updated`);
                    }}
                  >
                    Update
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card>
            <h3 className="mb-2 text-sm font-medium">Staff PINs</h3>
            <p className="text-sm text-muted">Only an admin can change PINs, restore a backup, or erase this till.</p>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-medium">Who can do what</h3>
          <p className="mb-3 text-sm text-muted">
            Permissions are enforced in the till, not only by hiding a button. A cashier cannot record expenses or read gross margin by calling the store directly.
          </p>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 font-medium">Action</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-2 font-medium capitalize">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_LABELS.map((perm) => (
                  <tr key={perm.id} className="border-t border-border">
                    <td className="py-2 pr-3">{perm.label}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-2">
                        {permissionsFor(r).includes(perm.id) ? "Yes" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-medium">Backup</h3>
          <p className="mb-4 text-sm text-muted">
            Products, sales, and customers stay on this device. There is no multi-shop sync. Export a JSON backup and keep a copy off the phone.
          </p>
          <div className="flex flex-wrap gap-2">
            {can(role, "settings.backup") ? (
              <Button variant="secondary" onClick={backup}>
                <Download className="size-4" />
                Backup JSON
              </Button>
            ) : null}
            {can(role, "settings.restore") ? (
              <Button variant="outline" onClick={restore}>
                <Upload className="size-4" />
                Restore JSON
              </Button>
            ) : null}
            {can(role, "settings.reset") ? (
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm("Reset all local data to the demo catalog?")) {
                    const err = resetDemo();
                    if (err) return toast.error(err);
                    toast.success("Demo data restored");
                  }
                }}
              >
                <RotateCcw className="size-4" />
                Reset data
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
