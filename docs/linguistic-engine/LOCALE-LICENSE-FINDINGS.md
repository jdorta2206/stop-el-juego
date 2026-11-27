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


## Case-sensitive signal for proper-noun review (es_ES vs es_MX)

A second pass retained original capitalization before creating NFC/lowercase comparison keys. For roots exclusive to one locale after deduplication:

| Direction | Unique exclusive roots | Entries beginning uppercase | Entries beginning lowercase |
|---|---:|---:|---:|
| es_ES only | 1,759 | 345 | 1,414 |
| es_MX only | 2,378 | 1,827 | 551 |

The uppercase-only sample is strongly enriched for geographic names (for example, Spanish municipality names in es_ES and Mexican municipality names in es_MX). This makes capitalization a useful review signal, but not a definitive classifier: proper nouns can be lowercase in source data, and some valid common words may be capitalized for other reasons. The lowercase-only set also contains a mixture of potential regional vocabulary, inflections, archaic/technical forms, and items needing verification.

Implementation rule for the future audit pipeline: preserve original display spelling and capitalization in provenance; compare normalized forms separately; flag capitalized candidates for proper-noun review rather than automatically discarding or accepting them. Do not use capitalization as the sole acceptance rule.


## Full-dictionary capitalization profile across all 23 Spanish locales

Audit date: 2026-11-26. This pass extends the earlier es_ES-versus-es_MX exclusive-root review to every locale pair in the same pinned snapshot. For each `.dic` file, the parser skipped the declared-count line, removed Hunspell flags after `/` and trailing morphology fields, normalized the retained spelling to NFC, deduplicated by Spanish-lowercased key, and counted the first retained spelling as uppercase or lowercase according to its original first character.

| Locale | Distinct normalized roots | Uppercase-initial roots | Lowercase-initial roots | Uppercase share |
|---|---:|---:|---:|---:|
| es_AR | 54,912 | 1,172 | 53,740 | 2.13% |
| es_BO | 54,394 | 972 | 53,422 | 1.79% |
| es_CL | 54,675 | 1,136 | 53,539 | 2.08% |
| es_CO | 58,548 | 5,573 | 52,975 | 9.52% |
| es_CR | 54,203 | 850 | 53,353 | 1.57% |
| es_CU | 54,340 | 987 | 53,353 | 1.82% |
| es_DO | 54,102 | 850 | 53,252 | 1.57% |
| es_EC | 54,249 | 850 | 53,399 | 1.57% |
| es_ES | 55,638 | 1,319 | 54,319 | 2.37% |
| es_GQ | 66,783 | 11,514 | 55,269 | 17.24% |
| es_GT | 54,177 | 850 | 53,327 | 1.57% |
| es_HN | 54,335 | 850 | 53,485 | 1.56% |
| es_MX | 56,257 | 2,994 | 53,263 | 5.32% |
| es_NI | 54,239 | 850 | 53,389 | 1.57% |
| es_PA | 54,153 | 850 | 53,303 | 1.57% |
| es_PE | 55,705 | 2,568 | 53,137 | 4.61% |
| es_PH | 63,711 | 11,514 | 52,197 | 18.07% |
| es_PR | 54,106 | 850 | 53,256 | 1.57% |
| es_PY | 54,165 | 850 | 53,315 | 1.57% |
| es_SV | 54,200 | 850 | 53,350 | 1.57% |
| es_US | 53,842 | 850 | 52,992 | 1.58% |
| es_UY | 54,313 | 850 | 53,463 | 1.57% |
| es_VE | 54,531 | 1,150 | 53,381 | 2.11% |

Interpretation:
- The uppercase-initial share varies substantially. es_GQ and es_PH are especially high (both have 11,514 uppercase-initial roots); es_CO, es_MX and es_PE are also above the cluster around 1.6–2.4%.
- The exact repeated counts and large uppercase clusters are a warning that these files may include substantial proper-name/geographic-name material or shared editorial blocks. They are not proof of regional common-word coverage.
- The 850-entry baseline recurring across many locales suggests a shared block or common editorial pattern; it must not be interpreted as 850 valid regionalisms.
- This is a triage signal only. Capitalization is not a reliable standalone proper-noun classifier: names may be lowercase, common words may be uppercase, and Hunspell entries can encode forms and metadata in ways this lightweight parser does not expand.
- Preserve original spelling and source provenance, but send uppercase-heavy and anomalous groups to manual classification. Do not import these candidates into a runtime allowlist or reject them solely because of capitalization.
- Counts here are not directly comparable to the earlier es_ES-only/es_MX-only capitalization counts: this table profiles each complete dictionary independently, while the earlier table profiled only roots exclusive to one side of a pairwise comparison.

Reproducible source files at pinned commit `79195b017e6d70151337856c59e7d13d311d6630`:
- Directory: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Each locale file follows the pattern `https://raw.githubusercontent.com/LibreOffice/dictionaries/79195b017e6d70151337856c59e7d13d311d6630/es/{locale}.dic`.

No source was approved or imported. This analysis changes documentation only; it does not alter STOP runtime behavior.


## Cross-country Spanish comparison: Argentina, Chile, Colombia, Peru and Venezuela

Audit date: 2026-11-26. To move beyond the Spain–Mexico pair, five additional regional files were compared against `es_ES.dic` at the same pinned LibreOffice commit. The comparison used NFC-normalized, lowercase keys after removing Hunspell flags and trailing morphology fields. For each locale, the first source spelling was retained for display and capitalization review.

### Lowercase-initial roots absent from es_ES

| Locale compared with es_ES | Locale-only roots, all capitalization | Lowercase-initial subset |
|---|---:|---:|
| es_AR | 1,058 | 740 |
| es_CL | 819 | 538 |
| es_CO | 4,647 | 1,158 |
| es_PE | 1,852 | 383 |
| es_VE | 650 | 433 |

These totals are raw lexical-file differences, not counts of confirmed regionalisms. The much larger es_CO difference is partly driven by uppercase-initial entries (3,489), so it must not be interpreted as Colombia having thousands more common words.

### Cross-locale overlap among lowercase-initial candidates

Across the five regional dictionaries, there are 7,515 distinct lowercase-initial roots that are absent from es_ES and occur in at least one of the five files. Their distribution by number of these five files containing each root is:

| Number of regional files containing the root | Root count |
|---:|---:|
| 1 | 6,851 |
| 2 | 324 |
| 3 | 66 |
| 4 | 41 |
| 5 | 233 |

The 233 roots present in all five files are a particularly useful review queue: examples from the source lists include `abigeato`, `abigeo`, `bluyín`, `bombacha`, `camote`, `cuy`, and `altoparlante`. These are examples of source overlap only, not a declaration that every term is a regionalism, is absent from all other Spanish dictionaries, or is valid for every STOP category. The overlap may reflect a common shared word-list block rather than independent evidence from five regional editorial teams.

### Quality rules established by this comparison

1. A word found in one regional file but absent from es_ES is only a candidate; absence from one reference dictionary does not establish that it is regionally exclusive.
2. Agreement across multiple locale files increases review priority, but is not independent confirmation if the upstream files share common source material.
3. Preserve source locale membership and original spelling; do not collapse the regional provenance into one undifferentiated Spanish list.
4. Before any candidate is admitted, verify that it is a real lexical item using independent, appropriately licensed evidence; classify proper names, demonyms, abbreviations, inflections, archaic/technical forms, and spelling variants separately.
5. Keep lexical existence separate from category membership. Even a verified word must not automatically count as a valid answer in every STOP category.

This comparison is still a first-pass Hunspell-root analysis: it does not expand affix rules, validate definitions or usage, establish frequency, or prove category suitability. No words were imported, approved, or added to runtime validation.


## Independent lexicographic spot-check of shared candidates (ASALE)

Audit date: 2026-11-26. A small, deliberately transparent sample of roots shared by the five regional Hunspell files (Argentina, Chile, Colombia, Peru and Venezuela) was checked against individual entries in the Asociación de Academias de la Lengua Española's *Diccionario de americanismos* (DA). The DA is a descriptive, dialectal and differential reference; its own presentation says it records geographic, social and cultural usage and is not a prescriptive guide.

### Results of the sample

