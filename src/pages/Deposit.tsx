/**
 * Deposit & booking page.
 *
 * Two Whop flows, exactly as the bounty describes:
 *
 * 1. PAY THE DEPOSIT — the full Checkout element. The server creates a
 *    checkout configuration for the chosen plan (`POST /api/checkout/session`)
 *    and the page mounts `<Checkout>` with BOTH `<CheckoutElement />` (full
 *    checkout surface: order summary, promo codes, card form) and
 *    `<ExpressCheckoutElement />` (one-press Apple Pay / Google Pay / PayPal),
 *    as in Whop's own React example. The checkout surface renders Whop's
 *    merchant-of-record notice itself. `onComplete` records the result;
 *    fulfillment happens from webhooks, never from this callback.
 *
 * 2. SAVE A CARD ON FILE — a setup-intent flow. `<Payments mode="setup">`
 *    mounts EmailElement + PaymentElement + the REQUIRED `<BrandingElement />`
 *    (payment elements stay in their loading state until it is mounted).
 *    The confirmation token goes to the server, which creates the setup
 *    intent; `handleNextAction` finishes any 3D Secure step. The saved
 *    `payment_method_id` is kept in sessionStorage for the invoice demo
 *    (`#/invoice`).
 *
 * Pixel events: `deposit_started` (+ standard `initiate_checkout`) fires
 * when the checkout section is shown.
 *
 * In demo mode (no Whop credentials) the elements are NOT mounted with fake
 * IDs — the page says so and explains what to configure.
 */

import { useEffect, useState } from "react";
import {
  BrandingElement,
  Checkout,
  CheckoutElement,
  EmailElement,
  ExpressCheckoutElement,
  PaymentElement,
  Payments,
  WhopElements,
  usePayments,
  useWhop,
} from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import { siteConfig } from "../config.ts";
import { createCheckoutSession, createSetupIntent, getPublicConfig } from "../lib/api.ts";
import type { PublicConfig } from "../lib/api.ts";
import { trackDepositStarted } from "../lib/tracking.ts";
import { Footer, Header } from "../components/Sections.tsx";
import { IconCheck } from "../components/icons.tsx";

const whopElements = loadWhop();
const plans = [siteConfig.plans.inspection, siteConfig.plans.deposit, siteConfig.plans.gutterCleaning];

function readReturnParams(): { payment: string | null; status: string | null; saved: string | null } {
  const search = new URLSearchParams(window.location.search);
  // Whop appends ?payment=&status= to the returnUrl — with hash routing
  // those params land after the `#`, so read the fragment too.
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const fragment = new URLSearchParams(hashQuery);
  return {
    payment: search.get("payment") ?? fragment.get("payment"),
    status: search.get("status") ?? fragment.get("status"),
    saved: search.get("saved") ?? fragment.get("saved"),
  };
}

function SaveCardForm({ email }: { email: string }) {
  const payments = usePayments();
  const whop = useWhop();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMethodId, setSavedMethodId] = useState<string | null>(
    () => sessionStorage.getItem("summit_payment_method_id"),
  );

  async function save() {
    if (!payments || !whop) return;
    setBusy(true);
    setError(null);
    try {
      const { confirmationToken } = await payments.createConfirmationToken({});
      const result = await createSetupIntent(confirmationToken, email);
      if (!result.ok || !result.data) {
        setError(result.error ?? "The card couldn't be saved.");
        return;
      }
      const setupIntent = result.data;
      if (setupIntent.status === "succeeded") {
        finish(setupIntent.paymentMethodId);
        return;
      }
      if (setupIntent.status === "canceled") {
        setError("The payment method couldn't be saved. Try a different one.");
        return;
      }
      if (!setupIntent.clientSecret) {
        setError("The save is still processing — check back in a moment.");
        return;
      }
      const next = await whop.payments.handleNextAction({ clientSecret: setupIntent.clientSecret });
      if (next.redirected) return;
      if (next.status === "succeeded") {
        finish(setupIntent.paymentMethodId);
        return;
      }
      setError(next.lastPaymentError?.message ?? "The payment method wasn't saved. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while saving the card.");
    } finally {
      setBusy(false);
    }
  }

  function finish(paymentMethodId?: string | null) {
    if (paymentMethodId) {
      sessionStorage.setItem("summit_payment_method_id", paymentMethodId);
      setSavedMethodId(paymentMethodId);
    }
  }

  if (savedMethodId) {
    return (
      <div className="form-success" role="status">
        <h3>
          <IconCheck className="icon-sm" /> Card saved on file.
        </h3>
        <p>
          Method <code>{savedMethodId}</code> is stored with Whop. The final balance can be billed to it from the{" "}
          <a href="#/invoice">invoice page</a>.
        </p>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            sessionStorage.removeItem("summit_payment_method_id");
            setSavedMethodId(null);
          }}
        >
          Remove saved card
        </button>
      </div>
    );
  }

  return (
    <div className="save-card-form">
      <EmailElement />
      <PaymentElement onChange={(event) => setReady(event.complete)} />
      <BrandingElement />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-secondary" type="button" disabled={!ready || busy} onClick={save}>
        {busy ? "Saving…" : "Save card on file"}
      </button>
      <p className="fine-print">
        Nothing is charged. The card is stored by Whop for the final-balance invoice only.
      </p>
    </div>
  );
}

