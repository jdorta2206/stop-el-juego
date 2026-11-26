import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type License = { spdxId: string; licenseTextPath: string; appliesTo: string[] };
type Source = {
  id: string;
  language: "es" | "en" | "pt" | "fr";
  locales: string[];
  upstreamUrl: string;
  version: string;
  revision: string;
  sha256: string;
  files: string[];
  licenses: License[];
  notices: string[];
  commercialUse: boolean;
  modification: boolean;
  redistribution: boolean;
  shareAlike: boolean;
  thirdPartyContent: "none-known" | "present-audited" | "present-unaudited" | "unknown";
  reviewStatus: "candidate" | "blocked" | "approved";
  reviewedBy?: string;
  reviewedAt?: string;
  approvalReference?: string;
};

function fail(message: string): never { throw new Error(message); }
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isCalendarDate = (value: string): boolean => {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const assertOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[], context: string): void => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${context}: unknown field ${key}`);
};
const safeRelativePath = (value: string): boolean =>
  value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\\\/]/).includes("..") &&
  !value.includes("\\0");

async function readInsideRoot(relativePath: string, rootReal: string, dataRoot: string): Promise<Buffer> {
  if (!safeRelativePath(relativePath)) fail(`Unsafe path: ${relativePath}`);
  const absolute = path.resolve(dataRoot, relativePath);
  const resolved = await realpath(absolute).catch(() => fail(`Missing file: ${relativePath}`));
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) {
    fail(`Path escapes data root: ${relativePath}`);
  }
  return readFile(resolved);
}

function validateLicenseShape(value: unknown, sourceId: string, index: number): License {
  if (!isRecord(value)) fail(`${sourceId}: licenses[${index}] must be an object`);
  assertOnlyKeys(value, ["spdxId", "licenseTextPath", "appliesTo"], `${sourceId}.licenses[${index}]`);
  if (!nonEmpty(value.spdxId) || !nonEmpty(value.licenseTextPath)) {
    fail(`${sourceId}: license requires spdxId and licenseTextPath`);
  }
  if (!Array.isArray(value.appliesTo) || value.appliesTo.length === 0 || !value.appliesTo.every(nonEmpty)) {
    fail(`${sourceId}: license appliesTo must contain file paths`);
  }
  if (new Set(value.appliesTo).size !== value.appliesTo.length) {
    fail(`${sourceId}: duplicate file in license appliesTo`);
  }
  return value as unknown as License;
}

function validateSourceShape(value: unknown, index: number): Source {
  if (!isRecord(value)) fail(`sources[${index}] must be an object`);
  assertOnlyKeys(value, ["id", "language", "locales", "upstreamUrl", "version", "revision", "sha256", "files", "licenses", "notices", "commercialUse", "modification", "redistribution", "shareAlike", "thirdPartyContent", "reviewStatus", "reviewedBy", "reviewedAt", "approvalReference"], `sources[${index}]`);
  const required = [
    "id", "language", "locales", "upstreamUrl", "version", "revision", "sha256",
    "files", "licenses", "notices", "commercialUse", "modification",
    "redistribution", "shareAlike", "thirdPartyContent", "reviewStatus",
  ];
  for (const key of required) if (!(key in value)) fail(`sources[${index}] missing ${key}`);
  if (!nonEmpty(value.id) || !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(value.id)) fail(`sources[${index}] has invalid id`);
  if (!["es", "en", "pt", "fr"].includes(String(value.language))) fail(`${value.id}: unsupported language`);
  if (!Array.isArray(value.locales) || value.locales.length === 0 ||
      !value.locales.every((v) => typeof v === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(v))) {
    fail(`${value.id}: invalid locales`);
  }
  if (new Set(value.locales).size !== value.locales.length) fail(`${value.id}: duplicate locale`);
  if (!value.locales.every((locale) => locale.startsWith(`${value.language}-`))) {
    fail(`${value.id}: locale language must match ${value.language}`);
  }
  if (!nonEmpty(value.upstreamUrl)) fail(`${value.id}: invalid upstreamUrl`);
  try {
    const url = new URL(value.upstreamUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") fail(`${value.id}: invalid upstreamUrl`);
  } catch { fail(`${value.id}: invalid upstreamUrl`); }
  if (!nonEmpty(value.version)) fail(`${value.id}: missing version`);
  if (!nonEmpty(value.revision) || value.revision.length < 7) fail(`${value.id}: revision must contain at least 7 characters`);
  if (!/^[a-fA-F0-9]{64}$/.test(String(value.sha256))) fail(`${value.id}: invalid sha256`);
  if (!Array.isArray(value.files) || value.files.length === 0 || !value.files.every(nonEmpty)) fail(`${value.id}: files must be non-empty paths`);
  if (new Set(value.files).size !== value.files.length) fail(`${value.id}: duplicate files`);
  if (!Array.isArray(value.licenses) || value.licenses.length === 0) fail(`${value.id}: licenses must be a non-empty array`);
  const licenses = value.licenses.map((license, licenseIndex) => validateLicenseShape(license, String(value.id), licenseIndex));
  const sourceFiles = new Set(value.files as string[]);
  const coveredFiles = new Set<string>();
  for (const license of licenses) {
    for (const file of license.appliesTo) {
      if (!sourceFiles.has(file)) fail(`${value.id}: license references unknown source file ${file}`);
      coveredFiles.add(file);
    }
  }
  for (const file of sourceFiles) {
    if (!coveredFiles.has(file)) fail(`${value.id}: source file has no license coverage: ${file}`);
  }
  if (!Array.isArray(value.notices) || !value.notices.every(nonEmpty)) fail(`${value.id}: notices must be an array of non-empty strings`);
  for (const key of ["commercialUse", "modification", "redistribution", "shareAlike"] as const) {
    if (typeof value[key] !== "boolean") fail(`${value.id}: ${key} must be boolean`);
  }
  if (!["none-known", "present-audited", "present-unaudited", "unknown"].includes(String(value.thirdPartyContent))) {
    fail(`${value.id}: invalid thirdPartyContent`);
  }
  if (!["candidate", "blocked", "approved"].includes(String(value.reviewStatus))) fail(`${value.id}: invalid reviewStatus`);
  if ("reviewedBy" in value && !nonEmpty(value.reviewedBy)) fail(`${value.id}: reviewedBy must be a non-empty string`);
  if ("approvalReference" in value && !nonEmpty(value.approvalReference)) fail(`${value.id}: approvalReference must be a non-empty string`);
  if ("reviewedAt" in value && (typeof value.reviewedAt !== "string" || !isCalendarDate(value.reviewedAt))) {
    fail(`${value.id}: reviewedAt must be a valid calendar date`);
  }
  if (value.reviewStatus === "approved") {
    if (value.commercialUse !== true || value.redistribution !== true) fail(`${value.id}: approved source must permit commercial use and redistribution`);
    if (!["none-known", "present-audited"].includes(String(value.thirdPartyContent))) fail(`${value.id}: third-party content is not audited`);
    if (value.notices.length === 0) fail(`${value.id}: approved source must preserve attribution/notices`);
    if (!nonEmpty(value.reviewedBy) || !nonEmpty(value.approvalReference) ||
        typeof value.reviewedAt !== "string" || !isCalendarDate(value.reviewedAt)) {
      fail(`${value.id}: approved source requires reviewer, date and approval reference`);
    }
  }
  return value as unknown as Source;
}

export async function validateManifest(manifestPath: string, dataRoot: string): Promise<{ sourceCount: number; bundleVersion: string }> {
  const manifestRaw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(manifestRaw);
  if (isRecord(parsed)) {
    assertOnlyKeys(parsed, ["$schema", "schemaVersion", "bundleVersion", "sources"], "manifest");
    if ("$schema" in parsed && !nonEmpty(parsed.$schema)) fail("manifest: $schema must be a non-empty string");
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 2 ||
      typeof parsed.bundleVersion !== "string" ||
      !/^\\d{4}\\.\\d{2}\\.\\d{2}([+-][A-Za-z0-9.-]+)?$/.test(parsed.bundleVersion) ||
      !isCalendarDate(parsed.bundleVersion.slice(0, 10).replaceAll(".", "-")) ||
      !Array.isArray(parsed.sources)) {
    fail("Invalid manifest header: expected schemaVersion 2, dated bundleVersion and sources array");
  }
  const sources = parsed.sources.map(validateSourceShape);
  const ids = sources.map((source) => source.id);
  if (new Set(ids).size !== ids.length) fail("Duplicate source id");
  const rootReal = await realpath(dataRoot);
  for (const source of sources) {
    if (source.reviewStatus !== "approved") fail(`${source.id}: source is ${source.reviewStatus}; import is blocked`);
    const hash = createHash("sha256");
    const paths = [...new Set([
      ...source.files,
      ...source.licenses.map((license) => license.licenseTextPath),
    ])].sort();
    for (const relativePath of paths) {
      const bytes = await readInsideRoot(relativePath, rootReal, dataRoot);
      hash.update(relativePath, "utf8");
      hash.update(Buffer.from([0]));
      hash.update(bytes);
      hash.update(Buffer.from([0]));
    }
    const actual = hash.digest("hex");
    if (actual.toLowerCase() !== source.sha256.toLowerCase()) {
      fail(`${source.id}: SHA-256 mismatch (expected ${source.sha256}, got ${actual})`);
    }
  }
  return { sourceCount: sources.length, bundleVersion: parsed.bundleVersion };
}

async function main(): Promise<void> {
  const manifestPath = path.resolve(process.argv[2] ?? "docs/linguistic-engine/source-manifest.json");
  const dataRoot = path.resolve(process.argv[3] ?? ".");
  const result = await validateManifest(manifestPath, dataRoot);
  console.log(`Manifest valid: ${result.sourceCount} approved source(s), bundle ${result.bundleVersion}.`);
  if (result.sourceCount === 0) console.log("No lexical datasets are registered; nothing can be imported yet.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