| Candidate | Independent DA evidence | Preliminary interpretation for STOP |
|---|---|---|
| `abigeato` | DA marks use in Mexico, Honduras, Nicaragua, Panama, Venezuela, Ecuador, Bolivia, Chile, Argentina and Uruguay, among others; definition relates to cattle theft | Strongly corroborated regional lexical item; legal/agricultural semantic domain, so category suitability must be checked |
| `abigeo` | DA records the meaning “cattle thief” in Honduras, Nicaragua, Ecuador and Peru, and less frequent use in Colombia, Chile, Paraguay and Argentina | Strongly corroborated regional lexical item; noun/person, not a universal category answer |
| `bluyín` | DA records the garment meaning in Honduras, El Salvador, Nicaragua, Costa Rica, Panama, Cuba, Colombia, Venezuela, Peru and Chile | Corroborated regional form; retain accent and spelling exactly; do not normalize it to the English phrase |
| `bombacha` | DA records distinct senses by country: underwear in Peru, Paraguay, Argentina and Uruguay (also Bolivia, masculine); loose trousers in southern Venezuela and Chile, with other country-specific senses | Corroborated, but strongly polysemous and country-dependent; category/meaning must be explicit |
| `camote` | DA records the plant/tuber sense across Mexico, Central America and several South American countries; it also records multiple figurative and colloquial senses with different country marks | Corroborated, highly polysemous; STOP should validate the intended sense/category rather than treating the spelling as one meaning |
| `cuy` | DA records the animal sense in Colombia, Ecuador, Peru, Bolivia and Argentina | Corroborated regional animal name; potentially suitable for animal categories where the country profile permits it |
| `altoparlante` | DA records the loudspeaker sense across much of the Americas, and also marks use in the United States Spanish and Spain | Valid word, but not a good example of an exclusively American or regional-only word; likely a broad synonym of `altavoz` |

### What this proves—and what it does not

- This sample demonstrates that the Hunspell overlap method can surface genuine, independently documented Spanish vocabulary and country-specific senses.
- It also demonstrates why “present in five files” cannot be treated as “exclusive to those five countries”: `altoparlante` is documented beyond them, and other entries have different country distributions or multiple senses.
- The DA entry and country marks are independent linguistic corroboration, not permission to copy its definitions or database into STOP. This audit records short factual findings and source links only; no DA text or dataset is imported.
- The seven checked words are not automatically approved for every category. Their lexical status, part of speech, sense, country distribution and category fit must remain separate fields in the future engine.
- Do not infer that the other 226 shared candidates are valid or invalid from this small sample. They remain unreviewed.

Primary references:
- ASALE, *Diccionario de americanismos*, description and editorial scope: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos
- `abigeato`: https://www.asale.org/damer/abigeato
- `abigeo`: https://www.asale.org/damer/abigeo
- `bluyín`: https://www.asale.org/damer/bluy%C3%ADn
- `bombacha`: https://www.asale.org/damer/bombacha
- `camote`: https://www.asale.org/damer/camote
- `cuy`: https://www.asale.org/damer/cuy
- `altoparlante`: https://www.asale.org/damer/altoparlante

This is a seven-word spot-check, not a complete review of the 233-root set. No external lexicon was imported, no candidate was approved for runtime use, and no game behavior was changed.


## Second independent lexicographic batch: eight additional candidates

Audit date: 2026-11-26. Eight more candidates from the cross-country review queue were checked against individual ASALE entries or official ASALE/RAE material. This extends the seven-word initial sample; it does not complete the 233-root queue.

| Candidate | Independent evidence | Linguistic classification / STOP caution |
|---|---|---|
| `abracar` | ASALE's *Diccionario de americanismos* records senses in Nicaragua, Panama and Cuba; ASALE's historical dictionary also documents broader historical use in America and parts of Spain | Valid verb with regional and historical distribution; not an invented spelling. Preserve the intended sense and region |
| `acalambrar` | ASALE's DA records use across numerous American countries. An official RAE/ASALE 2023 release says the sense ‘producir un calambre’ lost the geographic label ‘América’ and is now treated as general Spanish | Valid, but do not mark as Latin-America-only; distinguish the general sense from figurative country-specific senses |
| `acápite` | ASALE's DA records multiple senses across Panama, Cuba, Dominican Republic, Colombia, Venezuela, Ecuador, Peru, Bolivia, Chile, Paraguay, Argentina, Uruguay and other countries | Valid noun with several document/text-related senses; category suitability depends on sense |
| `acolchonar` | ASALE's DA records the verb in Mexico, Central America, the Caribbean and South America, with additional senses in Panama, Cuba and the Dominican Republic | Valid verb; retain reflexive and non-reflexive forms/senses distinctly where needed |
| `acolitar` | ASALE's DA records meanings including supporting someone in an activity (Colombia, Ecuador), acting as an acolyte (Nicaragua, Colombia; obsolete mark), and covering up an illicit action (Colombia) | Valid but strongly sense- and country-dependent; do not treat all senses as interchangeable |
| `acreencia` | ASALE's DA records financial/legal senses in the Dominican Republic, Venezuela, Bolivia, Paraguay, Argentina, Puerto Rico, Colombia and Ecuador | Valid feminine noun; semantic domain is financial/legal, so not a fit for arbitrary categories |
| `abigeato` | Reconfirmed: ASALE's DA records the cattle-theft sense across a broad set of American countries | Valid noun; category-specific |
| `abigeo` | Reconfirmed: ASALE's DA records the cattle-thief sense in several Central and South American countries | Valid person noun; category-specific |

### Important correction from the evidence

The regional files are discovery sources, not a boundary between “Spain Spanish” and “Latin American Spanish”. In particular, `acalambrar` is explicitly treated as general Spanish for its ‘produce a cramp’ sense in RAE/ASALE's 2023 announcement. STOP must store country distribution as descriptive metadata and must not automatically reject a valid word merely because it is not labelled as regional.

### References

- ASALE DA, `abracar`: https://www.asale.org/damer/abracar
- ASALE DA, `acalambrar`: https://www.asale.org/damer/acalambrar
- RAE/ASALE 2023 announcement on the loss of the geographic label for `acalambrar`: https://www.asale.org/sites/default/files/2023-11/NdP_RAE_Los%20sin%C3%B3nimos%20y%20ant%C3%B3nimos%20se%20incorporan%20al%20%C2%ABDiccionario%20de%20la%20lengua%20espa%C3%B1ola%C2%BB%20en%20su%20actualizaci%C3%B3n%2023.7.pdf
- ASALE DA, `acápite`: https://www.asale.org/damer/ac%C3%A1pite
- ASALE DA, `acolchonar`: https://www.asale.org/damer/acolchonar
- ASALE DA, `acolitar`: https://www.asale.org/damer/acolitar
- ASALE DA, `acreencia`: https://www.asale.org/damer/acreencia
- ASALE DA, `abigeato`: https://www.asale.org/damer/abigeato
- ASALE DA, `abigeo`: https://www.asale.org/damer/abigeo

This batch is evidence documentation only. It does not grant redistribution rights, approve a runtime lexicon entry, or change game behavior. Remaining candidates stay unreviewed until checked individually.


## Third independent lexicographic batch: fourteen additional candidates

Audit date: 2026-11-26. Fourteen further roots from the regional comparison queue have direct entries in ASALE's *Diccionario de americanismos*. This is an evidence check, not a runtime approval.

