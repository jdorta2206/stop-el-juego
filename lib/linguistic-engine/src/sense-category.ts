/**
 * Sense-bound category decisions.
 *
 * A category attestation belongs to a specific reviewed lexical record, not
 * merely to a spelling. This prevents one homonym/polyseme from lending its
 * category to another sense with the same written form.
 */
export interface SenseBoundCategoryEvidence {
  lexicalRecordId: string;
  normalizedForm: string;
  categoryId: string;
  sourceId: string;
  reviewed: boolean;
}

export interface SenseBoundCategoryDecision {
  eligible: boolean | null;
  reason: "category_attested" | "category_not_attested" | "category_evidence_missing" | "lexical_record_missing";
}

export function decideCategoryForLexicalRecord(
  lexicalRecordId: string,
  normalizedForm: string,
  categoryId: string,
  evidence: readonly SenseBoundCategoryEvidence[],
): SenseBoundCategoryDecision {
  if (!lexicalRecordId.trim()) {
    return { eligible: null, reason: "lexical_record_missing" };
  }
  const form = normalizedForm.trim().toLocaleLowerCase("und").normalize("NFC");
  const category = categoryId.trim().toLocaleLowerCase("und").normalize("NFC");
  if (!form || !category) {
    return { eligible: false, reason: "category_not_attested" };
  }

  const sameRecord = evidence.filter((item) =>
    item.reviewed &&
    item.lexicalRecordId === lexicalRecordId &&
    item.normalizedForm === form &&
    item.sourceId.trim().length > 0
  );

  if (sameRecord.some((item) =>
    item.categoryId.trim().toLocaleLowerCase("und").normalize("NFC") === category
  )) {
    return { eligible: true, reason: "category_attested" };
  }
  if (sameRecord.length > 0) {
    return { eligible: false, reason: "category_not_attested" };
  }
  return { eligible: null, reason: "category_evidence_missing" };
}
