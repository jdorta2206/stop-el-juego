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

test("normalization preserves ñ and meaningful accent distinctions", () => {
  assert.equal(normalizeLexicalForm("ÑU"), "ñu");
  assert.notEqual(normalizeLexicalForm("año"), normalizeLexicalForm("ano"));
  assert.notEqual(normalizeLexicalForm("sí"), normalizeLexicalForm("si"));
  assert.notEqual(normalizeLexicalForm("él"), normalizeLexicalForm("el"));
});

test("normalization equates canonically equivalent composed and decomposed accents", () => {
  assert.equal(normalizeLexicalForm("café"), normalizeLexicalForm("cafe\u0301"));
  assert.equal(normalizeLexicalForm("pingüino"), normalizeLexicalForm("pingu\u0308ino"));
});

test("accent distinctions are enforced by exact lexical lookup", () => {
  const evidence: LexicalEvidence[] = [{
    sourceId: "fixture-es-001",
    normalizedForm: "sí",
    language: "es",
    locale: "es-ES",
    sourceVersion: "fixture-1",
    reviewed: true,
  }];
  assert.equal(decideLexicalStatus("sí", "es", evidence).status, "valid");
  assert.equal(decideLexicalStatus("si", "es", evidence).status, "unknown");
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


import { auditLexicalDiscrepancies } from "./source-registry";

test("approved and rejected attestations for the same locale and sense are blocked as a conflict", () => {
  const rejected = { ...lexicalRecord, recordId: "lex-rejected", sourceId: "source-002", reviewStatus: "rejected" as const };
  const audit = auditLexicalDiscrepancies([lexicalRecord, rejected]);
  assert.equal(audit.groups[0].status, "conflict");
  assert.deepEqual(audit.publishableRecordIds, []);
  assert.deepEqual(audit.blockedRecordIds, ["lex-001", "lex-rejected"]);
});

test("pending independent evidence blocks publication until reviewed", () => {
  const pending = { ...lexicalRecord, recordId: "lex-pending", sourceId: "source-002", reviewStatus: "pending" as const };
  const audit = auditLexicalDiscrepancies([lexicalRecord, pending]);
  assert.equal(audit.groups[0].status, "pending_review");
  assert.deepEqual(audit.publishableRecordIds, []);
});

test("different regional locales are not treated as contradictory evidence", () => {
  const regional = { ...lexicalRecord, recordId: "lex-es", sourceId: "source-es", locale: "es-ES" };
  const audit = auditLexicalDiscrepancies([lexicalRecord, regional]);
  assert.equal(audit.groups.length, 2);
  assert.ok(audit.groups.every((group) => group.status === "approved"));
  assert.equal(audit.publishableRecordIds.length, 2);
});

test("homographs in different languages and distinct parts of speech remain separate", () => {
  const portuguese = { ...lexicalRecord, recordId: "lex-pt", language: "pt", locale: "pt-BR" };
  const noun = { ...lexicalRecord, recordId: "lex-noun", partOfSpeech: "noun" };
  const verb = { ...lexicalRecord, recordId: "lex-verb", partOfSpeech: "verb" };
  const audit = auditLexicalDiscrepancies([lexicalRecord, portuguese, noun, verb]);
  assert.equal(audit.groups.length, 4);
  assert.ok(audit.groups.every((group) => group.status === "approved"));
});

test("different definition summaries alone do not create an automatic conflict", () => {
  const otherMeaning = { ...lexicalRecord, recordId: "lex-meaning-2", sourceId: "source-002", definitionSummary: "Another documented meaning" };
  const audit = auditLexicalDiscrepancies([lexicalRecord, otherMeaning]);
  assert.equal(audit.groups.length, 1);
  assert.equal(audit.groups[0].status, "approved");
});

test("homographs with the same spelling and part of speech stay separate by curated sense", () => {
  const commonNoun = {
    ...lexicalRecord,
    recordId: "lex-banco-finance",
    partOfSpeech: "noun",
    senseKey: "financial-institution",
    definitionSummary: "Financial institution",
  };
  const seatNoun = {
    ...lexicalRecord,
    recordId: "lex-banco-seat",
    partOfSpeech: "noun",
    senseKey: "long-seat",
    definitionSummary: "Long seat for several people",
  };
  const audit = auditLexicalDiscrepancies([commonNoun, seatNoun]);
  assert.equal(audit.groups.length, 2);
  assert.deepEqual(
    audit.groups.map((group) => group.senseKey).sort(),
    ["financial-institution", "long-seat"],
  );
  assert.deepEqual(audit.publishableRecordIds.sort(), ["lex-banco-finance", "lex-banco-seat"]);
});

test("independent attestations for the same curated sense remain grouped", () => {
  const source2 = { ...lexicalRecord, recordId: "lex-banco-2", sourceId: "source-002", partOfSpeech: "noun", senseKey: "financial-institution" };
  const source1 = { ...lexicalRecord, partOfSpeech: "noun", senseKey: "financial-institution" };
  const audit = auditLexicalDiscrepancies([source1, source2]);
  assert.equal(audit.groups.length, 1);
  assert.deepEqual(audit.groups[0].recordIds.sort(), ["lex-001", "lex-banco-2"]);
});


import { buildDictionaryImportPlan } from "./dictionary-import";

const approvedCategoryRecord = {
  recordId: "cat-import-001",
  lexicalRecordId: "lex-001",
  normalizedForm: "carro",
  categoryId: "vehicle",
  citationLocator: "entry:carro#vehicle",
  reviewStatus: "approved" as const,
  reviewedBy: "category-reviewer",
  reviewedAt: "2026-11-27T10:15:00Z",
};

test("dictionary import plan includes only fully approved lexical and category evidence", () => {
  const plan = buildDictionaryImportPlan(
    [{ lexicalRecordId: "lex-001", categoryRecordId: "cat-import-001" }],
    [sourceRecord],
    [lexicalRecord],
    [approvedCategoryRecord],
  );
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].form, "carro");
  assert.equal(plan.entries[0].locale, "es-MX");
  assert.deepEqual(plan.rejected, []);
});

