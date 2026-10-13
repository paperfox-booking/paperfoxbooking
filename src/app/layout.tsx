import type { Metadata, Viewport } from "next";
import "@fontsource/bebas-neue/400.css";
import "@fontsource-variable/nunito-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Paper Fox bookings",
    template: "%s | Paper Fox",
  },
  description:
    "Book your place at a Paper Fox crafting weekend, and see what you've paid.",
  applicationName: "Paper Fox",
  openGraph: {
    siteName: "Paper Fox",
    locale: "en_GB",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#93ded0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 bg-white px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
