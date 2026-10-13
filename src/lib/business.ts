/**
 * Paper Fox's public business details (CLAUDE.md section 15). These move to
 * the owner-only settings screen in a later phase; until then this is the one
 * place to change them.
 */
export const business = {
  name: "Paper Fox",
  legalName: "Paper Fox Events Ltd",
  companyNumber: "13717760",
  email: "hello@paper-fox.co.uk",
  phone: "+44 (0)24 7693 7383",
  phoneHref: "tel:+442476937383",
  address: ["Suite 1B, The Hall", "Rugby Road", "Wolston", "CV8 3FZ"],
  website: "https://www.paper-fox.co.uk/",
  social: {
    facebook: "https://www.facebook.com/PaperFoxEvents/",
    facebookGroup: "https://www.facebook.com/groups/paperfoxevents/",
    instagram: "https://www.instagram.com/paperfoxevents/",
  },
  signOff: "Nichola & Morag",
} as const;
