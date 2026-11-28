# Hunspell upstream audit — 2026-11-27

## Scope and reproducibility

Repository inspected: https://github.com/LibreOffice/dictionaries

Immutable upstream revision inspected:
- Commit: `79195b017e6d70151337856c59e7d13d311d6630`
- Commit URL: https://github.com/LibreOffice/dictionaries/commit/79195b017e6d70151337856c59e7d13d311d6630
- Commit date reported by GitHub: 2026-11-24T12:38:09Z
- This is the same LibreOffice/dictionaries revision used in the previous locale inventory. File contents below were fetched from this exact revision, not from a moving branch.

This audit checks upstream notices, not a legal opinion. No files are imported and no locale is approved for the STOP bundle by this audit.

## Findings by language and locale

### Spanish — `es/` (including localized `.aff` / `.dic` pairs)

Files checked:
- `es/README_hunspell_es.txt` — blob SHA `80f264842ea15210c764ba228f0f1302062516d0`
- `es/LICENSE.md` — blob SHA `2e4370a6cf5f873b39a70947d3166174db75f2a6`

Upstream notice identifies Santiago Bosio as initial developer/coordinator and describes the dictionary as collaborative. It explicitly says the spelling dictionary consists of the affix file and word list for each locale and offers a disjunctive choice of GPL-3.0-or-later, LGPL-3.0-or-later, or MPL-1.1-or-later. The LICENSE.md repeats that choice and points to the exact license texts in the repository's `LICENSE/` directory.

Assessment:
- The Spanish family has a clearly stated MPL path in the upstream notice, unlike a blanket assumption that the repository's top-level license controls all data.
- Our current STOP source-manifest SPDX allowlist does not include MPL-1.1 or MPL-2.0. Do not add Spanish records to the manifest until the project explicitly chooses and reviews an MPL path, confirms notices/attribution for every locale file, and checks whether any file-specific exception or third-party contribution changes the terms.
- The upstream README uses placeholders `__LOCALES__` and `__VERSION__`; it does not itself enumerate the exact localized pairs. The prior locale inventory found 23 Spanish locale pairs, but each exact pair still needs a checksum and file-level audit before packaging.
- The dictionary is a spell-checking resource, not a reviewed game-answer list. Proper names, abbreviations, inflections, offensive terms, multiword forms and morphology need separate STOP policy.

### Brazilian Portuguese — `pt_BR/`

File checked:
- `pt_BR/README_pt_BR.txt` — blob SHA `b3b5b26cdac108a1a785ab41ed98bd1add71f0bc`

The notice names Raimundo Santos Moura and the Brazilian community project VERO. Its English and Portuguese text names LGPL version 3 and the Mozilla Public License, but does not state the MPL version in the file and uses wording that does not cleanly resolve whether both licenses apply together or are alternatives.

Assessment:
- Treat the exact license choice/version as **ambiguous pending clarification**, not as a confirmed permissive dual-license grant.
- Do not add this source to the current manifest or bundle until the upstream maintainers or authoritative license materials clarify the applicable MPL version and whether the user may select one license or must comply with both.
- Preserve contributor credits and inspect the exact `.aff` / `.dic` files and any embedded third-party material before reconsidering.

### European Portuguese — `pt_PT/`

File checked:
- `pt_PT/README_pt_PT.txt` — blob SHA `a0028f1e27dcfc075087072372ffe89599bb5c35`

The notice names José João de Almeida, Rui Vilela and Alberto Simões at Universidade do Minho. It says dictionary files and associated programs are covered by GPL/LGPL/MPL “by this order” and lists GPL v2, LGPL v2.1 and MPL 1.1.

Assessment:
- The wording indicates a license order but does not explicitly explain in the checked file whether these are selectable alternatives or cumulative obligations. The referenced `COPYING` file was not present at the checked path (GitHub returned 404).
- Treat the licensing route as **unresolved**. Do not import until the exact license texts and the meaning of the order are established from authoritative upstream materials.
- The README itself is evidence of authorship and locale (Portugal), not proof of a commercial redistribution permission by itself.

### French — `fr_FR/dictionaries/`

File checked:
- `fr_FR/dictionaries/README_dict_fr.txt` — blob SHA `fc74384d35cecef4b7f32f9131ec56aa3723d203`

The current upstream README identifies Grammalecte / Olivier R. and explicitly states Mozilla Public License 2.0. It describes several French orthographic profiles (including classical, 1990 reform and all-variants forms); the checked excerpt recommends the classical dictionary and explains that older and reformed spellings may both be accepted depending on profile.

Assessment:
- MPL-2.0 is a clearer current notice than older consolidated LibreOffice license pages that refer generically to MPL 1.1 or higher.
- Our current allowlist does not include MPL-2.0. Do not add a French source record until STOP explicitly accepts and implements the MPL-2.0 obligations and preserves notices.
- The selected orthographic profile must be explicit in STOP; do not merge all French variants indiscriminately and accidentally accept incompatible forms.

## Cross-cutting decision

| Corpus | Current upstream notice | STOP status |
|---|---|---|
| Spanish locale family | GPL-3.0-or-later OR LGPL-3.0-or-later OR MPL-1.1-or-later | Candidate; MPL route requires explicit policy/allowlist review and per-file audit |
| Portuguese (Brazil) | LGPLv3 and Mozilla Public License mentioned; MPL version and relationship unclear | Blocked pending clarification |
| Portuguese (Portugal) | GPLv2 / LGPLv2.1 / MPL1.1 listed “by this order”; exact selection mechanics unresolved | Blocked pending authoritative clarification |
| French (Grammalecte) | MPL-2.0 in current dictionary README | Candidate; requires explicit MPL-2.0 policy and notices |

The existing manifest remains empty. No Hunspell word list, affix file, license file or dictionary-derived entry has been copied into the STOP game. The package's existing allowlist remains unchanged.

## Next technical verification before any import

1. Enumerate exact filenames and SHA-256 for every candidate `.aff` and `.dic` at the pinned revision.
2. Archive the full license text and contributor/attribution notices for each selected locale.
3. Resolve the Portuguese license ambiguities with authoritative upstream materials.
4. Decide whether STOP can accept file-level MPL obligations (including distribution of modified MPL-covered files and notices) and add a deliberate license profile only after review.
5. Parse Hunspell flags and affix rules to derive candidate forms reproducibly; never treat raw stem counts as playable word counts.
6. Filter proper names, abbreviations, offensive entries, foreign insertions and multiword forms according to explicit game policy.
7. Review candidate entries and category eligibility separately. Corpus membership alone does not grant category points.
