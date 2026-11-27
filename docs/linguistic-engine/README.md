# STOP Linguistic Engine — regional foundation

Status: design and source-audit foundation. This document does not authorize importing third-party wordlists or changing scoring yet.

## Product rule

A word must not be rejected merely because it belongs to a different recognized regional variety of the selected language. The player's country must not restrict the accepted vocabulary. Regional metadata is for provenance and coverage, not a penalty or a hard locale filter.

The validator must separate:
1. lexical existence (is this a documented word/form in the selected language?);
2. regional usage (where is it documented?);
3. category fit (does it answer the current category?);
4. game constraints (initial letter, safe input, duplicate rules, etc.).

An AI model is never the lexical authority. It may suggest candidates for review, but it cannot turn an unverified string into a valid answer.

## Language and locale coverage

| Game language | Initial locale coverage target | Notes |
|---|---|---|
| Spanish (es) | es-ES, es-MX, es-AR, es-BO, es-CL, es-CO, es-CR, es-CU, es-DO, es-EC, es-SV, es-GT, es-HN, es-NI, es-PA, es-PY, es-PE, es-PR, es-UY, es-VE | Also record regionalisms shared across countries; do not assume one dictionary represents all Latin America. |
| English (en) | en-US, en-GB, en-CA, en-AU, en-NZ, en-ZA, en-IE | Spelling variants and regional vocabulary must be distinguished. |
| Portuguese (pt) | pt-PT, pt-BR | Keep regional forms from both national varieties. |
| French (fr) | fr-FR, fr-BE, fr-CH, fr-CA, fr-LU | Add other documented varieties when a compatible source is approved. |

This is a coverage target, not a claim that every locale already has complete data.

## Source and licensing policy

No source is approved for redistribution until its exact dataset, version, file-level license, attribution requirements, share-alike obligations, and commercial-use compatibility have been recorded.

| Candidate | Potential use | Current decision |
|---|---|---|
| Hunspell dictionaries (locale-specific) | spelling forms and morphology; useful for locale coverage | Candidate only. Audit each locale's actual upstream source and license; repository metadata shows licenses differ by locale. A spell-check list alone does not prove semantic/category fit. |
| Wiktionary dumps | broad lexical evidence and regional labels | Candidate only. Text is generally CC BY-SA 4.0 / GFDL, with imported material sometimes carrying other terms. Redistribution may trigger attribution and share-alike obligations; not a drop-in private wordlist. |
| RAE DLE | Spanish lexical reference | Reference for research only. Do not scrape, mirror, or redistribute its entries absent explicit permission or a suitable official license/API agreement. |
| Apertium lexical data | morphology and lexical processing | Not approved for this proprietary game bundle by default: relevant data is commonly GPL-licensed and must be assessed package-by-package before integration. |
| Curated STOP additions | verified game vocabulary gaps | Allowed only when independently authored/verified, with source note, locale, reviewer, and audit trail. |

## Runtime behavior to implement

- Store canonical lexical entries separately from inflected forms and regional aliases.
- Each entry carries: normalized form, display form, language, locale/region tags, part of speech where available, source ID, source version, license ID, and review status.
- Normalize Unicode consistently but preserve meaningful letters (especially ñ) and accents for display. Never collapse distinct letters into false matches.
- Accept a documented word from any supported region of the selected language; do not require the player's locale to match.
- Check category membership independently. A valid word is not automatically a valid answer to every category.
- Proper nouns, places, brands, names, and open-ended categories require dedicated evidence sources or an explicit game policy. They must not become valid solely because they contain three letters.
- If a source is unavailable, do not silently treat the word as invented or as valid. Return a reviewable/indeterminate state and avoid a punitive false negative where the game design permits.
- Online and offline validation must use the same versioned lexical bundle and rules. Include bundle version/hash in diagnostics.
- AI may queue an unknown candidate for later review; never make an untraceable real-time verdict authoritative.

## Important current-code finding

In `artifacts/api-server/src/routes/game.ts`, the current server validator treats configured open categories as valid when the input is safe, starts with the round letter, and has at least three characters. The offline mirror in `artifacts/stop-game/src/lib/offlineGame.ts` does the same. That permits plausible-looking invented strings in open categories and does not prove lexical existence. This behavior must be redesigned together on server and offline clients; changing only one would make online/offline scores disagree.

The current dictionaries in `game.ts` are hand-maintained category lists, not a complete multilingual lexical database. The offline bundle ships those lists to clients.

## Phased implementation and acceptance criteria

### Phase 1 — source inventory (this PR)
- Establish locale targets and source/license rules.
- Keep all external datasets out until their exact licenses are cleared.
- Record that current open-category validation bypasses lexical evidence.

