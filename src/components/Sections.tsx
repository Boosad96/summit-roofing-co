/**
 * Landing-page sections for Summit Roofing Co.
 * All copy and prices come from `src/config.ts` — nothing is hardcoded here
 * except layout and the demo flow labels.
 */

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { siteConfig } from "../config.ts";
import type { Service } from "../config.ts";
import { submitLead } from "../lib/api.ts";
import { trackEstimateRequested, trackServiceViewed } from "../lib/tracking.ts";
import {
  IconCheck,
  IconGutter,
  IconInspection,
  IconPhone,
  IconRepair,
  IconReplacement,
  IconShield,
  IconStar,
} from "./icons.tsx";

const { company, hero, services, financing, serviceArea, reviews, estimateForm } = siteConfig;

function ServiceIcon({ icon, className }: { icon: Service["icon"]; className?: string }) {
  switch (icon) {
    case "repair":
      return <IconRepair className={className} />;
    case "replacement":
      return <IconReplacement className={className} />;
    case "inspection":
      return <IconInspection className={className} />;
    case "gutter":
      return <IconGutter className={className} />;
  }
}

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <IconReplacement className="brand-icon" />
          </span>
          <span className="brand-text">
            <strong>{company.name}</strong>
            <small>{company.tagline}</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
          <a href="#financing">Financing</a>
          <a href="#reviews">Reviews</a>
        </nav>
        <a className="header-phone" href={company.phoneHref}>
          <IconPhone className="icon-sm" /> {company.phone}
        </a>
        <a className="btn btn-primary btn-sm" href="#estimate">
          Free estimate
        </a>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">
            <IconShield className="icon-sm" /> Licensed &amp; insured · {company.yearsInBusiness} years in business
          </p>
          <h1>{hero.headline}</h1>
          <p className="lede">{hero.subheadline}</p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#estimate">
              {hero.primaryCta}
            </a>
            <a className="btn btn-secondary" href="#/deposit">
              {hero.secondaryCta}
            </a>
          </div>
          <p className="trust-line">{hero.trustLine}</p>
        </div>
        <div className="hero-card" aria-label="Company snapshot">
          <div className="hero-stat">
            <strong>{company.roofsCompleted.toLocaleString()}+</strong>
            <span>roofs completed</span>
          </div>
          <div className="hero-stat">
            <strong>
              {company.rating} <IconStar className="icon-sm star" />
            </strong>
            <span>from {company.reviewCount} reviews</span>
          </div>
          <div className="hero-stat">
            <strong>10-year</strong>
            <span>workmanship warranty</span>
          </div>
          <p className="hero-card-note">
            Free inspection with every booked job. Final balance billed only when the work is done — see how it
            works below.
          </p>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  service,
  onEstimate,
}: {
  service: Service;
  onEstimate: (serviceName: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !tracked.current) {
          tracked.current = true;
          trackServiceViewed(service.id, service.planId);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [service.id, service.planId]);

  return (
    <article className="service-card" ref={ref}>
      <div className="service-icon">
        <ServiceIcon icon={service.icon} className="icon-lg" />
      </div>
      <h3>{service.name}</h3>
      <p className="service-tagline">{service.tagline}</p>
      <p>{service.description}</p>
      <ul className="checklist">
        {service.includes.map((item) => (
          <li key={item}>
            <IconCheck className="icon-sm" /> {item}
          </li>
        ))}
      </ul>
      <p className="service-price">
        From <strong>${service.startingAt.toLocaleString()}</strong> <span>{service.priceNote}</span>
      </p>
      <div className="service-actions">
        <button className="btn btn-primary btn-sm" type="button" onClick={() => onEstimate(service.name)}>
          Get an estimate
        </button>
        <a className="btn btn-ghost btn-sm" href="#/deposit">
          Book now
        </a>
      </div>
    </article>
  );
}

