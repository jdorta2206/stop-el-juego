import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationSource = readFileSync(
  resolve(currentDir, "../../../../../lib/db/src/migrate.ts"),
  "utf8",
);
const rateLimitSource = readFileSync(
  resolve(currentDir, "../middlewares/rateLimit.ts"),
  "utf8",
);

describe("api_rate_limits legacy schema repair", () => {
  it("ensures ON CONFLICT(bucket_key) has a valid single-column unique index", () => {
    expect(rateLimitSource).toContain("ON CONFLICT (bucket_key) DO UPDATE");
    expect(migrationSource).toContain("i.indisunique");
    expect(migrationSource).toContain("i.indisvalid");
    expect(migrationSource).toContain("i.indnkeyatts = 1");
    expect(migrationSource).toContain("a.attname = 'bucket_key'");
    expect(migrationSource).toContain(
      "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS api_rate_limits_bucket_key_uidx",
    );
  });

  it("deduplicates legacy buckets without weakening the newest active limit", () => {
    const repairStart = migrationSource.indexOf("DELETE FROM public.api_rate_limits a");
    const repairEnd = migrationSource.indexOf("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS api_rate_limits_bucket_key_uidx", repairStart);
    expect(repairStart).toBeGreaterThan(-1);
    expect(repairEnd).toBeGreaterThan(repairStart);
    const repairSql = migrationSource.slice(repairStart, repairEnd);
    expect(repairSql).toContain("a.window_start < b.window_start");
    expect(repairSql).toContain("a.hits < b.hits");
    expect(repairSql).toContain("a.ctid < b.ctid");
  });
});
