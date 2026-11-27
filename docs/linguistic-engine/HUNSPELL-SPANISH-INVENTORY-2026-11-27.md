# Spanish Hunspell regional inventory — 2026-11-27

## Execution record

- STOP branch: `feat/linguistic-engine-regional-foundation`
- Inventory workflow run: [run #12](https://github.com/jdorta2206/stop-el-juego/actions/runs/46008229570)
- Workflow result: **success**
- Artifact: `hunspell-spanish-candidates-79195b0` (22 files, 10,663,547 bytes compressed; retained until 2026-12-04)
- Upstream repository: LibreOffice/dictionaries
- Pinned upstream revision: `79195b017e6d70151337856c59e7d13d311d6630`
- Hunspell CLI: 1.7.2
- Coverage: Spain plus 20 American regional dictionaries (21 locale pairs)

The run installed Hunspell, passed the extractor's 10 Python unit tests, downloaded all 42 pinned `.dic`/`.aff` files, extracted every locale and uploaded the review-only JSONL inventories.

## Results

The JSONL files contain **1,203,534 raw dictionary entries**. These include repeated spellings with different Hunspell flags, so raw lines are not unique answers.

For cross-locale comparison, spellings were normalized to Unicode NFC and case-folded, without removing accents. This gives:

- **1,149,089** unique normalized forms summed across the 21 locale files.
- **54,445** repeated rows within locale files (raw entries minus per-locale unique forms).
- **65,558** distinct normalized spellings in the union of all 21 locales.
- **10,293** spellings present in only one of the 21 locale files.
- **53,833** spellings present in all 21 locale files.
- **48** non-simple entries held for manual review.

### Per-locale inventory

| Locale | Raw entries | Unique normalized forms | Exclusive to locale | Duplicate rows | Manual review |
|---|---:|---:|---:|---:|---:|
| es-AR | 57,437 | 54,912 | 511 | 2,525 | 2 |
| es-BO | 56,899 | 54,394 | 119 | 2,505 | 1 |
| es-CL | 57,174 | 54,675 | 387 | 2,499 | 1 |
| es-CO | 62,280 | 58,548 | 3,975 | 3,732 | 2 |
| es-CR | 56,699 | 54,203 | 20 | 2,496 | 1 |
| es-CU | 56,892 | 54,340 | 140 | 2,552 | 1 |
| es-DO | 56,581 | 54,102 | 5 | 2,479 | 1 |
| es-EC | 56,749 | 54,249 | 23 | 2,500 | 1 |
| es-ES | 58,221 | 55,638 | 1,632 | 2,583 | 2 |
| es-GT | 56,666 | 54,177 | 9 | 2,489 | 2 |
| es-HN | 56,841 | 54,335 | 28 | 2,506 | 2 |
| es-MX | 59,093 | 56,257 | 1,812 | 2,836 | 2 |
| es-NI | 56,743 | 54,239 | 10 | 2,504 | 1 |
| es-PA | 56,635 | 54,153 | 5 | 2,482 | 2 |
| es-PE | 58,445 | 55,710 | 1,389 | 2,735 | 16 |
| es-PR | 56,592 | 54,106 | 7 | 2,486 | 2 |
| es-PY | 56,650 | 54,165 | 4 | 2,485 | 2 |
| es-SV | 56,703 | 54,200 | 8 | 2,503 | 2 |
| es-US | 56,293 | 53,842 | 0 | 2,451 | 1 |
| es-UY | 56,833 | 54,313 | 10 | 2,520 | 2 |
| es-VE | 57,108 | 54,531 | 199 | 2,577 | 2 |

### Distribution of cross-locale spellings

| Number of locales | Unique normalized spellings |
|---:|---:|
| 1 | 10,293 |
| 2 | 604 |
| 3 | 225 |
| 4 | 107 |
| 5 | 72 |
| 6 | 47 |
| 7 | 61 |
| 8 | 22 |
| 9 | 53 |
| 10 | 14 |
| 11 | 11 |
| 12 | 5 |
| 13 | 3 |
| 14 | 1 |
| 15 | 1 |
| 16 | 3 |
| 17 | 2 |
| 18 | 27 |
| 19 | 167 |
| 20 | 7 |
| 21 | 53,833 |

## Important interpretation

The self-check reported 1,203,486 entries accepted by their own paired Hunspell dictionary and zero rejected; 48 non-simple entries were diverted to manual review. **Zero rejections are expected** because each word was taken from the same `.dic` file used to check it. This verifies that the paired files load and accept their own simple entries; it is not independent proof that the forms are real, current, regionally appropriate or suitable for STOP.

The 65,558 union is a count of normalized dictionary spellings, **not 65,558 approved words or lemmas**. Hunspell lists may include inflections, proper names, place names, abbreviations and other entries. The regional-only counts are leads for review, not proof that a form belongs exclusively to a dialect.

The 48 manual-review records include punctuation/abbreviations, spacing, place/name entries and formatting anomalies. They must not be silently normalized into accepted answers. In particular, whitespace and invisible formatting characters need explicit review.

## Next validation gates

1. Deduplicate raw records while retaining source locale, original form, flags, line and checksum provenance.
2. Separate ordinary lexical candidates from proper names, abbreviations, phrases and malformed/formatting-sensitive entries.
3. Review regional-only and low-frequency forms against independent, citable lexicographic sources.
4. Keep lexical existence separate from category evidence.
5. Resolve upstream licensing before redistributing any extracted corpus or placing it in STOP's proprietary runtime bundle.

**No candidate from this inventory has been approved for scoring.** The production dictionary, game runtime, `master` and deployed services were not changed by this extraction.
