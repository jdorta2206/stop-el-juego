# Wikidata Spanish Lexeme Dump Acquisition Audit — 2026-11-28

## Decision

Wikidata Lexicographical Data is a suitable **research/candidate source** for the linguistic-engine pipeline because Wikidata documents dedicated RDF dumps for the Lexeme namespace and states that structured data in the Lexeme namespace is available under CC0, including for commercial use.

This is not approval to import all records into the STOP runtime dictionary. Wikidata defines a lexeme broadly: it may represent a word, phrase, or prefix. The dataset can also contain proper nouns, inflected forms, regional labels, and incomplete or inconsistently modeled entries. Every candidate still requires the project's lexical and category review rules.

## Official documentation checked

- Database download (Spanish): https://www.wikidata.org/wiki/Wikidata:Database_download/es
  - JSON entity dumps are the recommended stable dump format and use a single array whose entity objects are line-readable.
  - The directory also publishes dedicated Lexeme files with the `lexemes` suffix in JSON, RDF/Turtle, and RDF/N-Triples serializations.
  - The page states that structured data in the Lexeme namespace is CC0 and may be used commercially.
- Data access: https://www.wikidata.org/wiki/Wikidata:Data_access/en
  - WDQS is not suitable for large result sets; use a dump when traversing many records.
- Lexicographical data documentation: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation
  - A lexeme can be a word, phrase, or prefix and has a language, lexical category, lemmas, senses, and forms.
- Spanish lexicographical documentation: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation/es

## Canonical JSON format and dated dumps located

The official directory was inspected on 2026-11-28:

- Directory: https://dumps.wikimedia.org/wikidatawiki/entities/20261125/
- Dated file: `wikidata-20261125-lexemes.json.bz2`
- Published size: 496,618,794 bytes
- Official SHA-1 manifest: `wikidata-20261125-sha1sums.txt`
- Published SHA-1: `e0c5cbf9c5c9f64dc23b22301a30748ae1023851`
- Alternative gzip file: `wikidata-20261125-lexemes.json.gz`, 672,475,150 bytes; published SHA-1 `84e6eb368a918a33a601bd8ce723af421c419b7b`.

**Format correction after checking the canonical WikibaseLexeme JSON specification:** the JSON representation is explicitly documented as the canonical, reasonably stable format used by the API, JSON dumps, and Special:EntityData. The dated directory also lists `wikidata-20261125-lexemes.json.bz2` alongside dedicated `.nt` and `.ttl` Lexeme dumps. Therefore JSON is not an undocumented or inherently unsupported format; it should be the first candidate because the existing STOP extractor already consumes line-oriented JSON entity objects. RDF remains a valid alternative for comparison or if JSON sample inspection reveals a concrete limitation. The exact dated JSON file has not yet been downloaded, structurally inspected, or independently checksummed with SHA-256; the published SHA-1 above is recorded from the official manifest, not a locally verified checksum. The next gate is to inspect a small sample from the dated JSON file (and, if useful, compare the equivalent single-entity RDF representation) before selecting the production inventory input.

## Acquisition approach

1. First inspect a small, reproducible sample of the dated Lexeme JSON dump. Do not use the moving `latest` alias as the reproducible source identity.
2. Download the dated compressed file in a research-only workflow or local feasibility test. Verify its SHA-1 against the official manifest and compute SHA-256 locally; record both.
3. Confirm that decompression yields the documented JSON array with one Lexeme entity object per line, and verify that the existing JSONL reader handles the opening/closing array and commas. Check lemma, lexical category, forms, grammatical features, senses, and language tags. Compare one known Lexeme against its `.ttl` or `.nt` entity representation if that helps validate field coverage. Never load the full dump into memory.
4. Pin the exact dated artifact, filename, size, URL, SHA-1, and SHA-256 for each inventory run.
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

The existing `scripts/linguistic-engine/extract_wikidata_lexemes.py` accepts JSONL Lexeme entity objects and performs conservative candidate extraction. It has only been tested against synthetic line-oriented JSON fixtures; compatibility with the actual dated JSON dump has not yet been demonstrated. The canonical WikibaseLexeme JSON specification and the dated Lexeme JSON dump listing support JSON as the first format to test. RDF is retained as a comparison/fallback, not a mandatory prerequisite.

## Conclusion

Proceed with a small, reproducible sample inspection of the dated JSON Lexeme dump on the feature branch. Do not yet add a full-dump CI download, do not treat Wikidata records as approved words, and do not merge or deploy this work without explicit authorization.
