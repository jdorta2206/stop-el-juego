import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

type Source = {
  id: string;
  language: "es" | "en" | "pt" | "fr";
  locales: string[];
  upstreamUrl: string;
  version: string;
  revision: string;
  sha256: string;
  files: string[];
  license: { spdxId: string; licenseTextPath: string };
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

type Manifest = { schemaVersion: 1; bundleVersion: string; sources: Source[] };

const manifestPath = path.resolve(process.argv[2] ?? "docs/linguistic-engine/source-manifest.json");
const dataRoot = path.resolve(process.argv[3] ?? ".");
const fail = (message: string): never => { throw new Error(message); };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const safeRelativePath = (value: string): boolean =>
  !path.isAbsolute(value) && !value.split(/[\\/]/).includes("..");

async function readInsideRoot(relativePath: string, rootReal: string): Promise<Buffer> {
  if (!safeRelativePath(relativePath)) fail(`Unsafe path: ${relativePath}`);
  const absolute = path.resolve(dataRoot, relativePath);
  const resolved = await realpath(absolute).catch(() => fail(`Missing file: ${relativePath}`));
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) {
    fail(`Path escapes data root: ${relativePath}`);
  }
  return readFile(resolved);
}

function validateSourceShape(value: unknown, index: number): Source {
  if (!isRecord(value)) fail(`sources[${index}] must be an object`);
  const required = [
    "id", "language", "locales", "upstreamUrl", "version", "revision", "sha256",
    "files", "license", "notices", "commercialUse", "modification",
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
  if (!nonEmpty(value.upstreamUrl) || !/^https?:\/\//.test(value.upstreamUrl)) fail(`${value.id}: invalid upstreamUrl`);
  for (const key of ["version", "revision"] as const) if (!nonEmpty(value[key])) fail(`${value.id}: missing ${key}`);
  if (!/^[a-fA-F0-9]{64}$/.test(String(value.sha256))) fail(`${value.id}: invalid sha256`);
  if (!Array.isArray(value.files) || value.files.length === 0 || !value.files.every(nonEmpty)) fail(`${value.id}: files must be non-empty paths`);
  if (new Set(value.files).size !== value.files.length) fail(`${value.id}: duplicate files`);
  if (!isRecord(value.license) || !nonEmpty(value.license.spdxId) || !nonEmpty(value.license.licenseTextPath)) {
    fail(`${value.id}: license requires spdxId and licenseTextPath`);
  }
  if (!Array.isArray(value.notices) || !value.notices.every(nonEmpty)) fail(`${value.id}: notices must be an array of non-empty strings`);
  for (const key of ["commercialUse", "modification", "redistribution", "shareAlike"] as const) {
    if (typeof value[key] !== "boolean") fail(`${value.id}: ${key} must be boolean`);
  }
  if (!["none-known", "present-audited", "present-unaudited", "unknown"].includes(String(value.thirdPartyContent))) {
    fail(`${value.id}: invalid thirdPartyContent`);
  }
  if (!["candidate", "blocked", "approved"].includes(String(value.reviewStatus))) fail(`${value.id}: invalid reviewStatus`);
  if (value.reviewStatus === "approved") {
    if (value.commercialUse !== true || value.redistribution !== true) fail(`${value.id}: approved source must permit commercial use and redistribution`);
    if (!["none-known", "present-audited"].includes(String(value.thirdPartyContent))) fail(`${value.id}: third-party content is not audited`);
    if (value.notices.length === 0) fail(`${value.id}: approved source must preserve attribution/notices`);
    if (!nonEmpty(value.reviewedBy) || !nonEmpty(value.approvalReference) ||
        typeof value.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewedAt)) {
      fail(`${value.id}: approved source requires reviewer, date and approval reference`);
    }
  }
  return value as unknown as Source;
}

async function main(): Promise<void> {
  const manifestRaw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(manifestRaw);
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 ||
      typeof parsed.bundleVersion !== "string" ||
      !/^\d{4}\.\d{2}\.\d{2}([+-][A-Za-z0-9.-]+)?$/.test(parsed.bundleVersion) ||
      !Array.isArray(parsed.sources)) {
    fail("Invalid manifest header: expected schemaVersion 1, dated bundleVersion and sources array");
  }
  const sources = parsed.sources.map(validateSourceShape);
  const ids = sources.map((source) => source.id);
  if (new Set(ids).size !== ids.length) fail("Duplicate source id");
  const rootReal = await realpath(dataRoot);
  for (const source of sources) {
    if (source.reviewStatus !== "approved") fail(`${source.id}: source is ${source.reviewStatus}; import is blocked`);
    const hash = createHash("sha256");
    const paths = [...source.files, source.license.licenseTextPath].sort();
    for (const relativePath of paths) {
      const bytes = await readInsideRoot(relativePath, rootReal);
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
  console.log(`Manifest valid: ${sources.length} approved source(s), bundle ${parsed.bundleVersion}.`);
  if (sources.length === 0) console.log("No lexical datasets are registered; nothing can be imported yet.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
