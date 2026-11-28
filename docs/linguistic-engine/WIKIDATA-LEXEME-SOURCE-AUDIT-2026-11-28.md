# Wikidata Spanish lexeme source audit — 2026-11-28

## Decision

**Suitable for a research-only structural cross-check; not approved as an automatic dictionary or game-answer source.**

Wikidata's official licensing policy states that structured data in the main, Property, Lexeme and EntitySchema namespaces is released under CC0. Its data-access guidance also says CC0 does not require attribution, while recommending that reuse projects identify Wikidata as their source. STOP should retain source IDs and revision metadata and display a source acknowledgement if the dataset is ever used in a shipped dictionary.

Primary references:
- Lexicographical data model: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation
- Spanish lexeme modeling: https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation/Languages/es/modeling
- Licensing policy: https://www.wikidata.org/wiki/Wikidata:Licensing
- Data access and reuse guidance: https://www.wikidata.org/wiki/Wikidata:Data_access

## What the model can contribute

A Wikidata lexeme has a stable lexeme ID, lemma representation(s), language, lexical category, senses and forms. A form has its own ID, one or more representations and grammatical features. This makes it possible to preserve the relationship between a written form and the lexeme/part of speech it belongs to, rather than accepting a spelling without context.

The Spanish modeling page explicitly lists:
- noun: Q1084
- proper noun: Q147276
- verb: Q24905
- adjective: Q34698
- adverb: Q380057
- interjection: Q83034
- conjunction: Q36484
- preposition: Q4833830
- pronoun: Q36224
- determiner: Q576271
- grammatical particle: Q184943
- contraction: Q126473
- phrase/locution categories, prefixes and suffixes as separate categories

The category list is useful as a classification signal, not as a final STOP policy. The project must decide separately which parts of speech and multiword forms are playable in each game category.

## Required extraction fields

For each candidate record, preserve only the minimum structural evidence needed for review:

- snapshot date and exact dump/revision identifier;
- lexeme ID (L…);
- language item ID and language code;
- lexical category item ID;
- exact lemma string and its language tag;
- form ID (when applicable);
- exact form representation and its language tag;
- grammatical feature item IDs;
- sense IDs only as stable references if needed for later review;
- source references/provenance where present.

Do not normalize away accents. Use the existing NFC + case-fold identity only as a comparison key; always retain the original spelling, language tag and source identifiers.

## Proper-name handling

1. A lexeme explicitly categorized as proper noun (Q147276) must be marked `proper_name_evidence`, not accepted as a common noun.
2. Do not infer proper-name status from uppercase spelling. Capitalization is unreliable after normalization and across sentence positions.
3. Do not reject a spelling globally merely because one proper-noun lexeme exists. The same spelling may have a separate common-noun lexeme or a different sense. Keep each lexeme/category/sense record distinct.
4. Proper adjectives, demonyms, abbreviations, symbols, prefixes, suffixes and phrases must remain separate review classes; do not silently fold them into common nouns.
5. A proper-noun classification is evidence for category review, not a universal rejection rule. STOP category policy determines whether a proper name can be valid in a specific category.

## Language and regional safeguards

- Do not infer regional validity from a Spanish lexeme's presence alone.
- Keep the lexeme language item and every lemma/form language tag exactly as published.
- Treat `es`, `es-419`, `es-ES`, `es-MX` and other tags as distinct evidence values; do not manufacture a regional label or silently map one tag to another.
- A language code on a representation is not proof that the word is exclusive to that country or region.
- A missing regional tag means unknown regional scope, not invalid Spanish.
- If the same form has several analyses or lexemes, preserve all of them and route conflicting category/POS evidence to manual review.

## Quality and rights gates

CC0 describes Wikidata's structured-data licensing policy; it does not prove that every record is accurate, complete, independently sourced, current, or suitable for STOP. Wikidata itself notes that data licensing and upstream dataset provenance can be complex. Before any record enters a production bundle:

- inspect available references and provenance for imported lexemes;
- exclude or separately review records whose source provenance raises rights concerns;
- do not copy glosses, examples, pronunciations or other descriptive content in this first stage;
- pin the exact dump/snapshot and record its hash;
- test duplicate spellings, accent distinctions, proper/common homographs, language tags and ambiguous analyses;
- require a separate lexical review and a separate category review.

The first pipeline should use Wikidata only to add structured evidence to the existing Hunspell/RLA/MCR/FreeLing candidate catalogue. It must not add entries to the runtime dictionary.

## Implementation boundary

The research comparator must emit fields such as:

- `wikidataLexemeIds`
- `wikidataLexicalCategories`
- `wikidataLanguageIds`
- `wikidataLanguageTags`
- `wikidataFormIds`
- `wikidataGrammaticalFeatures`
- `properNameEvidence`
- `wikidataAmbiguousAnalysis`

Every emitted candidate must remain:

- `lexicalApproval: false`
- `categoryApproval: false`

No Wikidata API calls should be made per user answer at runtime. Use a pinned offline snapshot for reproducible research, or a separately rate-limited research job. Do not rely on the public Query Service as an unbounded production dependency.

## Go/no-go

**GO:** build a pinned, offline, research-only Spanish lexeme cross-check preserving IDs, categories, language tags and explicit forms.

**NO-GO:** auto-accepting every Wikidata lemma/form; treating Q147276 as a universal rejection; treating language tags as country exclusivity; copying glosses/examples into production; changing the runtime dictionary or scoring rules.

No Wikidata data has been imported into STOP. No runtime dictionary, database, API or production service has been changed by this audit.
