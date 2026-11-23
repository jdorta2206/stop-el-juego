import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const healthSource = readFileSync(resolve(currentDir, "./adminHealth.ts"), "utf8");

describe("admin health lazy-module diagnostics", () => {
  it("renders the lazy page and module exports captured by client-error telemetry", () => {
    expect(healthSource).toContain("lazy_page?:unknown");
    expect(healthSource).toContain("module_exports?:unknown");
    expect(healthSource).toContain('parsed.context?.lazy_page==="string"');
    expect(healthSource).toContain('parsed.context?.module_exports==="string"');
    expect(healthSource).toContain('"Página lazy: "+lazyPage');
    expect(healthSource).toContain('"Exportaciones del módulo: "+moduleExports');
    expect(healthSource).toContain("lazyIdentity=typeof parsed.message");
    expect(healthSource).toContain("lazyIdentity?.[1]");
    expect(healthSource).toContain("lazyIdentity?.[2]");
  });
});
