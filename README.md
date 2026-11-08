# Summit Roofing Co. — Whop Websites template

A production-ready website template for a US roofing company, built for
[Whop Websites](https://docs.whop.com/developer/websites/overview) and the
Whop Workforce bounty posted by Bens Whop ("Build a production-ready website
template for a US roofing company using Whop Websites", $17.50).

It demos the full Whop flow end to end: a customer requests an estimate
(creates a **lead**), pays a **$500 project deposit** with their card saved
on file (setup intent), and the final balance is billed later through the
**Invoices API** — auto-charged to the saved card, or emailed for manual
payment. Checkout uses **Whop Payment Elements only** — no custom card
forms, no Stripe/PayPal code.

**Fictional company:** "Summit Roofing Co." (Austin, TX) is invented for
this template. Rebrand it by editing **one file only**: `src/config.ts`
(company name, services, prices, plans, service area, financing, reviews).

## What is verified vs assumed

Verified in this repo (8 Nov 2026, against docs.whop.com + the installed
`@whop/elements@1.9.0` / `@whop/elements-react@1.9.0` / `@whop/cli@0.34.1`
type definitions):

- `npm run build` passes (`tsc -b` + Vite client build + esbuild server
  bundle). The `@whop/cli/vite` plugin packs the deploy archive
  `dist/whop-build.zip` — manifest shows `entry: index.js`,
  `server: [index.js, package.json]`, client files included.
- The server boots and serves the site + API in demo mode (smoke-tested:
  `/api/health`, `/api/config`, leads, checkout session, setup intent,
  invoice create/issue all return the documented demo shapes; SPA fallback
  returns 200 for `/#/deposit` and `/#/invoice`; bad input returns 400).
- Element usage matches the installed type definitions and the docs:
  `Checkout` + `CheckoutElement` + `ExpressCheckoutElement` (as in Whop's
  own React example), `Payments mode="setup"` + `EmailElement` +
  `PaymentElement` + required `BrandingElement`, `createConfirmationToken`,
  `handleNextAction`, checkout configurations via
  `POST /checkout_configurations`, setup intents via `POST /setup_intents`,
  payments via `POST /payments`, native invoices via `POST /invoices` with
  `Api-Version-Date: 2026-10-24` or later, issue/send, `Idempotency-Key` on
  every POST, and `window.whop.track` custom events (pixel is auto-injected
  on whop.site sites — no snippet to paste).
- Client bundle contains the three custom pixel events
  (`service_viewed`, `estimate_requested`, `deposit_started`).

NOT verified here — needs the deployment step with a real Whop account:

- A live deploy (`whop apps deploy`), a real test checkout, and the pixel
  events landing in the dashboard (they appear ~1 minute after a visit).
- The legacy Leads endpoint path (`POST /leads` on the v1 base) and the
  invoice inline-plan shape without a product (custom fee) — both are the
  documented shapes, but confirm against the live API response at deploy
  time; the server logs Whop's exact error if either is refused.
- `whop apps init` behaviour (it registers the app and writes
  `whop.app.json`; this repo deliberately ships without it — see below).

## Stack

- **Client:** Vite 8 + React 19 + TypeScript (strict), plain CSS (no CSS
  framework, no external assets, original inline SVG icons).
- **Server:** Express 5 bundled with esbuild into a single self-contained
  `dist/server/index.js` (CJS — Express's dependency tree uses dynamic
  `require()` that esbuild's ESM output cannot represent; a local
  `dist/server/package.json` pins `{"type":"commonjs"}` because the project
  root is `"type": "module"`).
- **Whop:** `@whop/elements` + `@whop/elements-react` 1.9.0 for checkout
  and payment elements; raw `fetch` against the Current API from the server
  (no SDK version drift); `@whop/cli` 0.34.1 Vite plugin for the deploy
  archive.

## File layout

```
src/
  config.ts                 # THE config — rebrand everything from here
  App.tsx                   # hash router: #/  #/deposit  #/invoice
  main.tsx                  # entry
  index.css                 # whole design system (mobile-first)
  components/
    Sections.tsx            # header, hero, services, how-it-works, financing,
                            # service area, reviews, estimate form, footer
    icons.tsx               # original inline SVG icons
  lib/
    tracking.ts             # whop.track wrapper + the 3 custom events
    api.ts                  # client helpers for /api/*
  pages/
    Home.tsx                # landing page
    Deposit.tsx             # deposit checkout + save card on file
    InvoiceDemo.tsx         # owner panel: bill the final balance
  server/
    index.ts                # Express: static client + /api/* routes, demo mode
    whop.ts                 # Whop API client (checkout configs, setup
                            # intents, payments, leads, invoices)
scripts/build-server.mjs    # esbuild: server -> dist/server/index.js
vite.config.ts              # react() + whop() plugins; outDir dist/client
.env.example                # every env var, no real values
```

Build layout (what Whop requires): static assets in `dist/client`, server
bundle in `dist/server`. `npm run build` runs `tsc -b`, then the server
bundle, then Vite — **in that order**, because the `whop()` plugin packs
whatever is in `dist/` at Vite build time into `dist/whop-build.zip`.

## The three plans (create in the Whop dashboard)

| Plan | Amount | Kind | Env var |
| --- | --- | --- | --- |
| Roof Inspection | $149 | one-time | `WHOP_PLAN_INSPECTION_ID` |
| Project Deposit | $500 | deposit (one-time) | `WHOP_PLAN_DEPOSIT_ID` |
| Gutter Cleaning | $199 | flat rate (one-time) | `WHOP_PLAN_GUTTER_ID` |

Service cards also reference repair/replacement plans
(`WHOP_PLAN_REPAIR_ID`, `WHOP_PLAN_REPLACEMENT_ID`) for tracking; the
inspection plan doubles as the purchasable inspection variant. All five are
`plan_…` ids. Create them under one product if you want a single
`WHOP_PRODUCT_ID` (used for the final-balance invoice item; without it the
item is a custom fee — verify at deploy time).

The API key needs these permissions: `checkout_configuration:create`,
`plan:create`, `access_pass:create`, `access_pass:update`, `lead:manage`,
`member:email:read`, `member:basic:read`, `access_pass:basic:read`,
`invoice:create`, `payment:charge`.

## Deploy

```bash
# 1. Install the CLI (once)
curl -fsSL https://whop.com/install.sh | sh

# 2. From this directory, register the website (signs you in, creates
#    whop.app.json, links this folder to the app). This is the step that
#    needs the user's Whop account — it is NOT done in this repo.
whop apps init --app_type website --name "Summit Roofing Co." --domain summit-roofing-co

# 3. Configure env (copy .env.example -> .env) and the plans above.
#    Test with SANDBOX keys first: sandbox.whop.com/dashboard/developer,
#    WHOP_API_BASE=https://sandbox-api.whop.com/api/v1

# 4. Build, then deploy (or: npm run build && whop apps deploy)
npm run build
whop apps deploy

# Preview a build without promoting it:
whop apps deploy --preview
whop apps builds promote apbu_xxxxxxxx
```

The live site lands at `https://summit-roofing-co.whop.site` (Whop serves
sites at `.whop.site`; the bounty text says `.whop.app`, which is the older
name for the same hosting).

**Note:** the CLI has no sandbox/dry-run mode — it acts on production.
Use sandbox API keys for the test checkout, and only switch to production
keys at launch.

## Verify the required pieces (bounty checklist)

After deploy, walk through this on the live site:

1. **Estimate → lead.** Submit the form at `#estimate`. Check the Whop
   dashboard → Leads: a lead appears with the form metadata. Pixel:
   `estimate_requested` + standard `lead` fire (Websites / pixel dashboard,
   ~1 minute later).
2. **Service views.** Scroll the services section. Pixel: `service_viewed`
   (once per service) + standard `view_content`.
3. **Deposit checkout.** Open `#/deposit`, pick the $500 deposit. The
   Checkout element shows the order summary, promo code field and card form;
   the express row shows Apple Pay / Google Pay buttons. Complete a **test
   checkout with a sandbox card**. Pixel: `deposit_started` +
   `initiate_checkout` fire when the checkout opens.
4. **BrandingElement.** On `#/deposit`, the "Save a card on file" form
   mounts EmailElement + PaymentElement + **BrandingElement** (Whop's
   merchant-of-record notice). The payment elements stay in their loading
   state until it is mounted — if the form never becomes usable, the
   branding element is the first thing to check. Saving a card creates a
   setup intent; `setup_intent.succeeded` confirms the save and the page
   stores the `payment_method_id` for the invoice step.
5. **Final-balance invoice.** Open `#/invoice`, enter the customer email
   and the balance (project total minus the $500 deposit), and create the
   draft. **Issue** it to auto-charge the saved card off-session, or
   **Send** it to email the pay link for manual payment. Fulfill from the
   `payment.succeeded` webhook for the invoice's `pay_` id.
6. **Pixel verification.** Dashboard → Websites (visitors, page views,
   attributed revenue per domain) and the pixel dashboard (full event
   breakdown). All three custom events — `estimate_requested`,
   `service_viewed`, `deposit_started` — must appear by name.

## Demo mode (no credentials)

Without `WHOP_API_KEY` / `WHOP_ACCOUNT_ID` the server runs in demo mode:
every API route returns a demo payload (`{ demo: true, ... }`), the pages
show a "Demo mode" notice, and the Whop elements are not mounted with fake
IDs. Nothing is charged and no lead/invoice is created. Run it locally:

```bash
npm install
npm run build
npm start            # serves :3000 — open http://localhost:3000
```

For client-only dev with live reload: `npm run dev:server` in one terminal
(builds + runs the server on :3000) and `npm run dev` in another (Vite
proxies `/api` to :3000).

## What the deployment step still has to do (needs the user's account)

- Sign in with the Whop CLI and run `whop apps init` (registers the app,
  writes `whop.app.json`) — cannot be done without the account.
- Create the product + the three plans in the dashboard and set the
  `WHOP_PLAN_*` env vars (and `WHOP_API_KEY` / `WHOP_ACCOUNT_ID`).
- Deploy (`whop apps deploy`) and run the verification walkthrough above
  with a sandbox test checkout; confirm the three pixel events in the
  dashboard.
- Record the 3–5 minute screen recording for the bounty submission: live
  site, completed test checkout with Payment Elements, estimate form
  creating a lead, invoice created for a final balance, pixel events firing
  — plus the live `.whop.site` URL, source code (this repo), and one
  paragraph listing the Whop features implemented.
- Submit the bounty on Whop Workforce (the submission itself is a manual
  dashboard step — nothing in this repo submits anything).

## Notes for the reviewer (bounty submission paragraph)

Whop features implemented: Whop Websites hosting via the Whop CLI
(`whop apps deploy`, `.whop.site`); Checkout element with a server-created
checkout configuration for the $500 deposit plan; Express Checkout element
(Apple Pay / Google Pay / PayPal); Payment Elements with the required
BrandingElement; card-on-file via a setup intent (`mode: "setup"`,
`setup_intent.succeeded`); Leads API for the estimate form; native
Invoices API for the final balance (draft → issue auto-charges the saved
card, or send emails a pay link); Whop Pixel custom events
(`estimate_requested`, `service_viewed`, `deposit_started`) with standard
events alongside; financing options surface automatically at checkout for
approved customers (Klarna, Splitit, Afterpay, etc.). All code is original;
company, services and prices are driven by a single config file so the
template is reusable without structural changes.
