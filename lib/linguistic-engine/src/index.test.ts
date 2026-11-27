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
  validateLexicalCorpus,
  type LexicalSourceRecord,
  type LexicalAttestationRecord,
} from "./source-registry";

const sourceRecord: LexicalSourceRecord = {
  sourceId: "source-001",
  title: "Reference dictionary",
  provider: "Publisher",
  referenceUrl: "https://example.org/dictionary",
  licenseId: "MIT",
  licenseUrl: "https://example.org/license",
  attribution: "Attribution text required by the source license",
  language: "es",
  locale: "es-MX",
  edition: "2026",
  retrievedAt: "2026-11-27T10:00:00Z",
  reviewStatus: "approved",
  commercialUse: true,
  modification: true,
  redistribution: true,
  shareAlike: false,
  thirdPartyContent: "none-known",
  reviewedBy: "legal-reviewer",
  reviewedAt: "2026-11-27T09:55:00Z",
  approvalReference: "LEGAL-STOP-001",
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

test("approved lexical attestation requires registered and approved source rights", () => {
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

test("candidate source cannot authorize an approved lexical word", () => {
  const candidateSource = { ...sourceRecord, reviewStatus: "candidate" as const };
  const result = validateLexicalAttestation(lexicalRecord, [candidateSource]);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("source_not_registered_or_approved"));
});

test("source approval rejects incompatible licenses and missing commercial rights", () => {
  const incompatible = validateLexicalSource({ ...sourceRecord, licenseId: "GPL-3.0-or-later" });
  assert.equal(incompatible.valid, false);
  if (!incompatible.valid) assert.ok(incompatible.errors.includes("license_not_approved_for_stop_bundle"));
  const noModification = validateLexicalSource({ ...sourceRecord, modification: false });
  assert.equal(noModification.valid, false);
  if (!noModification.valid) assert.ok(noModification.errors.includes("approved_source_requires_commercial_modification_and_redistribution_rights"));
});

test("source approval requires a human audit record and audited third-party content", () => {
  const noReviewer = validateLexicalSource({ ...sourceRecord, reviewedBy: "", approvalReference: "" });
  assert.equal(noReviewer.valid, false);
  const unknownThirdParty = validateLexicalSource({ ...sourceRecord, thirdPartyContent: "unknown" });
  assert.equal(unknownThirdParty.valid, false);
});

test("lexical evidence cannot be approved from a malformed citation locator", () => {
  const result = validateLexicalAttestation({ ...lexicalRecord, citationLocator: " " }, [sourceRecord]);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("citationLocator_required"));
});

test("source approval rejects impossible UTC calendar timestamps", () => {
  const result = validateLexicalSource({ ...sourceRecord, reviewedAt: "2026-02-30T10:00:00Z" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("source_approval_audit_required"));
});


test("source registry rejects duplicate source identifiers", () => {
  const result = validateLexicalAttestation(lexicalRecord, [sourceRecord, sourceRecord]);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("duplicate_source_id"));
});

test("source registry rejects licenses outside the bundle allowlist", () => {
  const result = validateLexicalSource({ ...sourceRecord, licenseId: "GPL-3.0-or-later" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("license_not_approved_for_stop_bundle"));
});

test("lexical evidence rejects duplicate record IDs and repeated citations", () => {
  const duplicateId = validateLexicalAttestation(lexicalRecord, [sourceRecord], [lexicalRecord]);
  assert.equal(duplicateId.valid, false);
  if (!duplicateId.valid) assert.ok(duplicateId.errors.includes("duplicate_lexical_record_id"));
  const duplicateCitation = validateLexicalAttestation({ ...lexicalRecord, recordId: "lex-002" }, [sourceRecord], [lexicalRecord]);
  assert.equal(duplicateCitation.valid, false);
  if (!duplicateCitation.valid) assert.ok(duplicateCitation.errors.includes("duplicate_lexical_attestation"));
});

test("category evidence rejects duplicate record IDs and duplicate category claims", () => {
  const category = {
    recordId: "cat-003",
    lexicalRecordId: "lex-001",
    normalizedForm: "carro",
    categoryId: "vehicle",
    citationLocator: "entry:carro#vehicle",
    reviewStatus: "approved" as const,
    reviewedBy: "reviewer-id",
    reviewedAt: "2026-11-27T10:10:00Z",
  };
  const duplicateId = validateCategoryAttestation(category, [lexicalRecord], [category]);
  assert.equal(duplicateId.valid, false);
  if (!duplicateId.valid) assert.ok(duplicateId.errors.includes("duplicate_category_record_id"));
  const duplicateClaim = validateCategoryAttestation({ ...category, recordId: "cat-004" }, [lexicalRecord], [category]);
  assert.equal(duplicateClaim.valid, false);
  if (!duplicateClaim.valid) assert.ok(duplicateClaim.errors.includes("duplicate_category_attestation"));
});


test("whole-corpus audit keeps identical spelling separate across regional locales", () => {
  const mexican = { ...lexicalRecord, recordId: "lex-mx", locale: "es-MX" };
  const spanishSource = { ...sourceRecord, sourceId: "source-es-es", locale: "es-ES", referenceUrl: "https://example.org/es-es" };
  const spanish = { ...lexicalRecord, recordId: "lex-es", sourceId: "source-es-es", locale: "es-ES" };
  const result = validateLexicalCorpus([mexican, spanish], [sourceRecord, spanishSource]);
  assert.equal(result.valid, true);
});

test("whole-corpus audit rejects records whose locale conflicts with their source", () => {
  const mismatched = { ...lexicalRecord, locale: "es-ES" };
  const result = validateLexicalCorpus([mismatched], [sourceRecord]);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("source_language_locale_mismatch"));
});

test("whole-corpus audit rejects duplicate evidence IDs and missing sources", () => {
  const duplicate = { ...lexicalRecord };
  const duplicateResult = validateLexicalCorpus([lexicalRecord, duplicate], [sourceRecord]);
  assert.equal(duplicateResult.valid, false);
  if (!duplicateResult.valid) assert.ok(duplicateResult.errors.includes("duplicate_lexical_record_id"));
  const missingSource = validateLexicalCorpus([{ ...lexicalRecord, sourceId: "missing-source" }], [sourceRecord]);
  assert.equal(missingSource.valid, false);
  if (!missingSource.valid) assert.ok(missingSource.errors.includes("source_not_registered"));
});

test("same spelling in separate languages remains separate and does not cross-validate", () => {
  const portugueseSource = { ...sourceRecord, sourceId: "source-pt-br", language: "pt", locale: "pt-BR", referenceUrl: "https://example.org/pt-br" };
  const portugueseRecord = { ...lexicalRecord, recordId: "lex-pt", sourceId: "source-pt-br", language: "pt", locale: "pt-BR" };
  assert.equal(validateLexicalCorpus([lexicalRecord, portugueseRecord], [sourceRecord, portugueseSource]).valid, true);
});
