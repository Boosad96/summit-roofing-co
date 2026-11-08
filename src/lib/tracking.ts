/**
 * Whop Pixel tracking.
 *
 * On a deployed whop.site site, Whop injects the pixel into every HTML page
 * and `window.whop` exists before app code runs — there is no snippet to
 * paste and no company ID to configure. Page views and Whop checkouts are
 * tracked automatically; we only add `whop.track` calls for funnel steps
 * Whop can't see on its own.
 *
 * Custom events fired by this template (all verifiable in the Whop dashboard
 * under Websites / pixel dashboard, appearing ~1 minute after the visit):
 *   - `service_viewed`   — a service card became visible / was opened
 *   - `estimate_requested` — the estimate form was submitted successfully
 *   - `deposit_started`  — the deposit checkout was opened
 * Standard events used alongside them:
 *   - `view_content`, `lead`, `add_to_cart`, `initiate_checkout`
 *
 * Locally (or anywhere the pixel is absent) calls fall back to a console
 * debug line so flows can still be walked through and verified by eye.
 */

declare global {
  interface Window {
    whop?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      // The Whop Websites runtime may expose the signed-in visitor here.
      // These are deliberately loose: the runtime is not part of the
      // template and may not provide an identity at all (anonymous visitors).
      user?: { id?: string };
      viewer?: { id?: string };
      userId?: string;
    };
  }
}

/**
 * The Whop user id of the signed-in visitor, when the Whop Websites runtime
 * exposes one. Returns undefined for anonymous visitors (the server then
 * records the lead against the configured WHOP_LEAD_USER_ID).
 */
export function getWhopUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const whop = window.whop;
  if (!whop) return undefined;
  const id = whop.user?.id ?? whop.viewer?.id ?? whop.userId;
  return typeof id === "string" && id ? id : undefined;
}

export type TrackData = {
  value?: number;
  currency?: string;
  variant_id?: string;
  product_id?: string;
  [key: string]: unknown;
};

export function track(event: string, data?: TrackData): void {
  if (typeof window !== "undefined" && window.whop?.track) {
    window.whop.track(event, data);
  } else if (typeof window !== "undefined") {
    // Pixel absent (local dev / preview): log so the event is still visible.
    console.debug(`[whop.track] ${event}`, data ?? {});
  }
}

/** Fired once per service when its card first becomes visible on screen. */
export function trackServiceViewed(serviceId: string, planId?: string): void {
  track("service_viewed", { service_id: serviceId, variant_id: planId });
  track("view_content", { variant_id: planId });
}

/** Fired when the estimate form is submitted successfully. */
export function trackEstimateRequested(service: string): void {
  track("estimate_requested", { service });
  track("lead", { service });
}

/** Fired when the deposit checkout is opened. */
export function trackDepositStarted(planId?: string): void {
  track("deposit_started", { value: 500, currency: "usd", variant_id: planId });
  track("initiate_checkout", {
    value: 500,
    currency: "usd",
    variant_id: planId,
  });
}
