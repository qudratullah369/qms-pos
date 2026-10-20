import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PosApp } from "@/components/pos/pos-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <>
      <PosApp />
      <Toaster theme="dark" position="top-center" richColors={false} />
    </>
  );
}
