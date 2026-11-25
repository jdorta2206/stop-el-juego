import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { validateManifest } from "./validate-lexical-manifest.js";

const temporaryRoots: string[] = [];
const bundleVersion = "2026.11.25";

async function fixture(status: "approved" | "candidate" = "approved") {
  const root = await mkdtemp(path.join(os.tmpdir(), "stop-lexical-preflight-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "source"), { recursive: true });
  await writeFile(path.join(root, "source", "words.dic"), "3\ncasa\nperro\nárbol\n", "utf8");
  await writeFile(path.join(root, "source", "LICENSE"), "Test license notice\n", "utf8");

  const paths = ["source/LICENSE", "source/words.dic"].sort();
  const hash = createHash("sha256");
  for (const relativePath of paths) {
    hash.update(relativePath, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(await readFile(path.join(root, relativePath)));
    hash.update(Buffer.from([0]));
  }

  const manifest = {
    $schema: "./source-manifest.schema.json",
    schemaVersion: 1,
    bundleVersion,
    sources: [{
      id: "test-es-dictionary",
      language: "es",
      locales: ["es-ES"],
      upstreamUrl: "https://example.org/dictionary",
      version: "1.0.0",
      revision: "test-revision",
      sha256: hash.digest("hex"),
      files: ["source/words.dic"],
      license: { spdxId: "MIT", licenseTextPath: "source/LICENSE" },
      notices: ["Preserve the license notice."],
      commercialUse: true,
      modification: true,
      redistribution: true,
      shareAlike: false,
      thirdPartyContent: "none-known",
      reviewStatus: status,
      ...(status === "approved" ? {
        reviewedBy: "test-reviewer",
        reviewedAt: "2026-11-25",
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

test("accepts an empty manifest without claiming vocabulary was imported", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stop-lexical-empty-"));
  temporaryRoots.push(root);
  const manifestPath = path.join(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ $schema: "./source-manifest.schema.json", schemaVersion: 1, bundleVersion, sources: [] }));
  assert.deepEqual(await validateManifest(manifestPath, root), { sourceCount: 0, bundleVersion });
});

test("accepts an approved source when files and checksum match", async () => {
  const { root, manifestPath } = await fixture();
  assert.deepEqual(await validateManifest(manifestPath, root), { sourceCount: 1, bundleVersion });
});

test("rejects a candidate source even when its checksum is valid", async () => {
  const { root, manifestPath } = await fixture("candidate");
  await assert.rejects(validateManifest(manifestPath, root), /source is candidate; import is blocked/);
});

test("rejects modified source files through the checksum", async () => {
  const { root, manifestPath } = await fixture();
  await writeFile(path.join(root, "source", "words.dic"), "3\ncasa\ngato\nárbol\n");
  await assert.rejects(validateManifest(manifestPath, root), /SHA-256 mismatch/);
});

test("rejects path traversal before reading a source file", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].files = ["../outside.dic"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /Unsafe path/);
});

test("rejects a missing license or dictionary file", async () => {
  const { root, manifestPath } = await fixture();
  await rm(path.join(root, "source", "LICENSE"));
  await assert.rejects(validateManifest(manifestPath, root), /Missing file: source\/LICENSE/);
});

test("rejects an approved source that does not permit commercial use", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].commercialUse = false;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /must permit commercial use and redistribution/);
});

test("rejects a symlink that escapes the data root", async () => {
  const { root, manifestPath, manifest } = await fixture();
  const outside = path.join(os.tmpdir(), `stop-lexical-outside-${process.pid}-${Date.now()}.dic`);
  await writeFile(outside, "outside data");
  try {
    await symlink(outside, path.join(root, "source", "external.dic"));
    manifest.sources[0].files = ["source/external.dic"];
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(validateManifest(manifestPath, root), /Path escapes data root/);
  } finally {
    await rm(outside, { force: true });
  }
});


test("rejects unknown manifest fields instead of silently ignoring schema drift", async () => {
  const { root, manifestPath, manifest } = await fixture();
  Object.assign(manifest, { unexpectedFlag: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /unknown field unexpectedFlag/);
});

test("rejects source revisions shorter than the schema minimum", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].revision = "abc";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /revision must contain at least 7 characters/);
});

test("rejects invalid calendar dates in approval records", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].reviewedAt = "2026-02-30";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /requires reviewer, date and approval reference/);
});


test("rejects locales whose language does not match the source language", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.sources[0].locales = ["fr-FR"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /locale language must match es/);
});

test("rejects impossible calendar dates in bundle versions", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.bundleVersion = "2026.02.30";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /Invalid manifest header/);
});


test("rejects an empty schema reference when the optional field is present", async () => {
  const { root, manifestPath, manifest } = await fixture();
  manifest.$schema = "   ";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateManifest(manifestPath, root), /\$schema must be a non-empty string/);
});