| Candidate | ASALE evidence summary | Classification and STOP caution |
|---|---|---|
| `agringar(se)` | ASALE records several senses across Central America, Mexico, the Caribbean and South America: adopting customs considered foreign/Anglo-American, or in some countries European/Italian customs | Valid verb, but senses and social connotations vary by country; some senses are marked colloquial or disapproving |
| `aguarapar(se)` | ASALE records processes involving sugar-cane juice or fruit taking on the taste/quality of guarapo in Panama, Dominican Republic, Colombia, Venezuela and other countries; also a Chilean sense ‘agazaparse’ | Valid but highly polysemous; the Chilean sense is unrelated to fermentation and must not be conflated |
| `¡ahijuna!` | ASALE records an interjection in Ecuador, southern Bolivia, Argentina and Uruguay, marked obsolete | Lexically documented, but obsolete interjection; likely unsuitable for ordinary categories unless the game explicitly supports interjections/archaic vocabulary |
| `ahuesarse` | ASALE records Peruvian senses for becoming useless or losing prestige | Valid pronominal verb, country-specific and sense-dependent |
| `ajicero` | ASALE records the container for ají sauce in the Dominican Republic, northern Colombia, Venezuela and Ecuador; also ‘person who likes ají’ in Peru and Bolivia, among other senses | Valid noun with gender/person/object senses; the entry form and intended sense matter |
| `alinderar` | ASALE records the verb ‘mark the boundaries of land’ in Nicaragua, Dominican Republic, Colombia, Venezuela and Bolivia, with a less frequent Honduran use | Valid rural/land-related verb; category fit is narrow |
| `amelcochar(se)` | ASALE records literal confectionery senses and several figurative senses across Mexico, Central America, the Caribbean and South America | Valid verb, strongly polysemous; do not reduce all meanings to the literal candy-making sense |
| `ameritar` | ASALE records several senses across many American countries, including deserving/meriting, requiring a process or attention, and earning sufficient merit | Valid verb with broad country coverage; not a narrowly exclusive regionalism |
| `andinismo` | ASALE records the mountaineering sport associated especially with the Andes in Colombia, Venezuela, Ecuador, Peru, Bolivia, Chile, Argentina and Uruguay | Valid noun; suitable for sport/activity categories |
| `antipatizar` | ASALE records ‘feel antipathy towards’ in Mexico, Panama, Dominican Republic, Venezuela and Paraguay, with less frequent use in Chile and Argentina | Valid verb; category fit depends on whether verbs are accepted |
| `apealar` | ASALE records an obsolete rural Chilean and Argentine verb for lassoing the legs of a running horse or bull to bring it down; cross-reference to `apialar` | Valid but explicitly obsolete and rural; preserve historical/register metadata |
| `apunar(se)` | ASALE records altitude-sickness senses in Peru, Bolivia, Chile, Argentina and Uruguay, plus further regional vehicle/health senses | Valid verb; distinguish human/animal altitude sickness from vehicle-related uses |
| `arrequintar(se)` | ASALE records multiple Venezuelan senses (attack forcefully, compel, intensify, hurry, grip tightly, harden with heat) and an obsolete Costa Rican sense | Valid but highly polysemous; country and sense are essential |
| `aserruchar` | ASALE records ‘cut with a handsaw’ in Guatemala, Honduras, El Salvador, Nicaragua, Dominican Republic, Peru, Chile and Argentina, with popular/rural marks elsewhere; also figurative and Chilean senses | Valid verb and variant related to `serruchar`; do not treat it as a separate unrelated concept |

### Quality findings from this batch

- A candidate can be a genuine word and still be obsolete, rural, colloquial, figurative or narrowly technical. These are descriptive labels, not reasons to erase it from the language.
- Some forms are polysemous across countries (`aguarapar`, `ajicero`, `amelcochar`, `arrequintar`, `aserruchar`). A future category engine must associate a candidate with a sense, not only a spelling.
- The source explicitly marks `¡ahijuna!` and `apealar` as obsolete. This is a strong reason to preserve register metadata and make any game policy configurable rather than silently treating every attested form as equally current.
- `andinismo` is a clear positive example for a sport/activity category, while terms such as `alinderar` and `apealar` have narrower semantic domains.
- This check establishes dictionary evidence, not frequency in contemporary speech, universal acceptance, category membership, or permission to redistribute ASALE content.

### References

- ASALE DA, `agringar`: https://www.asale.org/damer/agringar
- ASALE DA, `aguarapar`: https://www.asale.org/damer/aguarapar
- ASALE DA, `¡ahijuna!`: https://www.asale.org/damer/%C2%A1ahijuna%21
- ASALE DA, `ahuesarse`: https://www.asale.org/damer/ahuesarse
- ASALE DA, `ajicero`: https://www.asale.org/damer/ajicero
- ASALE DA, `alinderar`: https://www.asale.org/damer/alinderar
- ASALE DA, `amelcochar`: https://www.asale.org/damer/amelcochar
- ASALE DA, `ameritar`: https://www.asale.org/damer/ameritar
- ASALE DA, `andinismo`: https://www.asale.org/damer/andinismo
- ASALE DA, `antipatizar`: https://www.asale.org/damer/antipatizar
- ASALE DA, `apealar`: https://www.asale.org/damer/apealar
- ASALE DA, `apunar`: https://www.asale.org/damer/apunar
- ASALE DA, `arrequintar`: https://www.asale.org/damer/arrequintar
- ASALE DA, `aserruchar`: https://www.asale.org/damer/aserruchar

This batch is documentation only. No ASALE definitions or database data were copied into STOP, no candidate was approved for runtime validation, and no game behavior was changed. The remaining review queue stays open.


## Fourth independent lexicographic batch: five candidates and two spelling controls

Audit date: 2026-11-26. This batch deliberately includes spelling/etymology controls so STOP does not inflate its accepted vocabulary by counting related forms as unrelated words.

| Candidate / control | Independent ASALE/RAE evidence | Classification and STOP decision signal |
|---|---|---|
| `arrimado` | ASALE's DA records several senses for a person living in another person's home, often at their expense, across Mexico, Central America, the Caribbean and much of South America; it also records a separate sense related to living in concubinage in Spain, Ecuador, Argentina and Uruguay | Attested adjective/noun with multiple country-specific senses. Do not reject it as “Latin-only”; preserve sense and register because some entries are marked derogatory |
| `arruinado` | ASALE's DA records adjective/noun senses for a coward in Honduras, El Salvador and Nicaragua; lacking virtues/capacities or being a failure in Nicaragua; decadent appearance in Uruguay; and annoying/inopportune or mischievous people in Bolivia and Honduras | Attested adjective/noun, but these are colloquial/derogatory person senses, not merely the general financial sense of `arruinado`. Sense must be explicit |
| `amacayo` | RAE-ASALE's *Tesoro de los diccionarios históricos* records the noun as a regional plant name (Amaryllis/Sprekelia), derived from Quechua `amankay`, with historical geographic descriptions for southern America and Mexico | Historically attested botanical common noun, not a proper name. Mark historical/botanical evidence; do not assume it is frequent or currently used throughout those regions |
| `acriollar(se)` | RAE-ASALE's historical dictionary records the verb for adopting the customs of the Hispanic-American country where a foreigner lives, with historical examples and regional descriptions including Argentina, Chile, Peru and Cuba | Historically attested verb; preserve reflexive/non-reflexive forms and historical/register metadata. Current everyday frequency is not established by this source |
| `arrimado` / `arrimarse` | RAE-ASALE's historical dictionary of Canarian Spanish documents `arrimarse` with a locally recorded sense ‘vivir maritalmente’; it also notes the DA's country distribution for `arrimado` | Related forms, but do not automatically merge the verb's Canarian sense with every adjective/noun sense of `arrimado`; model part of speech and sense separately |
| `amacayo` / `amancayo` | The historical dictionary cross-references `amacayo` with `amancay`, `amancaya` and `amancayo`; its separate `amancayo` entry describes other regional plant names and taxa | Spelling-family control: do not count these as independent concepts without confirming botanical referents and regional usage. Similar-looking names can denote different plants |
| `acriollar` / `acriollarse` | The historical entry gives both transitive and pronominal uses, with the pronominal form especially associated with adapting to local customs | Morphological control: store lemma and allowed inflection/reflexive behavior distinctly; do not treat every inflected form as a new lexical headword |

### Quality findings

- The dictionary evidence supports `arrimado` and `arruinado`, but some senses are socially marked (derogatory, popular or colloquial). A valid lexical entry should retain these labels rather than silently presenting all senses as neutral.
- `amacayo` and `acriollar` are supported here by historical lexicographic evidence, not by a current DA entry. They should therefore carry a historical-source flag and must not be represented as proven high-frequency contemporary vocabulary.
- Botanical names require special care: common names can refer to more than one species, and near-variant spellings may not be interchangeable. Category acceptance should rely on a sense/species mapping, not string similarity.
- Inflections and reflexive forms are not independent concepts. The future engine should connect them to a lemma and part of speech while preserving legitimate regional spellings.
- A source's failure to return a DA page is not evidence that a candidate is invalid. It only means that this particular independent reference did not corroborate it in this pass.

### References

- ASALE DA, `arrimado`: https://www.asale.org/damer/arrimado
- ASALE DA, `arruinado`: https://www.asale.org/damer/arruinado
- RAE-ASALE historical dictionary, `amacayo`: https://temporalweb.asale.org/tdhle/amacayo
- RAE-ASALE historical dictionary, `acriollar`: https://temporalweb.asale.org/tdhle/acriollar
- RAE-ASALE historical dictionary of Canarian Spanish, `arrimarse`: https://temporalweb.asale.org/tdhle/arrimarse
- RAE-ASALE historical dictionary, `amancayo`: https://temporalweb.asale.org/tdhle/amancayo

