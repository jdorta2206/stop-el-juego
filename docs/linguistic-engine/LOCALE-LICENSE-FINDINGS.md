# Locale coverage and licensing findings

Audit date: 2026-11-25
Status: preliminary research only; no source or locale is approved for import.

## What the upstream evidence establishes

The LibreOffice dictionaries repository is a maintained upstream collection of Hunspell dictionaries. Its current tree includes distinct directories for `pt_BR`, `pt_PT`, and `fr_FR`, as well as general `es` and `en` directories. The repository tree alone does not prove that every STOP target locale has an independent dictionary.

A separate downstream inventory reports Spanish files for many regional codes, including es_AR, es_BO, es_CL, es_CO, es_CR, es_CU, es_DO, es_EC, es_ES, es_GT, es_HN, es_MX, es_NI, es_PA, es_PE, es_PR, es_PY, es_SV, es_UY, and es_VE. Treat this only as a lead: each file must be confirmed in the canonical upstream tree at a pinned commit before it is recorded as an import candidate.

Fedora's 2026 packaging proposal documents five distinct English dictionary subpackages: en-AU, en-CA, en-GB, en-US, and en-ZA. Its packaging notes mention en-IE and en-NZ as aliases/symlinks in the packaged Hunspell layout, not independent English dictionary datasets. STOP must not count an alias as an independently sourced locale.

## Preliminary coverage matrix

| STOP locale family | Evidence found | Next verification required | Decision |
|---|---|---|---|
| Spanish es-ES and Latin American locales | Downstream inventory lists many locale-specific .aff/.dic pairs under LibreOffice's Spanish dictionary collection | Confirm every requested file and its exact upstream path, revision, provenance and notices | Candidate only |
| English en-US, en-GB, en-CA, en-AU, en-ZA | Fedora proposal identifies five distinct locale subpackages sourced from LibreOffice | Pin exact upstream files and review the exact license/notice for each locale | Candidate only |
| English en-IE, en-NZ | Fedora packaging notes describe aliases/symlinks to other dictionaries | Decide whether alias coverage is linguistically acceptable; do not claim independent source coverage | Alias only; not an independent dataset |
| Portuguese pt-BR | Canonical upstream has a distinct pt_BR directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| Portuguese pt-PT | Canonical upstream has a distinct pt_PT directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| French fr-FR | Canonical upstream has a fr_FR directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| French fr-BE, fr-CH, fr-CA, fr-LU | No independent locale directory established by this check | Search for separately licensed, canonical sources; do not silently substitute fr_FR | Unverified |

## Licensing findings

LibreOffice's published licensing index lists the Spanish spelling dictionary under GPLv3, LGPLv3, and MPL 1.1 terms. Its Portuguese (Portugal) spelling dictionary is listed as GPL 2.0 / LGPL 2.1 / MPL 1.1 tri-license. The Portuguese (Brazil) dictionary is described separately under LGPLv3 and MPL 1.1, with credits pointing to the VERO project.

These are collection-level discovery findings, not a legal conclusion for a particular file or release. The exact locale files may have additional upstream notices or different provenance. In particular:

- Do not infer the license of every file from the repository's top-level license.
- Retain the exact license text and copyright/attribution notices distributed with the selected locale package.
- Confirm whether the chosen license option permits STOP's intended commercial use, modification, and redistribution, and document all obligations.
- If the exact terms or file provenance are ambiguous, keep the source blocked pending legal review.

## Sources

- Canonical LibreOffice dictionaries repository: https://github.com/LibreOffice/dictionaries
- LibreOffice licensing index: https://api.libreoffice.org/share/readme/LICENSE.html
- Fedora proposal documenting five English locale subpackages and en-IE/en-NZ aliases: https://fedoraproject.org/wiki/Changes/LibreOfficeDictionaries
- Downstream Spanish locale inventory, used only as a discovery lead: https://github.com/wachin/libreoffice-dictionaries-collection/blob/main/dictionary_report.txt

## Safety conclusion

No data files were downloaded or imported. No manifest source was marked approved. No runtime validator, scoring, game data, online/offline behavior, production service, or Android artifact was changed. This document is not legal advice and does not grant redistribution rights.




## Exact duplicate-content comparison for Spanish locale files

At the same pinned upstream commit, the GitHub Contents API's Git blob object IDs were compared separately for all 23 `.aff` files and all 23 `.dic` files. For a fixed Git repository/object format, identical blob IDs mean identical file bytes; different blob IDs mean the bytes differ.

