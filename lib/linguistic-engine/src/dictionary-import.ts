import {
  auditLexicalDiscrepancies,
  validateCategoryAttestation,
  validateLexicalAttestation,
  validateLexicalCorpus,
  type CategoryAttestationRecord,
  type LexicalAttestationRecord,
  type LexicalSourceRecord,
} from "./source-registry";

export interface DictionaryImportCandidate {
  lexicalRecordId: string;
  categoryRecordId: string;
}

export interface DictionaryImportEntry {
  form: string;
  normalizedForm: string;
  language: string;
  locale: string;
  categoryId: string;
  lexicalRecordId: string;
  categoryRecordId: string;
}

export interface DictionaryImportRejection {
  candidate: DictionaryImportCandidate;
  reasons: string[];
}

export interface DictionaryImportPlan {
  entries: DictionaryImportEntry[];
  rejected: DictionaryImportRejection[];
}

/**
 * Builds a deterministic, review-gated import plan. It does not write files,
 * alter the game dictionary, award points, or fetch external sources.
 * Every candidate must have approved source, lexical and category evidence,
 * and must pass the cross-source discrepancy audit.
 */
export function buildDictionaryImportPlan(
  candidates: readonly DictionaryImportCandidate[],
  sources: readonly LexicalSourceRecord[],
  lexicalRecords: readonly LexicalAttestationRecord[],
  categoryRecords: readonly CategoryAttestationRecord[],
): DictionaryImportPlan {
  const entries: DictionaryImportEntry[] = [];
  const rejected: DictionaryImportRejection[] = [];
  const corpusValidation = validateLexicalCorpus(lexicalRecords, sources);
  const discrepancyAudit = auditLexicalDiscrepancies(lexicalRecords);
  const publishedLexicalIds = new Set(discrepancyAudit.publishableRecordIds);
  const importedKeys = new Set<string>();

  for (const candidate of candidates) {
    const reasons: string[] = [];
    const matchingLexical = lexicalRecords.filter((item) => item.recordId === candidate.lexicalRecordId);
    const matchingCategory = categoryRecords.filter((item) => item.recordId === candidate.categoryRecordId);
    const lexical = matchingLexical[0];
    const category = matchingCategory[0];

    if (matchingLexical.length !== 1) reasons.push("lexical_record_missing_or_ambiguous");
    if (matchingCategory.length !== 1) reasons.push("category_record_missing_or_ambiguous");
    if (!corpusValidation.valid) reasons.push("lexical_corpus_integrity_failed");

    if (lexical) {
      if (lexical.reviewStatus !== "approved") reasons.push("lexical_evidence_not_approved");
      if (!publishedLexicalIds.has(lexical.recordId)) reasons.push("lexical_discrepancy_not_cleared");
      const sourceValidation = validateLexicalAttestation(lexical, sources);
      if (!sourceValidation.valid) reasons.push("lexical_source_or_provenance_invalid");
    }

    if (category) {
      if (category.reviewStatus !== "approved") reasons.push("category_evidence_not_approved");
      const categoryValidation = validateCategoryAttestation(category, lexicalRecords);
      if (!categoryValidation.valid) reasons.push("category_evidence_or_provenance_invalid");
    }

    if (lexical && category && category.lexicalRecordId !== lexical.recordId) {
      reasons.push("category_does_not_reference_selected_lexical_record");
    }

    if (lexical && category) {
      const key = [lexical.normalizedForm, lexical.language, lexical.locale, category.categoryId].join("\u0000");
      if (importedKeys.has(key)) reasons.push("duplicate_dictionary_entry");
      if (reasons.length === 0) importedKeys.add(key);
    }

    if (reasons.length > 0 || !lexical || !category) {
      rejected.push({ candidate, reasons: [...new Set(reasons)] });
      continue;
    }

    entries.push({
      form: lexical.form,
      normalizedForm: lexical.normalizedForm,
      language: lexical.language,
      locale: lexical.locale,
      categoryId: category.categoryId,
      lexicalRecordId: lexical.recordId,
      categoryRecordId: category.recordId,
    });
  }

  return { entries, rejected };
}