This batch records evidence and review controls only. No historical or ASALE definitions were copied into STOP; none of these candidates has been added to runtime validation. No dataset was imported and no game behavior was changed.


## Fifth semantic-control batch: regional senses, related plant names and register

Audit date: 2026-11-26. This small supplementary pass uses current ASALE *Diccionario de americanismos* entries to test engine rules that a spelling-only allowlist would miss. These are semantic controls, not an increase to the 233-root shared-candidate queue: queue membership for each item has not been re-established in this pass, so none is counted toward the 31 individually reviewed queue candidates.

| Lemma / control | Independent ASALE evidence | Engine implication |
|---|---|---|
| `aplazado, -a` | ASALE records a student who has not passed an exam/course across Honduras, El Salvador, Nicaragua, Costa Rica, Dominican Republic, Venezuela, Ecuador, Peru, Bolivia, Argentina and Uruguay; it also records a separate Dominican Republic sense meaning a person in a consensual union | One spelling carries an educational sense and a separate social sense. Category matching must select the intended sense; don't treat all senses as interchangeable |
| `aplanchar(se)` | ASALE records ‘iron clothes’ in Guatemala, Honduras, Nicaragua and Venezuela; Colombian senses include discouraging someone or losing motivation; other Central American senses also refer to ironing | The lemma is not necessarily exclusive to the Americas; the regional meaning and country distribution belong on the sense, not as a blanket label on the spelling |
| `apolillar(se)` | ASALE records ‘sleep/be asleep’ in Bolivia, Paraguay, Argentina and Uruguay, and a separate Peruvian sense ‘remain unmarried’ (of a woman) | Preserve distinct senses and register. A word can be a valid answer in one category/sense and unsuitable in another |
| `apandar` | ASALE records Mexican senses involving confinement in a punishment cell and, by extension, segregating someone; Cuban usage includes accumulating more of something than needed | A valid verb with sharply different country-specific meanings; a generic “word exists” flag is insufficient for category validation |
| `amancay` / `amancaya` / `amancayo` | ASALE records several botanical senses: in Colombia, Venezuela, Ecuador and Peru, plant/flower names associated with *Plumeria*; in Chile and Argentina, a different plant/flower associated with *Alstroemeria aurantiaca*. Related forms are not always botanically interchangeable | Botanical entries need a sense-to-taxon mapping. Do not merge similar spellings into one concept or infer species from string similarity |

### Findings

- This pass reinforces the core model: lexical headword → part of speech → sense → geographic distribution → register/domain → category eligibility.
- Country marks attach to a particular sense, not automatically to every use of a lemma.
- Botanical common names are especially risky for category scoring because one name can refer to different taxa in different regions.
- These examples are not approved runtime entries and do not change the 233-root queue count. They are evidence and test cases for future deterministic sense-aware validation.

### References

- ASALE DA, `aplazado`: https://www.asale.org/damer/aplazado
- ASALE DA, `aplanchar`: https://www.asale.org/damer/aplanchar
- ASALE DA, `apolillar`: https://www.asale.org/damer/apolillar
- ASALE DA, `apandar`: https://temporalweb.asale.org/damer/apandar
- ASALE DA, `amancay`: https://www.asale.org/damer/amancay
- ASALE DA, `amancaya`: https://www.asale.org/damer/amancaya
- ASALE DA, `amancayo`: https://temporalweb.asale.org/damer/amancayo

This supplementary audit records factual lexical findings and source links only. No ASALE definitions or database data were copied into STOP; no candidate was approved for runtime validation; no dictionary file or runtime code was changed.


## Source verification correction for fifth semantic-control batch

Audit date: 2026-11-26. The five ASALE lookups have now been checked directly. The core descriptions of `aplazado, -a`, `aplanchar(se)`, `apolillar(se)`, and `apandar` are supported by their individual DA entries. The `apandar` source is the temporal ASALE DA URL, not the historical-dictionary entry.

The botanical control needs a more precise distinction than the initial summary:
- ASALE's DA entry `amancay` records a Plumeria sense in southern Colombia, Venezuela, Ecuador and Peru, and a separate *Alstroemeria aurantiaca* sense in Chile and Argentina.
- DA `amancaya` records the Plumeria sense in Peru and the *Alstroemeria aurantiaca* sense in southern Bolivia.
- DA `amancayo` records the Plumeria sense in southern Colombia and Peru.
- Historical `amacayo` is a separate historical entry derived from Quechua `amankay`, with a historical *Amaryllis/Sprekelia* referent and historical geographic descriptions. Do not collapse `amacayo` into the current DA `amancay` senses merely because the forms are related.

This correction supersedes the broad wording in the fifth-batch table where it could imply that every related spelling has the same country distribution or botanical referent. The engine must retain each attested form, source, sense, region and taxon as separate linked records until a specialist confirms synonymy.

Verified references:
- ASALE DA, `aplazado`: https://www.asale.org/damer/aplazado
- ASALE DA, `aplanchar`: https://www.asale.org/damer/aplanchar
- ASALE DA, `apolillar`: https://www.asale.org/damer/apolillar
- ASALE DA, `apandar`: https://temporalweb.asale.org/damer/apandar
- ASALE DA, `amancay`: https://www.asale.org/damer/amancay
- ASALE DA, `amancaya`: https://www.asale.org/damer/amancaya
- ASALE DA, `amancayo`: https://temporalweb.asale.org/damer/amancayo
- RAE-ASALE historical dictionary, `amacayo`: https://temporalweb.asale.org/tdhle/amacayo

The source lookups support the distinctions above; they do not authorize copying the entries or importing their content into STOP.



## Sixth independent lexicographic batch: six corroborated candidates and one non-match control

Audit date: 2026-11-27. Six further roots from the 233-item shared Hunspell comparison queue were checked against individual entries in ASALE's *Diccionario de americanismos*. One additional candidate was checked as a negative lookup control. These checks record lexical evidence and sense distinctions; they do not approve runtime entries.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `afiebrar(se)` | ASALE records the pronominal sense ‘begin to have a fever’ in Mexico, Honduras, Panama, Cuba, Dominican Republic, Colombia, Ecuador, Peru, Bolivia, Chile, Paraguay, Argentina and Uruguay. It also records a less frequent transitive fever-causing sense in Colombia and Uruguay, plus separate figurative senses in Colombia, Honduras and Nicaragua | Valid verb with medical and figurative senses. Keep the intended sense and pronominal/transitive behavior separate; the spelling alone does not establish category fit |
| `atrenzo` | ASALE records the masculine noun in Argentina with the meaning ‘conflict, trouble or difficulty’ | Valid regional noun with a narrow abstract meaning; likely suitable only for categories that accept situations or abstract concepts |
| `atrincar(se)` | ASALE records several senses: tying/securing with ropes across Mexico, Central America, the Caribbean and much of South America; tightening/compressing in several countries; and distinct country-specific senses including wearing tight clothes, fighting, getting drunk, or feeling sudden pain | Valid but highly polysemous and often marked rural, popular or vulgar. The game must match the country-specific sense, register and category rather than accepting every sense everywhere |
| `azarear(se)` | ASALE records pronominal senses for becoming confused/disturbed in Spain, Panama, Ecuador and Bolivia; becoming irritated in Honduras, El Salvador and Bolivia; and becoming embarrassed in Guatemala, Nicaragua and Panama. It also records transitive ‘embarrass someone’ in Guatemala and Nicaragua | Valid verb with multiple distinct regional senses. Preserve pronominal vs transitive behavior and the geographic distribution of each sense |
| `azua` | ASALE records a feminine noun in central Ecuador meaning `asua` or `chicha de jora` | Valid food/drink-related noun, with a narrowly marked Ecuadorian sense; category matching should be based on the fermented corn drink sense |
| `bicicletero, -a` | ASALE records the masculine noun for tight knee-length shorts in Colombia; a bicycle-parking rack in Chile and Uruguay; a bicycle repairer/builder in Venezuela, Peru, Chile, Argentina and Uruguay; and additional adjective/person senses in Cuba and Chile, plus a colloquial Argentine sense for a swindler | Valid noun/adjective with unrelated senses and gender/person/object distinctions. Do not assign one universal definition or category to the spelling |
| `ajizal` (negative lookup control) | ASALE explicitly reports that `ajizal` is not an entry and suggests the related forms `ajisal` and `ajizar` | This lookup does not prove `ajizal` is invalid, but it does not corroborate it either. Do not silently substitute a suggested related form or merge it without separate evidence |

### Quality findings

