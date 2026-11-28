import test from "node:test";
import assert from "node:assert/strict";
import { decideCategoryForLexicalRecord, type SenseBoundCategoryEvidence } from "./sense-category";

const evidence: SenseBoundCategoryEvidence[] = [
  {
    lexicalRecordId: "lex-guache-coati",
    normalizedForm: "guache",
    categoryId: "animal",
    sourceId: "reviewed-source-coati",
    reviewed: true,
  },
  {
    lexicalRecordId: "lex-guache-person",
    normalizedForm: "guache",
    categoryId: "persona",
    sourceId: "reviewed-source-person",
    reviewed: true,
  },
];

test("category evidence applies only to the exact lexical sense record", () => {
  assert.deepEqual(
    decideCategoryForLexicalRecord("lex-guache-coati", "guache", "animal", evidence),
    { eligible: true, reason: "category_attested" },
  );
  assert.deepEqual(
    decideCategoryForLexicalRecord("lex-guache-person", "guache", "animal", evidence),
    { eligible: false, reason: "category_not_attested" },
  );
});

test("evidence for a different sense cannot authorize this sense", () => {
  assert.deepEqual(
    decideCategoryForLexicalRecord("lex-guache-unknown", "guache", "animal", evidence),
    { eligible: null, reason: "category_evidence_missing" },
  );
});

test("unreviewed or mismatched-form category evidence cannot authorize a sense", () => {
  const pending = [{ ...evidence[0], reviewed: false }];
  assert.deepEqual(
    decideCategoryForLexicalRecord("lex-guache-coati", "guache", "animal", pending),
    { eligible: null, reason: "category_evidence_missing" },
  );
  const wrongForm = [{ ...evidence[0], normalizedForm: "guacha" }];
  assert.deepEqual(
    decideCategoryForLexicalRecord("lex-guache-coati", "guache", "animal", wrongForm),
    { eligible: null, reason: "category_evidence_missing" },
  );
});

test("missing lexical record identity fails closed", () => {
  assert.deepEqual(
    decideCategoryForLexicalRecord("", "guache", "animal", evidence),
    { eligible: null, reason: "lexical_record_missing" },
  );
});
