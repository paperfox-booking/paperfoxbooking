import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to see your Paper Fox bookings.",
};

/**
 * Fully static, so it loads instantly and the form also works if someone taps
 * the button before the page's scripts have loaded. The "go back to" path is
 * read from the address in the browser (see SignInForm).
 */
export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-5xl">Sign in</h1>
      <p className="mt-2 mb-8">
        See your bookings, what you&apos;ve paid and anything left to pay.
      </p>
      <SignInForm />
    </div>
  );
}