- All six positively corroborated forms have sense-level information that a simple word-exists flag would lose.
- `afiebrar` and `atrincar` show why part of speech, reflexivity, register and country must be attached to a particular sense, not merely to the lemma.
- `atrenzo` and `azua` are clear examples of geographically narrow nouns whose category eligibility depends on the category model.
- `bicicletero` demonstrates that one headword can name an object, a profession, a person, an adjective or a colloquial social role in different countries.
- A failed dictionary lookup is recorded only as “not corroborated by this source”; it is not evidence that the form is fabricated or invalid.
- The six positive lookups are additional individually corroborated candidates from the existing 233-root queue. They do not establish that the other unreviewed roots are valid, nor do they authorize copying ASALE definitions or database content.

### References

- ASALE DA, `afiebrar`: https://www.asale.org/damer/afiebrar
- ASALE DA, `atrenzo`: https://www.asale.org/damer/atrenzo
- ASALE DA, `atrincar`: https://www.asale.org/damer/atrincar
- ASALE DA, `azarear`: https://www.asale.org/damer/azarear
- ASALE DA, `azua`: https://www.asale.org/damer/azua
- ASALE DA, `bicicletero`: https://www.asale.org/damer/bicicletero
- ASALE DA negative lookup, `ajizal`: https://www.asale.org/damer/ajizal

This batch is documentation only. No ASALE definitions or database data were copied into STOP, no candidate was approved for runtime validation, no dictionary was imported, and no game behavior was changed.



## Seventh independent lexicographic batch: ten further regional candidates

Audit date: 2026-11-27. Ten additional roots from the 233-item shared Hunspell comparison queue were checked against individual entries in ASALE's *Diccionario de americanismos*. The aim is to preserve sense, region, register and domain, not to turn a dictionary lookup into automatic game approval.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `bolsiquear(se)` | ASALE records furtively searching another person's pockets or bag to steal valuables in Colombia, Ecuador, Peru, Bolivia, northern Argentina and Uruguay; Bolivia and northern Argentina have a more specific sense involving a sleeping or drunk person. Ecuador also has a pronominal sense of searching one's own pockets | Valid verb with transitive and pronominal uses. Preserve the theft-related sense and regional distribution; don't reduce it to generic “searching pockets” |
| `buscapleitos` | ASALE records a person who provokes quarrels or disturbances in Nicaragua, Costa Rica, Panama, Puerto Rico, Chile, Argentina and Uruguay, and as a noun/adjective in Colombia, Venezuela and Peru. Dominican Republic and Bolivia have a separate, derogatory sense for a lawyer who delays proceedings for financial gain | Valid person noun/adjective with a separate legal/social sense in two countries. Category and register need sense-level selection |
| `cachimbo` | ASALE records numerous unrelated senses: a smoking pipe in Venezuela, Argentina, Dominican Republic, Puerto Rico and obsolete Uruguay; a ceremonial pipe in parts of Paraguay and northeastern Argentina; a first-year university student and a village military-band musician in Peru; several plant names in Colombia, Puerto Rico and Costa Rica; a large quantity in Guatemala, Honduras, El Salvador and Nicaragua; plus other country-specific senses | Strongly polysemous noun, including objects, people, plants and quantity. Never treat it as one universal meaning; category acceptance must select a documented country/sense pair |
| `cachumbo` | ASALE records a masculine noun in Colombia meaning a curl of hair in a spiral shape | Valid, narrow regional noun; category fit depends on whether STOP accepts hairstyle/appearance terms |
| `calandraco` | ASALE records a derogatory political designation for a member or supporter of the Conservative Party in Nicaragua. The related form `calandraco, -a` has other senses for an erratic, indolent or careless person in northern/northeastern/central Colombia, eastern Bolivia and Uruguay; an obsolete sense in Argentina and Uruguay; and thin-person senses in Cuba, Nicaragua and Honduras | Preserve the exact headword and separate adjectival/person senses. Political and derogatory labels need special treatment and should not be surfaced as neutral vocabulary |
| `calilla` | ASALE records a person who continually annoys others in Mexico, Guatemala, Honduras and Ecuador; “annoyance” in Nicaragua; a suppository in several Central American countries, Venezuela and obsolete Peru; a long thin type of tobacco in northern/southwestern Colombia and Venezuela; a cigarette butt in Panama; and a debt in Chile | Valid but highly polysemous noun. Some senses concern medicine, tobacco or debt; category filtering must use the intended sense and avoid inappropriate content |
| `camarotero, -a` | ASALE records a person working as a waiter on a passenger ship in Ecuador and Peru (masculine in the Dominican Republic entry) | Valid occupational noun; distinguish shipboard waiter from a generic waiter and preserve grammatical gender |
| `cantuta` | ASALE records the plant and its flower in Peru and Bolivia; the entry cross-refers to `kantuta`, which is explicitly traced to Aymara and Quechua | Valid botanical noun. Preserve spelling variants as linked forms, not duplicate concepts; botanical category mapping should identify the plant/flower |
| `carángano` | ASALE records a musical instrument in Colombia and Venezuela, a reference to `caranga` in Nicaragua and Panama, and a man with a bad temper in Panama | Valid noun with instrument, animal-related cross-reference and person senses. The musical instrument sense is distinct and can fit musical-instrument categories |
| `carato` | ASALE records a thick, cold refreshing drink made from ground rice or maize, or fruit pulp mixed with water and sweetened, in Puerto Rico (rural) and obsolete Venezuela; it also records a separate Puerto Rican cross-reference to `caruto`, while the adjective `carato, -a` has a Panamanian color sense | Valid but sense-specific food/drink noun, with obsolete and rural labels. Do not merge the beverage, plant cross-reference and adjective |
| `carnear` | ASALE records slaughtering and butchering a large animal for its meat in Mexico, Nicaragua, Ecuador, Peru, Bolivia, Chile, Paraguay, Argentina and Uruguay; metaphorical knife-attack senses in Mexico, Bolivia and criminal slang in Chile; and a vulgar/popular Mexican sense meaning to deceive | Valid verb with neutral agricultural and marked figurative/criminal senses. The game should retain the animal-processing sense separately from violent or vulgar meanings |

### Quality findings

- Ten additional candidates now have direct ASALE entry evidence, but evidence is not a blanket approval for all categories or all countries.
- `cachimbo`, `calilla` and `carnear` are particularly clear examples where one spelling spans different semantic domains and registers.
- `cantuta` / `kantuta` demonstrates how spelling variants can be linked without double-counting the underlying botanical concept.
- `calandraco` includes derogatory and political senses; any future player-facing definition or hint must retain the register and context and avoid presenting the label as neutral.
- Rural, obsolete, vulgar, criminal-slang and geographically narrow senses should be explicit metadata, not silently discarded or generalized.
- These checks do not prove frequency, current everyday use, or category suitability beyond the individual senses described.

### References

- ASALE DA, `bolsiquear`: https://www.asale.org/damer/bolsiquear
- ASALE DA, `buscapleitos`: https://temporalweb.asale.org/damer/buscapleitos
- ASALE DA, `cachimbo`: https://www.asale.org/damer/cachimbo
- ASALE DA, `cachumbo`: https://temporalweb.asale.org/damer/cachumbo
- ASALE DA, `calandraco`: https://www.asale.org/damer/calandraco
- ASALE DA, `calilla`: https://www.asale.org/damer/calilla
- ASALE DA, `camarotero`: https://www.asale.org/damer/camarotero
- ASALE DA, `cantuta`: https://www.asale.org/damer/cantuta
- ASALE DA, `kantuta`: https://www.asale.org/damer/kantuta
- ASALE DA, `carángano`: https://www.asale.org/damer/car%C3%A1ngano
- ASALE DA, `carato`: https://www.asale.org/damer/carato
- ASALE DA, `carnear`: https://www.asale.org/damer/carnear

This batch is documentation only. No ASALE definitions or database data were copied into STOP, no candidate was approved for runtime validation, no dictionary was imported, and no game behavior was changed.


## Eighth supplementary lexicographic check: agricultural tool term

Audit date: 2026-11-27. This focused check examined `carpidor` in ASALE's *Diccionario de americanismos*. Its membership in the original 233-root intersection queue was not re-established in this pass, so it is recorded as a supplementary lexical control and does not change the queue's reviewed-candidate count.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `carpidor` / `carpidora` | ASALE records `carpidor` as a masculine noun/adjective in Bolivia, Paraguay, Argentina and Uruguay for a machine or tool used to weed/clear soil. It separately records `carpidor, -ra` in Bolivia and Paraguay for a person who clears or weeds soil using such a tool | Preserve the instrument and occupational/person senses separately, along with grammatical gender and country coverage. It is an agricultural-tool term, not a generic synonym for every hoe or plough |

