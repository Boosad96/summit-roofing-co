/**
 * Summit Roofing Co. — server entry.
 *
 * Serves the built client from `dist/client` and the JSON API the client
 * calls. Every Whop call happens here, with the API key from the
 * environment — the key never reaches the browser.
 *
 * Demo mode: when WHOP_API_KEY / WHOP_ACCOUNT_ID are unset, the API routes
 * return honest demo payloads (`{ demo: true, ... }`) so the site renders
 * and the flows can be walked through without credentials. Nothing is
 * charged and no lead/invoice is created in demo mode.
 *
 * Build: `node scripts/build-server.mjs` bundles this file (and Express)
 * into `dist/server/index.js`. Run: `node dist/server/index.js`.
 */

import express from "express";
import path from "node:path";
import {
  createCheckoutConfiguration,
  createInvoice,
  createLead,
  createPayment,
  createSetupIntent,
  getWhopEnv,
  isConfigured,
  issueInvoice,
  sendInvoice,
} from "./whop.ts";

// The server is bundled to CommonJS (see scripts/build-server.mjs), where
// Node provides `__dirname`. The source is ESM, so declare it for the
// typechecker; at runtime the bundle's real `__dirname` is used.
declare const __dirname: string;
const CLIENT_DIR = path.resolve(__dirname, "../client");
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

const env = getWhopEnv();
const demo = !isConfigured(env);

if (demo) {
  console.warn(
    "[summit-roofing] WHOP_API_KEY / WHOP_ACCOUNT_ID not set — running in DEMO mode. " +
      "API routes return demo payloads; nothing is charged. See README.md.",
  );
}

const demoId = (prefix: string) => `${prefix}_demo_${Date.now().toString(36)}`;

/** Public config: plan ids + account id are public identifiers, safe to expose. */
app.get("/api/config", (_req, res) => {
  res.json({
    accountId: env.accountId,
    plans: {
      inspection: process.env.WHOP_PLAN_INSPECTION_ID ?? "plan_REPLACE_WITH_INSPECTION",
      deposit: process.env.WHOP_PLAN_DEPOSIT_ID ?? "plan_REPLACE_WITH_DEPOSIT",
      gutter: process.env.WHOP_PLAN_GUTTER_ID ?? "plan_REPLACE_WITH_GUTTER",
      repair: process.env.WHOP_PLAN_REPAIR_ID ?? "plan_REPLACE_WITH_REPAIR",
      replacement: process.env.WHOP_PLAN_REPLACEMENT_ID ?? "plan_REPLACE_WITH_REPLACEMENT",
    },
    demo,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, demo, apiBase: env.apiBase, apiVersion: env.apiVersion });
});

/** Estimate form → Whop lead (Legacy API). */
app.post("/api/leads", async (req, res) => {
  const { name, email, phone, service, message, address } = req.body as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string" || typeof service !== "string") {
    res.status(400).json({ ok: false, error: "name, email and service are required." });
    return;
  }
  if (demo) {
    res.json({ ok: true, demo: true, data: { leadId: demoId("lead") } });
    return;
  }
  try {
    const lead = await createLead(env, {
      metadata: {
        name,
        email,
        phone: typeof phone === "string" ? phone : "",
        service,
        message: typeof message === "string" ? message : "",
        address: typeof address === "string" ? address : "",
        source: "summit-roofing-estimate-form",
      },
    });
    res.json({ ok: true, data: { leadId: lead.id } });
  } catch (err) {
    console.error("[summit-roofing] createLead failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Lead creation failed." });
  }
});

/** Create a checkout configuration for a plan (Checkout element). */
app.post("/api/checkout/session", async (req, res) => {
  const { planId, mode } = req.body as Record<string, unknown>;
  if (typeof planId !== "string" || !planId.startsWith("plan_")) {
    res.status(400).json({ ok: false, error: "A valid plan_id (plan_…) is required." });
    return;
  }
  if (demo) {
    res.json({
      ok: true,
      demo: true,
      data: { checkoutConfigurationId: demoId("ch"), purchaseUrl: null },
    });
    return;
  }
  try {
    const cfg = await createCheckoutConfiguration(env, {
      planId,
      mode: mode === "setup" ? "setup" : "payment",
      metadata: { source: "summit-roofing-deposit" },
    });
    res.json({
      ok: true,
      data: { checkoutConfigurationId: cfg.id, purchaseUrl: cfg.purchaseUrl },
    });
  } catch (err) {
    console.error("[summit-roofing] createCheckoutConfiguration failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Checkout creation failed." });
  }
});

