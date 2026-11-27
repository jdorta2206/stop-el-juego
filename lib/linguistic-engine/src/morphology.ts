import { normalizeLexicalForm } from "./index";
import { validateLexicalAttestation, validateLexicalSource, type LexicalAttestationRecord, type LexicalSourceRecord } from "./source-registry";

export interface MorphologicalAttestationRecord {
  recordId: string;
  /** Exact surface-form lexical record, e.g. "cantamos". */
  formRecordId: string;
  /** Reviewed lemma lexical record, e.g. "cantar". */
  lemmaRecordId: string;
  sourceId: string;
  language: string;
  locale: string;
  grammaticalFeatures: string[];
  citationLocator: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

export type MorphologyValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

const ALLOWED_FEATURES = new Set([
  "number:singular", "number:plural",
  "gender:masculine", "gender:feminine", "gender:common",
  "person:first", "person:second", "person:third",
  "tense:present", "tense:past", "tense:future", "tense:imperfect", "tense:preterite", "tense:conditional",
  "mood:indicative", "mood:subjunctive", "mood:imperative", "mood:infinitive", "mood:gerund", "mood:participle",
  "degree:positive", "degree:comparative", "degree:superlative",
  "form:affirmative", "form:negative", "form:clitic",
]);

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validUtcTimestamp = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
};

/**
 * Validates an explicitly attested surface-form -> lemma relationship.
 * This module never generates conjugations or guesses morphology from suffixes.
 */
export function validateMorphologicalAttestation(
  record: MorphologicalAttestationRecord,
  lexicalRecords: readonly LexicalAttestationRecord[],
  sources: readonly LexicalSourceRecord[],
): MorphologyValidation {
  const errors: string[] = [];
  const forms = lexicalRecords.filter((item) => item.recordId === record.formRecordId);
  const lemmas = lexicalRecords.filter((item) => item.recordId === record.lemmaRecordId);
  const sourceMatches = sources.filter((item) => item.sourceId === record.sourceId);

  if (forms.length !== 1) errors.push("surface_form_record_missing_or_ambiguous");
  if (lemmas.length !== 1) errors.push("lemma_record_missing_or_ambiguous");
  if (sourceMatches.length !== 1) errors.push("morphology_source_missing_or_ambiguous");

  const form = forms[0];
  const lemma = lemmas[0];
  const source = sourceMatches[0];

  if (form && form.reviewStatus !== "approved") errors.push("surface_form_not_approved");
  if (lemma && lemma.reviewStatus !== "approved") errors.push("lemma_not_approved");
  if (form && !validateLexicalAttestation(form, sources).valid) errors.push("surface_form_lexical_evidence_invalid");
  if (lemma && !validateLexicalAttestation(lemma, sources).valid) errors.push("lemma_lexical_evidence_invalid");
  if (source && (!validateLexicalSource(source).valid || source.reviewStatus !== "approved" || source.language !== record.language || source.locale !== record.locale)) {
    errors.push("morphology_source_not_approved_for_locale");
  }
  if (form && (form.language !== record.language || form.locale !== record.locale)) {
    errors.push("surface_form_language_locale_mismatch");
  }
  if (lemma && (lemma.language !== record.language || lemma.locale !== record.locale)) {
    errors.push("lemma_language_locale_mismatch");
  }
  if (form && lemma && form.recordId === lemma.recordId) errors.push("surface_form_and_lemma_must_be_distinct_records");

  if (!nonBlank(record.recordId) || !nonBlank(record.formRecordId) ||
      !nonBlank(record.lemmaRecordId) || !nonBlank(record.sourceId)) {
    errors.push("morphology_identifiers_required");
  }
  if (!nonBlank(record.language) || !/^[a-z]{2}-[A-Z]{2}$/.test(record.locale) ||
      !record.locale.startsWith(record.language + "-")) {
    errors.push("morphology_language_locale_invalid");
  }
  if (!Array.isArray(record.grammaticalFeatures) || record.grammaticalFeatures.length === 0 ||
      record.grammaticalFeatures.some((item) => !nonBlank(item))) {
    errors.push("grammatical_features_required");
  } else {
    if (new Set(record.grammaticalFeatures).size !== record.grammaticalFeatures.length) {
      errors.push("duplicate_grammatical_feature");
    }
    if (record.grammaticalFeatures.some((item) => !ALLOWED_FEATURES.has(item))) {
      errors.push("unsupported_grammatical_feature");
    }
    for (const dimension of ["number", "gender", "person", "tense", "mood", "degree"]) {
      const values = record.grammaticalFeatures.filter((item) => item.startsWith(dimension + ":"));
      if (values.length > 1) errors.push("conflicting_" + dimension + "_features");
    }
  }
  if (!nonBlank(record.citationLocator) || record.citationLocator.trim().length < 3) {
    errors.push("morphology_citation_required");
  }
  if (!["pending", "approved", "rejected"].includes(record.reviewStatus)) {
    errors.push("morphology_review_status_invalid");
  }
  if (record.reviewStatus === "approved" &&
      (!nonBlank(record.reviewedBy) || !nonBlank(record.reviewedAt) ||
       !validUtcTimestamp(record.reviewedAt))) {
    errors.push("morphology_review_audit_required");
  }

  // Ensure the referenced surface and lemma records really contain the forms
  // described by their own attestations; never infer a relationship by spelling.
  if (form && normalizeLexicalForm(form.form) !== form.normalizedForm) {
    errors.push("surface_form_record_normalization_invalid");
  }
  if (lemma && normalizeLexicalForm(lemma.form) !== lemma.normalizedForm) {
    errors.push("lemma_record_normalization_invalid");
  }

  return errors.length ? { valid: false, errors: [...new Set(errors)] } : { valid: true };
}
