/**
 * Auditable provenance records. These schemas store references and review
 * decisions; they do not import, scrape, or redistribute dictionary content.
 */

export interface LexicalSourceRecord {
  sourceId: string;
  title: string;
  provider: string;
  referenceUrl: string;
  licenseId: string;
  licenseUrl?: string;
  attribution: string;
  language: string;
  locale: string;
  edition: string;
  retrievedAt: string;
}

export interface LexicalAttestationRecord {
  recordId: string;
  sourceId: string;
  form: string;
  normalizedForm: string;
  language: string;
  locale: string;
  citationLocator: string;
  definitionSummary?: string;
  partOfSpeech?: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface CategoryAttestationRecord {
  recordId: string;
  lexicalRecordId: string;
  normalizedForm: string;
  categoryId: string;
  citationLocator: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

export type RegistryValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validTimestamp = (value: string): boolean =>
  /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

const validHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Source metadata must be complete before any record can cite it. */
export function validateLexicalSource(source: LexicalSourceRecord): RegistryValidation {
  const errors: string[] = [];
  for (const field of ["sourceId", "title", "provider", "licenseId", "attribution", "language", "locale", "edition"] as const) {
    if (!nonBlank(source[field])) errors.push(field + "_required");
  }
  if (!nonBlank(source.referenceUrl) || !validHttpsUrl(source.referenceUrl)) errors.push("referenceUrl_must_be_https");
  if (source.licenseUrl !== undefined && !validHttpsUrl(source.licenseUrl)) errors.push("licenseUrl_must_be_https");
  if (!nonBlank(source.retrievedAt) || !validTimestamp(source.retrievedAt)) errors.push("retrievedAt_must_be_utc_iso_timestamp");
  return errors.length ? { valid: false, errors } : { valid: true };
}

/** Approval requires a real source reference, a precise locator and reviewer audit data. */
export function validateLexicalAttestation(
  record: LexicalAttestationRecord,
  sources: readonly LexicalSourceRecord[],
): RegistryValidation {
  const errors: string[] = [];
  const source = sources.find((item) => item.sourceId === record.sourceId);
  if (!source || !validateLexicalSource(source).valid) errors.push("source_not_registered_or_invalid");
  if (!nonBlank(record.recordId)) errors.push("recordId_required");
  if (!nonBlank(record.form) || !nonBlank(record.normalizedForm)) errors.push("form_required");
  if (!nonBlank(record.language) || !nonBlank(record.locale)) errors.push("language_and_locale_required");
  if (source && (record.language !== source.language || record.locale !== source.locale)) errors.push("source_language_locale_mismatch");
  if (!nonBlank(record.citationLocator)) errors.push("citationLocator_required");
  if (!["pending", "approved", "rejected"].includes(record.reviewStatus)) errors.push("reviewStatus_invalid");
  if (record.reviewStatus === "approved") {
    if (!nonBlank(record.reviewedBy)) errors.push("reviewedBy_required_for_approval");
    if (!nonBlank(record.reviewedAt) || !validTimestamp(record.reviewedAt)) errors.push("reviewedAt_required_for_approval");
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/** Category proof is a separate reviewed claim and must point to a lexical record. */
export function validateCategoryAttestation(
  record: CategoryAttestationRecord,
  lexicalRecords: readonly LexicalAttestationRecord[],
): RegistryValidation {
  const errors: string[] = [];
  const lexical = lexicalRecords.find((item) => item.recordId === record.lexicalRecordId);
  if (!lexical || lexical.reviewStatus !== "approved") errors.push("approved_lexical_record_required");
  if (!nonBlank(record.recordId) || !nonBlank(record.normalizedForm) || !nonBlank(record.categoryId)) errors.push("category_record_fields_required");
  if (lexical && record.normalizedForm !== lexical.normalizedForm) errors.push("category_form_mismatch");
  if (!nonBlank(record.citationLocator)) errors.push("citationLocator_required");
  if (!["pending", "approved", "rejected"].includes(record.reviewStatus)) errors.push("reviewStatus_invalid");
  if (record.reviewStatus === "approved") {
    if (!nonBlank(record.reviewedBy)) errors.push("reviewedBy_required_for_approval");
    if (!nonBlank(record.reviewedAt) || !validTimestamp(record.reviewedAt)) errors.push("reviewedAt_required_for_approval");
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}