Results:
- All 23 `.dic` files have distinct blob IDs. No exact duplicate word-list file was found.
- The 23 `.aff` files collapse to 8 unique byte contents. Three groups are exact duplicates:
  - `es_BO`, `es_CL`, `es_CR`, `es_CU`, `es_DO`, `es_EC`, `es_HN`, `es_NI`, `es_PA`, `es_PR`, `es_PY`, and `es_SV`.
  - `es_GQ`, `es_PH`, and `es_US`.
  - `es_MX`, `es_PE`, and `es_VE`.
- The remaining `.aff` files each have unique byte content.

Interpretation for STOP:
- Do not treat 23 locale codes as 23 fully independent Hunspell rule sets: only 8 distinct affix files exist in this snapshot.
- The word-list files are byte-distinct, which is evidence of different file contents, but not proof that each difference represents useful, region-specific vocabulary. Differences may include spelling variants, inflections, ordering, metadata, or other editorial changes.
- The upstream Spanish README states that the spelling dictionary is the combination of the affix file and word list and that it is available under the disjunctive GPLv3-or-later, LGPLv3-or-later, or MPL-1.1-or-later license scheme. This is a source statement, not legal advice; STOP still needs to choose and document a compatible license option and retain required notices.
- This comparison used Git blob IDs as exact-content fingerprints. It did not download the dictionary files, compute STOP manifest SHA-256 values, parse Hunspell entries, or assess word-level regional coverage.

Reproducible source:
- Pinned upstream Spanish directory: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Pinned Spanish package manifest: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/Dictionary_es.mk
- Pinned Spanish README: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/README_hunspell_es.txt

## Exact duplicate-content comparison for Spanish locale files

At the same pinned upstream commit, the GitHub Contents API Git blob object IDs were compared separately for all 23 `.aff` files and all 23 `.dic` files. Within the same Git repository and object format, identical blob IDs mean identical file bytes.

Results:
- All 23 `.dic` files have distinct blob IDs. No exact duplicate word-list file was found.
- The 23 `.aff` files collapse to 8 unique byte contents. Three groups are exact duplicates:
  - `es_BO`, `es_CL`, `es_CR`, `es_CU`, `es_DO`, `es_EC`, `es_HN`, `es_NI`, `es_PA`, `es_PR`, `es_PY`, and `es_SV`.
  - `es_GQ`, `es_PH`, and `es_US`.
  - `es_MX`, `es_PE`, and `es_VE`.
- The other `.aff` files each have unique byte content.

Interpretation for STOP:
- Do not treat 23 locale codes as 23 fully independent Hunspell rule sets: this snapshot contains only 8 distinct affix-file contents.
- The word-list files are byte-distinct, which proves their contents differ, but not that each difference represents useful, region-specific vocabulary. Differences may include spelling variants, inflections, ordering, metadata, or other editorial changes.
- The upstream Spanish README describes the spelling dictionary as the combination of the affix file and word list and states a disjunctive license choice: GPLv3-or-later, LGPLv3-or-later, or MPL 1.1-or-later. This is a source statement, not legal advice; STOP still needs to select and document a compatible license option and retain required notices.
- This comparison used Git blob IDs as exact-content fingerprints. It did not download dictionary files, compute STOP manifest SHA-256 values, parse Hunspell entries, or assess word-level regional coverage.

Reproducible sources:
- Pinned upstream Spanish directory: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Pinned Spanish package manifest: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/Dictionary_es.mk
- Pinned Spanish README: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/README_hunspell_es.txt

## Canonical Spanish file-pair verification (pinned snapshot)

Verification date: 2026-11-25.
Canonical repository: https://github.com/LibreOffice/dictionaries
Pinned upstream commit observed: `79195b017e6d70151337856c59e7d13d311d6630` (commit timestamp reported by GitHub: 2026-11-24T12:38:09Z).

The GitHub Contents API listing for the canonical `es/` directory at the `master` snapshot above was inspected by filename. It contains both an `.aff` and a matching `.dic` file for each of these 23 regional codes:

`es_AR`, `es_BO`, `es_CL`, `es_CO`, `es_CR`, `es_CU`, `es_DO`, `es_EC`, `es_ES`, `es_GQ`, `es_GT`, `es_HN`, `es_MX`, `es_NI`, `es_PA`, `es_PE`, `es_PH`, `es_PR`, `es_PY`, `es_SV`, `es_US`, `es_UY`, and `es_VE`.

All 23 pairs were present in the directory listing; no missing `.aff` or `.dic` partner was found. This corrects the earlier incomplete downstream discovery list by adding Equatorial Guinea (`es_GQ`), Philippines (`es_PH`), and United States Spanish (`es_US`).

