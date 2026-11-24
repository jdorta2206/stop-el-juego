import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const healthSource = readFileSync(resolve(currentDir, "./adminHealth.ts"), "utf8");

describe("admin health lazy-module diagnostics", () => {
  it("shows all recent client errors that contribute to the 15-minute health counter", () => {
    expect(healthSource).toContain("AND created_at>=NOW()-INTERVAL '15 minutes'");
    expect(healthSource).toContain("ORDER BY created_at DESC");
    expect(healthSource).toContain("LIMIT 30");
    expect(healthSource).toContain('name:"Detalle de errores cliente (15 min)"');
  });
  it("isolates the optional gameplay check behind a bounded timeout", () => {
    expect(healthSource).toContain("SET LOCAL statement_timeout = '1500ms'");
    expect(healthSource).toContain("INTERVAL '2 hours'");
    expect(healthSource).toContain("event_name IN ('game_start', 'game_complete')");
    expect(healthSource).not.toContain("potentiallyStuck");
    expect(healthSource).not.toContain("Partidas potencialmente atascadas");
    expect(healthSource).toContain("Son recuentos de eventos e identidades, no partidas emparejadas");
    expect(healthSource).toContain("catch (gameplayError: unknown)");
    expect(healthSource).toContain("value: 'NO EVALUADO'");
    expect(healthSource).toContain("resto del diagnóstico sigue disponible");
  });
  it("renders the lazy page and module exports captured by client-error telemetry", () => {
    expect(healthSource).toContain("lazy_page?:unknown");
    expect(healthSource).toContain("module_exports?:unknown");
    expect(healthSource).toContain('parsed.context?.lazy_page==="string"');
    expect(healthSource).toContain('parsed.context?.module_exports==="string"');
    expect(healthSource).toContain('"Página lazy: "+lazyPage');
    expect(healthSource).toContain("filename?:unknown");
    expect(healthSource).toContain("parsed.context?.filename");
    expect(healthSource).toContain('"Archivo JS: "+filename');
    expect(healthSource).toContain("parsed.context?.line");
    expect(healthSource).toContain("parsed.context?.column");
    expect(healthSource).toContain('"Exportaciones del módulo: "+moduleExports');
    expect(healthSource).toContain("lazyIdentity=typeof parsed.message");
    expect(healthSource).toContain("lazyIdentity?.[1]");
    expect(healthSource).toContain("lazyIdentity?.[2]");
  });
});