test("dictionary import plan blocks pending category evidence", () => {
  const plan = buildDictionaryImportPlan(
    [{ lexicalRecordId: "lex-001", categoryRecordId: "cat-pending" }],
    [sourceRecord],
    [lexicalRecord],
    [{ ...approvedCategoryRecord, recordId: "cat-pending", reviewStatus: "pending" }],
  );
  assert.equal(plan.entries.length, 0);
  assert.ok(plan.rejected[0].reasons.includes("category_evidence_not_approved"));
});

test("dictionary import plan blocks lexical evidence with unresolved discrepancies", () => {
  const rejectedLexical = {
    ...lexicalRecord,
    recordId: "lex-rejected-import",
    reviewStatus: "rejected" as const,
    reviewedBy: undefined,
    reviewedAt: undefined,
  };
  const secondSource = {
    ...sourceRecord,
    sourceId: "source-002",
    referenceUrl: "https://example.org/dictionary-2",
  };
  const plan = buildDictionaryImportPlan(
    [{ lexicalRecordId: "lex-001", categoryRecordId: "cat-import-001" }],
    [sourceRecord, secondSource],
    [lexicalRecord, rejectedLexical],
    [approvedCategoryRecord],
  );
  assert.equal(plan.entries.length, 0);
  assert.ok(plan.rejected[0].reasons.includes("lexical_discrepancy_not_cleared"));
});

test("dictionary import plan rejects duplicate candidate entries", () => {
  const plan = buildDictionaryImportPlan(
    [
      { lexicalRecordId: "lex-001", categoryRecordId: "cat-import-001" },
      { lexicalRecordId: "lex-001", categoryRecordId: "cat-import-001" },
    ],
    [sourceRecord],
    [lexicalRecord],
    [approvedCategoryRecord],
  );
  assert.equal(plan.entries.length, 1);
  assert.ok(plan.rejected[0].reasons.includes("duplicate_dictionary_entry"));
});

test("dictionary import plan rejects missing or ambiguous evidence references", () => {
  const plan = buildDictionaryImportPlan(
    [{ lexicalRecordId: "missing", categoryRecordId: "missing-category" }],
    [sourceRecord],
    [lexicalRecord],
    [approvedCategoryRecord],
  );
  assert.equal(plan.entries.length, 0);
  assert.ok(plan.rejected[0].reasons.includes("lexical_record_missing_or_ambiguous"));
  assert.ok(plan.rejected[0].reasons.includes("category_record_missing_or_ambiguous"));
});
