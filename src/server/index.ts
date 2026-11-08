/**
 * Summit Roofing Co. — server entry (Cloudflare Worker).
 *
 * Serves the JSON API the client calls. Every Whop call happens here, with
 * the API key from the environment — the key never reaches the browser.
 *
 * Whop Websites hosting runs on Cloudflare Workers, so the entry point is
 * the `fetch` handler exported below (`export default { fetch }`), not a
 * Node process listening on a port. Static files and the SPA fallback are
 * served by the Workers assets binding (see `wrangler.jsonc`), not by this
 * handler.
 *
 * Local development: the same handler runs under Node with
 * `npm run dev:server` (or `npm start`), which starts a small adapter on
 * :3000 that forwards requests to the `fetch` handler and serves the built
 * client from `dist/client`.
 *
 * Demo mode: when WHOP_API_KEY / WHOP_ACCOUNT_ID are unset, the API routes
 * return honest demo payloads (`{ demo: true, … }`) so the site renders
 * and the flows can be walked through without credentials. Nothing is
 * charged and no lead/invoice is created in demo mode.
 *
 * Build: `node scripts/build-server.mjs` bundles this file into
 * `dist/server/index.js` (an ES module — the Worker's entry point).
 */
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
  type WhopEnv,
} from "./whop.ts";

/** Environment bindings: the Worker's `env` object, or `process.env` under Node. */
type Bindings = Record<string, unknown>;

const demoId = (prefix: string) => `${prefix}_demo_${Date.now().toString(36)}`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** One request's server context: the Whop config plus the ids the client needs. */
interface Context {
  whop: WhopEnv;
  demo: boolean;
  planId: (name: string) => string;
  productId: string | undefined;
  leadUserId: string | undefined;
}

