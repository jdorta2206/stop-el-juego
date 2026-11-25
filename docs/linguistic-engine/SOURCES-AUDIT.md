# Source and license audit — linguistic engine

Audit date: 2026-11-25
Scope: preliminary public-source review for a commercial/proprietary game. This is an engineering screening, not legal advice or a final legal opinion. No third-party word data is imported by this document.

## Findings

### 1. RAE / ASALE (Spanish)

- ASALE's published legal notice states that RAE owns or licenses the website and its contents, reserves rights, and expressly prohibits commercial reproduction, transformation, distribution, communication, extraction or reuse without prior written authorization.
- Decision: do not scrape the DLE, mirror its entries, or bundle its content in STOP. It can be used as a human research/reference destination only, subject to its terms. Seek a written license or an official data/API agreement before any programmatic reuse.
- Source: https://www.asale.org/info/asale/aviso-legal

### 2. Hunspell / LibreOffice dictionaries (all four languages)

- Hunspell is a spelling and morphological analysis technology. The Hunspell engine itself is tri-licensed LGPL/GPL/MPL, but that license does not automatically license individual dictionary datasets.
- LibreOffice dictionary files have separate upstream licensing; each language/locale must be checked at its own upstream directory and retained with its notices. Aggregator repositories explicitly warn that the underlying .dic/.aff files retain their original licenses.
- Decision: strongest practical candidate for spelling/morphology support, but no dictionary file is approved until the exact locale, upstream repository, commit/release, license text, attribution, and redistribution obligations are recorded. A spellchecker does not establish semantic category membership.
- Sources:
  - https://github.com/hunspell/hunspell
  - https://github.com/LibreOffice/dictionaries
  - https://github.com/plainlib/dictionaries (use only as a discovery index, not as the legal authority)

### 3. Wiktionary data dumps

- Wiktionary's original entry text is generally offered under CC BY-SA 4.0 and GFDL, but entries can contain imported third-party material under different terms.
- Commercial use is not automatically prohibited, but attribution and share-alike obligations can affect redistributed derivatives and the wider product/data bundle. Imported material requires per-entry scrutiny.
- Decision: not suitable as an unfiltered direct wordlist import for the current proprietary game. Reconsider only after legal review of the exact dump, per-entry licensing/provenance, attribution implementation, and share-alike compatibility.
- Sources:
  - https://en.wiktionary.org/wiki/Wiktionary:Copyrights
  - https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use

### 4. Apertium

- Apertium is an open machine-translation ecosystem with lexical data and language-pair packages; licenses can vary by package and data component, with GPL common in the project.
- Decision: candidate for linguistic analysis/morphology only after auditing the exact package and its license. Do not bundle GPL data into STOP by default; evaluate obligations and compatibility first.
- Sources:
  - https://wiki.apertium.org/wiki/Documentation
  - https://api.old.datahub.io/en/dataset/apertium (discovery metadata only; package license must be checked upstream)

## Practical source strategy by game language

| Language | Locale targets | Current safe status |
|---|---|---|
| Spanish | es-ES and Latin American locales (es-MX, es-AR, es-CO, es-CL, es-PE, es-VE, etc.) | RAE/ASALE content not approved for commercial extraction; audit independent open spelling/morphology sources locale-by-locale. |
| English | en-US, en-GB, en-CA, en-AU, en-NZ, en-ZA, en-IE | Hunspell/SCOWL-family sources are candidates; inspect exact locale package license and provenance. |
| Portuguese | pt-BR, pt-PT | Audit each locale independently; do not assume one Portuguese list covers both. |
| French | fr-FR, fr-CA, fr-BE, fr-CH, fr-LU | Audit each locale independently; distinguish spelling variants and regional vocabulary. |

The locale list is a target for coverage, not proof that a complete compatible dataset exists for each locale.

## Data approval gate

A dataset can enter the build only when all fields below are present:
- stable source name and canonical upstream URL;
- exact release, commit, or dump date and cryptographic checksum;
- exact locale/variety and language;
- license identifier plus a copy of the license text;
- required copyright notices and attribution;
- documented commercial-use, modification, redistribution, and share-alike obligations;
- record of excluded third-party/imported entries where applicable;
- technical tests for false positives, morphology, regional forms, and category separation;
- explicit approval after legal review where terms are ambiguous.

## Engineering conclusion

There is no single ready-made, legally uncomplicated dictionary that solves all four languages and their regional varieties. The practical path is a source-backed hybrid:
1. per-locale spelling/morphology datasets with verified compatible licenses;
2. separately sourced lexical/regional evidence for words not covered by spellcheck lists;
3. category evidence kept independent from lexical existence;
4. a provenance manifest and deterministic, versioned importer;
5. online and offline clients consuming the same approved data release.

Do not treat a successful spellcheck as proof that a word is a correct answer to any category. Do not let an AI model certify unknown words on its own.


## Concrete locale inventory discovered in LibreOffice dictionaries (preliminary)

