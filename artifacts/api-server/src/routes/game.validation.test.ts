import { beforeAll, describe, expect, it } from "vitest";
import { normalizeWord } from "../lib/wordRules";

let getAiWord: typeof import("./game")["getAiWord"];
let isWordValid: typeof import("./game")["isWordValid"];

beforeAll(async () => {
  // These tests exercise pure dictionary functions and never open a DB connection.
  process.env.DATABASE_URL ||= "postgres://stop_test:stop_test@127.0.0.1:5432/stop_test";
  const game = await import("./game");
  getAiWord = game.getAiWord;
  isWordValid = game.isWordValid;
});

describe("game word language validation", () => {
  it.each([
    ["es", "animal", "A"],
    ["es", "animal", "C"],
    ["es", "animal", "B"],
    ["en", "animal", "A"],
    ["en", "animal", "C"],
    ["en", "animal", "B"],
    ["pt", "animal", "A"],
    ["pt", "animal", "C"],
    ["fr", "animal", "A"],
    ["fr", "animal", "C"],
    ["fr", "animal", "B"],
  ])("returns a real %s dictionary word for %s starting with %s and accepted by scoring", (language, category, letter) => {
    const word = getAiWord(letter, category, language);
    expect(word).not.toBe("");
    expect(normalizeWord(word).startsWith(normalizeWord(letter))).toBe(true);
    expect(isWordValid(word, letter, category, language)).toBe(true);
  });

  it.each([
    ["pt", "cor"],
    ["fr", "couleur"],
  ])("uses the localized closed category for %s (%s)", (language, category) => {
    const word = getAiWord("A", category, language);
    expect(word).not.toBe("");
    expect(isWordValid(word, "A", category, language)).toBe(true);
  });

  it("does not accept Spanish-only words as French answers", () => {
    expect(isWordValid("azul", "A", "couleur", "fr")).toBe(false);
    expect(isWordValid("abejorro", "A", "animal", "fr")).toBe(false);
  });

  it("rejects a dictionary word that does not begin with the round letter", () => {
    expect(isWordValid("abeja", "B", "animal", "es")).toBe(false);
  });

  it("does not fall back to Spanish when the requested language is unsupported", () => {
    expect(getAiWord("A", "animal", "de")).toBe("");
    expect(isWordValid("azul", "A", "color", "de")).toBe(false);
  });
});
