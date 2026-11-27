import test from "node:test";
import assert from "node:assert/strict";
import {
  decideLexicalStatus,
  decideCategoryEligibility,
  isLexicallySafeInput,
  normalizeLexicalForm,
  type LexicalEvidence,
} from "./index";

const reviewedEvidence: LexicalEvidence[] = [{
  sourceId: "fixture-es-mx-001",
  normalizedForm: "carro",
  language: "es",
  locale: "es-MX",
  sourceVersion: "fixture-1",
  reviewed: true,
}];

test("normalization preserves ñ as distinct from n", () => {
  assert.equal(normalizeLexicalForm("ÑU"), "ñu");
  assert.notEqual(normalizeLexicalForm("año"), normalizeLexicalForm("ano"));
});

test("exact reviewed regional evidence is valid independent of player locale", () => {
  const result = decideLexicalStatus("CARRO", "es", reviewedEvidence);
  assert.equal(result.status, "valid");
  assert.equal(result.evidence?.locale, "es-MX");
});

test("a longer fabricated prefix extension is unknown, not valid", () => {
  assert.equal(decideLexicalStatus("carroinventado", "es", reviewedEvidence).status, "unknown");
});

test("an unreviewed candidate cannot validate a word", () => {
  const candidate = [{ ...reviewedEvidence[0], reviewed: false }];
  assert.equal(decideLexicalStatus("carro", "es", candidate).status, "unknown");
});

test("evidence from another language cannot validate this language", () => {
  assert.equal(decideLexicalStatus("carro", "pt", reviewedEvidence).status, "unknown");
});

test("unsafe inputs are invalid before lexical lookup", () => {
  assert.equal(isLexicallySafeInput(""), false);
  assert.equal(isLexicallySafeInput("aaaa"), false);
  assert.equal(decideLexicalStatus("aaaa", "es", reviewedEvidence).status, "invalid");
});


test("a real word is not automatically valid for every category", () => {
  const categoryEvidence = [{
    normalizedForm: "carro",
    category: "vehiculo",
    sourceId: "reviewed-category-001",
    reviewed: true,
  }];
  assert.deepEqual(
    decideCategoryEligibility("carro", "animal", categoryEvidence),
    { eligible: false, reason: "category_not_attested" },
  );
});

test("missing category evidence remains pending and cannot award points", () => {
  assert.deepEqual(
    decideCategoryEligibility("carro", "vehiculo", []),
    { eligible: null, reason: "category_evidence_missing" },
  );
});

test("reviewed category evidence can authorize the exact category", () => {
  const categoryEvidence = [{
    normalizedForm: "carro",
    category: "vehiculo",
    sourceId: "reviewed-category-001",
    reviewed: true,
  }];
  assert.deepEqual(
    decideCategoryEligibility("CARRO", "VEHICULO", categoryEvidence),
    { eligible: true, reason: "category_attested" },
  );
});