The upstream LibreOffice repository exposes a particularly useful coverage map:
- Spanish package includes separate files for es_AR, es_BO, es_CL, es_CO, es_CR, es_CU, es_DO, es_EC, es_ES, es_GQ, es_GT, es_HN, es_MX, es_NI, es_PA, es_PE, es_PH, es_PR, es_PY, es_SV, es_US, es_UY and es_VE.
- English package metadata lists en_AU, en_CA, en_GB and en_US; en_ZA is also listed in the package description.
- Portuguese has distinct pt_BR and pt_PT directories.
- French has a French dictionary package (fr_FR); separate Canadian French lexical coverage still needs a dedicated source audit.

This is meaningful progress: the Spanish package already models many of the regional varieties that STOP needs, rather than forcing one generic Spanish list.

### Exact license evidence checked (still subject to final legal review)

| Locale/package | Evidence found upstream | Engineering decision |
|---|---|---|
| Spanish regional dictionaries | README states the .aff/.dic dictionary is dual/disjunctively available under GPL-3.0-or-later, LGPL-3.0-or-later, or MPL-1.1-or-later. | Candidate worth prioritizing; verify the exact current LICENSE.md, notices, and chosen license for the pinned release. Do not import yet. |
| Portuguese Brazil (pt_BR) | README states LGPLv3 and Mozilla Public License; contributor credits are identified. | Candidate; pin exact release and retain both required notices/terms. |
| Portuguese Portugal (pt_PT) | LICENSES.txt says spelling files are covered by GPL and BSD; extension distribution has GPL terms. | Do not import into the proprietary bundle until counsel confirms the exact file-level grant and distribution model. |
| English variants | Package metadata confirms distinct regional packages. | Coverage confirmed, but each dictionary's own README/license still must be audited before use. |
| French (fr_FR) | LibreOffice package points to Dicollecte/Grammalecte dictionary files; a current MPL-2.0 notice is visible in the upstream affix file. | Candidate, but audit the matching .dic, README, contributors, and exact release as a unit. Do not infer the entire package's license from the .aff header alone. |
| French Canada (fr_CA) | Not established by the inspected LibreOffice package. | Separate source required; no coverage claim yet. |

### Important implementation consequence

These resources are spelling/morphology datasets. They are not a complete semantic dictionary and do not decide whether a response is an animal, fruit, object, place, name, or brand. The engine must use them as one lexical evidence layer, then separately verify category membership. A spelling dictionary may include proper names, technical terms, inflections, and compounds that need category-specific treatment.

### Sources inspected

- LibreOffice Spanish locale manifest: https://github.com/LibreOffice/dictionaries/blob/master/Dictionary_es.mk
- Spanish Hunspell license statement: https://github.com/LibreOffice/dictionaries/blob/master/es/README_hunspell_es.txt
- Brazilian Portuguese license statement: https://github.com/LibreOffice/dictionaries/blob/master/pt_BR/README_pt_BR.txt
- European Portuguese license statement: https://github.com/LibreOffice/dictionaries/blob/master/pt_PT/LICENSES.txt
- English locale package description: https://github.com/LibreOffice/dictionaries/blob/master/en/package-description.txt
- French dictionary package manifest: https://github.com/LibreOffice/dictionaries/blob/master/Dictionary_fr.mk
- RAE/ASALE legal notice: https://www.asale.org/info/asale/aviso-legal

No file from these packages has been downloaded, copied, transformed, or included in STOP by this audit.


## Follow-up audit: English SCOWL and Canadian French

Audit update: 2026-11-25.

### English: SCOWL-derived Hunspell dictionaries

The upstream English Hunspell README identifies a maintained release (2026.02.25, commit 7e99eda) and the following actual variants: en_US, en_CA, en_GB-ise, en_GB-ize and en_AU. It distinguishes normal size-60 dictionaries from larger size-70 variants and explicitly warns that the larger lists are less carefully checked and can contain misspellings or problematic uncommon words.

The same README gives a permissive SCOWL grant: use, copy, modify, distribute and sell word lists and derivatives without fee, provided the copyright and permission notices are retained in copies and supporting documentation. It separately identifies the Ispell-derived affix file under a BSD-style license with redistribution notice requirements, and identifies Benjamin Titze's Australian contribution with its own notice.

- Decision: strong candidate for en-US, en-CA, en-AU and both British spelling tracks. Prefer the normal size-60 release for the initial import; do not use the larger lists as an unreviewed acceptance authority. Keep the wordlist and affix-file notices distinct in the provenance manifest.
- en-NZ, en-ZA and en-IE are not included in this SCOWL Hunspell release list; do not claim they are covered by it. They need separate sources or explicitly documented fallback policy.
- Exact release, commit and per-file checksums still need to be pinned and independently verified before import.
- Sources:
  - https://wordlist.aspell.net/hunspell-readme/
  - https://wordlist.aspell.net/dicts/

### French Canada: important distinction between locale aliases and regional data

