# Preliminary locale source inventory

Audit date: 2026-11-25
Status: discovery only. No dictionary files are approved, downloaded, imported, or bundled by this inventory.

## Purpose

Record where candidate spelling data appears to exist, while keeping three questions separate:

1. Does an upstream project publish a dictionary for this language or locale?
2. What exact files, revision, and license govern that dictionary?
3. Is that exact material compatible with STOP's commercial use, modification, and redistribution?

A positive answer to the first question does not answer the other two.

## Candidate upstream: LibreOffice/dictionaries

Canonical repository: https://github.com/LibreOffice/dictionaries

The upstream repository currently exposes language directories for Spanish (`es`), English (`en`), French (`fr_FR`), and Portuguese (`pt_BR`, `pt_PT`). Its build module also lists the corresponding dictionary targets, including separate Portuguese (Brazil/Portugal) targets. This establishes a useful discovery lead, not a complete locale coverage claim.

| STOP language | Locale targets to investigate | Discovery evidence | Current status |
|---|---|---|---|
| Spanish | es-ES, es-MX, es-AR, es-BO, es-CL, es-CO, es-CR, es-CU, es-DO, es-EC, es-SV, es-GT, es-HN, es-NI, es-PA, es-PY, es-PE, es-PR, es-UY, es-VE | Upstream `es` directory; locale-specific files must be enumerated and checked individually | Candidate; no locale approved |
| English | en-US, en-GB, en-CA, en-AU, en-NZ, en-ZA, en-IE | Upstream `en` directory and `Dictionary_en` target; exact regional coverage not established by the directory name alone | Candidate; no locale approved |
| Portuguese | pt-PT, pt-BR | Separate upstream `pt_PT` and `pt_BR` directories and build targets | Candidate; no locale approved |
| French | fr-FR, fr-BE, fr-CH, fr-CA, fr-LU | Upstream `fr_FR` directory; other target locales not established by this discovery check | Candidate for fr-FR only; others unverified |

### License warning

LibreOffice's top-level repository license must not be assumed to govern every dictionary file. The upstream project and its licensing documentation indicate that individual dictionaries may carry different licenses and notices. The exact locale directory, file-level license, copyright/attribution notice, and source revision must be inspected before any source can be marked approved.

A third-party flat aggregation such as plainlib/dictionaries is useful only as a discovery index. Its own README explicitly says it does not relicense the dictionaries and that each file retains its original upstream license; it also omits upstream license texts and per-language documentation. Therefore it is not an acceptable provenance root for importing files into STOP.

## Required record before a locale can be approved

For every candidate locale, record all of the following in the source manifest or its linked audit record:

- exact locale code and language;
- canonical upstream repository and exact subdirectory/file paths;
- immutable commit SHA or release tag and retrieval date;
- SHA-256 of every imported file;
- exact license identifier and retained license text;
- copyright and attribution notices;
- permissions/obligations for commercial use, modification, redistribution, and share-alike;
- third-party/imported content status;
- reviewer, review date, and approval reference;
- technical checks for spelling variants, morphology, regional vocabulary, and false positives.

If any item is missing or ambiguous, the source remains candidate/blocked and cannot enter the bundle.

## Explicit non-decisions

- No locale is approved by this inventory.
- No words are added to STOP by this inventory.
- Spell-check dictionaries establish spelling evidence only; they do not prove category membership.
- No RAE/ASALE scraping or redistribution is authorized.
- No AI verdict can promote an unknown word to accepted status.
- The runtime validator, scoring, online play, offline play, Railway, production, and Android artifacts are unchanged.

## Sources checked

- LibreOffice dictionaries repository: https://github.com/LibreOffice/dictionaries
- LibreOffice dictionary build module: https://github.com/LibreOffice/dictionaries/blob/master/Module_dictionaries.mk
- Flat Hunspell aggregation's explicit per-file licensing disclaimer: https://github.com/plainlib/dictionaries/blob/main/README.md
- LibreOffice licensing information (example Portuguese spelling dictionary notice): https://api.libreoffice.org/share/readme/LICENSE.html

This is an engineering discovery inventory, not legal advice or final legal approval.
