"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print window (where it can also be saved as a PDF). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="print:hidden"
    >
      {label}
    </Button>
  );
}
