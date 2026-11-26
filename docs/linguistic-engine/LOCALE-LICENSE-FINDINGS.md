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
