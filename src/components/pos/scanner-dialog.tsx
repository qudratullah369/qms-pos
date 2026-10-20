import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => Detector;
  }
}

export function ScannerDialog({
  open,
  onClose,
  onCode,
}: {
  open: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) {
      setError(null);
      setManual("");
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;

    async function start() {
      if (!window.BarcodeDetector) {
        setError("Camera detection is not available here. Type or paste a barcode below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });
        const loop = async () => {
          if (!alive) return;
          const codes = await detector.detect(video).catch(() => []);
          const value = codes[0]?.rawValue;
          if (value) {
            onCodeRef.current(value);
            return;
          }
          raf = requestAnimationFrame(() => void loop());
        };
        void loop();
      } catch {
        setError("Camera unavailable or permission denied. Enter the barcode instead.");
      }
    }

    void start();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <video ref={videoRef} className="min-h-0 flex-1 bg-bg object-cover" playsInline muted />
      <div className="safe-bottom space-y-3 border-t border-border bg-surface p-4">
        <p className="text-sm text-muted">{error ?? "Point the camera at a barcode, or type it below."}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = manual.trim();
            if (!code) return;
            onCode(code);
          }}
        >
          <Input
            autoFocus={!window.BarcodeDetector}
            inputMode="numeric"
            placeholder="Enter barcode"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button type="submit" disabled={!manual.trim()}>
            Add
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </form>
      </div>
    </div>
  );
}
