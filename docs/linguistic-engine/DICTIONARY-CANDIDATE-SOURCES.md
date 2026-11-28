# Dictionary corpus research — candidate sources (not approved)

Research date: 2026-11-27

This file records discovery leads only. Nothing here is an approved STOP dictionary source, and no dataset is imported by this document.

## English: Linguabase / IDEA

- Landing page: https://www.idea.org/linguabase/
- Download and data description: https://www.linguabase.org/download.html
- Dataset mirror: https://huggingface.co/datasets/linguabase/linguabase
- Declared license: CC0 1.0; the publisher states commercial reuse is allowed.
- Scope: English vocabulary and semantic relations. It does not provide the Spanish, Portuguese or French coverage required by STOP.
- Quality caveat: publisher documentation describes a large dataset and also warns that it is not ground truth, includes a noisy low-familiarity tail, and may contain errors and sensitive vocabulary. Any candidate word must still be filtered, checked, and reviewed.
- Import decision: candidate for a separate English research pipeline only. Do not mark approved until the exact release, files, checksums, attribution/notices, content filters and licence statement are archived and reviewed.

## Spanish, Portuguese and French: Hunspell / LibreOffice dictionary families

- Discovery lead: LibreOffice dictionaries repository, including Spanish regional variants previously inventoried in `LOCALE-INVENTORY.md`.
- A third-party implementation report describes Spanish, Brazilian Portuguese and French Hunspell datasets and reports permissive MPL options for some of those packages: https://wordtide.app/licenses
- This is not sufficient legal or technical evidence for STOP approval. The authoritative upstream repository, exact per-file license notices, contributors, affix rules, third-party content and exact commit must be checked directly.
- Hunspell `.dic` entries are not automatically a curated list of valid STOP answers. Affix expansion, morphology, capitalization, abbreviations, proper names, profanity, multiword entries and regional coverage need explicit policy and testing.
- Import decision: candidate investigation only; no source is approved and no data is copied into the game.

## Sources deliberately not accepted as proprietary-bundle inputs at this stage

- Wiktionary-derived datasets: commonly CC BY-SA 4.0 (and potentially GFDL obligations). A combined or adapted dataset may inherit share-alike requirements. Do not put this material into the proprietary STOP bundle under the current allowlist without a separate legal/design decision.
- Frequency lists with non-commercial, no-derivatives, unclear or missing licenses are excluded from import until the exact upstream terms are verified.
- ASALE / Diccionario de americanismos: useful as a reference lead for regional Spanish, but rights are reserved; do not copy entries or definitions without permission or a suitable license.

## Next verification gates

For each source and each exact release:
1. Preserve the upstream URL, immutable revision/version, retrieval timestamp and SHA-256.
2. Archive the exact license file(s), notices and per-file attribution requirements.
3. Establish commercial use, modification and redistribution rights for the actual data files, not just the code.
4. Audit third-party material and excluded content.
5. Determine whether entries are lemmas, inflected forms, stems or generated forms.
6. Build a reviewable candidate list; do not auto-approve words or categories from corpus presence alone.
7. Keep locale identity explicit (for example `es-ES`, `es-MX`, `pt-BR`, `pt-PT`, `fr-FR`).

## Current outcome

No source has been added to `source-manifest.json`; its `sources` array remains empty. No dictionary data has been imported into the game. This is intentional: a source that is useful linguistically but incompatible or unclear legally must not silently enter a commercial game bundle.
