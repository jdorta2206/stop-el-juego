import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const adminRouteSource = readFileSync(
  resolve(currentDir, "admin.ts"),
  "utf8",
);

describe("STOP Control analytics funnel event ordering", () => {
  it("only treats a game start at or after the lobby view as a transition", () => {
    const lobbyWithoutStart = adminRouteSource.match(
      /AS lobby_without_start,[\s\S]*?\) THEN session_id END\)::int AS lobby_without_start/,
    );
    expect(lobbyWithoutStart).not.toBeNull();
    expect(lobbyWithoutStart?.[0]).toContain(
      "gs.created_at >= analytics_events.created_at",
    );
  });

  it("only treats a game completion at or after the start as a transition", () => {
    const startedWithoutComplete = adminRouteSource.match(
      /AS started_without_complete,[\s\S]*?\) THEN session_id END\)::int AS started_without_complete/,
    );
    expect(startedWithoutComplete).not.toBeNull();
    expect(startedWithoutComplete?.[0]).toContain(
      "gc.created_at >= analytics_events.created_at",
    );
  });
});
