# Wikidata Spanish Lexeme Dump Acquisition Audit — 2026-11-28

## Decision

Wikidata Lexicographical Data is a suitable **research/candidate source** for the linguistic-engine pipeline because Wikidata documents dedicated RDF dumps for the Lexeme namespace and states that structured data in the Lexeme namespace is available under CC0, including for commercial use.

This is not approval to import all records into the STOP runtime dictionary. Wikidata defines a lexeme broadly: it may represent a word, phrase, or prefix. The dataset can also contain proper nouns, inflected forms, regional labels, and incomplete or inconsistently modeled entries. Every candidate still requires the project's lexical and category review rules.

## Official documentation checked

- Database download (Spanish): https://www.wikidata.org/wiki/Wikidata:Database_download/es
  - JSON entity dumps are weekly and line-oriented, but the documented JSON dump is for entities in the main entity array; the Lexeme namespace has dedicated RDF dumps.
  - RDF dump files for the Lexeme namespace are published at the same dump location with the `lexemes` suffix.
  - The page states that structured data in the Lexeme namespace is CC0 and may be used commercially.
- Data access: https://www.wikidata.org/wiki/Wikidata:Data_access/en
  - WDQS is not suitable for large result sets; use a dump when traversing many records.
- Lexicographical data documentation: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation
  - A lexeme can be a word, phrase, or prefix and has a language, lexical category, lemmas, senses, and forms.
- Spanish lexicographical documentation: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation/es

## Acquisition approach

1. Use the official Lexeme RDF dump, not the general JSON entity dump assumed by the existing JSONL extractor.
2. Select a dated, completed dump release from the official Wikimedia dump directory. Record the exact dump filename, dump date, byte size, download URL, and SHA-256 checksum in the audit manifest before processing.
3. Do not rely on a moving `latest` URL as the reproducible source identity. Pin the dated artifact and checksum for each inventory run.
4. Parse the RDF Lexeme representation with a dedicated, tested parser or a documented conversion step. Do not feed RDF directly to `extract_wikidata_lexemes.py`, which currently expects one JSON Lexeme entity per JSONL line.
5. Filter by Spanish language entity Q1321 and explicitly retain language tags and regional variants. Do not silently collapse locale evidence.
6. Extract lemma representations, lexical category, form representations, grammatical features, usage labels, and entity identifiers where present. Keep original spellings; use NFC plus casefold only for comparison keys.
7. Keep proper-noun categories and common-noun categories distinguishable. A proper-noun sense/category must not automatically disqualify an identical spelling that also has a separately attested common-noun lexeme.
8. Exclude phrases, prefixes, and non-word lexical entries from the game's single-word candidate set unless a separate, explicit game rule supports them.
9. Mark every extracted candidate with `lexicalApproval:false` and `categoryApproval:false`. Wikidata membership is evidence for review, not automatic acceptance.
10. Generate a deterministic candidate inventory and provenance report only. No runtime dictionary writes, automatic points eligibility, or production changes.

## Reproducibility and rights gates

Before implementing a scheduled workflow, verify that the chosen dated dump is actually present and that its exact file can be downloaded and checksummed. Record:
- official source and dump date;
- exact filename and URL;
- file size and SHA-256;
- parser/conversion version;
- language and locale filters;
- counts by lexical category and language tag;
- counts excluded as phrases/prefixes or unsupported structures;
- explicit proper-noun candidate counts;
- output artifact checksum.

The CC0 status applies to Wikidata structured data in the Lexeme namespace as documented by Wikidata. It does not grant rights to unrelated third-party datasets or media that might be linked from records. Preserve source identifiers and audit provenance regardless.

## Current implementation boundary

The existing `scripts/linguistic-engine/extract_wikidata_lexemes.py` accepts JSONL Lexeme entity objects and performs conservative candidate extraction. It is not yet a parser for the official RDF Lexeme dump. A separate RDF-to-candidate path must be implemented and tested before any dump workflow is enabled.

## Conclusion

Proceed with a small, reproducible RDF sample/parser feasibility test on the feature branch. Do not yet add a full-dump CI download, do not treat Wikidata records as approved words, and do not merge or deploy this work without explicit authorization.
