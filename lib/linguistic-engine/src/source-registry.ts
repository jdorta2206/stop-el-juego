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

const BUNDLE_LICENSES = new Set(["0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "ISC", "MIT", "Unlicense"]);

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
  if (!/^[a-z]{2}-[A-Z]{2}$/.test(source.locale) || !source.locale.startsWith(`${source.language}-`)) errors.push("source_locale_language_mismatch");
  if (source.licenseUrl !== undefined && !validHttpsUrl(source.licenseUrl)) errors.push("licenseUrl_must_be_https");
  for (const field of ["commercialUse", "modification", "redistribution", "shareAlike"] as const) {
    if (typeof source[field] !== "boolean") errors.push(field + "_must_be_boolean");
  }
  if (!["none-known", "present-audited", "present-unaudited", "unknown"].includes(source.thirdPartyContent)) errors.push("thirdPartyContent_invalid");
  if (!nonBlank(source.retrievedAt) || !validTimestamp(source.retrievedAt)) errors.push("retrievedAt_must_be_utc_iso_timestamp");
  if (!["candidate", "blocked", "approved"].includes(source.reviewStatus)) errors.push("reviewStatus_invalid");
  if (source.reviewStatus === "approved") {
    if (!BUNDLE_LICENSES.has(source.licenseId)) {
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
  existingRecords: readonly LexicalAttestationRecord[] = [],
): RegistryValidation {
  const errors: string[] = [];
  const matchingSources = sources.filter((item) => item.sourceId === record.sourceId);
  const source = matchingSources[0];
  if (matchingSources.length > 1) errors.push("duplicate_source_id");
  if (sources.some((item) => item.sourceId !== record.sourceId && item.referenceUrl === source?.referenceUrl && item.edition === source?.edition && item.locale === source?.locale)) errors.push("ambiguous_source_reference");
  if (!source || !validateLexicalSource(source).valid || source.reviewStatus !== "approved") errors.push("source_not_registered_or_approved");
  if (!nonBlank(record.recordId)) errors.push("recordId_required");
  if (existingRecords.some((item) => item.recordId === record.recordId)) errors.push("duplicate_lexical_record_id");
  if (existingRecords.some((item) => item.sourceId === record.sourceId && item.normalizedForm === record.normalizedForm && item.language === record.language && item.locale === record.locale && item.citationLocator === record.citationLocator)) errors.push("duplicate_lexical_attestation");
  if (!nonBlank(record.form) || !nonBlank(record.normalizedForm)) errors.push("form_required");
  if (nonBlank(record.form) && nonBlank(record.normalizedForm) &&
      normalizeLexicalForm(record.form) !== record.normalizedForm) {
    errors.push("normalized_form_does_not_match_form");
  }
  if (!nonBlank(record.language) || !nonBlank(record.locale)) errors.push("language_and_locale_required");
  if (nonBlank(record.language) && nonBlank(record.locale) && (!/^[a-z]{2}-[A-Z]{2}$/.test(record.locale) || !record.locale.startsWith(`${record.language}-`))) errors.push("record_locale_language_mismatch");
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
  existingRecords: readonly CategoryAttestationRecord[] = [],
): RegistryValidation {
  const errors: string[] = [];
  const matchingLexical = lexicalRecords.filter((item) => item.recordId === record.lexicalRecordId);
  const lexical = matchingLexical[0];
  if (matchingLexical.length > 1) errors.push("duplicate_lexical_record_id");
  if (!lexical || lexical.reviewStatus !== "approved") errors.push("approved_lexical_record_required");
  else if (!nonBlank(lexical.reviewedBy) || !nonBlank(lexical.reviewedAt) || !validTimestamp(lexical.reviewedAt)) errors.push("lexical_record_review_audit_required");
  if (!nonBlank(record.recordId) || !nonBlank(record.normalizedForm) || !nonBlank(record.categoryId)) errors.push("category_record_fields_required");
  if (existingRecords.some((item) => item.recordId === record.recordId)) errors.push("duplicate_category_record_id");
  if (existingRecords.some((item) => item.lexicalRecordId === record.lexicalRecordId && item.categoryId === record.categoryId)) errors.push("duplicate_category_attestation");
  if (lexical && record.normalizedForm !== lexical.normalizedForm) errors.push("category_form_mismatch");
  if (!nonBlank(record.citationLocator) || record.citationLocator.trim().length < 3) errors.push("citationLocator_required");
  if (!["pending", "approved", "rejected"].includes(record.reviewStatus)) errors.push("reviewStatus_invalid");
  if (record.reviewStatus === "approved") {
    if (!nonBlank(record.reviewedBy)) errors.push("reviewedBy_required_for_approval");
    if (!nonBlank(record.reviewedAt) || !validTimestamp(record.reviewedAt)) errors.push("reviewedAt_required_for_approval");
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}


/**
 * Whole-corpus structural audit. Identical spellings in different languages
 * or regional locales remain separate evidence; they are never merged merely
 * because their normalized form matches.
 */
export function validateLexicalCorpus(
  records: readonly LexicalAttestationRecord[],
  sources: readonly LexicalSourceRecord[],
): RegistryValidation {
  const errors: string[] = [];
  const recordIds = new Set<string>();
  const attestationKeys = new Set<string>();

  for (const record of records) {
    if (recordIds.has(record.recordId)) errors.push("duplicate_lexical_record_id");
    recordIds.add(record.recordId);

    const key = [record.sourceId, record.normalizedForm, record.language, record.locale, record.citationLocator].join("\u0000");
    if (attestationKeys.has(key)) errors.push("duplicate_lexical_attestation");
    attestationKeys.add(key);

    const sourceMatches = sources.filter((source) => source.sourceId === record.sourceId);
    if (sourceMatches.length !== 1) {
      errors.push(sourceMatches.length === 0 ? "source_not_registered" : "duplicate_source_id");
      continue;
    }
    const source = sourceMatches[0];
    if (!validateLexicalSource(source).valid || source.reviewStatus !== "approved") errors.push("source_not_approved");
    if (record.language !== source.language || record.locale !== source.locale) errors.push("source_language_locale_mismatch");
    if (record.reviewStatus === "approved" &&
        (!nonBlank(record.reviewedBy) || !nonBlank(record.reviewedAt) || !validTimestamp(record.reviewedAt))) {
      errors.push("approved_record_missing_review_audit");
    }
    if (!nonBlank(record.form) || !nonBlank(record.normalizedForm) ||
        normalizeLexicalForm(record.form) !== record.normalizedForm) errors.push("normalized_form_does_not_match_form");
    if (!nonBlank(record.citationLocator) || record.citationLocator.trim().length < 3) errors.push("citationLocator_required");
  }

  return errors.length ? { valid: false, errors: [...new Set(errors)] } : { valid: true };
}


export interface LexicalDiscrepancyGroup {
  normalizedForm: string;
  language: string;
  locale: string;
  partOfSpeech: string | null;
  recordIds: string[];
  status: "conflict" | "pending_review" | "approved" | "rejected" | "unresolved";
}

export interface LexicalDiscrepancyAudit {
  groups: LexicalDiscrepancyGroup[];
  publishableRecordIds: string[];
  blockedRecordIds: string[];
}

/**
 * Compare independent attestations only within the same spelling, language,
 * locale and part of speech. Different locales/languages and grammatical
 * senses are intentionally kept separate. Divergent definitions alone are
 * not treated as contradictions: a human reviewer must establish that.
 */
export function auditLexicalDiscrepancies(
  records: readonly LexicalAttestationRecord[],
): LexicalDiscrepancyAudit {
  const groups = new Map<string, LexicalAttestationRecord[]>();
  for (const record of records) {
    const key = [
      record.normalizedForm,
      record.language,
      record.locale,
      record.partOfSpeech?.trim().toLocaleLowerCase("und") ?? "",
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const findings: LexicalDiscrepancyGroup[] = [];
  const publishableRecordIds: string[] = [];
  const blockedRecordIds: string[] = [];

  for (const group of groups.values()) {
    const approved = group.filter((item) => item.reviewStatus === "approved");
    const rejected = group.filter((item) => item.reviewStatus === "rejected");
    const pending = group.filter((item) => item.reviewStatus === "pending");
    const status: LexicalDiscrepancyGroup["status"] =
      approved.length > 0 && rejected.length > 0 ? "conflict" :
      pending.length > 0 ? "pending_review" :
      approved.length > 0 ? "approved" :
      rejected.length > 0 ? "rejected" : "unresolved";

    findings.push({
      normalizedForm: group[0].normalizedForm,
      language: group[0].language,
      locale: group[0].locale,
      partOfSpeech: group[0].partOfSpeech ?? null,
      recordIds: group.map((item) => item.recordId),
      status,
    });

    if (status === "approved") publishableRecordIds.push(...approved.map((item) => item.recordId));
    else blockedRecordIds.push(...group.map((item) => item.recordId));
  }

  return { groups: findings, publishableRecordIds, blockedRecordIds };
}
