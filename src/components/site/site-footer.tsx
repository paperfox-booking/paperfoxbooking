import { business } from "@/lib/business";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-teal text-ink">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h2 className="text-3xl">Paper Fox</h2>
          <address className="mt-2 not-italic">
            {business.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
        <div>
          <h2 className="text-3xl">Get in touch</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <a className="text-ink" href={`mailto:${business.email}`}>
                {business.email}
              </a>
            </li>
            <li>
              <a className="text-ink" href={business.phoneHref}>
                {business.phone}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-3xl">Follow us</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <a className="text-ink" href={business.social.facebook}>
                Facebook
              </a>
            </li>
            <li>
              <a className="text-ink" href={business.social.instagram}>
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto max-w-5xl px-4 pb-8 text-sm">
        {business.legalName}, company number {business.companyNumber}.
      </p>
    </footer>
  );
}