function context(bindings: Bindings): Context {
  const whop = getWhopEnv(bindings);
  const value = (name: string): string | undefined => {
    const v = bindings[name] ?? process.env[name];
    return typeof v === "string" ? v : undefined;
  };
  return {
    whop,
    demo: !isConfigured(whop),
    planId: (name: string) =>
      value(`WHOP_PLAN_${name}_ID`) ?? `plan_REPLACE_WITH_${name}`,
    productId: value("WHOP_PRODUCT_ID"),
    leadUserId: value("WHOP_LEAD_USER_ID"),
  };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function badRequest(message: string): Response {
  return json({ ok: false, error: message }, 400);
}

function failed(err: unknown, action: string, fallback: string): Response {
  console.error(`[summit-roofing] ${action}`, err);
  return json(
    { ok: false, error: err instanceof Error ? err.message : fallback },
    502,
  );
}

async function handleRequest(
  request: Request,
  bindings: Bindings,
): Promise<Response> {
  const url = new URL(request.url);
  const ctx = context(bindings);
  const { pathname } = url;

  /** Public config: plan ids + account id are public identifiers, safe to expose. */
  if (request.method === "GET" && pathname === "/api/config") {
    return json({
      accountId: ctx.whop.accountId,
      plans: {
        inspection: ctx.planId("INSPECTION"),
        deposit: ctx.planId("DEPOSIT"),
        gutter: ctx.planId("GUTTER"),
        repair: ctx.planId("REPAIR"),
        replacement: ctx.planId("REPLACEMENT"),
      },
      demo: ctx.demo,
    });
  }

  if (request.method === "GET" && pathname === "/api/health") {
    return json({
      ok: true,
      demo: ctx.demo,
      apiBase: ctx.whop.apiBase,
      apiVersion: ctx.whop.apiVersion,
    });
  }

  /** Estimate form → Whop lead (Legacy API). */
  if (request.method === "POST" && pathname === "/api/leads") {
    const { name, email, phone, service, message, address, userId } =
      await readBody(request);
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof service !== "string"
    ) {
      return badRequest("name, email and service are required.");
    }
    if (ctx.demo) {
      return json({ ok: true, demo: true, data: { leadId: demoId("lead") } });
    }
    // The Whop Leads API needs a real Whop user id for the lead. Prefer the
    // signed-in visitor's id; otherwise fall back to the configured lead
    // user (WHOP_LEAD_USER_ID) so an anonymous estimate is still recorded,
    // with the visitor's details in the lead metadata.
    const leadUserId =
      typeof userId === "string" && userId ? userId : ctx.leadUserId;
    if (!leadUserId) {
      return badRequest(
        "Sign in with Whop first so this estimate can be recorded as a lead — the Whop Leads API needs the visitor's Whop user ID.",
      );
    }
    try {
      const lead = await createLead(ctx.whop, {
        userId: leadUserId,
        productId: ctx.productId,
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
      return json({ ok: true, data: { leadId: lead.id } });
    } catch (err) {
      return failed(err, "createLead failed:", "Lead creation failed.");
    }
  }

  /** Create a checkout configuration for a plan (Checkout element). */
  if (request.method === "POST" && pathname === "/api/checkout/session") {
    const { planId, mode } = await readBody(request);
    if (typeof planId !== "string" || !planId.startsWith("plan_")) {
      return badRequest("A valid plan_id (plan_…) is required.");
    }
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: { checkoutConfigurationId: demoId("ch"), purchaseUrl: null },
      });
    }
    try {
      const cfg = await createCheckoutConfiguration(ctx.whop, {
        planId,
        mode: mode === "setup" ? "setup" : "payment",
        metadata: { source: "summit-roofing-deposit" },
      });
      return json({
        ok: true,
        data: { checkoutConfigurationId: cfg.id, purchaseUrl: cfg.purchaseUrl },
      });
    } catch (err) {
      return failed(
        err,
        "createCheckoutConfiguration failed:",
        "Checkout creation failed.",
      );
    }
  }

  /** Save a card on file — setup intent from a browser confirmation token. */
  if (request.method === "POST" && pathname === "/api/save-payment-method") {
    const { confirmationToken, email } = await readBody(request);
    if (typeof confirmationToken !== "string") {
      return badRequest("confirmationToken is required.");
    }
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: {
          setupIntentId: demoId("seti"),
          status: "succeeded",
          clientSecret: null,
          paymentMethodId: "payt_demo_card",
        },
      });
    }
    try {
      const setupIntent = await createSetupIntent(ctx.whop, {
        confirmationToken,
        currency: "usd",
        returnUrl: `${url.origin}/#/deposit?saved=1`,
        metadata: {
          email: typeof email === "string" ? email : "",
          source: "summit-roofing-card-on-file",
        },
      });
      return json({ ok: true, data: setupIntent });
    } catch (err) {
      return failed(
        err,
        "createSetupIntent failed:",
        "createSetupIntent failed.",
      );
    }
  }

  /** Charge a plan from a browser confirmation token (payment-elements flow). */
  if (request.method === "POST" && pathname === "/api/pay") {
    const { confirmationToken, planId } = await readBody(request);
    if (typeof confirmationToken !== "string" || typeof planId !== "string") {
      return badRequest("confirmationToken and planId are required.");
    }
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: { id: demoId("pay"), status: "succeeded", clientSecret: null },
      });
    }
    try {
      const payment = await createPayment(ctx.whop, {
        confirmationToken,
        planId,
        metadata: { source: "summit-roofing-deposit" },
      });
      return json({ ok: true, data: payment });
    } catch (err) {
      return failed(err, "createPayment failed:", "Payment failed.");
    }
  }

  /** Create a draft invoice for a final balance (charges nothing, emails no one). */
  if (request.method === "POST" && pathname === "/api/invoices") {
    const {
      email,
      customerName,
      amount,
      description,
      paymentMethodId,
      dueInDays,
    } = await readBody(request);
    if (
      typeof email !== "string" ||
      typeof amount !== "number" ||
      amount <= 0
    ) {
      return badRequest("A valid email and a positive amount are required.");
    }
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: { invoiceId: demoId("pay"), checkoutLink: null, status: "draft" },
      });
    }
    try {
      const invoice = await createInvoice(ctx.whop, {
        email,
        customerName:
          typeof customerName === "string" ? customerName : undefined,
        amount,
        description:
          typeof description === "string" ? description : "Final balance",
        paymentMethodId:
          typeof paymentMethodId === "string" ? paymentMethodId : undefined,
        dueInDays: typeof dueInDays === "number" ? dueInDays : undefined,
        productId: ctx.productId,
      });
      return json({ ok: true, data: invoice });
    } catch (err) {
      return failed(err, "createInvoice failed:", "Invoice creation failed.");
    }
  }

  /** Issue an invoice — opens it and charges a saved card off-session. */
  const issue = pathname.match(/^\/api\/invoices\/([^/]+)\/issue$/);
  if (request.method === "POST" && issue) {
    const invoiceId = decodeURIComponent(issue[1]);
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: { invoiceId, checkoutLink: null, status: "open" },
      });
    }
    try {
      const invoice = await issueInvoice(ctx.whop, invoiceId);
      return json({ ok: true, data: invoice });
    } catch (err) {
      return failed(err, "issueInvoice failed:", "Issue failed.");
    }
  }

  /** Send an invoice — issues it and emails it to the customer. */
  const send = pathname.match(/^\/api\/invoices\/([^/]+)\/send$/);
  if (request.method === "POST" && send) {
    const invoiceId = decodeURIComponent(send[1]);
    if (ctx.demo) {
      return json({
        ok: true,
        demo: true,
        data: { invoiceId, checkoutLink: null, status: "open" },
      });
    }
    try {
      const invoice = await sendInvoice(ctx.whop, invoiceId);
      return json({ ok: true, data: invoice });
    } catch (err) {
      return failed(err, "sendInvoice failed:", "Send failed.");
    }
  }

  if (pathname.startsWith("/api/")) {
    return json({ ok: false, error: "Not found." }, 404);
  }

  // Static client + SPA fallback are served by the Workers assets binding.
  const assets = (
    bindings as { ASSETS?: { fetch: (request: Request) => Promise<Response> } }
  ).ASSETS;
  if (assets) {
    return assets.fetch(request);
  }
  return json({ ok: false, error: "Not found." }, 404);
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    return handleRequest(request, env);
  },
};