### Quality finding

This entry illustrates why the engine should store the semantic role (instrument versus person), part of speech, gender and region at sense level. The evidence supports those attested senses, but does not establish frequency, current everyday use in every listed country, or suitability for all STOP categories. Queue membership remains unverified and the term is not approved for runtime validation.

### References

- ASALE DA, `carpidor`: https://www.asale.org/damer/carpidor
- ASALE historical dictionary, `carpidora`: https://temporalweb.asale.org/tdhle/carpidora

This supplementary check is documentation only. No ASALE definitions or database data were copied into STOP, no dictionary was imported, and no runtime or game behavior was changed.


## Ninth supplementary lexicographic check: animal name and polysemous regional form

Audit date: 2026-11-27. Two additional ASALE entries adjacent to the current alphabetical review area were checked as supplementary controls. Their membership in the original 233-root intersection queue was not re-established in this pass; neither changes the reviewed-candidate count.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `carpincho` | ASALE records the masculine zoological sense in Ecuador, Peru, Bolivia, Paraguay, Argentina and Uruguay, identifying the species `Hydrochoerus hydrochaeris`. It also records a separate Bolivian colloquial sense of `carpincho, -a` meaning a carpenter | Keep the animal and occupational/person senses distinct. The animal sense can be evaluated for animal categories; the Bolivian colloquial person sense must not be conflated with the animal |
| `carretilla` | ASALE records several unrelated regional senses: a thread/wire reel in Mexico, Panama and Chile; a fast-talking person or rapid speech in parts of the Caribbean and northern South America; a small street-vending cart in Honduras, El Salvador and Peru; lower jaw in Chile, Paraguay, Argentina and Uruguay; and a football tackle in Peru, among others | This is a high-polysemy lemma. Store senses separately with country, grammatical gender and register; do not accept it as a generic object or vehicle without sense/category matching |

### Quality finding

These entries reinforce that a lemma-level country tag is insufficient. The lexical record must attach region, part of speech, register and semantic domain to each individual sense. A single spelling may denote an animal, a person, a tool, a body part or an action depending on locale.

### References

- ASALE DA, `carpincho`: https://www.asale.org/damer/carpincho
- ASALE DA, `carretilla`: https://www.asale.org/damer/carretilla
- ASALE, description and scope of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This supplementary check is documentation only. No dictionary data was copied or imported, no candidate was approved for runtime validation, and no game behavior was changed.



## Tenth independent lexicographic batch: three further candidates from the shared regional queue

Audit date: 2026-11-27. The next three entries in the reproducibly reconstructed 233-root intersection queue after the previously reviewed alphabetical section were checked against individual entries in ASALE's *Diccionario de americanismos*. These are lexical corroborations only; they do not approve runtime acceptance.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `cebado, -a` | ASALE records an adjective for a wild animal that has eaten human flesh and is therefore more dangerous in Colombia, Venezuela, Peru, Bolivia, Paraguay, Argentina and Uruguay; a separate sense describes an animal that regularly visits a place to hunt in Colombia, Venezuela, Ecuador and Chile. Person senses include someone unable to abandon a bad habit in northwestern Argentina and Uruguay, someone who assumes a one-time benefit will continue in Panama and Chile, and youth slang for someone skilled or excellent in Chile | This is an adjective, not a generic noun for food or bait. Keep animal and person senses separate, with country, register and evaluative tone. It should not be offered as a neutral animal label without the intended sense |
| `chambonear` | ASALE records working carelessly or without skill in Colombia, Venezuela, Bolivia, Argentina and Uruguay; making a botched job in Bolivia, Argentina and Uruguay, with youth use in Guatemala and Honduras. Separate senses include doing vulgar things to someone in Nicaragua, dancing reggaetón in Puerto Rico (youth), and preparing a firearm to shoot in Puerto Rico (youth) | Polysemous verb with neutral-ish colloquial work senses and separate vulgar / firearm-related senses. Preserve transitivity, region and register; do not surface sensitive senses as ordinary game hints |
| `chicotear` | ASALE records whipping someone in Mexico, Guatemala, Honduras, Nicaragua, Panama, Peru, Dominican Republic, Bolivia, Ecuador and Cuba (with varying usage labels); whipping an animal in Chile, Argentina, Uruguay and other marked varieties; and further senses including bothering someone, urging someone to hurry, moving a vehicle's rear end erratically in Argentina, throwing mortar onto a wall in Chile/Argentina, threshing rice in eastern Ecuador, and a vulgar sexual sense in Bolivia | Highly polysemous verb with physical punishment, construction, agricultural, figurative, slang and vulgar senses. Keep each sense and its transitivity/register separate; a spelling match alone is insufficient for category acceptance |

### Quality findings

- All three forms have individual ASALE entry evidence and belong to the reconstructed 233-root queue; this batch therefore adds three positively corroborated candidates to the queue review count.
- `cebado` shows that adjectival senses and noun-category eligibility must not be conflated.
- `chambonear` and `chicotear` show why verbs require sense-level grammatical behavior, country and register metadata; one lemma can include unrelated or sensitive meanings.
- The *Diccionario de americanismos* is descriptive and dialectal, and its own description emphasizes geographic, social and cultural information attached to individual senses. Its entries are evidence for review, not a license to copy its definitions or database.

### References

- ASALE DA, `cebado`: https://www.asale.org/damer/cebado
- ASALE DA, `chambonear`: https://www.asale.org/damer/chambonear
- ASALE DA, `chicotear`: https://www.asale.org/damer/chicotear
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No ASALE definitions or database data were copied into STOP, no dictionary was imported, no runtime candidate was approved, and no game behavior or production system was changed.


## Eleventh independent lexicographic batch: four further candidates from the shared regional queue

Audit date: 2026-11-27. The next four terms in the reconstructed 233-root intersection queue were checked against individual entries in ASALE's *Diccionario de americanismos*. Each entry contains multiple regional senses; this review records evidence without granting automatic category or runtime approval.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `cholo, -a` | ASALE records a wide range of country-specific noun/adjective senses: in some countries a person of Indigenous or mixed ancestry, in others a rural/campesino identity, a person from Peru or Bolivia, an affectionate term for a person, a cowardly person, a person of lower social class, and several other uses. Some senses are explicitly derogatory, popular, rural, obsolete or youth slang. The masculine form also has unrelated object/fruit/billiards senses in particular countries | Extremely sensitive and polysemous. Ethnic and class-related senses must never be treated as neutral labels or surfaced without context. Store only sense-specific, contextual evidence; category eligibility should normally exclude demographic labels |
| `chueco, -a` | ASALE records the adjective for something crooked/not straight across Mexico, Central America, the Caribbean and much of South America; further senses include dishonest or disloyal people, defective objects, illegal or suspicious dealings, forged documents, bow-legged or lame people, damaged things, and country-specific meanings | Broad adjective with several unrelated domains. Preserve adjective/person/object/business senses and country/register. A generic lemma match must not be used to infer a noun category or a single universal definition |
| `cigarrería` | ASALE records a feminine noun for an establishment selling cigarettes, tobacco and smokers' articles in the Dominican Republic, Ecuador (western region), Peru, Argentina and Uruguay, with obsolete use in Peru and Chile; Colombia has a broader shop sense that also sells liquor, wine, preserves and food | Regional commercial-place noun. Lexical evidence does not make it appropriate for every category; preserve the country-specific shop profile and the obsolete labels |
| `cochayuyo` | ASALE records a masculine noun in Peru, Bolivia and Chile for an edible marine alga, identifying the taxon *Durvillaea antarctica*; it also gives the Quechua-derived etymology and the Chilean related name `collofe` | Specific food/botanical noun. Keep the taxon and regional distribution attached to the sense; link `collofe` as a regional related form rather than assuming it is a separate species |

### Quality findings

- Four further terms from the 233-root queue now have individual ASALE corroboration. The running count for positively reviewed queue candidates advances from 50 to 54 of 233.
- `cholo` is a high-risk example: some senses concern ethnicity, ancestry or social class and are explicitly marked derogatory. A dictionary's attestation is not permission to present such labels as neutral game vocabulary.
- `chueco` demonstrates that an adjective may describe physical shape, conduct, documents, businesses or health; the game must not flatten those into one meaning.
- `cigarrería` and `cochayuyo` provide more straightforward shop and food/botanical senses, but still require country and category matching.
- ASALE's entries are descriptive evidence, not a wordlist license. No definitions or database content are copied into STOP.

