import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-cream bg-white p-5 shadow-sm sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function Notice({
  className,
  tone = "info",
  ...props
}: ComponentProps<"div"> & { tone?: "info" | "error" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border-l-4 p-4",
        tone === "info" && "border-teal bg-cream-light",
        tone === "error" && "border-danger bg-cream-light",
        tone === "success" && "border-teal-deep bg-cream-light",
        className,
      )}
      {...props}
    />
  );
}