### Phase 2 — data model and importer
- Add a versioned lexical manifest and deterministic import pipeline.
- Fail the build if a dataset has no explicit license, attribution record, locale, or source version.
- Produce auditable provenance for every imported batch.

### Phase 3 — validation engine
- Replace hand-list-only lexical checks with a shared, source-backed lexical service.
- Keep category checks separate from lexical existence.
- Add explicit unknown/review handling; AI cannot self-certify words.
- Share the same validation rules and versioned data between API and offline bundle.

### Phase 4 — regression suite
At minimum test:
- Spanish regional pairs: coche/carro/auto, ordenador/computadora, móvil/celular, zumo/jugo, patata/papa.
- Portuguese pt-PT and pt-BR variants.
- English en-GB and en-US spellings/words.
- French France and Canada variants.
- ñ versus n, accents, apostrophes/hyphens where the language permits them, plurals and inflections.
- valid word in wrong category; invented string in an open category; proper nouns with their own evidence policy.
- same answers produce same result online and offline.
- missing source/network does not trigger a 12–13 second AI wait or silently fabricate a verdict.

## Release safety

This foundation is documentation only. Do not merge, deploy, change timers, or generate Android artifacts as part of this phase. Later implementation must be isolated, tested on all four languages and both online/offline paths, and reviewed before production release.


## Manifest preflight tool (implementation step)

A fail-closed preflight command is available in `scripts`:

```sh
pnpm --filter @workspace/scripts linguistics:preflight

Run the fail-closed validator tests with:

```sh
pnpm --filter @workspace/scripts linguistics:test
```
```

It validates the manifest header and required source fields, rejects duplicate IDs/locales/files, blocks every source not explicitly marked `approved`, and requires an approval record plus commercial-use and redistribution permission. For each approved source it reads the listed dataset files and the exact license text from the supplied data root, rejects paths outside that root, and checks the SHA-256 digest.

The manifest is schema version 2. Each source declares a non-empty `licenses` array; every license record contains an SPDX identifier, a path to its exact license text, and an `appliesTo` list naming the source files governed by that license. Every source file must be covered by at least one license record; a license may cover multiple files and multiple licenses may cover one file where the upstream grant is genuinely dual-licensed. Unknown file references and uncovered files are rejected. The digest is computed over the lexicographically sorted union of `files` and every `licenses[].licenseTextPath`; for each path, the hash stream is UTF-8 path, one NUL byte, file bytes, one NUL byte. This makes the check deterministic across operating systems and ensures each distinct license text is pinned.

Optional CLI arguments are: manifest path (default `docs/linguistic-engine/source-manifest.json`) and data root (default repository root). Example:

```sh
pnpm --filter @workspace/scripts linguistics:preflight -- ./docs/linguistic-engine/source-manifest.json ./lexical-sources
```

This is a preflight gate, not yet a wordlist parser or runtime importer. The current manifest is intentionally empty, so a successful run confirms only that no unapproved source is being admitted; it does not mean STOP has gained new vocabulary. The next implementation stage is fixture-based tests for rejected candidates, missing files, path traversal, checksum mismatch, and approved-source acceptance before any real dataset is considered. The tests include mixed word-list/affix licenses, missing file coverage, unknown license references, missing license texts, and license-text tampering.


## Validation gap audit — current server and offline behavior

Audit date: 2026-11-27. Scope: read-only inspection of the current `master` implementation; no runtime files were changed by this audit.

### Confirmed defects

1. **Open categories bypass lexical existence.** In `artifacts/api-server/src/routes/game.ts`, `isWordValid` returns true for any safe input of at least three normalized characters in configured open categories, provided it starts with the round letter. This means a fabricated string can score in categories such as name/place/object/brand.
2. **Offline repeats the same permissive rule.** `artifacts/stop-game/src/lib/offlineGame.ts` independently returns true for the same three-character condition. A server-only correction would leave offline play inconsistent.
3. **The AI fallback is explicitly permissive.** `artifacts/api-server/src/lib/aiWordValidator.ts` instructs the model to be generous, accept plausible colloquialisms and accept when uncertain; its yes/no answer is cached as a durable validity verdict. That is incompatible with evidence-based lexical acceptance.
4. **Prefix matching can over-accept.** Closed-category membership currently accepts a submitted form whenever it starts with a listed entry (for example, any longer string sharing a listed prefix), without verifying that the longer form is a documented inflection or derivative.
5. **The same AI validator is used by the Impossible challenge.** Its scoring decision also relies on the permissive yes/no verdict, so the remediation must inspect this route rather than fixing only the solo round.

### Required remediation order

