/**
 * Server-side Whop API client — raw fetch against the documented endpoints.
 *
 * Docs used (docs.whop.com):
 * - API overview: base `https://api.whop.com/api/v1`, `Authorization: Bearer <key>`,
 *   pin a dated version with the `Api-Version-Date` header. Sandbox base is
 *   `https://sandbox-api.whop.com/api/v1` (separate keys, no real money).
 * - Checkout configurations: POST /checkout_configurations — creates a reusable
 *   configuration for a checkout (plan, metadata). Returns `id` (`ch_…`) and
 *   `purchase_url`. Needs `checkout_configuration:create` (+ `plan:create` for
 *   inline plans).
 * - Setup intents: POST /setup_intents — creates a setup intent from a
 *   confirmation token. Returns `status` + `client_secret`; once `succeeded`
 *   it carries the saved method as `payment_method_id`.
 * - Payments: POST /payments — charges a buyer with a `confirmation_token`
 *   (on-session) or `member_id` + `payment_method_id` (off-session). The
 *   response is the payment as created, not its outcome — fulfill from the
 *   `payment.succeeded` webhook.
 * - Invoices (native — requires `Api-Version-Date: 2026-10-24` or later):
 *   POST /invoices creates a draft (201, charges nothing, emails no one).
 *   POST /invoices/{id}/issue opens it and charges a saved `payment_method_id`
 *   off-session. POST /invoices/{id}/send issues + emails it. Send an
 *   `Idempotency-Key` on every POST.
 * - Leads (Legacy-only resource): POST /leads with `{ account_id, metadata,
 *   product_id?, user_id? }`. Needs `lead:manage`, `member:email:read`,
 *   `access_pass:basic:read`, `member:basic:read`.
 *
 * No API key is ever sent to the browser. When WHOP_API_KEY is unset the
 * server runs in demo mode and the routes return demo payloads instead of
 * calling Whop — the UI says so honestly.
 */

export interface WhopEnv {
  apiKey: string | null;
  accountId: string | null;
  apiBase: string;
  apiVersion: string;
}

export function getWhopEnv(): WhopEnv {
  return {
    apiKey: process.env.WHOP_API_KEY ?? null,
    accountId: process.env.WHOP_ACCOUNT_ID ?? null,
    apiBase: process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1",
    apiVersion: process.env.WHOP_API_VERSION ?? "2026-10-24",
  };
}

export function isConfigured(env: WhopEnv): boolean {
  return Boolean(env.apiKey && env.accountId);
}

interface WhopError {
  message?: string;
  error?: string;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as WhopError;
    if (typeof b.message === "string") return b.message;
    if (typeof b.error === "string") return b.error;
  }
  return fallback;
}

