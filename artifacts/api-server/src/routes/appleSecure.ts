import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { issuePlayerToken, PLAYER_TOKEN_BRIDGE_KEY } from "../lib/playerAuth";

const router = Router();

const APP_ORIGIN = process.env["APP_ORIGIN"] || "https://www.stopjuegodepalabras.com";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_NONCE_COOKIE = "stop_apple_nonce";
const APPLE_STATE_COOKIE = "stop_apple_state";
const STATE_TTL_MS = 15 * 60 * 1000;

const SAFE_RETURN_ORIGINS = new Set([
  "https://stopjuegodepalabras.com",
  "https://www.stopjuegodepalabras.com",
  APP_ORIGIN,
]);

interface AppleJwk {
  kty: "EC";
  kid: string;
  use?: string;
  alg?: string;
  crv: "P-256";
  x: string;
  y: string;
}

interface AppleJwksResponse {
  keys?: AppleJwk[];
}

interface AppleIdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  sub?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
}

const APPLE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
};

function sessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not configured securely");
  }
  return secret;
}

function safeReturnPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function safeReturnOrigin(req: Request): string {
  const requested = req.query["origin"];
  if (typeof requested === "string" && SAFE_RETURN_ORIGINS.has(requested)) return requested;
  try {
    const refererOrigin = new URL(req.get("referer") || "").origin;
    if (SAFE_RETURN_ORIGINS.has(refererOrigin)) return refererOrigin;
  } catch {
    // Ignore malformed/missing referer.
  }
  return APP_ORIGIN;
}

