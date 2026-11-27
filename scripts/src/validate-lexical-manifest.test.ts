import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { validateManifest } from "./validate-lexical-manifest.js";

const temporaryRoots: string[] = [];
const bundleVersion = "2026.11.26";

async function fixture(status: "approved" | "candidate" = "approved") {
  const root = await mkdtemp(path.join(os.tmpdir(), "stop-lexical-preflight-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "source"), { recursive: true });
  await writeFile(path.join(root, "source", "words.dic"), "3\ncasa\nperro\nárbol\n", "utf8");
  await writeFile(path.join(root, "source", "rules.aff"), "SET UTF-8\n", "utf8");
  await writeFile(path.join(root, "source", "LICENSE-WORDS"), "Word list license notice\n", "utf8");
  await writeFile(path.join(root, "source", "LICENSE-AFFIX"), "Affix rules license notice\n", "utf8");

  const paths = ["source/words.dic", "source/rules.aff", "source/LICENSE-WORDS", "source/LICENSE-AFFIX"].sort();
  const hash = createHash("sha256");
  for (const relativePath of paths) {
    hash.update(relativePath, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update(Buffer.from([0]));
  }

  const manifest = {
    $schema: "./source-manifest.schema.json",
    schemaVersion: 2,
    bundleVersion,
    sources: [{
      id: "test-es-dictionary",
      language: "es",
      locales: ["es-ES"],
      upstreamUrl: "https://example.org/dictionary",
      version: "1.0.0",
      revision: "test-revision",
      sha256: hash.digest("hex"),
      files: ["source/words.dic", "source/rules.aff"],
      licenses: [
        { spdxId: "MIT", licenseTextPath: "source/LICENSE-WORDS", appliesTo: ["source/words.dic"] },
        { spdxId: "BSD-3-Clause", licenseTextPath: "source/LICENSE-AFFIX", appliesTo: ["source/rules.aff"] },
      ],
      notices: ["Preserve each component's license notice."],
      commercialUse: true,
      modification: true,
      redistribution: true,
      shareAlike: false,
      thirdPartyContent: "none-known",
      reviewStatus: status,
      ...(status === "approved" ? {
        reviewedBy: "test-reviewer",
        reviewedAt: "2026-11-26",
        approvalReference: "LEGAL-TEST-001",
      } : {}),
    }],
  };
  const manifestPath = path.join(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
  return { root, manifestPath, manifest };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("accepts an empty v2 manifest without claiming vocabulary was imported", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stop-lexical-empty-"));
  temporaryRoots.push(root);
  const manifestPath = path.join(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ $schema: "./source-manifest.schema.json", schemaVersion: 2, bundleVersion, sources: [] }));
  assert.deepEqual(await validateManifest(manifestPath, root), { sourceCount: 0, bundleVersion });
});

test("accepts distinct licenses for word and affix files and hashes both notices", async () => {
  const { root, manifestPath } = await fixture();
  assert.deepEqual(await validateManifest(manifestPath, root), { sourceCount: 1, bundleVersion });
});

test("rejects a candidate source even when its checksum is valid", async () => {
  const { root, manifestPath } = await fixture("candidate");
  await assert.rejects(validateManifest(manifestPath, root), /source is candidate; import is blocked/);
});

test("rejects a source file with no license coverage", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].licenses[1].appliesTo = [];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /license appliesTo must contain file paths/);
});

test("rejects a source file omitted from every license record", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].licenses = [manifest.sources[0].licenses[0]];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /source file has no license coverage: source\/rules\.aff/);
});

test("rejects a license record that references a file outside the source", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].licenses[0].appliesTo = ["source/not-in-package.dic"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /license references unknown source file/);
});

test("rejects a missing license text", async () => {
  const { root, manifestPath } = await fixture();
  await rm(path.join(root, "source", "LICENSE-AFFIX"));
  await assert.rejects(validateManifest(manifestPath, root), /Missing file: source\/LICENSE-AFFIX/);
});

test("rejects license-text tampering through the checksum", async () => {
  const { root, manifestPath } = await fixture();
  await writeFile(path.join(root, "source", "LICENSE-AFFIX"), "changed license terms\n");
  await assert.rejects(validateManifest(manifestPath, root), /SHA-256 mismatch/);
});

test("rejects modified source files through the checksum", async () => {
  const { root, manifestPath } = await fixture();
  await writeFile(path.join(root, "source", "words.dic"), "3\ncasa\ngato\nárbol\n");
  await assert.rejects(validateManifest(manifestPath, root), /SHA-256 mismatch/);
});

test("rejects path traversal before reading a source file", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].files = ["../outside.dic", "source/rules.aff", "source/words.dic"];
  manifest.sources[0].licenses[0].appliesTo = ["../outside.dic", "source/words.dic"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /Unsafe path/);
});

test("rejects a symlink that escapes the data root", async () => {
  const { root, manifestPath, manifest } = await fixture();
  const outside = path.join(os.tmpdir(), `stop-lexical-outside-${process.pid}-${Date.now()}.dic`);
  await writeFile(outside, "outside data");
  try {
    await symlink(outside, path.join(root, "source", "external.dic"));
    manifest.sources[0].files = ["source/external.dic", "source/rules.aff"];
    manifest.sources[0].licenses[0].appliesTo = ["source/external.dic"];
    const paths = ["source/external.dic", "source/rules.aff", "source/LICENSE-WORDS", "source/LICENSE-AFFIX"].sort();
    const hash = createHash("sha256");
    for (const relativePath of paths) {
      hash.update(relativePath, "utf8");
      hash.update(Buffer.from([0]));
      hash.update(await readFile(path.join(root, relativePath)).catch(() => Buffer.from("outside data")));
      hash.update(Buffer.from([0]));
    }
    manifest.sources[0].sha256 = hash.digest("hex");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(validateManifest(manifestPath, root), /Path escapes data root/);
  } finally {
    await rm(outside, { force: true });
  }
});

test("rejects approved sources without commercial redistribution permission", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].commercialUse = false;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /must permit commercial use and redistribution/);
});

test("rejects unknown manifest fields", async () => {
  const { root, manifestPath, manifest } = await fixture();
  Object.assign(manifest, { unexpectedFlag: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /unknown field unexpectedFlag/);
});

test("rejects locales whose language does not match the source language", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].locales = ["fr-FR"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /locale language must match es/);
});

test("rejects impossible bundle and approval dates", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.bundleVersion = "2026.02.30";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /Invalid manifest header/);
});

test("rejects invalid optional review metadata", async () => {
  const { root, manifestPath, manifest } = await fixture("candidate");
  manifest.sources[0].reviewedAt = "2026-02-30";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /reviewedAt must be a valid calendar date/);
});

test("rejects an unrecognized or unapproved SPDX identifier", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].licenses[0].spdxId = "MADE-UP-LICENSE";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /not approved by STOP bundle policy/);
});

test("rejects approved sources that do not permit modification", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].modification = false;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /permit commercial use, modification and redistribution/);
});

test("rejects share-alike sources from the proprietary game bundle", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].shareAlike = true;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /share-alike source is not approved/);
});

test("rejects non-HTTPS upstream references", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].upstreamUrl = "http://example.org/dictionary";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /upstreamUrl must use HTTPS/);
});
