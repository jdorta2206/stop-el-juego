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
});
