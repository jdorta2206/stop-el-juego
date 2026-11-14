import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import { verifyAdMobSsv } from "./admobSsv";

describe("verifyAdMobSsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies Google-style percent-escaped query data without changing its signed meaning", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const keyId = 123456789;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        keys: [{ keyId, pem: publicKey.export({ type: "spki", format: "pem" }) }],
      }),
    })));

    const signedQuery =
      "ad_unit=3559554716&custom_data=%7B%22requestId%22%3A%22request_12345678901234567890%22%7D&transaction_id=abc123";
    // Google’s reference implementation obtains URI.getQuery(), which
    // percent-decodes the query before converting it to UTF-8 for ECDSA.
    const signedBytes = Buffer.from(decodeURIComponent(signedQuery), "utf8");
    const signature = crypto.sign("sha256", signedBytes, privateKey).toString("base64url");
    const callbackUrl =
      `/api/rewards/admob-ssv?${signedQuery}&signature=${signature}&key_id=${keyId}`;

    const valid = await verifyAdMobSsv(callbackUrl);
    expect(valid.valid).toBe(true);
    if (valid.valid) {
      expect(valid.params.custom_data).toBe(
        '{"requestId":"request_12345678901234567890"}',
      );
      expect(valid.params.ad_unit).toBe("3559554716");
    }

    const tampered = await verifyAdMobSsv(
      callbackUrl.replace("3559554716", "3559554717"),
    );
    expect(tampered).toEqual({ valid: false, error: "Invalid signature" });
  });

  it("rejects a missing query string and missing signature without fetching keys", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyAdMobSsv("/api/rewards/admob-ssv")).toEqual({ valid: false, error: "Missing query string" });
    expect(await verifyAdMobSsv("/api/rewards/admob-ssv?ad_unit=3559554716")).toEqual({ valid: false, error: "Missing signature" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed percent escapes before contacting the key server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyAdMobSsv("/api/rewards/admob-ssv?custom_data=%E0%A4%A&signature=abc&key_id=123");
    expect(result).toEqual({ valid: false, error: "Invalid signature encoding" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes Google's key set once when a callback uses an unknown key id", async () => {
    const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ keys: [{ keyId: 987654321, pem: publicKey.export({ type: "spki", format: "pem" }) }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await verifyAdMobSsv("/api/rewards/admob-ssv?ad_unit=3559554716&signature=AA&key_id=987654322");
    expect(result).toEqual({ valid: false, error: "Unknown key_id" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a signature that is validly encoded but cryptographically incorrect", async () => {
    const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const keyId = 456789123;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ keys: [{ keyId, pem: publicKey.export({ type: "spki", format: "pem" }) }] }),
    })));
    const badSignature = Buffer.from("not-a-signature").toString("base64url");
    const result = await verifyAdMobSsv(`/api/rewards/admob-ssv?ad_unit=3559554716&signature=${badSignature}&key_id=${keyId}`);
    expect(result).toEqual({ valid: false, error: "Invalid signature" });
  });

});
