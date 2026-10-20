import { useEffect, useRef, useState } from "react";
import { Delete, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"] as const;

export function LoginScreen() {
  const login = usePosStore((s) => s.login);
  const storeName = usePosStore((s) => s.settings.storeName);
  const [pin, setPin] = useState("");
  const pinRef = useRef(pin);
  pinRef.current = pin;

  function submit(nextPin = pinRef.current) {
    if (!nextPin) return;
    if (usePosStore.getState().session) return;
    if (!login(nextPin)) {
      toast.error("Invalid PIN");
      setPin("");
      return;
    }
    toast.success("Signed in");
  }

  function tryAuto(next: string) {
    const users = usePosStore.getState().users;
    if (users.some((u) => u.pin === next)) submit(next);
  }

  function press(key: (typeof KEYS)[number]) {
    if (key === "clear") {
      setPin("");
      return;
    }
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      const next = p.length >= 8 ? p : p + key;
      queueMicrotask(() => tryAuto(next));
      return next;
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") submit();
      else if (/^\d$/.test(e.key)) {
        const next = pinRef.current.length >= 8 ? pinRef.current : pinRef.current + e.key;
        setPin(next);
        tryAuto(next);
      } else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-elevated text-accent">
            <Store className="size-7" strokeWidth={1.6} />
          </div>
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Offline till</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight text-fg">QMS POS Pro</h1>
          <p className="mt-2 text-sm text-muted">{storeName}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-panel">
          <div className="mb-4 flex h-12 items-center justify-center gap-2 rounded-lg bg-input">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`size-2.5 rounded-full ${i < pin.length ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="flex h-14 items-center justify-center rounded-lg bg-elevated text-lg font-medium text-fg transition-[background-color,transform] duration-150 hover:bg-border active:scale-[0.98]"
              >
                {key === "del" ? <Delete className="size-5" /> : key === "clear" ? "C" : key}
              </button>
            ))}
          </div>

          <Button size="wide" className="mt-4" onClick={() => submit()} disabled={!pin}>
            Sign in
          </Button>

          <p className="mt-4 text-center text-xs text-subtle">
            Demo PINs — Admin 1234 · Manager 2468 · Cashier 0000 · Accountant 1357
          </p>
        </div>
      </div>
    </div>
  );
}
