# Hunspell candidate extractor

This is a research-only tool. It does not change the game dictionary, does not import data, and does not approve lexical or category evidence.

## Why this implementation is conservative

- It reads the original UTF-8 `.dic` file, retains flags/morphology and calculates SHA-256 from the exact local bytes.
- It requires the paired UTF-8 `.aff` file and invokes the official Hunspell command-line checker with that dictionary pair. Hunspell therefore interprets the source's affix rules and dictionary flags instead of this script trying to reimplement them.
- Simple alphabetic entries are checked in one batch. Entries containing spaces, punctuation, digits or other non-letter characters are retained as `manual_review` and are not automatically accepted.
- The first `.dic` line is preserved as an approximate declared count. Hunspell documentation describes it as an approximate sizing count, so it is not incorrectly enforced as an exact number of entries.
- It exports dictionary headwords only. It does **not** expand inflections, compound forms or derivations into additional STOP answers.
- `accepted_by_hunspell` means only that the pinned source pair accepts the form. It does not prove that the form is a real contemporary word, is appropriate for the game, or belongs to any category. Both approval fields remain false.

The official Hunspell format describes each dictionary entry as a word with optional flags and explains that the paired affix file controls how those flags are applied. Hunspell's `-l` option lists words not accepted by the dictionary. References:
- https://github.com/hunspell/hunspell/blob/master/man/hunspell.5
- https://manpages.debian.org/unstable/hunspell/hunspell.1.en.html

The separate Spylls Python port was considered but is not used as a runtime or extractor dependency here. Its own documentation reports pending edge cases and describes it as an almost-complete port, and its package is MPL-2.0. Keeping this pipeline on the official Hunspell CLI avoids adding that additional implementation and license to STOP.

## Requirements

Install the Hunspell CLI on the research machine. On Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install hunspell
```

The dictionary and affix files must be adjacent and share the same basename, for example `es_ES.dic` and `es_ES.aff`.

## Example

From the repository root, after obtaining the exact upstream files into a local research directory:

```bash
python3 scripts/linguistic-engine/extract_hunspell_candidates.py \
  --dic research/hunspell/es_ES.dic \
  --aff research/hunspell/es_ES.aff \
  --locale es-ES \
  --revision 79195b017e6d70151337856c59e7d13d311d6630 \
  --output research/output/es-ES-candidates.jsonl
```

The output is JSON Lines. The first record is a source manifest containing the SHA-256 checksums of the actual local `.dic` and `.aff` bytes. Every subsequent record contains the original word, source line, flags, morphology, and a cautious status:
- `accepted_by_hunspell`
- `rejected_by_hunspell`
- `manual_review`

The output file is research data and must not be copied into the runtime dictionary. It should go through the source-license gate, lexical review, regional review, category review and duplicate/discrepancy audit first.

## Tests

Run the standard-library tests:

```bash
python3 -m unittest discover -s scripts/linguistic-engine -p 'test_*.py' -v
```

These tests use a small fake Hunspell executable to verify the extractor contract. They do not replace integration tests against the actual Hunspell binary and real upstream dictionary files.