- Define a tri-state internal decision: `valid` (traceable lexical evidence and category fit), `invalid` (evidence disproves the answer or game rules reject it), and `unknown` (not enough evidence; never award points automatically).
- Replace the three-character shortcut with a source-backed lookup. Names, places, brands, and other proper-noun categories need their own curated/evidenced registries; a general spelling dictionary alone cannot prove that a brand or place exists.
- Remove AI yes/no as an authoritative source. AI may suggest a candidate and supporting references for review, but cannot create a valid cache verdict. Existing cached AI verdicts must not be trusted as lexical evidence during migration.
- Replace prefix acceptance with explicit canonical-form/inflection relations from a reviewed morphological source. Do not accept arbitrary longer strings just because they share a prefix.
- Implement the same deterministic rules and versioned data for API and offline play. If the evidence bundle is missing or stale, fail safely without awarding points and surface an understandable pending/unknown result where the UI supports it.
- Add regression tests for invented strings in every open category, real documented regional words, valid words in the wrong category, unverified AI suggestions, prefix lookalikes, and parity between online/offline validation.

### Release guard

This audit is a finding, not a production fix. No scoring behavior, database rows, cache entries, Android artifacts, or production services were changed. Do not merge this PR or claim the issue fixed until the server, offline mirror, AI cache policy, and Impossible route have all been corrected and tested together.


## Runtime integration audit — shared validation boundary

Audit date: 2026-11-27. The current `master` implementation was inspected before any runtime change. This section records the actual integration boundary and the constraints for the first implementation slice.

### Confirmed current structure

- `artifacts/api-server/src/lib/wordRules.ts` already contains dependency-free `normalizeWord` and `isSafeInput` helpers with unit tests in `wordRules.test.ts`. It is imported by `routes/game.ts`, but it does not yet implement lexical existence, category membership, morphology, locale evidence or tri-state outcomes.
- `artifacts/api-server/src/routes/game.ts` owns the current dictionary, open-category shortcut, category lookup and prefix-based word match. `isWordValidAsync` adds the AI fallback for closed categories.
- `artifacts/stop-game/src/lib/offlineGame.ts` independently duplicates normalization, input safety, category lookup and acceptance logic using the downloaded bundle. It currently returns only boolean validity and cannot distinguish invalid from unknown.
- `artifacts/api-server/src/lib/aiWordValidator.ts` reads and writes `word_validation_cache` as a boolean verdict. The current prompt explicitly favors permissive acceptance, and the cache lookup treats old AI verdicts as reusable decisions.
- `artifacts/api-server/src/routes/impossible.ts` calls the same AI boolean validator directly, bypassing the normal game validator.
- The API server has a Vitest test script and existing focused tests for `wordRules`; the game package has no matching validator test suite visible in its source tree.

### Architectural decision for the next implementation slice

Do not create a second independent rules engine in the client. Extend the existing pure-rule boundary into a small dependency-free validation core with explicit result states:

- `valid`: an admissible source-backed lexical record exists and the requested category/sense rules match.
- `invalid`: there is positive evidence of a spelling/rule violation, or the word demonstrably does not fit the category under an explicit rule.
- `unknown`: the current approved data cannot establish either result. Unknown must never award points automatically, but the interface must not claim the word is invented or nonexistent.

The core must accept explicit data as input (language/locale, category rules, lexical records and morphology evidence) and must not import Express, PostgreSQL, OpenAI, browser storage or React. The API route and offline bundle consumer must call the same pure decision functions, while each environment supplies its own data adapter.

### Compatibility and migration safeguards

1. Preserve the existing HTTP response shape initially; introduce the tri-state result additively and only change score awarding after API/offline parity tests exist.
2. Version the offline bundle whenever its schema or validation semantics change. Old cached bundles must fail closed to an explicit outdated/unknown state rather than silently using the old permissive shortcut.
3. Treat `word_validation_cache.source = 'ai'` as historical suggestion data, never as lexical proof. Do not let old cached `true` values authorize a score.
4. Keep AI as a candidate-generation/research assistant only. It may create a review item with evidence references; it must not write an authoritative valid/invalid verdict.
5. The Impossible Challenge must call the same validation core and must not retain a separate AI-only acceptance path.
6. Replace generic prefix matching only after explicit inflection/morphology rules and regression cases are defined; exact matching alone would wrongly reject legitimate inflected forms.
7. Do not silently convert every unknown regional word to invalid. Provide a pending/review path and preserve country/register/sense metadata.

### First safe coding boundary

The first runtime change should be limited to extracting the existing deterministic primitives and defining typed tri-state contracts with unit tests. It must not yet remove AI, change scoring, rewrite the offline bundle or migrate database rows. Those changes require separate reviewed steps after the shared core and compatibility contract are proven.

This audit is documentation only. No runtime source, database schema/data, score calculation, offline cache, master branch or production service was changed.