### References

- ASALE DA, `cholo`: https://www.asale.org/damer/cholo
- ASALE DA, `chueco`: https://temporalweb.asale.org/damer/chueco
- ASALE DA, `cigarrería`: https://www.asale.org/damer/cigarrer%C3%ADa
- ASALE DA, `cochayuyo`: https://www.asale.org/damer/cochayuyo
- ASALE DA, related form `collofe`: https://www.asale.org/damer/collofe

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.


## Twelfth independent lexicographic batch: four further candidates from the shared regional queue

Audit date: 2026-11-27. The next four terms in the reconstructed 233-root intersection queue after the preceding alphabetical batch were checked against individual entries in ASALE's *Diccionario de americanismos*. The source records regional senses and usage labels; the evidence is not automatic approval for every STOP category.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `coimear` | ASALE records a transitive sense in Nicaragua, Panama, Peru, Bolivia, Chile, Paraguay, Argentina and Uruguay meaning giving money or gifts to obtain something illicitly; an intransitive sense in Peru, Bolivia, Argentina and Uruguay for giving or receiving a bribe; and a separate Honduran sense meaning earning money | Verb directly associated with bribery/corruption in most listed regions, plus a distinct Honduran meaning. Preserve transitivity, region and register; do not collapse the Honduran sense into the bribery senses or present illegal conduct as a neutral activity |
| `coloniaje` | ASALE records a masculine noun across Mexico, Central America, the Caribbean and much of South America for the historical period in which some American countries were colonies of Spain; the entry carries historical/loanword and usage labels | Historical noun with broad regional documentation. Category fit depends on whether STOP accepts historical periods or events; don't confuse it with a generic colony or colonial building |
| `complotar(se)` | ASALE records pronominal senses for conspiring/confabulating in Mexico, Guatemala, Honduras, Cuba, Dominican Republic, Peru, Bolivia, Chile, Argentina and Uruguay; joining together against another person or group, generally for political purposes, in Venezuela, Peru, Bolivia and Chile; conspiring in Guatemala, Dominican Republic, Ecuador and Uruguay; and a Chilean sense where two or more causes combine to produce a result | Verb with pronominal and intransitive uses and political/social senses. Keep grammatical construction and country attached to each sense; don't infer that all senses are political |
| `conferencista` | ASALE records a common-gender noun across Mexico, Central America, the Caribbean and South America for a person who gives a conference or participates in one | Broadly documented occupational/role noun. Preserve common gender (`el/la conferencista`) and the distinction between speaker and participant; category fit is strongest for professions or roles |

### Quality findings

- Four further terms from the 233-root queue have individual ASALE corroboration. The positively reviewed queue count advances from 54 to 58 of 233.
- `coimear` illustrates why a single lemma can have ethically and semantically distinct regional senses; a Honduran “earn money” sense must not be merged with bribery senses.
- `complotar(se)` requires preserving reflexive/pronominal constructions and distinguishing conspiracy from the Chilean “combine to produce a result” sense.
- `conferencista` is a useful common-gender example: grammatical gender should not be inferred from the final letter alone.
- ASALE describes its work as a descriptive, dialectal and differential repertory, with geographic, social and cultural information attached to individual senses. This is corroboration, not permission to copy definitions or database content.

### References

- ASALE DA, `coimear`: https://www.asale.org/damer/coimear
- ASALE DA, `coloniaje`: https://www.asale.org/damer/coloniaje
- ASALE DA, `complotar`: https://www.asale.org/damer/complotar
- ASALE DA, `conferencista`: https://www.asale.org/damer/conferencista
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.


## Thirteenth independent lexicographic batch: four further candidates from the shared regional queue

Audit date: 2026-11-27. The next four terms in the reconstructed 233-root intersection queue were checked against individual entries in ASALE's *Diccionario de americanismos*. The recorded senses are geographically and grammatically specific; none is automatically approved for all game categories.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `conguito` | ASALE records a masculine noun in the Dominican Republic for a congo drum; as an adjective there for an arm or leg that is short and thick, and for a woman who is short and stout; Panama has a separate noun sense for a chili pepper plant and its fruit | Keep the instrument, physical-description adjective and plant/fruit senses separate. The person-description sense may be sensitive or insulting depending on context and should not be used as a neutral player-facing label |
| `conscripto, -a` | ASALE records a masculine noun in Mexico, Nicaragua, Dominican Republic, Venezuela, Ecuador, Peru, Bolivia, Paraguay and Uruguay for a person performing compulsory military service; Honduras, Puerto Rico and Argentina are marked obsolete. Colombia and Chile record masculine/feminine forms | Military/person noun with regional and obsolete labels. Preserve common-gender behavior in Colombia and Chile and do not infer that the term means any professional soldier |
| `contesta` | ASALE records a feminine noun, an apocope of `contestación`, for a response or answer in the United States and Venezuela; Panama, Cuba, Dominican Republic and Chile (rural), and Colombia (popular) | Regional feminine noun with marked rural/popular usage in several countries. Keep it distinct from the verb form `contesta` (third-person or imperative of `contestar`); part of speech is essential to avoid a false lexical/category match |
| `contraloría` | ASALE records a feminine noun in Mexico, Guatemala, Honduras, El Salvador, Nicaragua, Costa Rica, Panama, Dominican Republic, Colombia, Venezuela, Ecuador, Peru, Bolivia, Chile and Paraguay for a public office responsible for auditing accounts and the legality of state expenditure; a second sense names the Comptroller General's office in Mexico, several Central American countries, Bolivia, Chile and Uruguay | Public-administration institution noun. Preserve the institutional sense and the narrower proper-office sense; do not treat it as a generic synonym for any control or audit |

### Quality findings

- Four further terms from the 233-root queue have individual ASALE corroboration. The positively reviewed queue count advances from 58 to 62 of 233.
- `conguito` contains unrelated instrument, descriptive and botanical senses; country must attach to each sense.
- `conscripto` is a person noun with obsolete country labels and a gender pattern that differs by region.
- `contesta` highlights a critical homograph trap: the ASALE noun is not the ordinary verbal form. The engine must store part of speech and sense, not merely spelling.
- `contraloría` is a specific public institution; category eligibility should use the institutional concept, not a loose string match.
- ASALE's *Diccionario de americanismos* is descriptive and attaches geographic, social and cultural information to senses. It is evidence for linguistic review, not permission to copy definitions or database content.

### References

- ASALE DA, `conguito`: https://www.asale.org/damer/conguito
- ASALE DA, `conscripto`: https://temporalweb.asale.org/damer/conscripto
- ASALE DA, `contesta`: https://temporalweb.asale.org/damer/contesta
- ASALE DA, `contraloría`: https://www.asale.org/damer/contralor%C3%ADa
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.



## Fourteenth independent lexicographic batch: four further candidates from the shared regional queue

Audit date: 2026-11-27. The next positively corroborated entries in the reconstructed 233-root intersection queue were checked against individual ASALE *Diccionario de americanismos* entries. The intervening form `corar` was not positively corroborated in this source during this pass and is therefore not counted; absence from this dictionary is not evidence that a form is invalid.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `controversial` | ASALE records an adjective for a person or thing that provokes debate or discussion in the United States, Mexico, Nicaragua, Costa Rica, Cuba, Dominican Republic, Puerto Rico, Colombia, Venezuela, Ecuador, Peru, Bolivia, Paraguay, Argentina and Uruguay; Chile is marked as cultured-to-standard usage | Adjective, not a noun meaning “controversy”. Preserve its grammatical category and country labels; do not infer suitability for noun-only categories |
| `correntoso, -a` | ASALE records an adjective in Honduras, Nicaragua, Puerto Rico, Colombia, Ecuador, Peru, Bolivia, Chile, Argentina and Uruguay, marked obsolete in the entry, referring to a river or watercourse with a rapid, forceful flow; it gives `torrentoso` as a related equivalent | Geographical/hydrological adjective with an obsolete label. Keep the watercourse sense and regional status; do not generalize it to any fast-moving object |
| `coyotero, -a` | ASALE records in Mexico an adjective for a dog trained to pursue coyotes, and in Ecuador a noun sense equivalent to a person who handles procedures or paperwork (the broader `coyote` entry also cross-refers to `coyotero` for intermediary/agent senses) | Preserve the Mexican canine adjective separately from the Ecuadorian person/occupation noun. Do not flatten this into the animal name `coyote` or assume all countries share the same sense |
| `criandera` | ASALE records a feminine noun in Honduras and Cuba for a wet nurse; Honduras also has a rural sense for a cow or mare that is raising young | Feminine noun with distinct human-care and livestock senses. Preserve the rural label and semantic domain; do not treat it as a generic animal or profession without sense matching |

