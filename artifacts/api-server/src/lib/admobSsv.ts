import crypto from "crypto";

const KEY_SERVER_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type VerifierKey = { keyId: number; pem: string };

let keyCache: { keys: Map<number, string>; expiresAt: number } | null = null;

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

async function fetchVerifierKeys(): Promise<Map<number, string>> {
  const response = await fetch(KEY_SERVER_URL, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`AdMob key server returned ${response.status}`);

  const data = await response.json() as { keys?: VerifierKey[] };
  const keys = new Map<number, string>();

  for (const key of data.keys ?? []) {
    if (
      Number.isInteger(key.keyId) &&
      typeof key.pem === "string" &&
      key.pem.includes("BEGIN PUBLIC KEY")
    ) {
      keys.set(key.keyId, key.pem);
    }
  }

  if (keys.size === 0) throw new Error("AdMob verifier key set is empty");
  keyCache = { keys, expiresAt: Date.now() + KEY_CACHE_TTL_MS };
  return keys;
}

async function getVerifierKeys(forceRefresh = false): Promise<Map<number, string>> {
  if (!forceRefresh && keyCache && Date.now() < keyCache.expiresAt) return keyCache.keys;
  return fetchVerifierKeys();
}

export async function verifyAdMobSsv(originalUrl: string): Promise<
  { valid: true; params: Record<string, string> } |
  { valid: false; error: string }
> {
  const queryStart = originalUrl.indexOf("?");
  if (queryStart < 0) return { valid: false, error: "Missing query string" };

  // Google’s reference verifier uses URI.getQuery(), which percent-decodes
  // escaped query values before UTF-8 encoding the signed content. Preserve
  // the original parameter order, but decode each escape exactly once.
  const rawQuery = originalUrl.slice(queryStart + 1);
  const signatureMarker = rawQuery.lastIndexOf("&signature=");
  const signatureStart = signatureMarker >= 0
    ? signatureMarker + 1
    : rawQuery.startsWith("signature=") ? 0 : -1;
  if (signatureStart < 0) return { valid: false, error: "Missing signature" };

  const rawSignedContent = rawQuery.slice(0, signatureStart - (signatureMarker >= 0 ? 1 : 0));
  const signedTail = rawQuery.slice(signatureStart);
  const sigMatch = signedTail.match(/^signature=([^&]+)&key_id=([^&]+)$/);
  if (!sigMatch) return { valid: false, error: "Invalid signature/key_id ordering" };

  let signedContent: string;
  let signature: Buffer;
  let keyId: number;
  try {
    signedContent = decodeURIComponent(rawSignedContent);
    signature = decodeBase64Url(decodeURIComponent(sigMatch[1]));
    keyId = Number(decodeURIComponent(sigMatch[2]));
  } catch {
    return { valid: false, error: "Invalid signature encoding" };
  }

  if (!Number.isSafeInteger(keyId)) return { valid: false, error: "Invalid key_id" };

  let keys = await getVerifierKeys();
  let pem = keys.get(keyId);

  if (!pem) {
    keys = await getVerifierKeys(true);
    pem = keys.get(keyId);
  }

  if (!pem) return { valid: false, error: "Unknown key_id" };

  const verified = crypto.verify(
    "sha256",
    Buffer.from(signedContent, "utf8"),
    pem,
    signature,
  );

  if (!verified) return { valid: false, error: "Invalid signature" };

  const parsed = new URL(`https://ssv.invalid/?${rawQuery}`);
  const params: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) params[key] = value;

  return { valid: true, params };
}
