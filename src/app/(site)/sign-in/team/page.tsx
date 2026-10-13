import type { Metadata } from "next";
import Link from "next/link";
import { TeamSignInForm } from "./team-sign-in-form";

export const metadata: Metadata = {
  title: "Team sign in",
  robots: { index: false, follow: false },
};

/** Fully static, like the customer sign-in page, so the form is there straight away. */
export default function TeamSignInPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-5xl">Team sign in</h1>
      <p className="mt-2 mb-8">
        For the Paper Fox team. Booked on a weekend?{" "}
        <Link href="/sign-in">Sign in to your account here</Link> instead.
      </p>
      <TeamSignInForm />
    </div>
  );
}
