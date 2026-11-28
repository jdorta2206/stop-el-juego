import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewedEvidenceBundle } from "./evidence-adapter";
import type { LexicalSourceRecord, LexicalAttestationRecord, CategoryAttestationRecord } from "./source-registry";

const source: LexicalSourceRecord = {
  sourceId: "source-es-mx",
  title: "Reviewed dictionary",
  provider: "Publisher",
  referenceUrl: "https://example.org/dictionary",
  licenseId: "MIT",
  licenseUrl: "https://example.org/license",
  attribution: "Required attribution",
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
  approvalReference: "LEGAL-001",
};

const lexical: LexicalAttestationRecord = {
  recordId: "lex-carro",
  sourceId: source.sourceId,
  form: "carro",
  normalizedForm: "carro",
  language: "es",
  locale: "es-MX",
  citationLocator: "entry:carro",
  reviewStatus: "approved",
  reviewedBy: "lexical-reviewer",
  reviewedAt: "2026-11-27T10:05:00Z",
};

const category: CategoryAttestationRecord = {
  recordId: "cat-vehicle",
  lexicalRecordId: lexical.recordId,
  normalizedForm: "carro",
  categoryId: "vehicle",
  citationLocator: "entry:carro#vehicle",
  reviewStatus: "approved",
  reviewedBy: "category-reviewer",
  reviewedAt: "2026-11-27T10:10:00Z",
};

test("adapter builds compact evidence only from linked approved registry records", () => {
  const result = buildReviewedEvidenceBundle([source], [lexical], [category]);
  assert.equal(result.valid, true);
  assert.equal(result.lexicalEvidence.length, 1);
  assert.equal(result.lexicalEvidence[0].sourceId, lexical.recordId);
  assert.equal(result.categoryEvidence.length, 1);
  assert.equal(result.categoryEvidence[0].sourceId, lexical.recordId);
});

test("adapter excludes pending lexical and category claims", () => {
  const result = buildReviewedEvidenceBundle(
    [source],
    [{ ...lexical, reviewStatus: "pending" }],
    [{ ...category, reviewStatus: "pending" }],
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.lexicalEvidence, []);
  assert.deepEqual(result.categoryEvidence, []);
});

test("category evidence cannot be attached to a different lexical form", () => {
  const result = buildReviewedEvidenceBundle(
    [source],
    [lexical],
    [{ ...category, normalizedForm: "carroinventado" }],
  );
  assert.equal(result.valid, false);
  assert.deepEqual(result.lexicalEvidence, []);
  assert.deepEqual(result.categoryEvidence, []);
  assert.ok(result.errors.includes("category_form_mismatch"));
});

test("adapter rejects duplicate source identifiers before producing evidence", () => {
  const result = buildReviewedEvidenceBundle([source, source], [lexical], [category]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.lexicalEvidence, []);
  assert.deepEqual(result.categoryEvidence, []);
  assert.ok(result.errors.includes("duplicate_source_id"));
});

test("category claim must reference the exact approved lexical record", () => {
  const result = buildReviewedEvidenceBundle(
    [source],
    [lexical],
    [{ ...category, lexicalRecordId: "different-lexical-record" }],
  );
  assert.equal(result.valid, false);
  assert.deepEqual(result.categoryEvidence, []);
  assert.ok(result.errors.includes("approved_lexical_record_required"));
});