### Quality findings

- Four further entries in the 233-root queue have individual ASALE corroboration. The positively reviewed queue count advances from 62 to 66 of 233.
- `controversial` is a useful adjective-category control: lexical existence does not make an adjective eligible for a noun category.
- `correntoso` carries an obsolete label in the source; historical or obsolete attestation must not be silently presented as ordinary current usage.
- `coyotero` has unrelated grammatical and semantic roles by country, demonstrating why part of speech and sense-level region are mandatory.
- `criandera` has human-care and animal-husbandry senses, which must remain distinct.
- ASALE's *Diccionario de americanismos* is descriptive and records geographic and usage labels at sense level. Its entries are corroboration for review, not permission to copy definitions or database content.

### References

- ASALE DA, `controversial`: https://www.asale.org/damer/controversial
- ASALE DA, `correntoso`: https://www.asale.org/damer/correntoso
- ASALE DA, `coyotero`: https://www.asale.org/damer/coyotero
- ASALE DA, `criandera`: https://www.asale.org/damer/criandera
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.



## Fifteenth independent lexicographic batch: two ASALE-confirmed candidates and two source-status controls

Audit date: 2026-11-27. The next four forms in the alphabetical review area were checked against ASALE and supplementary lexicographic sources. Only the two forms with individual ASALE entries are added to the positively corroborated ASALE queue count. The other two are recorded as controls, not silently treated as ASALE-confirmed.

| Candidate | Independent evidence | Classification and STOP caution |
|---|---|---|
| `cuerazo` | ASALE records multiple unrelated senses: an attractive/b well-formed body or attractive person in several countries; a whip-lash in parts of Central America and northern South America; a fall or blow, a drink, and a vulgar sexual sense in Cuba; a lightning thunderclap in Costa Rica; and a separate feminine noun sense for a prostitute in the Dominican Republic | Extremely polysemous and register-sensitive. Preserve each sense, gender, country and usage label. Avoid surfacing sexualized or vulgar senses as neutral game vocabulary; a bare spelling match is not enough for category eligibility |
| `cueriza` | ASALE records a feminine noun for a beating/corporal punishment in Mexico, Panama, Cuba, Colombia, Venezuela, Ecuador, Peru and Bolivia; a further sense in Cuba, Puerto Rico and Bolivia is a beating/flogging | Feminine noun with overlapping but separately marked regional senses. Its meaning concerns physical punishment; do not treat it as a generic “hit” or neutral object |
| `cúlmine` | Not found as an ASALE headword in this pass. A language-advice source reports use in Chile and Argentina with the sense “culminating/high point”, while noting it is absent from general dictionaries and corpora consulted by that source | Do not count as ASALE-confirmed or treat the secondary source as equivalent to a dictionary entry. Keep it pending stronger corpus/lexicographic evidence and check spelling/inflection carefully |
| `cunchu` | Not found as an ASALE headword in this pass. The DLE-derived Iedra entry records a rural Ecuadorian masculine noun meaning the residue/bran of chicha; a historical lexicographic discussion also reports this sense and questions the precise geographic label | Evidence exists outside ASALE, but the country attribution and current usage require confirmation. Keep it pending independent contemporary Ecuadorian evidence; do not merge it automatically with `concho` |

### Quality findings

- Two further entries in the 233-root queue have individual ASALE corroboration. The positively reviewed ASALE queue count advances from 66 to 68 of 233.
- `cuerazo` is a strong test of sense-level safeguards: one spelling spans appearance, punishment, injury, drink, vulgar sexual usage and weather-related sound.
- `cueriza` is a regional feminine noun for corporal punishment; semantic category and register need to be retained.
- `cúlmine` and `cunchu` are deliberately not counted in the ASALE total. Their supplementary evidence is a lead for further verification, not approval for runtime acceptance.
- ASALE's *Diccionario de americanismos* is descriptive and attaches geographic, social and cultural labels to individual senses. Its entries corroborate lexical review; they do not grant permission to copy definitions or database content.

### References

- ASALE DA, `cuerazo`: https://www.asale.org/damer/cuerazo
- ASALE DA, `cueriza`: https://www.asale.org/damer/cueriza
- Language-advice discussion of `cúlmine`: https://www.elcastellano.org/node/48158
- DLE-derived entry for `cunchu`: https://iedra.es/palabras/cunchu
- Historical lexicographic discussion of `cunchu`: https://sisbib.unmsm.edu.pe/BibVirtual/Publicaciones/Alma_Mater/2000_n18-19/diccionario.htm
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.



## Sixteenth independent lexicographic batch: four further candidates from the shared regional queue

Audit date: 2026-11-27. The next four not-yet-reviewed entries after `cunchu` in the reconstructed 233-root intersection queue were checked against individual ASALE *Diccionario de americanismos* entries. The intervening `cuy` was already reviewed in the first batch and is not counted again.

| Candidate | Independent ASALE evidence | Classification and STOP caution |
|---|---|---|
| `demeritar(se)` | ASALE records a transitive use across Mexico, Guatemala, Honduras, Nicaragua, Panama, Cuba, Puerto Rico, Colombia, Venezuela, Ecuador, Bolivia, Argentina and Uruguay, with cultured-use labels in Costa Rica and Chile, meaning to remove merit or diminish the value of a person or thing. It separately records a pronominal intransitive use in Colombia and Venezuela meaning to lose one's credit or reputation | Verb with transitive and pronominal constructions. Preserve the argument structure and country labels; do not merge it with the related variant `desmeritar` as though spellings and regional coverage were identical |
| `denguear` | ASALE records an intransitive popular use in Colombia and western Venezuela meaning to sway or move the body with affected/marked movement. The historical dictionary also documents older senses and additional uses in other countries, including a youth-jargon sense in Peru | Polysemous verb with regional, historical and youth-jargon evidence. Keep the ASALE current regional sense distinct from historical senses and the separate Peruvian slang sense; do not infer universal current use |
| `desaterrar` | ASALE records a transitive use in Honduras, Nicaragua and Costa Rica, and rural Mexico, meaning to remove earth from a place such as a road, ditch or conduit to clear it; a less-used Ecuadorian sense concerns removing rubble or earth to level a place | Technical/practical verb with regional and rural labels. Preserve the construction and earth-removal sense; do not confuse it with generic excavation or unrelated meanings of `aterrar` |
| `descachazar` | ASALE records a transitive agricultural/industrial use in Guatemala, Honduras, Cuba and Colombia, and rural Costa Rica and Ecuador, meaning to remove the cachaza (impurities/foam) from sugar-cane juice | Specialized sugar-processing verb. Preserve its agricultural domain and transitivity; it should not be treated as a general synonym for cleaning or filtering |

### Quality findings

- Four further entries in the 233-root queue have individual ASALE corroboration. The positively reviewed ASALE queue count advances from 68 to 72 of 233.
- `demeritar` demonstrates the need to retain transitivity and pronominal behavior as distinct lexical constructions.
- `denguear` shows why a historical attestation or a separate youth-jargon sense must not be conflated with a current regional sense.
- `desaterrar` and `descachazar` are domain-specific verbs; lexical existence alone does not make them suitable for arbitrary categories.
- ASALE's *Diccionario de americanismos* is descriptive and records geographic and usage labels at sense level. Its entries corroborate review; they do not grant permission to copy definitions or database content.

### References

- ASALE DA, `demeritar`: https://www.asale.org/damer/demeritar
- ASALE DA, `denguear`: https://www.asale.org/damer/denguear
- ASALE historical dictionary, `denguear`: https://temporalweb.asale.org/tdhle/denguear
- ASALE DA, `desaterrar`: https://www.asale.org/damer/desaterrar
- ASALE DA, `descachazar`: https://www.asale.org/damer/descachazar
- ASALE, scope and descriptive character of the *Diccionario de americanismos*: https://www.asale.org/obras-academicas/diccionarios/diccionario-de-americanismos

This batch is documentation only. No dictionary was imported, no runtime candidate was approved, and no game behavior, master branch or production system was changed.