/** True when this module is loaded by the Cloudflare Workers runtime. */
const isWorker = (() => {
  const nav = (globalThis as { navigator?: { userAgent?: unknown } }).navigator;
  return (
    typeof nav?.userAgent === "string" &&
    nav.userAgent.includes("Cloudflare-Workers")
  );
})();

if (!isWorker) {
  void startNodeServer();
}

/**
 * Local development adapter: run the `fetch` handler under Node on :3000,
 * serving the built client from `dist/client` itself. Only used outside
 * the Workers runtime.
 */
async function startNodeServer(): Promise<void> {
  const http = await import("node:http");
  const { createReadStream, existsSync } = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const PORT = Number(process.env.PORT ?? 3000);
  const CLIENT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../client",
  );
  const MIME: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? `localhost:${PORT}`}`,
      );
      if (url.pathname.startsWith("/api/")) {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined) {
            headers.set(
              name,
              Array.isArray(value) ? value.join(", ") : String(value),
            );
          }
        }
        let body: Buffer | undefined;
        if (req.method !== "GET" && req.method !== "HEAD") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          if (chunks.length > 0) body = Buffer.concat(chunks);
        }
        const request = new Request(url.toString(), {
          method: req.method,
          headers,
          body,
        });
        const response = await handleRequest(request, process.env as Bindings);
        const outHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          outHeaders[key] = value;
        });
        res.writeHead(response.status, outHeaders);
        if (response.body) {
          for await (const chunk of response.body) res.write(chunk);
        }
        res.end();
        return;
      }

      // Static client + SPA fallback (hash routing, so any path serves index.html).
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      let target = path.resolve(CLIENT_DIR, rel);
      if (target !== CLIENT_DIR && !target.startsWith(CLIENT_DIR + path.sep)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }
      const wantsHtml =
        req.method === "GET" &&
        (req.headers.accept ?? "").includes("text/html");
      if (rel === "" || !existsSync(target)) {
        if (rel === "" || wantsHtml) {
          target = path.join(CLIENT_DIR, "index.html");
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found.");
          return;
        }
      }
      res.writeHead(200, {
        "Content-Type":
          MIME[path.extname(target).toLowerCase()] ??
          "application/octet-stream",
      });
      createReadStream(target).pipe(res);
    } catch (err) {
      console.error("[summit-roofing] node adapter failed:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ ok: false, error: "Internal error." }));
    }
  });

  const demo = !isConfigured(getWhopEnv());
  if (demo) {
    console.warn(
      "[summit-roofing] WHOP_API_KEY / WHOP_ACCOUNT_ID not set \u2014 running in DEMO mode. " +
        "API routes return demo payloads; nothing is charged. See README.md.",
    );
  }
  server.listen(PORT, () => {
    console.log(`[summit-roofing] listening on :${PORT} (demo=${demo})`);
  });
}