A packaging recipe for Grammalecte/Dicollecte's French Hunspell dictionary creates fr_CA aliases by pointing them to the same fr_FR .aff/.dic files. This establishes technical compatibility under the fr_CA locale code, but it does NOT establish Canadian French lexical coverage or a distinct Canadian vocabulary source.

Usito, developed at Université de Sherbrooke, explicitly describes standard French in use in Québec and North American French vocabulary. It is a promising human-reference and lexical research source, but the pages inspected do not establish a redistribution license for bulk extraction or bundling.

- Decision: do not mark fr_CA as covered by the fr_FR alias. Keep fr_CA regional coverage open.
- Usito may guide manual research and regional evidence discovery; do not scrape or import its content until a written data license or explicit reuse terms are confirmed.
- A separate Hydro-Québec French Ispell dictionary exists in Debian's package catalog, but its exact upstream source and license have not yet been audited; it remains a research lead, not an approved source.
- Sources:
  - https://github.com/void-linux/void-packages/blob/master/srcpkgs/hunspell-fr_FR/template
  - https://www.usherbrooke.ca/usito/
  - https://packages.debian.org/ca/trixie/ifrench

### Updated coverage decision

| Locale | Current evidence | Status |
|---|---|---|
| en-US | SCOWL/Hunspell current release; permissive SCOWL notice plus BSD-style affix notice | Candidate; pin files and notices |
| en-CA | Same release and license structure | Candidate; pin files and notices |
| en-GB | en-GB-ise and en-GB-ize tracks | Candidate; pin files and notices |
| en-AU | SCOWL/Hunspell current release; separate Australian contributor notice | Candidate; preserve separate notice |
| en-NZ, en-ZA, en-IE | Not established by this SCOWL release | Open; separate sources required |
| fr-CA | fr_FR alias exists in some packages, but no independent Canadian lexical dataset established | Open; alias is not regional coverage |
| fr-CA reference | Usito describes Quebec standard French; redistribution terms not established | Human research only; no import |

This audit narrows the next implementation scope: only datasets with exact release, checksum, file-level license, and complete notices may be admitted. A locale alias must never be mistaken for a regionally curated wordlist.


## Follow-up audit: English New Zealand/South Africa and French locale aliases

Audit update: 2026-11-25.

### English New Zealand (en_NZ) and South Africa (en_ZA)

The Elastic Hunspell dictionary source configuration identifies separate upstream packages:
- en_NZ: "English (New Zealand)", sourced from the Apache OpenOffice English New Zealand dictionary, metadata license LGPL 2.1.
- en_ZA: "English (South Africa)", sourced from the Apache OpenOffice English dictionaries package, metadata license LGPL.

This is stronger evidence than a generic en_GB fallback: distinct locale packages exist. However, this is a downstream packaging manifest, not the upstream license file or the exact wordlist release. The exact source archive, copyright notices, file-level license and redistribution terms still need to be checked at upstream before any import.

- Decision: en_NZ and en_ZA become identified source leads, not approved datasets. Keep them out of the import until upstream files and license texts are pinned and reviewed.
- en_IE (Ireland) remains unresolved: this audit did not establish a distinct Irish English Hunspell dataset. Do not silently map it to en_GB.

Sources:
- https://github.com/elastic/hunspell/blob/master/conf.yaml

### French Canada and other French locale aliases

A Solus package recipe for Grammalecte's French 7.7 dictionary installs the same fr_FR .aff/.dic files as symlinks for fr_BE, fr_CA, fr_CH and fr_LU. This confirms these locale codes are often compatibility aliases, not independently curated regional dictionaries.

- Decision: keep fr_CA, fr_BE, fr_CH and fr_LU regional lexical coverage unproven by that package. A shared fr_FR spelling base may be useful as a baseline only after licensing review, but it must not be represented as regional vocabulary coverage.
- The French dictionary's MPL-2.0 package metadata is a useful lead, but the upstream archive and its exact README/license notices must still be pinned and verified.
- Sources:
  - https://github.com/getsolus/packages/blob/main/packages/hunspell-fr/package.yml
  - https://github.com/void-linux/void-packages/blob/master/srcpkgs/hunspell-fr_FR/template

### Updated decision table

| Locale | Evidence now found | Status |
|---|---|---|
| en-NZ | Separate OpenOffice dictionary package identified; downstream metadata says LGPL-2.1 | Source lead only; upstream archive/license audit pending |
| en-ZA | Separate OpenOffice English package identified; downstream metadata says LGPL | Source lead only; upstream archive/license audit pending |
| en-IE | No distinct dataset established | Open |
| fr-CA / fr-BE / fr-CH / fr-LU | Some packages create aliases to fr_FR files | Not proof of regional lexical coverage |
| fr-FR | Grammalecte/Dicollecte dictionary available; package metadata reports MPL-2.0 | Candidate baseline only; exact upstream archive and notices still need pinning |

No additional dictionary files have been downloaded, copied, transformed, or added to STOP.
