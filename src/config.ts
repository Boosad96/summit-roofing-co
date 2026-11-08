/**
 * Summit Roofing Co. — template configuration.
 *
 * EVERYTHING a new roofing company needs to change lives in this one file:
 * company name, contact details, services, prices, plans, service area,
 * financing copy and reviews. No other file needs editing to rebrand the
 * template — components read from here only.
 *
 * Prices are shown in USD. Whop plan IDs are NOT secrets (they are public
 * product identifiers), but they are wired through the server's /api/config
 * endpoint so a deploy only has to set environment variables — see
 * `.env.example`. Until the plans exist in the Whop dashboard, the
 * placeholder IDs below are used and checkout runs in demo mode (the UI
 * says so honestly instead of failing).
 */

export interface Service {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** What's included — shown as a checklist on the service card. */
  includes: string[];
  /** Starting price shown on the card, in whole dollars. */
  startingAt: number;
  /** Price note, e.g. "per inspection" / "typical 1,500 sq ft home". */
  priceNote: string;
  /** Whop plan id for this service's purchasable variant (env: WHOP_PLAN_*). */
  planId: string;
  /** Icon key — see `src/components/icons.tsx`. */
  icon: "repair" | "replacement" | "inspection" | "gutter";
}

export interface Plan {
  id: string;
  name: string;
  /** What the customer pays, in whole dollars. */
  amount: number;
  kind: "one_time" | "deposit" | "flat_rate";
  blurb: string;
  /** Whop plan id (env var). Placeholder until created in the dashboard. */
  planId: string;
}

export const siteConfig = {
  company: {
    name: "Summit Roofing Co.",
    shortName: "Summit Roofing",
    tagline: "Roofs built to outlast the storm.",
    phone: "(512) 555-0148",
    phoneHref: "tel:+15125550148",
    email: "hello@summitroofing.example",
    address: "1200 Congress Ave, Austin, TX 78701",
    license: "TX Roofing Contractor License #RC-88412",
    yearsInBusiness: 14,
    roofsCompleted: 2800,
    rating: 4.9,
    reviewCount: 412,
  },

  hero: {
    headline: "A roof you never have to think about again.",
    subheadline:
      "Licensed, insured, and local. Free inspections, honest quotes, and work backed by a 10-year workmanship warranty — from a crew that answers the phone.",
    primaryCta: "Get a free estimate",
    secondaryCta: "Book a $149 inspection",
    trustLine: "No-pressure quotes · Same-week appointments · Financing available",
  },

  services: [
    {
      id: "repair",
      name: "Roof Repair",
      shortName: "Repair",
      tagline: "Leaks fixed right, the first time.",
      description:
        "From a single missing shingle to storm damage and flashing failures, our repair crews diagnose the real cause — not just the symptom — and fix it with materials matched to your existing roof.",
      includes: [
        "Leak detection & diagnosis",
        "Shingle, flashing & vent repair",
        "Storm & hail damage repair",
        "Same-week appointments",
      ],
      startingAt: 249,
      priceNote: "typical minor repair",
      planId: "plan_REPLACE_WITH_REPAIR",
      icon: "repair",
    },
    {
      id: "replacement",
      name: "Roof Replacement",
      shortName: "Replacement",
      tagline: "A full new roof, done in days.",
      description:
        "Complete tear-off and replacement with architectural shingles, metal, or tile. One dedicated project manager, a clean job site every night, and a 10-year workmanship warranty on top of the manufacturer's warranty.",
      includes: [
        "Full tear-off & disposal",
        "Architectural shingle, metal or tile",
        "10-year workmanship warranty",
        "Dedicated project manager",
      ],
      startingAt: 8900,
      priceNote: "typical 1,500 sq ft home",
      planId: "plan_REPLACE_WITH_REPLACEMENT",
      icon: "replacement",
    },
    {
      id: "inspection",
      name: "Roof Inspection",
      shortName: "Inspection",
      tagline: "Know exactly where your roof stands.",
      description:
        "A 47-point inspection with photos of everything we find, a plain-English report, and a prioritised repair list. Required before any replacement quote — and free when you book a repair or replacement with us.",
      includes: [
        "47-point inspection checklist",
        "Photo report of every finding",
        "Prioritised repair list",
        "Free with any booked job",
      ],
      startingAt: 149,
      priceNote: "one-time, per visit",
      planId: "plan_REPLACE_WITH_INSPECTION",
      icon: "inspection",
    },
  ] as Service[],

  /** The three real plans the bounty requires, created in the Whop dashboard. */
  plans: {
    inspection: {
      id: "inspection",
      name: "Roof Inspection",
      amount: 149,
      kind: "one_time",
      blurb: "47-point inspection with a photo report. Credited toward any booked job.",
      planId: "plan_REPLACE_WITH_INSPECTION",
    },
    deposit: {
      id: "deposit",
      name: "Project Deposit",
      amount: 500,
      kind: "deposit",
      blurb:
        "Locks your start date and materials. Your card is saved on file so the final balance can be billed when the job is done.",
      planId: "plan_REPLACE_WITH_DEPOSIT",
    },
    gutterCleaning: {
      id: "gutter-cleaning",
      name: "Gutter Cleaning",
      amount: 199,
      kind: "flat_rate",
      blurb: "Full gutter & downspout cleaning for a single-storey home. Flat rate, no surprises.",
      planId: "plan_REPLACE_WITH_GUTTER",
    },
  } as Record<string, Plan>,

  financing: {
    headline: "A new roof shouldn't wait for a savings account.",
    body: "Split your project into monthly payments with financing at checkout — options like Klarna, Splitit and Afterpay appear automatically for approved customers. No hidden fees, no prepayment penalty, and a decision in minutes.",
    points: ["0% APR options for qualified buyers", "Monthly payments from $89/mo", "Decision in minutes, at checkout"],
    note: "Financing is offered by Whop's payment partners at checkout and is subject to approval.",
  },

  serviceArea: {
    headline: "Proudly serving Greater Austin",
    cities: [
      "Austin",
      "Round Rock",
      "Cedar Park",
      "Pflugerville",
      "Georgetown",
      "Leander",
      "Lakeway",
      "Bee Cave",
      "Kyle",
      "Buda",
      "San Marcos",
      "Dripping Springs",
    ],
    note: "Outside the area? Call us — we take on select jobs across Central Texas.",
  },

  reviews: [
    {
      name: "Maria G.",
      location: "Round Rock, TX",
      rating: 5,
      text: "They found the leak two other companies missed, fixed it the same week, and the final bill matched the quote to the dollar.",
    },
    {
      name: "James & Priya T.",
      location: "Cedar Park, TX",
      rating: 5,
      text: "Full roof replacement in three days. The crew cleaned up every night and the project manager sent photos at each step.",
    },
    {
      name: "Dana W.",
      location: "Austin, TX",
      rating: 5,
      text: "The inspection report alone was worth it — photos of everything, plain English, and no pressure to buy anything.",
    },
  ],

  estimateForm: {
    headline: "Get a free estimate",
    body: "Tell us about your roof and we'll call you back within one business day with next steps. No obligation, no spam.",
    services: ["Roof Repair", "Roof Replacement", "Roof Inspection", "Gutter Cleaning", "Not sure yet"],
  },

  footer: {
    note: "Summit Roofing Co. is a fictional company created for this website template. Replace the details in src/config.ts with your own.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