function encodeState(returnPath: string, returnOrigin: string, nonce: string): string {
  const body = Buffer.from(
    JSON.stringify({ r: returnPath, o: returnOrigin, n: nonce, t: Date.now() }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `v1.${body}.${signature}`;
}

function verifyState(raw: unknown, nonce: string | undefined): { returnPath: string; returnOrigin: string } {
  if (typeof raw !== "string" || !raw.startsWith("v1.") || !nonce) {
    throw new Error("Invalid Apple OAuth state");
  }
  const parts = raw.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple OAuth state format");
  const [, body, signature] = parts;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid Apple OAuth state signature");
  }

  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  const timestamp = parsed["t"];
  const stateNonce = parsed["n"];
  if (typeof timestamp !== "number" || typeof stateNonce !== "string") {
    throw new Error("Malformed Apple OAuth state");
  }
  const age = Date.now() - timestamp;
  if (age < -60_000 || age > STATE_TTL_MS) throw new Error("Expired Apple OAuth state");
  if (stateNonce.length !== nonce.length || !crypto.timingSafeEqual(Buffer.from(stateNonce), Buffer.from(nonce))) {
    throw new Error("Apple OAuth nonce mismatch");
  }

  const returnOrigin = typeof parsed["o"] === "string" && SAFE_RETURN_ORIGINS.has(parsed["o"])
    ? parsed["o"]
    : APP_ORIGIN;
  return { returnPath: safeReturnPath(parsed["r"]), returnOrigin };
}

let cachedKeys: AppleJwk[] = [];
let cachedKeysAt = 0;
const JWKS_CACHE_MS = 60 * 60 * 1000;

async function getAppleSigningKey(kid: string): Promise<AppleJwk> {
  if (Date.now() - cachedKeysAt > JWKS_CACHE_MS || cachedKeys.length === 0) {
    const response = await fetch(APPLE_KEYS_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Apple JWKS request failed: ${response.status}`);
    const data = (await response.json()) as AppleJwksResponse;
    cachedKeys = (data.keys || []).filter(
      (key) => key.kty === "EC" && key.crv === "P-256" && key.x && key.y && key.kid,
    );
    cachedKeysAt = Date.now();
  }

  const key = cachedKeys.find((candidate) => candidate.kid === kid);
  if (!key) throw new Error("Apple signing key not found");
  return key;
}

function joseSignatureToDer(signature: Buffer): Buffer {
  if (signature.length !== 64) throw new Error("Invalid Apple ES256 signature length");

  const normalize = (value: Buffer): Buffer => {
    let first = 0;
    while (first < value.length - 1 && value[first] === 0) first++;
    let result = value.subarray(first);
    if (result[0] & 0x80) result = Buffer.concat([Buffer.from([0]), result]);
    return result;
  };

  const r = normalize(signature.subarray(0, 32));
  const s = normalize(signature.subarray(32, 64));
  const body = Buffer.concat([
    Buffer.from([0x02, r.length]), r,
    Buffer.from([0x02, s.length]), s,
  ]);
  if (body.length >= 128) throw new Error("Invalid Apple ES256 signature");
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

async function verifyAppleIdToken(idToken: string, expectedClientId: string, expectedNonce: string): Promise<AppleIdTokenClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed Apple id_token");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as Record<string, unknown>;
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AppleIdTokenClaims;

  if (header["alg"] !== "ES256" || typeof header["kid"] !== "string") {
    throw new Error("Unsupported Apple id_token signing algorithm");
  }
  const key = await getAppleSigningKey(header["kid"]);
  const publicKey = crypto.createPublicKey({
    key: { kty: key.kty, crv: key.crv, x: key.x, y: key.y },
    format: "jwk",
  });
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = joseSignatureToDer(Buffer.from(encodedSignature, "base64url"));
  if (!crypto.verify("sha256", signingInput, publicKey, signature)) {
    throw new Error("Invalid Apple id_token signature");
  }

  if (payload.iss !== APPLE_ISSUER) throw new Error("Invalid Apple id_token issuer");
  const audience = payload.aud;
  const audienceMatches = typeof audience === "string"
    ? audience === expectedClientId
    : Array.isArray(audience) && audience.some((value) => value === expectedClientId);
  if (!audienceMatches) throw new Error("Invalid Apple id_token audience");
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Expired Apple id_token");
  }
  if (typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 255) {
    throw new Error("Invalid Apple subject");
  }
  if (typeof payload.nonce !== "string" || payload.nonce.length !== expectedNonce.length ||
      !crypto.timingSafeEqual(Buffer.from(payload.nonce), Buffer.from(expectedNonce))) {
    throw new Error("Invalid Apple id_token nonce");
  }

  return payload;
}

function makeAppleClientSecret(): string {
  const privateKey = (process.env["APPLE_PRIVATE_KEY"] || "").replace(/\\n/g, "\n");
  const teamId = process.env["APPLE_TEAM_ID"]!;
  const clientId = process.env["APPLE_CLIENT_ID"]!;
  const keyId = process.env["APPLE_KEY_ID"]!;
  return jwt.sign({}, privateKey, {
    algorithm: "ES256",
    keyid: keyId,
    issuer: teamId,
    audience: APPLE_ISSUER,
    subject: clientId,
    expiresIn: "5m",
  });
}

function bridgePage(user: string, token: string | undefined, returnPath: string, returnOrigin: string): string {
  const items: [string, string][] = [["oauth_user", user]];
  if (token) items.push([PLAYER_TOKEN_BRIDGE_KEY, token]);
  const assignments = items.map(([key, value]) => {
    const store = key === PLAYER_TOKEN_BRIDGE_KEY ? "localStorage" : "sessionStorage";
    return `${store}.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`;
  }).join("\n");
  const destination = `${returnOrigin}${returnPath}`;
  const separator = destination.includes("#") ? "&" : "#";
  const handoff = `${destination}${separator}stopauth=${encodeURIComponent(JSON.stringify(items))}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectando...</title></head><body><p>Conectando cuenta...</p><script>try{${assignments}}catch(e){}window.location.replace(${JSON.stringify(handoff)});</script></body></html>`;
}

router.get("/apple/start", (req: Request, res: Response) => {
  try {
    const clientId = process.env["APPLE_CLIENT_ID"];
    if (!clientId || !process.env["APPLE_TEAM_ID"] || !process.env["APPLE_KEY_ID"] || !process.env["APPLE_PRIVATE_KEY"]) {
      return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
    }
    const nonce = crypto.randomBytes(32).toString("base64url");
    const returnPath = safeReturnPath(req.query["return"] || "/");
    const returnOrigin = safeReturnOrigin(req);
    const state = encodeState(returnPath, returnOrigin, nonce);
    res.cookie(APPLE_NONCE_COOKIE, nonce, { ...APPLE_COOKIE_OPTIONS, maxAge: STATE_TTL_MS });
    res.cookie(APPLE_STATE_COOKIE, state, { ...APPLE_COOKIE_OPTIONS, maxAge: STATE_TTL_MS });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${APP_ORIGIN}/api/auth/apple/callback`,
      response_type: "code",
      scope: "name email",
      response_mode: "form_post",
      state,
      nonce,
    });
    return res.redirect(`${APPLE_ISSUER}/auth/authorize?${params}`);
  } catch (error) {
    console.error("Apple start error:", error);
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_failed`);
  }
});

router.post("/apple/callback", async (req: Request, res: Response) => {
  const nonce = req.cookies?.[APPLE_NONCE_COOKIE] as string | undefined;
  const state = req.body?.["state"] as string | undefined;
  res.clearCookie(APPLE_NONCE_COOKIE, APPLE_COOKIE_OPTIONS);
  res.clearCookie(APPLE_STATE_COOKIE, APPLE_COOKIE_OPTIONS);

  try {
    const clientId = process.env["APPLE_CLIENT_ID"];
    if (!clientId || !process.env["APPLE_TEAM_ID"] || !process.env["APPLE_KEY_ID"] || !process.env["APPLE_PRIVATE_KEY"]) {
      return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
    }
    const { returnPath, returnOrigin } = verifyState(state, nonce);
    const code = req.body?.["code"] as string | undefined;
    const error = req.body?.["error"] as string | undefined;
    if (error || !code) return res.redirect(`${returnOrigin}${returnPath}?auth_error=apple_cancelled`);

    const tokenRes = await fetch(`${APPLE_ISSUER}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: makeAppleClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: `${APP_ORIGIN}/api/auth/apple/callback`,
      }),
    });
    const tokenData = (await tokenRes.json()) as { id_token?: string; error?: string };
    if (!tokenRes.ok || tokenData.error || !tokenData.id_token) throw new Error("Apple token exchange failed");

    const claims = await verifyAppleIdToken(tokenData.id_token, clientId, nonce!);
    let displayName = "Apple User";
    try {
      const rawUser = req.body?.["user"];
      const parsedUser = typeof rawUser === "string" ? JSON.parse(rawUser) : rawUser;
      const first = typeof parsedUser?.name?.firstName === "string" ? parsedUser.name.firstName : "";
      const last = typeof parsedUser?.name?.lastName === "string" ? parsedUser.name.lastName : "";
      displayName = `${first} ${last}`.trim() || displayName;
    } catch {
      // Apple may omit the user object after the first login.
    }

    const playerId = `apple_${claims.sub}`;
    const user = JSON.stringify({
      id: playerId,
      name: displayName,
      email: typeof claims.email === "string" ? claims.email : null,
      picture: null,
      provider: "apple",
    });
    const sessionToken = issuePlayerToken(res, playerId);
    return res.send(bridgePage(user, sessionToken, returnPath, returnOrigin));
  } catch (error) {
    console.error("Apple OAuth verification error:", error);
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_failed`);
  }
});

export default router;