export default function Deposit() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [planId, setPlanId] = useState(siteConfig.plans.deposit.planId);
  const [checkoutConfigId, setCheckoutConfigId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const returnParams = readReturnParams();

  const selectedPlan = plans.find((p) => p.planId === planId) ?? siteConfig.plans.deposit;

  useEffect(() => {
    getPublicConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    trackDepositStarted(planId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create a fresh checkout configuration whenever the chosen plan changes.
  useEffect(() => {
    if (!config || config.demo) {
      setCheckoutConfigId(null);
      return;
    }
    let cancelled = false;
    setCheckoutConfigId(null);
    setCheckoutError(null);
    createCheckoutSession(planId).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setCheckoutConfigId(result.data.checkoutConfigurationId);
        setCheckoutUrl(result.data.purchaseUrl ?? null);
      } else {
        setCheckoutError(result.error ?? "Checkout couldn't be created.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [config, planId]);

  const returnUrl = `${window.location.origin}/#/deposit`;

  return (
    <>
      <Header />
      <main className="container page">
        <p className="eyebrow">Book &amp; pay</p>
        <h1>Reserve your project</h1>
        <p className="lede">
          Pick a service, pay with card or a wallet, and optionally save your card on file so the final balance can
          be billed when the job is done.
        </p>

        {returnParams.status && (
          <div className={`notice ${returnParams.status === "succeeded" ? "notice-success" : "notice-error"}`} role="status">
            {returnParams.status === "succeeded"
              ? `Payment ${returnParams.payment ?? ""} succeeded. We'll be in touch to confirm your start date.`
              : `Payment ${returnParams.status}. Nothing was charged — you can try again below.`}
          </div>
        )}

        <section className="plan-picker" aria-label="Choose a service">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`plan-card ${plan.id === selectedPlan.id ? "plan-card-active" : ""}`}
              onClick={() => setPlanId(plan.planId)}
              aria-pressed={plan.id === selectedPlan.id}
            >
              <strong>{plan.name}</strong>
              <span className="plan-amount">${plan.amount}</span>
              <span className="plan-blurb">{plan.blurb}</span>
            </button>
          ))}
        </section>

        {config?.demo && (
          <div className="notice notice-demo" role="status">
            <strong>Demo mode.</strong> No Whop account is connected, so live checkout is disabled. Set the
            environment variables in <code>.env</code> (see README) and create the three plans in the Whop
            dashboard — the checkout below will then work for real.
          </div>
        )}

        <section className="checkout-section">
          <h2>
            Pay ${selectedPlan.amount} — {selectedPlan.name}
          </h2>
          <p>
            Checkout is powered entirely by Whop Payment Elements — card, Apple Pay, Google Pay and PayPal, with
            financing options shown automatically for approved customers. No card details ever touch this site.
          </p>
          {checkoutError && (
            <p className="form-error" role="alert">
              {checkoutError}
            </p>
          )}
          {checkoutResult && (
            <p className="form-success" role="status">
              {checkoutResult}
            </p>
          )}
          {!config?.demo && checkoutConfigId && checkoutUrl?.includes("sandbox.whop.com") && (
            <div className="notice" role="status">
              <strong>Test checkout.</strong> This template is connected to Whop in
              test mode, so checkout opens on Whop's secure hosted checkout page
              instead of the embedded element.
              <br />
              <a href={checkoutUrl} target="_blank" rel="noreferrer">
                Continue to secure checkout - {selectedPlan.name} ${selectedPlan.amount}
              </a>
            </div>
          )}
          {!config?.demo && checkoutConfigId && !checkoutUrl?.includes("sandbox.whop.com") && (
            <WhopElements elements={whopElements}>
              <Checkout
                checkoutConfiguration={checkoutConfigId}
                returnUrl={returnUrl}
                metadata={{ source: "summit-roofing-deposit" }}
                onComplete={(payload) => {
                  if (payload.result === "payment") {
                    setCheckoutResult(`Payment ${payload.paymentId} completed. We'll confirm your booking by email.`);
                  } else if (payload.result === "setup") {
                    setCheckoutResult("Payment method saved. You can now be billed for the final balance.");
                  }
                }}
              >
                <CheckoutElement />
                <ExpressCheckoutElement />
              </Checkout>
            </WhopElements>
          )}
          {!config?.demo && !checkoutConfigId && !checkoutError && <p>Loading checkout…</p>}
        </section>

        <section className="checkout-section">
          <h2>Save a card on file (optional)</h2>
          <p>
            Saving a card now lets us bill the final balance automatically when the job is finished — no second
            checkout for you. This uses a Whop setup intent: nothing is charged.
          </p>
          <label className="inline-label">
            Email for the saved card
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          {!config?.demo && config?.accountId ? (
            <WhopElements elements={whopElements}>
              <Payments accountId={config.accountId} mode="setup" currency="usd" returnUrl={returnUrl}>
                <SaveCardForm email={email} />
              </Payments>
            </WhopElements>
          ) : (
            <p className="fine-print">Card saving is available once the Whop account is connected.</p>
          )}
        </section>

        <p className="fine-print">
          Payments are processed by Whop as merchant of record. Fulfillment is confirmed from Whop webhooks, not
          from this page. See the README for the test-checkout steps.
        </p>
      </main>
      <Footer />
    </>
  );
}
