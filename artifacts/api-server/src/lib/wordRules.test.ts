import { describe, it, expect } from "vitest";
import { normalizeWord, isSafeInput } from "./wordRules";

describe("normalizeWord", () => {
  it("lowercases and trims surrounding whitespace", () => {
    expect(normalizeWord("  Hola  ")).toBe("hola");
    expect(normalizeWord("GATO")).toBe("gato");
  });

  it("strips accents but keeps the base letter", () => {
    expect(normalizeWord("Camión")).toBe("camion");
    expect(normalizeWord("árbol")).toBe("arbol");
    expect(normalizeWord("pingüino")).toBe("pinguino");
  });

  it("preserves ñ (does not collapse it into n)", () => {
    expect(normalizeWord("Ñu")).toBe("ñu");
    expect(normalizeWord("España")).toBe("españa");
    // ñ must stay distinct from n after normalization
    expect(normalizeWord("año")).not.toBe(normalizeWord("ano"));
  });

  it("strips numbers, symbols and emojis", () => {
    expect(normalizeWord("rosa123")).toBe("rosa");
    expect(normalizeWord("perro!")).toBe("perro");
    expect(normalizeWord("gato🐱")).toBe("gato");
  });

  it("collapses internal whitespace to a single space", () => {
    expect(normalizeWord("san   juan")).toBe("san juan");
    expect(normalizeWord(" nueva  york ")).toBe("nueva york");
  });
});

describe("isSafeInput", () => {
  it("accepts ordinary words including accented ones", () => {
    expect(isSafeInput("gato")).toBe(true);
    expect(isSafeInput("camión")).toBe(true);
    expect(isSafeInput("Nueva York")).toBe(true);
  });

  it("rejects empty or whitespace-only input", () => {
    expect(isSafeInput("")).toBe(false);
    expect(isSafeInput("    ")).toBe(false);
  });

  it("rejects input longer than 60 characters", () => {
    expect(isSafeInput("a".repeat(61))).toBe(false);
  });

  it("rejects input with no real letters", () => {
    expect(isSafeInput("123 !!!")).toBe(false);
    expect(isSafeInput("---")).toBe(false);
  });

  it("rejects keyboard-mashing (4+ identical consecutive chars)", () => {
    expect(isSafeInput("aaaa")).toBe(false);
    expect(isSafeInput("perrrro")).toBe(false);
  });
});