Important limits:
- This proves file-pair presence at the pinned repository snapshot, not independent linguistic review or quality for every region.
- Several locale files may share identical contents or affix rules; distinct filenames do not prove distinct regional vocabulary. A future audit must compare hashes and inspect the upstream locale descriptions.
- GitHub's directory listing provides Git blob object SHAs, not the SHA-256 values required by STOP's manifest. The exact file bytes and license texts still need to be fetched and SHA-256 hashed before any manifest entry can be approved.
- The Spanish directory contains license texts and a package README, but a legal reviewer must select and document the exact license grant and confirm file-level notices before redistribution.
- No dictionary data was downloaded into STOP, imported, or bundled. All locales remain candidates only.

Reproducible source locations:
- Pinned directory: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Pinned Spanish manifest: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/Dictionary_es.mk
- Pinned Spanish license README: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/README_hunspell_es.txt


## First-pass Spanish Hunspell entry-count audit (pinned snapshot)

Audit date: 2026-11-26. Each of the 23 canonical `.dic` files was fetched from the pinned LibreOffice commit `79195b017e6d70151337856c59e7d13d311d6630` and parsed as a first-pass inventory. The first line is treated as the declared entry count; each following non-empty line is counted as one dictionary entry. For the distinct-root estimate, the parser takes the text before the first Hunspell flag separator `/`, lowercases it using Spanish locale rules, and normalizes it to NFC.

| Locale | Declared/parsed entries | Distinct normalized roots |
|---|---:|---:|
| es_AR | 57,437 | 54,912 |
| es_BO | 56,899 | 54,394 |
| es_CL | 57,174 | 54,675 |
| es_CO | 62,280 | 58,548 |
| es_CR | 56,699 | 54,203 |
| es_CU | 56,892 | 54,340 |
| es_DO | 56,581 | 54,102 |
| es_EC | 56,749 | 54,249 |
| es_ES | 58,221 | 55,638 |
| es_GQ | 71,199 | 66,783 |
| es_GT | 56,666 | 54,177 |
| es_HN | 56,841 | 54,335 |
| es_MX | 59,093 | 56,257 |
| es_NI | 56,743 | 54,239 |
| es_PA | 56,635 | 54,153 |
| es_PE | 58,445 | 55,705 |
| es_PH | 67,762 | 63,711 |
| es_PR | 56,592 | 54,106 |
| es_PY | 56,650 | 54,165 |
| es_SV | 56,703 | 54,200 |
| es_US | 56,293 | 53,842 |
| es_UY | 56,833 | 54,313 |
| es_VE | 57,108 | 54,531 |

Interpretation and limits:
- These counts confirm that the files contain substantially different numbers of dictionary entries; Equatorial Guinea and Philippines are notably larger in this snapshot. This is a signal for deeper review, not evidence that their dictionaries are more complete or better for those regions.
- A Hunspell `.dic` file contains stems plus flags and may contain morphology metadata. This first-pass parser deliberately strips flags for the distinct-root estimate; it does not expand affix rules, validate spelling quality, or classify regionalisms.
- The counts are not the number of playable accepted words. They must not be used as a runtime allowlist or as evidence that a word is exclusive to a locale.
- The next linguistic comparison must compute cross-locale normalized set differences, inspect candidate terms in context, and then separately assess category suitability and regional legitimacy. Keep all 23 source pairs unapproved until the licensing and notice review is complete.

Sources:
- Pinned upstream directory and source files: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Pinned Spanish README: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/README_hunspell_es.txt
- Pinned Spanish license statement: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/LICENSE.md


## Pairwise Spanish regional-root comparison: es_ES vs es_MX

A direct normalized-root set comparison was performed on the pinned `es_ES.dic` and `es_MX.dic` files (same commit as above). The parser removed Hunspell flags after `/`, normalized strings to NFC, and compared lowercase forms.

- Roots present in es_ES but not es_MX: **1,759**.
- Roots present in es_MX but not es_ES: **2,378**.
- Inspection of the first alphabetical samples shows many place names and proper geographic names (for example, Spanish municipality names in es_ES and Mexican municipality names in es_MX). Therefore, a raw locale-only difference is not automatically a regional common noun, nor automatically suitable for a STOP category.

This is an important quality gate: future candidate extraction must classify entries (common noun, adjective, verb/root, demonym, toponym/proper noun, abbreviation, archaic/technical, etc.) and retain provenance. Do not automatically whitelist all locale-only entries. The raw comparison also does not expand Hunspell affixes or validate category membership.

Source files at pinned commit:
- https://raw.githubusercontent.com/LibreOffice/dictionaries/79195b017e6d70151337856c59e7d13d311d6630/es/es_ES.dic
- https://raw.githubusercontent.com/LibreOffice/dictionaries/79195b017e6d70151337856c59e7d13d311d6630/es/es_MX.dic
