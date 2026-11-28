import test from "node:test";
import assert from "node:assert/strict";
import { decideLexicalStatus, type LexicalEvidence } from "./index";

// Synthetic reviewed fixtures exercise language/locale isolation only.
// They are not dictionary imports or production vocabulary approvals.
const multilingualFixtures: LexicalEvidence[] = [
  { sourceId: "fixture-en-us-car", normalizedForm: "car", language: "en", locale: "en-US", sourceVersion: "fixture-1", reviewed: true },
  { sourceId: "fixture-en-gb-car", normalizedForm: "car", language: "en", locale: "en-GB", sourceVersion: "fixture-1", reviewed: true },
  { sourceId: "fixture-pt-br-carro", normalizedForm: "carro", language: "pt", locale: "pt-BR", sourceVersion: "fixture-1", reviewed: true },
  { sourceId: "fixture-pt-pt-carro", normalizedForm: "carro", language: "pt", locale: "pt-PT", sourceVersion: "fixture-1", reviewed: true },
  { sourceId: "fixture-fr-fr-chat", normalizedForm: "chat", language: "fr", locale: "fr-FR", sourceVersion: "fixture-1", reviewed: true },
  { sourceId: "fixture-fr-ca-chat", normalizedForm: "chat", language: "fr", locale: "fr-CA", sourceVersion: "fixture-1", reviewed: true },
];

test("English, Portuguese, and French accept exact reviewed forms in their own language", () => {
  assert.equal(decideLexicalStatus("CAR", "en", multilingualFixtures).status, "valid");
  assert.equal(decideLexicalStatus("CARRO", "pt", multilingualFixtures).status, "valid");
  assert.equal(decideLexicalStatus("CHAT", "fr", multilingualFixtures).status, "valid");
});

test("regional English, Portuguese, and French evidence is not filtered by player location", () => {
  const cases = [
    { form: "car", language: "en", locales: ["en-US", "en-GB"] },
    { form: "carro", language: "pt", locales: ["pt-BR", "pt-PT"] },
    { form: "chat", language: "fr", locales: ["fr-FR", "fr-CA"] },
  ];
  for (const item of cases) {
    for (const locale of item.locales) {
      const result = decideLexicalStatus(item.form, item.language, multilingualFixtures);
      assert.equal(result.status, "valid");
      assert.ok(multilingualFixtures.some((entry) =>
        entry.language === item.language && entry.locale === locale && entry.normalizedForm === item.form
      ));
    }
  }
});

test("a reviewed spelling in another language cannot cross-validate", () => {
  assert.equal(decideLexicalStatus("chat", "en", multilingualFixtures).status, "unknown");
  assert.equal(decideLexicalStatus("carro", "es", multilingualFixtures).status, "unknown");
  assert.equal(decideLexicalStatus("car", "fr", multilingualFixtures).status, "unknown");
});

test("fabricated extensions and unreviewed multilingual candidates remain unknown", () => {
  assert.equal(decideLexicalStatus("carinvented", "en", multilingualFixtures).status, "unknown");
  assert.equal(decideLexicalStatus("carroinventado", "pt", multilingualFixtures).status, "unknown");
  assert.equal(decideLexicalStatus("chatinventéx", "fr", multilingualFixtures).status, "unknown");

  const pending = multilingualFixtures.map((entry) =>
    entry.language === "fr" ? { ...entry, reviewed: false } : entry
  );
  assert.equal(decideLexicalStatus("chat", "fr", pending).status, "unknown");
});
