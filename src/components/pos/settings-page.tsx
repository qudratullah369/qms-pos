import { Download, RotateCcw, Upload, Plus, Building2 } from "lucide-react";
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
import { MAX_BRANCHES, ROLES, type Branch, type Settings } from "@/lib/pos/types";

export function SettingsPage() {
  const settings = usePosStore((s) => s.settings);
  const users = usePosStore((s) => s.users);
  const role = usePosStore((s) => s.session?.role);
  const branches = usePosStore((s) => s.branches || []);
  const saveSettings = usePosStore((s) => s.saveSettings);
  const saveBranch = usePosStore((s) => s.saveBranch);
  const deleteBranch = usePosStore((s) => s.deleteBranch);
  const exportDb = usePosStore((s) => s.exportDb);
  const importDb = usePosStore((s) => s.importDb);
  const resetDemo = usePosStore((s) => s.resetDemo);
  const changePin = usePosStore((s) => s.changePin);
  const [form, setForm] = useState<Settings>(settings);
  const [pins, setPins] = useState<Record<number, string>>({});
  const [branchForm, setBranchForm] = useState<Partial<Branch> & { name: string; code: string }>({
    name: "",
    code: "",
    address: "",
    phone: "",
    isActive: true,
  });
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);

  function saveProfile() {
    if (form.currency !== settings.currency) {
      const ok = confirm("Changing currency does not convert existing prices or sales. Continue?");
      if (!ok) return;
    }
    const err = saveSettings(form);
    if (err) return toast.error(err);
    toast.success("Settings saved");
  }

  function handleSaveBranch() {
    const err = saveBranch({
      id: editingBranchId ?? undefined,
      name: branchForm.name,
      code: branchForm.code,
      address: branchForm.address || "",
      phone: branchForm.phone || "",
      isActive: branchForm.isActive !== false,
    });
    if (err) return toast.error(err);
    toast.success(editingBranchId ? "Branch updated" : "Branch added");
    setBranchForm({ name: "", code: "", address: "", phone: "", isActive: true });
    setEditingBranchId(null);
  }

  function startEdit(b: Branch) {
    setEditingBranchId(b.id);
    setBranchForm({
      name: b.name,
      code: b.code,
      address: b.address,
      phone: b.phone,
      isActive: b.isActive,
    });
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
    toast.success("Backup downloaded. Staff PINs are never included in backups.");
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
      <PageHeader title="Settings" subtitle="Store profile, branches, currency, timezone, and staff permissions" />
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
                {form.pricesIncludeTax ? "Shelf prices already include this tax." : "Tax is added on top of the discounted total."} Zero turns tax off.
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
          </div>
        </Card>

        {can(role, "settings.write") ? (
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4" />
              Branches ({branches.length}/{MAX_BRANCHES})
            </h3>
            <div className="mb-4 space-y-2">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{b.name}</span>
                    <span className="ml-2 rounded bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-muted">
                      {b.code}
                    </span>
                    {!b.isActive && (
                      <span className="ml-2 text-xs text-warn">Inactive</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(b)}>
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs text-muted">
                {editingBranchId ? "Editing branch" : "Add new branch"} (max {MAX_BRANCHES})
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="Gulberg Branch"
                  />
                </div>
                <div>
                  <Label>Code</Label>
                  <Input
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    placeholder="GLB"
                    maxLength={8}
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={branchForm.address || ""}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={branchForm.phone || ""}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={branchForm.isActive !== false}
                  onChange={(e) => setBranchForm({ ...branchForm, isActive: e.target.checked })}
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button onClick={handleSaveBranch}>
                  <Plus className="size-4" />
                  {editingBranchId ? "Update Branch" : "Add Branch"}
                </Button>
                {editingBranchId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingBranchId(null);
                      setBranchForm({ name: "", code: "", address: "", phone: "", isActive: true });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : null}

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
            Permissions are enforced in the till, not only by hiding a button.
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
            Products, sales, and customers stay on this device. Export a JSON backup and keep a copy off the phone. Staff PINs are never written into backups.
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