/** Save a card on file — setup intent from a browser confirmation token. */
app.post("/api/save-payment-method", async (req, res) => {
  const { confirmationToken, email } = req.body as Record<string, unknown>;
  if (typeof confirmationToken !== "string") {
    res.status(400).json({ ok: false, error: "confirmationToken is required." });
    return;
  }
  if (demo) {
    res.json({
      ok: true,
      demo: true,
      data: { setupIntentId: demoId("seti"), status: "succeeded", clientSecret: null, paymentMethodId: "payt_demo_card" },
    });
    return;
  }
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    const setupIntent = await createSetupIntent(env, {
      confirmationToken,
      currency: "usd",
      returnUrl: `${origin}/#/deposit?saved=1`,
      metadata: { email: typeof email === "string" ? email : "", source: "summit-roofing-card-on-file" },
    });
    res.json({ ok: true, data: setupIntent });
  } catch (err) {
    console.error("[summit-roofing] createSetupIntent failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Setup intent failed." });
  }
});

/** Charge a plan from a browser confirmation token (payment-elements flow). */
app.post("/api/pay", async (req, res) => {
  const { confirmationToken, planId } = req.body as Record<string, unknown>;
  if (typeof confirmationToken !== "string" || typeof planId !== "string") {
    res.status(400).json({ ok: false, error: "confirmationToken and planId are required." });
    return;
  }
  if (demo) {
    res.json({ ok: true, demo: true, data: { id: demoId("pay"), status: "succeeded", clientSecret: null } });
    return;
  }
  try {
    const payment = await createPayment(env, {
      confirmationToken,
      planId,
      metadata: { source: "summit-roofing-deposit" },
    });
    res.json({ ok: true, data: payment });
  } catch (err) {
    console.error("[summit-roofing] createPayment failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Payment failed." });
  }
});

/** Create a final-balance invoice draft. */
app.post("/api/invoices", async (req, res) => {
  const { email, customerName, amount, description, paymentMethodId, dueInDays } = req.body as Record<string, unknown>;
  if (typeof email !== "string" || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ ok: false, error: "A valid email and a positive amount are required." });
    return;
  }
  if (demo) {
    res.json({
      ok: true,
      demo: true,
      data: { invoiceId: demoId("pay"), checkoutLink: null, status: "draft" },
    });
    return;
  }
  try {
    const invoice = await createInvoice(env, {
      email,
      customerName: typeof customerName === "string" ? customerName : undefined,
      amount,
      description: typeof description === "string" ? description : "Final balance",
      paymentMethodId: typeof paymentMethodId === "string" ? paymentMethodId : undefined,
      dueInDays: typeof dueInDays === "number" ? dueInDays : undefined,
      productId: process.env.WHOP_PRODUCT_ID ?? undefined,
    });
    res.json({ ok: true, data: invoice });
  } catch (err) {
    console.error("[summit-roofing] createInvoice failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Invoice creation failed." });
  }
});

/** Issue a draft invoice — charges a saved payment method, if one is set. */
app.post("/api/invoices/:id/issue", async (req, res) => {
  if (demo) {
    res.json({ ok: true, demo: true, data: { invoiceId: req.params.id, checkoutLink: null, status: "open" } });
    return;
  }
  try {
    const invoice = await issueInvoice(env, req.params.id);
    res.json({ ok: true, data: invoice });
  } catch (err) {
    console.error("[summit-roofing] issueInvoice failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Issue failed." });
  }
});

/** Send an invoice — issues it and emails it to the customer. */
app.post("/api/invoices/:id/send", async (req, res) => {
  if (demo) {
    res.json({ ok: true, demo: true, data: { invoiceId: req.params.id, checkoutLink: null, status: "open" } });
    return;
  }
  try {
    const invoice = await sendInvoice(env, req.params.id);
    res.json({ ok: true, data: invoice });
  } catch (err) {
    console.error("[summit-roofing] sendInvoice failed:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Send failed." });
  }
});

/** Static client + SPA fallback (hash routing, so any path serves index.html). */
app.use(express.static(CLIENT_DIR, { index: "index.html" }));
app.use((req, res, next) => {
  if (req.method === "GET" && req.accepts("html")) {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
    return;
  }
  next();
});

app.listen(PORT, () => {
  console.log(`[summit-roofing] listening on :${PORT} (demo=${demo})`);
});