async function whopFetch(
  env: WhopEnv,
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.apiKey as string}`,
    "Api-Version-Date": env.apiVersion,
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(`${env.apiBase}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Whop API ${res.status} on ${path}: ${errorMessage(parsed, text || "unknown error")}`);
  }
  return { status: res.status, body: parsed };
}

const idempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Create a reusable checkout configuration for a plan. */
export async function createCheckoutConfiguration(
  env: WhopEnv,
  input: { planId: string; mode: "payment" | "setup"; metadata?: Record<string, string> },
): Promise<{ id: string; purchaseUrl: string | null; planId: string | null }> {
  const { body } = await whopFetch(env, "/checkout_configurations", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: {
      company_id: env.accountId,
      plan_id: input.planId,
      mode: input.mode,
      metadata: input.metadata ?? {},
    },
  });
  const plan = body.plan as { id?: string } | null;
  return {
    id: String(body.id ?? ""),
    purchaseUrl: typeof body.purchase_url === "string" ? body.purchase_url : null,
    planId: plan?.id ?? null,
  };
}

/** Create a setup intent from a browser confirmation token (save card on file). */
export async function createSetupIntent(
  env: WhopEnv,
  input: { confirmationToken: string; currency?: string; returnUrl?: string; metadata?: Record<string, string> },
): Promise<{ id: string; status: string; clientSecret: string | null; paymentMethodId: string | null }> {
  const { body } = await whopFetch(env, "/setup_intents", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: {
      account_id: env.accountId,
      confirmation_token: input.confirmationToken,
      currency: input.currency ?? "usd",
      return_url: input.returnUrl ?? undefined,
      metadata: input.metadata ?? {},
    },
  });
  return {
    id: String(body.id ?? ""),
    status: String(body.status ?? ""),
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : null,
    paymentMethodId: typeof body.payment_method_id === "string" ? body.payment_method_id : null,
  };
}

/** Charge a buyer from a browser confirmation token (payment-elements flow). */
export async function createPayment(
  env: WhopEnv,
  input: { confirmationToken: string; planId: string; metadata?: Record<string, string> },
): Promise<{ id: string; status: string; clientSecret: string | null }> {
  const { body } = await whopFetch(env, "/payments", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: {
      account_id: env.accountId,
      confirmation_token: input.confirmationToken,
      plan_id: input.planId,
      metadata: input.metadata ?? {},
    },
  });
  return {
    id: String(body.id ?? ""),
    status: String(body.status ?? ""),
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : null,
  };
}

/** Record a lead (Legacy API). */
export async function createLead(
  env: WhopEnv,
  input: { metadata: Record<string, string>; productId?: string },
): Promise<{ id: string }> {
  const { body } = await whopFetch(env, "/leads", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: {
      account_id: env.accountId,
      metadata: input.metadata,
      product_id: input.productId ?? undefined,
    },
  });
  return { id: String(body.id ?? "") };
}

/** Create a draft invoice (native invoices API). */
export async function createInvoice(
  env: WhopEnv,
  input: {
    email: string;
    customerName?: string;
    amount: number;
    description: string;
    paymentMethodId?: string;
    dueInDays?: number;
    /** Optional product to bill under (WHOP_PRODUCT_ID). Without it the item
     * is a custom fee — verify against the live API at deploy time. */
    productId?: string;
    metadata?: Record<string, string>;
  },
): Promise<{ id: string; status: string; checkoutLink: string | null }> {
  const dueAt =
    input.dueInDays !== undefined
      ? new Date(Date.now() + input.dueInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
  const inlinePlan: Record<string, unknown> = {
    plan_type: "one_time",
    initial_price: input.amount,
    currency: "usd",
  };
  if (input.productId) inlinePlan.product_id = input.productId;
  const { body } = await whopFetch(env, "/invoices", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: {
      account_id: env.accountId,
      email_address: input.email,
      customer_name: input.customerName ?? undefined,
      items: [{ plan: inlinePlan }],
      payment_method_id: input.paymentMethodId ?? undefined,
      due_at: dueAt,
      metadata: { description: input.description, ...(input.metadata ?? {}) },
    },
  });
  return {
    id: String(body.id ?? ""),
    status: String(body.status ?? ""),
    checkoutLink: typeof body.checkout_link === "string" ? body.checkout_link : null,
  };
}

/** Issue a draft invoice — opens it and charges a saved payment method, if set. */
export async function issueInvoice(
  env: WhopEnv,
  invoiceId: string,
): Promise<{ id: string; status: string; checkoutLink: string | null }> {
  const { body } = await whopFetch(env, `/invoices/${invoiceId}/issue`, {
    method: "POST",
    idempotencyKey: idempotencyKey(),
  });
  return {
    id: String(body.id ?? invoiceId),
    status: String(body.status ?? ""),
    checkoutLink: typeof body.checkout_link === "string" ? body.checkout_link : null,
  };
}

/** Send an invoice — issues it and emails it to the customer. */
export async function sendInvoice(
  env: WhopEnv,
  invoiceId: string,
): Promise<{ id: string; status: string; checkoutLink: string | null }> {
  const { body } = await whopFetch(env, `/invoices/${invoiceId}/send`, {
    method: "POST",
    idempotencyKey: idempotencyKey(),
  });
  return {
    id: String(body.id ?? invoiceId),
    status: String(body.status ?? ""),
    checkoutLink: typeof body.checkout_link === "string" ? body.checkout_link : null,
  };
}
