import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { requireStaff } from "@/lib/auth/session";
import { listBookingsForMatching } from "@/lib/bank/admin";
import { BankImport } from "./bank-import";

export const metadata: Metadata = { title: "Bank statement" };

export default function BankPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Bank />
    </Suspense>
  );
}

async function Bank() {
  const access = await requireStaff("/admin/bank", "payments.record");
  if (!access.allowed) return <NotAllowed access={access} />;
  const bookings = await listBookingsForMatching();
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-5xl">Bank statement</h1>
        <p className="mt-1 text-lg">
          Record lots of bank transfers at once. Upload a statement, and each
          payment in is matched to a booking by its reference (like
          PF-2027-0001) or the person&apos;s name. Check the matches, then
          record them. Each one sends its email (B2, B3 or a thank you), just
          like recording a payment by hand.
        </p>
      </div>
      <BankImport bookings={bookings} />
    </div>
  );
}
