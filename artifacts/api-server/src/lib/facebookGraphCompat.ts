// Facebook Graph API v19.0 expired on 2026-05-21. Keep the existing OAuth
// implementation working without changing its public routes while migrating
// its outbound Facebook URLs to a currently supported Graph API version.
const FACEBOOK_GRAPH_VERSION = "v26.0";

const originalFetch = globalThis.fetch.bind(globalThis);

function rewriteFacebookUrl(input: RequestInfo | URL): RequestInfo | URL {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!raw.includes("facebook.com/")) return input;

  let rewritten = raw.replace(/facebook\.com\/v19\.0\//g, `facebook.com/${FACEBOOK_GRAPH_VERSION}/`);
  rewritten = rewritten.replace(/graph\.facebook\.com\/me\?/g, `graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?`);

  // Login itself only needs these basic permissions. Requesting user_friends
  // during the initial OAuth flow can make login fail when that permission is
  // not enabled/reviewed for the app. Friend access, when available, can be
  // requested separately after authentication.
  rewritten = rewritten.replace(/scope=email%2Cpublic_profile%2Cuser_friends/g, "scope=email%2Cpublic_profile");
  rewritten = rewritten.replace(/scope=email,public_profile,user_friends/g, "scope=email,public_profile");

  if (typeof input === "string") return rewritten;
  if (input instanceof URL) return new URL(rewritten);
  return new Request(rewritten, input);
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  originalFetch(rewriteFacebookUrl(input), init)
) as typeof globalThis.fetch;
