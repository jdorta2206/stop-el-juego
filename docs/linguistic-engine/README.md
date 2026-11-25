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
```

It validates the manifest header and required source fields, rejects duplicate IDs/locales/files, blocks every source not explicitly marked `approved`, and requires an approval record plus commercial-use and redistribution permission. For each approved source it reads the listed dataset files and the exact license text from the supplied data root, rejects paths outside that root, and checks the SHA-256 digest.

The digest is computed over the lexicographically sorted union of `files` and `license.licenseTextPath`; for each path, the hash stream is UTF-8 path, one NUL byte, file bytes, one NUL byte. This makes the check deterministic across operating systems.

Optional CLI arguments are: manifest path (default `docs/linguistic-engine/source-manifest.json`) and data root (default repository root). Example:

```sh
pnpm --filter @workspace/scripts linguistics:preflight -- ./docs/linguistic-engine/source-manifest.json ./lexical-sources
```

This is a preflight gate, not yet a wordlist parser or runtime importer. The current manifest is intentionally empty, so a successful run confirms only that no unapproved source is being admitted; it does not mean STOP has gained new vocabulary. The next implementation stage is fixture-based tests for rejected candidates, missing files, path traversal, checksum mismatch, and approved-source acceptance before any real dataset is considered.
