import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The fox and "PAPER FOX" wordmark, linking home. */
export function BrandMark({
  href = "/",
  suffix,
  className,
}: {
  href?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 text-ink no-underline", className)}
    >
      <Image
        src="/brand/fox-mark.png"
        alt=""
        width={44}
        height={44}
        className="rounded-xl"
        priority
      />
      <span className="font-display text-3xl leading-none tracking-wide">
        Paper Fox
        {suffix ? (
          <span className="ml-2 align-middle font-sans text-sm font-bold tracking-normal text-stone">
            {suffix}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
