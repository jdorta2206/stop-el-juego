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

## Dated dump located

The official directory was inspected on 2026-11-28:

- Directory: https://dumps.wikimedia.org/wikidatawiki/entities/20261125/
- Dated file: `wikidata-20261125-lexemes.json.bz2`
- Published size: 496,618,794 bytes
- Official SHA-1 manifest: `wikidata-20261125-sha1sums.txt`
- Published SHA-1: `e0c5cbf9c5c9f64dc23b22301a30748ae1023851`
- Alternative gzip file: `wikidata-20261125-lexemes.json.gz`, 672,475,150 bytes; published SHA-1 `84e6eb368a918a33a601bd8ce723af421c419b7b`.

**Format caveat discovered during follow-up verification:** the official database-download documentation says the recommended JSON dump is a single array of Wikidata entities whose objects are line-readable, but separately documents the Lexeme-namespace dumps as RDF/Turtle and N-Triples files with the `lexemes` suffix. It does not document a JSON Lexeme dump as a stable interface. Although the dated directory listing previously exposed a file named `wikidata-20261125-lexemes.json.bz2`, its presence and filename alone do not establish its schema, completeness, stability, or compatibility. Treat that JSON file as an unverified acquisition lead, not as the preferred supported format. The exact file has not been downloaded, structurally inspected, or independently checksummed with SHA-256; the published SHA-1 above is the value recorded from the official manifest, not a locally verified checksum. The next feasibility gate is to inspect a small sample of the documented Lexeme RDF dump and compare its structure and metadata coverage with the current JSON-oriented extractor. Only investigate the unusual JSON file if a small, reproducible structural check can establish what it contains.

## Acquisition approach

1. First inspect a small, reproducible sample of the documented dated Lexeme RDF dump (Turtle or N-Triples). Do not use the moving `latest` alias as the reproducible source identity. Treat the dated `lexemes.json.bz2` filename as unverified until its actual structure is inspected.
2. Download the dated compressed file in a research-only workflow or local feasibility test. Verify its SHA-1 against the official manifest and compute SHA-256 locally; record both.
3. For RDF, confirm the exact serialization and whether it preserves the lemma, lexical category, forms, grammatical features, senses, and usage labels needed by STOP; build a streaming parser only after a sample proves the mapping. Separately, if investigating the JSON-named file, verify its decompressed structure and entity schema before adapting the current JSONL extractor. Never load a full dump into memory.
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

The existing `scripts/linguistic-engine/extract_wikidata_lexemes.py` accepts JSONL Lexeme entity objects and performs conservative candidate extraction. It has only been tested against synthetic line-oriented JSON fixtures; no compatibility with the dated JSON-named file or the official Lexeme RDF dump has been demonstrated. The official documentation points to RDF as the documented Lexeme dump format, so RDF sample inspection is the next required feasibility step.

## Conclusion

Proceed with a small, reproducible RDF sample/parser feasibility test on the feature branch. Do not yet add a full-dump CI download, do not treat Wikidata records as approved words, and do not merge or deploy this work without explicit authorization.
