import type { response as ExpressResponse } from "express";

// Facebook Graph API v19.0 expired on 2026-05-21. Keep Facebook OAuth
// compatible with the currently supported Graph API without globally
// rewriting unrelated Express redirects.
const FACEBOOK_GRAPH_VERSION = "v26.0";

const originalFetch = globalThis.fetch.bind(globalThis);

function rewriteFacebookUrl(input: RequestInfo | URL): RequestInfo | URL {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!raw.includes("facebook.com/")) return input;

  let rewritten = raw.replace(/facebook\.com\/v19\.0\//g, `facebook.com/${FACEBOOK_GRAPH_VERSION}/`);
  rewritten = rewritten.replace(/graph\.facebook\.com\/me\?/g, `graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?`);
  rewritten = rewritten.replace(/scope=email%2Cpublic_profile%2Cuser_friends/g, "scope=email%2Cpublic_profile");
  rewritten = rewritten.replace(/scope=email,public_profile,user_friends/g, "scope=email,public_profile");

  if (typeof input === "string") return rewritten;
  if (input instanceof URL) return new URL(rewritten);
  return new Request(rewritten, input);
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  originalFetch(rewriteFacebookUrl(input), init)
) as typeof globalThis.fetch;

// The Facebook /start route uses res.redirect() directly, so fetch interception
// cannot change that first hop. Patch ONLY redirects originating from that route.
const originalRedirect = (ExpressResponse as any).redirect;
(ExpressResponse as any).redirect = function (...args: any[]) {
  const requestUrl = String((this as any)?.req?.originalUrl || (this as any)?.req?.url || "");
  if (requestUrl.includes("/api/auth/facebook/start") && typeof args[0] === "string") {
    args[0] = args[0].replace(/facebook\.com\/v19\.0\//g, `facebook.com/${FACEBOOK_GRAPH_VERSION}/`);
  }
  return originalRedirect.apply(this, args);
};
