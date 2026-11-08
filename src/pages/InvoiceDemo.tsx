/**
 * Final-balance invoice page (owner demo panel).
 *
 * The flow the bounty demos, after the job is done:
 *   1. Create a draft invoice for the final balance
 *      (`POST /api/invoices` → native Invoices API, `Api-Version-Date:
 *      2026-10-24+`). A draft charges nothing and emails no one.
 *   2. Either ISSUE it — if a saved `payment_method_id` is on the draft,
 *      Whop charges it off-session at `charge_at` / `due_at` / immediately —
 *      or SEND it, which issues it and emails the customer a pay link for
 *      manual payment.
 *
 * The saved payment method id is prefilled from the card-on-file step on
 * `#/deposit` (sessionStorage). Fulfillment is confirmed from the
 * `payment.succeeded` webhook for the invoice's `pay_` id — never from this
 * page.
 *
 * In demo mode the calls are simulated and nothing is created.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { createFinalBalanceInvoice, issueInvoice, sendInvoice } from "../lib/api.ts";
import { Footer, Header } from "../components/Sections.tsx";
import { siteConfig } from "../config.ts";

const DEFAULT_TOTAL = 8900;
const DEFAULT_DEPOSIT = 500;

export default function InvoiceDemo() {
  const [email, setEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [total, setTotal] = useState(DEFAULT_TOTAL);
  const [depositPaid, setDepositPaid] = useState(DEFAULT_DEPOSIT);
  const [description, setDescription] = useState("Roof replacement — final balance");
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => sessionStorage.getItem("summit_payment_method_id") ?? "",
  );
  const [dueInDays, setDueInDays] = useState(14);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  const [checkoutLink, setCheckoutLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const balance = Math.max(0, total - depositPaid);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createFinalBalanceInvoice({
      email,
      customerName: customerName || undefined,
      amount: balance,
      description,
      paymentMethodId: paymentMethodId || undefined,
      dueInDays,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Invoice creation failed.");
      return;
    }
    setDemo(Boolean(result.demo));
    setInvoiceId(result.data.invoiceId ?? null);
    setInvoiceStatus(result.data.status ?? "draft");
    setCheckoutLink(result.data.checkoutLink ?? null);
  }

  async function handleIssue() {
    if (!invoiceId) return;
    setBusy(true);
    setError(null);
    const result = await issueInvoice(invoiceId);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Issue failed.");
      return;
    }
    setInvoiceStatus(result.data.status ?? "open");
    setCheckoutLink(result.data.checkoutLink ?? null);
  }

  async function handleSend() {
    if (!invoiceId) return;
    setBusy(true);
    setError(null);
    const result = await sendInvoice(invoiceId);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Send failed.");
      return;
    }
    setInvoiceStatus(result.data.status ?? "open");
    setCheckoutLink(result.data.checkoutLink ?? null);
  }

  return (
    <>
      <Header />
      <main className="container page">
        <p className="eyebrow">Owner demo · Job complete</p>
        <h1>Bill the final balance</h1>
        <p className="lede">
          When the job is finished and the customer has walked the roof with you, invoice the remaining balance.
          With a card on file it is charged automatically; without one, the customer gets an email with a pay link.
        </p>

        <form className="invoice-form" onSubmit={handleCreate}>
          <label>
            Customer email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" autoComplete="email" />
          </label>
          <label>
            Customer name (optional)
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Homeowner" autoComplete="name" />
          </label>
          <label>
            Project total ($)
            <input type="number" min={0} step={1} value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </label>
          <label>
            Deposit already paid ($)
            <input type="number" min={0} step={1} value={depositPaid} onChange={(e) => setDepositPaid(Number(e.target.value))} />
          </label>
          <p className="balance-line">
            Final balance to invoice: <strong>${balance.toLocaleString()}</strong>
          </p>
          <label>
            Description
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Saved payment method (optional — from the card-on-file step)
            <input
              type="text"
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              placeholder="payt_…"
            />
          </label>
          <label>
            Due in (days)
            <input type="number" min={0} step={1} value={dueInDays} onChange={(e) => setDueInDays(Number(e.target.value))} />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy || balance <= 0}>
            {busy ? "Working…" : `Create draft invoice — $${balance.toLocaleString()}`}
          </button>
          <p className="fine-print">
            Creating a draft charges nothing and emails no one. Issuing it is the step that charges or emails.
          </p>
        </form>

        {invoiceId && (
          <div className="invoice-result" role="status">
            <h2>Invoice {invoiceId}</h2>
            <p>
              Status: <strong>{invoiceStatus}</strong>
              {demo && " (demo — nothing was created in Whop)"}
            </p>
            {checkoutLink && (
              <p>
                Customer pay link:{" "}
                <a href={checkoutLink} target="_blank" rel="noreferrer">
                  {checkoutLink}
                </a>
              </p>
            )}
            <div className="invoice-actions">
              <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={handleIssue}>
                Issue — auto-charge saved card
              </button>
              <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={handleSend}>
                Send — email pay link for manual payment
              </button>
            </div>
            <p className="fine-print">
              If the automatic charge is declined, the invoice stays open and Whop emails the pay link so the
              customer can pay through checkout instead. Fulfill from the <code>payment.succeeded</code> webhook
              for this invoice&apos;s <code>pay_</code> id.
            </p>
          </div>
        )}

        <p className="fine-print">
          Plans used here: inspection ${siteConfig.plans.inspection.amount} one-time · deposit $
          {siteConfig.plans.deposit.amount} · {siteConfig.plans.gutterCleaning.name} $
          {siteConfig.plans.gutterCleaning.amount} flat. Configure them in the Whop dashboard — see README.
        </p>
      </main>
      <Footer />
    </>
  );
}
