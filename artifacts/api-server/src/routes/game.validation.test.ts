import { beforeAll, describe, expect, it } from "vitest";
import { normalizeWord } from "../lib/wordRules";

let getAiWord: typeof import("./game")["getAiWord"];
let isWordValid: typeof import("./game")["isWordValid"];

beforeAll(async () => {
  // Import the route module only after supplying a lazy, unused pool URL.
  // These tests exercise pure dictionary functions and never open a DB connection.
  process.env.DATABASE_URL ||= "postgres://stop_test:stop_test@127.0.0.1:5432/stop_test";
  const game = await import("./game");
  getAiWord = game.getAiWord;
  isWordValid = game.isWordValid;
});

describe("game word language validation", () => {
  it.each(["en", "pt", "fr"])("returns a candidate accepted by the same %s scoring validator", (language) => {
    const word = getAiWord("A", "animal", language);
    expect(word).not.toBe("");
    expect(normalizeWord(word).startsWith("a")).toBe(true);
    expect(isWordValid(word, "A", "animal", language)).toBe(true);
  });

  it("does not accept a Spanish-only color as a French answer", () => {
    expect(isWordValid("azul", "A", "color", "fr")).toBe(false);
  });

  it("does not fall back to Spanish when the requested language is unsupported", () => {
    expect(getAiWord("A", "animal", "de")).toBe("");
    expect(isWordValid("azul", "A", "color", "de")).toBe(false);
  });
});
