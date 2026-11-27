import { normalizeLexicalForm } from "./index";

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
  reviewStatus: "candidate" | "blocked" | "approved";
  commercialUse: boolean;
  modification: boolean;
  redistribution: boolean;
  shareAlike: boolean;
  thirdPartyContent: "none-known" | "present-audited" | "present-unaudited" | "unknown";
  reviewedBy?: string;
  reviewedAt?: string;
  approvalReference?: string;
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

const validTimestamp = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const calendarDate = `${match[1]}-${match[2]}-${match[3]}`;
  const parsedDate = new Date(`${calendarDate}T00:00:00Z`);
  return Number.isFinite(Date.parse(value)) &&
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === calendarDate;
};

const validHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
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
  if (!["candidate", "blocked", "approved"].includes(source.reviewStatus)) errors.push("reviewStatus_invalid");
  if (source.reviewStatus === "approved") {
    if (!["0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "ISC", "MIT", "Unlicense"].includes(source.licenseId)) {
      errors.push("license_not_approved_for_stop_bundle");
    }
    if (source.commercialUse !== true || source.modification !== true || source.redistribution !== true) {
      errors.push("approved_source_requires_commercial_modification_and_redistribution_rights");
    }
    if (source.shareAlike !== false) errors.push("share_alike_not_approved_for_proprietary_bundle");
    if (!["none-known", "present-audited"].includes(source.thirdPartyContent)) errors.push("third_party_content_not_audited");
    if (!nonBlank(source.reviewedBy) || !nonBlank(source.approvalReference) ||
        !nonBlank(source.reviewedAt) || !validTimestamp(source.reviewedAt)) {
      errors.push("source_approval_audit_required");
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/** Approval requires a real source reference, a precise locator and reviewer audit data. */
export function validateLexicalAttestation(
  record: LexicalAttestationRecord,
  sources: readonly LexicalSourceRecord[],
): RegistryValidation {
  const errors: string[] = [];
  const source = sources.find((item) => item.sourceId === record.sourceId);
  if (!source || !validateLexicalSource(source).valid || source.reviewStatus !== "approved") errors.push("source_not_registered_or_approved");
  if (!nonBlank(record.recordId)) errors.push("recordId_required");
  if (!nonBlank(record.form) || !nonBlank(record.normalizedForm)) errors.push("form_required");
  if (nonBlank(record.form) && nonBlank(record.normalizedForm) &&
      normalizeLexicalForm(record.form) !== record.normalizedForm) {
    errors.push("normalized_form_does_not_match_form");
  }
  if (!nonBlank(record.language) || !nonBlank(record.locale)) errors.push("language_and_locale_required");
  if (source && (record.language !== source.language || record.locale !== source.locale)) errors.push("source_language_locale_mismatch");
  if (!nonBlank(record.citationLocator) || record.citationLocator.trim().length < 3) errors.push("citationLocator_required");
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
  else if (!nonBlank(lexical.reviewedBy) || !nonBlank(lexical.reviewedAt) || !validTimestamp(lexical.reviewedAt)) errors.push("lexical_record_review_audit_required");
  if (!nonBlank(record.recordId) || !nonBlank(record.normalizedForm) || !nonBlank(record.categoryId)) errors.push("category_record_fields_required");
  if (lexical && record.normalizedForm !== lexical.normalizedForm) errors.push("category_form_mismatch");
  if (!nonBlank(record.citationLocator) || record.citationLocator.trim().length < 3) errors.push("citationLocator_required");
  if (!["pending", "approved", "rejected"].includes(record.reviewStatus)) errors.push("reviewStatus_invalid");
  if (record.reviewStatus === "approved") {
    if (!nonBlank(record.reviewedBy)) errors.push("reviewedBy_required_for_approval");
    if (!nonBlank(record.reviewedAt) || !validTimestamp(record.reviewedAt)) errors.push("reviewedAt_required_for_approval");
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}
