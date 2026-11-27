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

import {
  validateCategoryAttestation,
  validateLexicalAttestation,
  validateLexicalSource,
  type LexicalSourceRecord,
  type LexicalAttestationRecord,
} from "./source-registry";

const sourceRecord: LexicalSourceRecord = {
  sourceId: "source-001",
  title: "Reference dictionary",
  provider: "Publisher",
  referenceUrl: "https://example.org/dictionary",
  licenseId: "license-reviewed-separately",
  licenseUrl: "https://example.org/license",
  attribution: "Attribution text required by the source license",
  language: "es",
  locale: "es-MX",
  edition: "2026",
  retrievedAt: "2026-11-27T10:00:00Z",
};

const lexicalRecord: LexicalAttestationRecord = {
  recordId: "lex-001",
  sourceId: "source-001",
  form: "carro",
  normalizedForm: "carro",
  language: "es",
  locale: "es-MX",
  citationLocator: "entry:carro",
  reviewStatus: "approved",
  reviewedBy: "reviewer-id",
  reviewedAt: "2026-11-27T10:05:00Z",
};

test("source registry rejects missing provenance and license metadata", () => {
  const result = validateLexicalSource({ ...sourceRecord, licenseId: "", edition: "" });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.includes("licenseId_required"));
    assert.ok(result.errors.includes("edition_required"));
  }
});

test("approved lexical attestation requires registered source and review audit", () => {
  assert.equal(validateLexicalAttestation(lexicalRecord, [sourceRecord]).valid, true);
  const unreviewed = { ...lexicalRecord, reviewedBy: "", reviewedAt: "" };
  const result = validateLexicalAttestation(unreviewed, [sourceRecord]);
  assert.equal(result.valid, false);
});

test("category approval cannot substitute for missing lexical approval", () => {
  const category = {
    recordId: "cat-001",
    lexicalRecordId: "lex-001",
    normalizedForm: "carro",
    categoryId: "vehicle",
    citationLocator: "entry:carro#vehicle",
    reviewStatus: "approved" as const,
    reviewedBy: "reviewer-id",
    reviewedAt: "2026-11-27T10:10:00Z",
  };
  assert.equal(validateCategoryAttestation(category, [{ ...lexicalRecord, reviewStatus: "pending" }]).valid, false);
  assert.equal(validateCategoryAttestation(category, [lexicalRecord]).valid, true);
});

test("category attestation must match the exact lexical form", () => {
  const category = {
    recordId: "cat-002",
    lexicalRecordId: "lex-001",
    normalizedForm: "carroinventado",
    categoryId: "vehicle",
    citationLocator: "entry:carro#vehicle",
    reviewStatus: "pending" as const,
  };
  const result = validateCategoryAttestation(category, [lexicalRecord]);
  assert.equal(result.valid, false);
});

test("approved lexical record cannot claim a different normalized spelling", () => {
  const result = validateLexicalAttestation(
    { ...lexicalRecord, normalizedForm: "carroinventado" },
    [sourceRecord],
  );
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("normalized_form_does_not_match_form"));
});

test("source retrieval timestamp must be a UTC ISO timestamp", () => {
  const result = validateLexicalSource({ ...sourceRecord, retrievedAt: "yesterday" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("retrievedAt_must_be_utc_iso_timestamp"));
});
