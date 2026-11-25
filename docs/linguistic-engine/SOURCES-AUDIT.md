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
