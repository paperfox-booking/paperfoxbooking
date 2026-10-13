import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md flex-1 px-4 py-16">
      <BrandMark />
      <h1 className="mt-10 text-5xl">Page not found</h1>
      <p className="mt-3">
        We couldn&apos;t find that page. The link may be out of date, or there
        may be a typo in the address.
      </p>
      <p className="mt-3">
        <Link href="/">Go to the Paper Fox home page</Link>
      </p>
    </main>
  );
}
