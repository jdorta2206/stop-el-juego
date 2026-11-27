/**
 * Deterministic, evidence-first primitives for STOP word validation.
 *
 * This package deliberately does not decide lexical truth from a bare string,
 * call an AI model, or award points. Callers must supply reviewed lexical
 * evidence and evaluate category/game rules separately.
 */

export type LexicalStatus = "valid" | "invalid" | "unknown";

export interface LexicalEvidence {
  /** Stable identifier of the reviewed source record. */
  sourceId: string;
  /** Exact normalized form attested by that source. */
  normalizedForm: string;
  /** Language code, e.g. es, en, pt, fr. */
  language: string;
  /** Source locale, e.g. es-ES or es-MX. */
  locale: string;
  /** Version or edition of the source dataset. */
  sourceVersion: string;
  /** Review state is explicit; unreviewed candidates are not evidence. */
  reviewed: boolean;
}

export interface LexicalDecision {
  status: LexicalStatus;
  evidence: LexicalEvidence | null;
  reason: "attested_exact_form" | "no_attestation" | "invalid_input" | "language_mismatch";
}

/** Normalize conservatively for lookup while preserving ñ as a distinct letter. */
export function normalizeLexicalForm(value: string): string {
  return value.toLocaleLowerCase("und").trim()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/~/g, "ñ")
    .normalize("NFC");
}

export function isLexicallySafeInput(value: string): boolean {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 60) return false;
  if (!/[\p{L}]/u.test(value)) return false;
  if (/(.)\1{3,}/u.test(value.toLocaleLowerCase("und"))) return false;
  return true;
}

/**
 * Exact-form lookup only. Prefixes, plausible morphology and AI opinions never
 * count as lexical evidence. Missing evidence is unknown, not "invented".
 */
export function decideLexicalStatus(
  value: string,
  language: string,
  evidence: readonly LexicalEvidence[],
): LexicalDecision {
  if (!isLexicallySafeInput(value)) {
    return { status: "invalid", evidence: null, reason: "invalid_input" };
  }

  const normalizedForm = normalizeLexicalForm(value);
  const matchingForm = evidence.find((item) =>
    item.reviewed && item.normalizedForm === normalizedForm && item.language === language
  );

  if (!matchingForm) {
    const otherLanguageMatch = evidence.some((item) =>
      item.reviewed && item.normalizedForm === normalizedForm
    );
    return {
      status: "unknown",
      evidence: null,
      reason: otherLanguageMatch ? "language_mismatch" : "no_attestation",
    };
  }

  return {
    status: "valid",
    evidence: matchingForm,
    reason: "attested_exact_form",
  };
}


export interface CategoryEvidence {
  /** Exact normalized form covered by this category record. */
  normalizedForm: string;
  /** Canonical STOP category identifier. */
  category: string;
  /** Same source record that supports the lexical form. */
  sourceId: string;
  reviewed: boolean;
}

export interface CategoryDecision {
  eligible: boolean | null;
  reason: "category_attested" | "category_not_attested" | "category_evidence_missing";
}

/**
 * Category membership is independent from lexical existence.
 * null means not enough reviewed category evidence; it must never award points.
 */
export function decideCategoryEligibility(
  value: string,
  category: string,
  evidence: readonly CategoryEvidence[],
): CategoryDecision {
  if (!isLexicallySafeInput(value) || !category.trim()) {
    return { eligible: false, reason: "category_not_attested" };
  }

  const normalizedForm = normalizeLexicalForm(value);
  const normalizedCategory = normalizeLexicalForm(category);
  const reviewedMatch = evidence.some((item) =>
    item.reviewed &&
    item.normalizedForm === normalizedForm &&
    normalizeLexicalForm(item.category) === normalizedCategory &&
    item.sourceId.trim().length > 0
  );

  if (reviewedMatch) {
    return { eligible: true, reason: "category_attested" };
  }

  const hasReviewedLexicalCategoryRecord = evidence.some((item) =>
    item.reviewed && item.normalizedForm === normalizedForm
  );

  return hasReviewedLexicalCategoryRecord
    ? { eligible: false, reason: "category_not_attested" }
    : { eligible: null, reason: "category_evidence_missing" };
}
