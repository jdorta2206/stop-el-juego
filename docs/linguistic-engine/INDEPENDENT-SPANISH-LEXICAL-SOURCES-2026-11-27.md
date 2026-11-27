# Independent Spanish lexical-source review — 2026-11-27

Status: research only. No source below is approved for the STOP runtime dictionary by this document.

## Why this review exists

The LibreOffice Hunspell inventory is a candidate-discovery source, not independent evidence that a spelling is a current Spanish word. The 21-locale inventory contains 65,558 distinct NFC + case-folded spellings, including inflections and entries that may need lexical or game-rule review. A second source must be evaluated independently before a candidate can receive lexical approval.

## Shortlist and decision

| Resource | Evidence and scope | Published license / restrictions | Current decision |
|---|---|---|---|
| RLA-ES / olea lemarios | Spanish lemma and word lists; repository says files are UTF-8 and materials are dedicated to the public domain. The project page explicitly marks several displayed historical lists as outdated. | Public-domain dedication is stated by the repository. | **Investigate, not approve.** Pin the exact file/revision, inspect its own header and history, verify provenance and distinguish the general lemario from conjugation lists, proper names and historical files. Do not assume the old 80k list is current. |
| Multilingual Central Repository MCR-3.0 Spanish WordNet | Spanish nouns, verbs and adjectives organized into synsets and lexicalizations. It can provide independent sense/POS evidence, not comprehensive regional coverage or a full spelling dictionary. | The UPC license page says the MCR-3.0 Spanish WordNet is CC BY 3.0 and permits commercial and research use. Attribution and license notice still need to be carried through. | **Promising evidence source, not yet importable.** Need pinned downloadable artifact, version/hash, exact attribution, field-level scope, and a license-policy decision for CC BY 3.0. The current manifest SPDX allowlist does not include CC-BY-3.0. |
| ASJP Spanish wordlist | Small basic-vocabulary list compiled by Cecil H. Brown; its page cites Cuyás 1972. Useful as a narrow independent cross-check, not a general dictionary. | CC BY 4.0 stated by ASJP. | **Possible supplementary evidence only.** Pin dataset revision and retain attribution. Its small concept list cannot cover the required game vocabulary or regional variants. |
| Spanish FrameNet | Public lexical resource with more than 1,000 lexical items and corpus-backed senses; source describes evidence from a 937-million-word corpus including New World and European Spanish. | The inspected overview does not establish a clear reusable data license. | **Do not ingest** until the project owner confirms redistribution and commercial-use rights for the database and examples. |
| OpenSLR SLR21 Spanish frequency wordlist | Frequency list derived from Spanish Gigaword; forms and frequency rather than authoritative definitions or complete lemma/sense evidence. | CC BY-SA 3.0. | **Not eligible under current proprietary-bundle policy.** Share-alike requires a separate legal and product decision. |
| DBnary / Wiktionary extracts | Broad Spanish lexical coverage and structured definitions/inflections. | CC BY-SA 4.0 (and Wiktionary source licensing). | **Not eligible under current proprietary-bundle policy** without a separate legal decision. |
| Corpus del Español Web/Dialects | Has word/lemma/POS material across 21 Spanish-speaking countries, potentially useful for regional usage evidence. | The Gonzaga repository page says data cannot be redistributed and cannot be used to create software/products for sale or consumption. | **Do not use** for STOP ingestion or product validation. |

## Important boundaries

- A source appearing in this shortlist is not approved merely because its license appears permissive.
- A word appearing in a wordlist is not automatically suitable for STOP: the source may include inflections, names, abbreviations, archaic forms, foreign words or typos.
- A word appearing in a dictionary does not establish eligibility in every STOP category.
- Regional labels must come from source evidence, not from assumptions based on the locale of a Hunspell file.
- A source's corpus examples, definitions, phonetic data and metadata may have different rights from its headword list. Review each component separately.
- CC BY licenses require attribution and notices. Do not add them to the import allowlist until the manifest schema can record and enforce the required attribution obligations.
- No data from any resource in this document has been copied into the runtime dictionary.

## Primary references checked on 2026-11-27

1. RLA-ES / olea repository and its public-domain statement: https://github.com/olea/lemarios
2. Olea project page; it explicitly marks some historical lists as outdated: https://olea.org/proyectos/lemarios/
3. UPC Spanish and Catalan WordNets license page; MCR-3.0 Spanish WordNet CC BY 3.0: https://nlp.lsi.upc.edu/esWN/licenseWN.php
4. ASJP Spanish wordlist and CC BY 4.0 notice: https://asjp.clld.org/languages/SPANISH
5. Spanish FrameNet overview: https://spanishfn.org/
6. OpenSLR SLR21 license and dataset description: https://openslr.org/21/
7. DBnary dataset license and language coverage: https://kaiko.getalp.org/about-dbnary/download/
8. Gonzaga Corpus del Español record and usage restrictions: https://repository.gonzaga.edu/corp_span/68/

## Next verification task

Acquire only the exact pinned RLA-ES general lemario and MCR-3.0 metadata/artifact for a local, reproducible comparison. First record source version, hashes, license and attribution. Then compare candidate spellings as evidence only, retaining the exact source record and POS/sense. Do not auto-approve, and do not change the STOP runtime dictionary until the independent evidence and category gates are satisfied.