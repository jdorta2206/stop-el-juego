import {
  type CategoryEvidence,
  type LexicalEvidence,
} from "./index";
import {
  validateCategoryAttestation,
  validateLexicalAttestation,
  validateLexicalCorpus,
  validateLexicalSource,
  type CategoryAttestationRecord,
  type LexicalAttestationRecord,
  type LexicalSourceRecord,
} from "./source-registry";

export interface ReviewedEvidenceBundle {
  valid: boolean;
  lexicalEvidence: LexicalEvidence[];
  categoryEvidence: CategoryEvidence[];
  errors: string[];
}

/**
 * The only supported bridge from auditable registry records to compact
 * decision primitives. It preserves the lexicalRecordId -> category claim
 * relationship and never promotes pending/rejected records.
 */
export function buildReviewedEvidenceBundle(
  sources: readonly LexicalSourceRecord[],
  lexicalRecords: readonly LexicalAttestationRecord[],
  categoryRecords: readonly CategoryAttestationRecord[],
): ReviewedEvidenceBundle {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (sourceIds.has(source.sourceId)) errors.push("duplicate_source_id");
    sourceIds.add(source.sourceId);
    const result = validateLexicalSource(source);
    if (!result.valid) errors.push(...result.errors);
  }

  const corpus = validateLexicalCorpus(lexicalRecords, sources);
  if (!corpus.valid) errors.push(...corpus.errors);

  const lexicalById = new Map<string, LexicalAttestationRecord>();
  for (const record of lexicalRecords) {
    if (lexicalById.has(record.recordId)) errors.push("duplicate_lexical_record_id");
    lexicalById.set(record.recordId, record);
    const result = validateLexicalAttestation(record, sources);
    if (!result.valid) errors.push(...result.errors);
  }

  const lexicalEvidence: LexicalEvidence[] = [];
  for (const record of lexicalRecords) {
    if (record.reviewStatus !== "approved") continue;
    const source = sources.find((item) => item.sourceId === record.sourceId);
    if (!source || source.reviewStatus !== "approved") continue;
    lexicalEvidence.push({
      sourceId: record.recordId,
      normalizedForm: record.normalizedForm,
      language: record.language,
      locale: record.locale,
      sourceVersion: source.edition,
      reviewed: true,
    });
  }

  const categoryEvidence: CategoryEvidence[] = [];
  const categoryIds = new Set<string>();
  const categoryClaims = new Set<string>();
  for (const record of categoryRecords) {
    if (categoryIds.has(record.recordId)) errors.push("duplicate_category_record_id");
    categoryIds.add(record.recordId);
    const claimKey = `${record.lexicalRecordId}\\u0000${record.categoryId}`;
    if (categoryClaims.has(claimKey)) errors.push("duplicate_category_attestation");
    categoryClaims.add(claimKey);
    const validation = validateCategoryAttestation(record, lexicalRecords);
    if (!validation.valid) errors.push(...validation.errors);
    if (record.reviewStatus !== "approved") continue;
    const lexical = lexicalById.get(record.lexicalRecordId);
    if (!lexical || lexical.reviewStatus !== "approved" ||
        lexical.normalizedForm !== record.normalizedForm) continue;
    categoryEvidence.push({
      normalizedForm: record.normalizedForm,
      category: record.categoryId,
      sourceId: lexical.recordId,
      reviewed: true,
    });
  }

  const uniqueErrors = [...new Set(errors)];
  return {
    valid: uniqueErrors.length === 0,
    lexicalEvidence: uniqueErrors.length === 0 ? lexicalEvidence : [],
    categoryEvidence: uniqueErrors.length === 0 ? categoryEvidence : [],
    errors: uniqueErrors,
  };
}
