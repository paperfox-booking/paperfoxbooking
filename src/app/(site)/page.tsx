import Image from "next/image";
import { Card } from "@/components/ui/card";
import { business } from "@/lib/business";

export default function HomePage() {
  return (
    <>
      <section className="bg-cream-light">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 text-center sm:flex-row sm:py-14 sm:text-left">
          <Image
            src="/brand/paper-fox-logo.png"
            alt="Paper Fox"
            width={240}
            height={240}
            className="h-auto w-48 sm:w-60"
            priority
          />
          <div>
            <h1 className="text-5xl sm:text-6xl">Crafting weekends</h1>
            <p className="mt-3 max-w-xl text-lg">
              Paper Fox crop weekends at the Holiday Inn Coventry, four times a
              year: March, June, September and November. Your own crop table,
              goody bag, meals and plenty of scrappy time.
            </p>
          </div>
        </div>
      </section>

      <section
        id="events"
        aria-labelledby="events-heading"
        className="mx-auto max-w-5xl px-4 py-10"
      >
        <h2 id="events-heading" className="text-4xl">
          Upcoming events
        </h2>
        <Card className="mt-4">
          <p className="text-lg font-bold">
            There aren&apos;t any events open for booking here yet.
          </p>
          <p className="mt-2">
            Online booking is coming soon. Until then, email us at{" "}
            <a href={`mailto:${business.email}`}>{business.email}</a> to book or
            ask about a place.
          </p>
        </Card>
      </section>
    </>
  );
}
