/**
 * Client-side helpers for the template's own server API routes.
 * The browser never talks to Whop directly and never sees the API key —
 * every Whop call goes through `src/server/index.ts`.
 */

export interface ApiResult<T = unknown> {
  ok: boolean;
  demo?: boolean;
  error?: string;
  data?: T;
}

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as ApiResult<T>;
}

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  service: string;
  message?: string;
  address?: string;
}

export function submitLead(input: LeadInput) {
  return post<{ leadId?: string }>("/api/leads", input);
}

export interface CheckoutSession {
  checkoutConfigurationId: string;
  purchaseUrl?: string;
  demo?: boolean;
}

export function createCheckoutSession(planId: string) {
  return post<CheckoutSession>("/api/checkout/session", { planId, mode: "payment" });
}

export interface SetupIntentResult {
  setupIntentId?: string;
  status?: string;
  clientSecret?: string;
  paymentMethodId?: string;
}

export function createSetupIntent(confirmationToken: string, email: string) {
  return post<SetupIntentResult>("/api/save-payment-method", { confirmationToken, email });
}

export interface InvoiceResult {
  invoiceId?: string;
  checkoutLink?: string;
  status?: string;
}

export function createFinalBalanceInvoice(input: {
  email: string;
  customerName?: string;
  amount: number;
  description: string;
  paymentMethodId?: string;
  dueInDays?: number;
}) {
  return post<InvoiceResult>("/api/invoices", input);
}

export function issueInvoice(invoiceId: string) {
  return post<InvoiceResult>(`/api/invoices/${invoiceId}/issue`, {});
}

export function sendInvoice(invoiceId: string) {
  return post<InvoiceResult>(`/api/invoices/${invoiceId}/send`, {});
}

/** Public (non-secret) config served by the server: plan ids + account id. */
export interface PublicConfig {
  accountId: string | null;
  plans: Record<string, string>;
  demo: boolean;
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const res = await fetch("/api/config");
  return (await res.json()) as PublicConfig;
}
