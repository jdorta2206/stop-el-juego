import { describe, expect, it } from "vitest";
import { getAiWord, isWordValid } from "./game";
import { normalizeWord } from "../lib/wordRules";

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