export function Services({ onEstimate }: { onEstimate: (serviceName: string) => void }) {
  return (
    <section className="section" id="services">
      <div className="container">
        <h2>Roofing services</h2>
        <p className="section-intro">
          Three services, one standard: an honest diagnosis, a written quote, and work we guarantee.
        </p>
        <div className="services-grid">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} onEstimate={onEstimate} />
          ))}
        </div>
        <div className="flat-rate-callout">
          <div>
            <strong>Gutter cleaning — ${siteConfig.plans.gutterCleaning.amount} flat.</strong>{" "}
            {siteConfig.plans.gutterCleaning.blurb}
          </div>
          <a className="btn btn-secondary btn-sm" href="#/deposit">
            Book gutter cleaning
          </a>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Request an estimate",
      text: "Tell us about your roof. We call back within one business day and book a free inspection — the request lands as a lead in our system, so nothing gets lost.",
    },
    {
      n: "2",
      title: "Pay the $500 deposit",
      text: "Accept the quote and reserve your start date with a $500 deposit. Your card is saved securely on file at checkout, so the final balance can be billed when the job is done.",
    },
    {
      n: "3",
      title: "We build, then bill the balance",
      text: "One crew, one project manager, a clean site every night. When the work is finished and you've walked the roof with us, we invoice the final balance — auto-charged to your card on file, or sent for manual payment.",
    },
  ];
  return (
    <section className="section section-alt" id="how-it-works">
      <div className="container">
        <h2>How it works</h2>
        <p className="section-intro">Estimate to final invoice — no surprises, no chasing payments.</p>
        <ol className="steps">
          {steps.map((step) => (
            <li key={step.n} className="step">
              <span className="step-number">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Financing() {
  return (
    <section className="section" id="financing">
      <div className="container financing">
        <div>
          <h2>{financing.headline}</h2>
          <p>{financing.body}</p>
          <ul className="checklist">
            {financing.points.map((point) => (
              <li key={point}>
                <IconCheck className="icon-sm" /> {point}
              </li>
            ))}
          </ul>
          <p className="fine-print">{financing.note}</p>
        </div>
        <div className="financing-card">
          <p className="eyebrow">Example</p>
          <p className="financing-example">
            <strong>$8,900</strong> replacement
          </p>
          <p>
            $500 deposit today
            <br />
            Balance from <strong>$89/mo</strong> with approved financing
          </p>
          <a className="btn btn-primary" href="#estimate">
            Check my options
          </a>
        </div>
      </div>
    </section>
  );
}

export function ServiceArea() {
  return (
    <section className="section section-alt" id="service-area">
      <div className="container">
        <h2>{serviceArea.headline}</h2>
        <ul className="city-list">
          {serviceArea.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
        <p className="section-intro">{serviceArea.note}</p>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section className="section" id="reviews">
      <div className="container">
        <h2>
          {company.rating} stars from {company.reviewCount} homeowners
        </h2>
        <div className="reviews-grid">
          {reviews.map((review) => (
            <blockquote key={review.name} className="review">
              <p className="stars" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: review.rating }).map((_, i) => (
                  <IconStar key={i} className="icon-sm star" />
                ))}
              </p>
              <p>“{review.text}”</p>
              <footer>
                {review.name} · {review.location}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EstimateForm({
  selectedService,
  onServiceChange,
}: {
  selectedService: string;
  onServiceChange: (service: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      service: selectedService,
      address: String(form.get("address") ?? ""),
      message: String(form.get("message") ?? ""),
    };
    const result = await submitLead(payload);
    if (result.ok) {
      setStatus("done");
      setDemo(Boolean(result.demo));
      setLeadId(typeof result.data?.leadId === "string" ? result.data.leadId : null);
      trackEstimateRequested(selectedService);
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong. Please call us instead.");
    }
  }

  return (
    <section className="section section-alt" id="estimate">
      <div className="container estimate">
        <div>
          <h2>{estimateForm.headline}</h2>
          <p>{estimateForm.body}</p>
          <p className="contact-line">
            Prefer to talk? Call <a href={company.phoneHref}>{company.phone}</a> or email{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a>.
          </p>
          <p className="contact-line">{company.address}</p>
          <p className="contact-line">{company.license}</p>
        </div>
        {status === "done" ? (
          <div className="form-success" role="status">
            <h3>Thanks — request received.</h3>
            <p>
              We&apos;ll call you back within one business day. Your request was recorded
              {leadId ? ` (reference ${leadId})` : ""}.
            </p>
            {demo && (
              <p className="demo-note">
                Demo mode: no lead was created in Whop — connect the account to record real leads.
              </p>
            )}
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setStatus("idle")}>
              Send another request
            </button>
          </div>
        ) : (
          <form className="estimate-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input name="name" type="text" required autoComplete="name" placeholder="Jane Homeowner" />
            </label>
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" placeholder="jane@example.com" />
            </label>
            <label>
              Phone (optional)
              <input name="phone" type="tel" autoComplete="tel" placeholder="(512) 555-0100" />
            </label>
            <label>
              Service
              <select
                name="service"
                value={selectedService}
                onChange={(e) => onServiceChange(e.target.value)}
              >
                {estimateForm.services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Property address (optional)
              <input name="address" type="text" autoComplete="street-address" placeholder="Street, City, ZIP" />
            </label>
            <label>
              Tell us about your roof (optional)
              <textarea name="message" rows={3} placeholder="Leak over the kitchen, shingles missing after the storm…" />
            </label>
            {status === "error" && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Request my free estimate"}
            </button>
            <p className="fine-print">
              By submitting, you agree to be contacted about your estimate. We never sell your details.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <strong>{company.name}</strong>
          <p>{company.address}</p>
          <p>
            <a href={company.phoneHref}>{company.phone}</a> ·{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a>
          </p>
        </div>
        <div>
          <p>{company.license}</p>
          <p>© {new Date().getFullYear()} {company.name}</p>
        </div>
      </div>
      <p className="container fine-print footer-note">{siteConfig.footer.note}</p>
    </footer>
  );
}
