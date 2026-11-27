# Spanish lexical cross-check results — 2026-11-27

## Execution

- Workflow: `Hunspell Spanish candidate inventory`
- Successful run: [46012953134](https://github.com/jdorta2206/stop-el-juego/actions/runs/46012953134)
- Branch commit used by the successful run: `fd054b34b77211b43b93629438203489f9fab04c`
- LibreOffice dictionary revision: `79195b017e6d70151337856c59e7d13d311d6630`
- RLA-ES revision: `e4f3043c6d7c15e454d43e6e62dfba0c68378ecf`
- MCR package: `omw-data v2.0`, tag commit `f75be19ec590da12a7a5665e361690b5badb7a25`
- Artifact: `hunspell-spanish-candidates-79195b0` (23,050,951 bytes; 26 files)

## Cross-check counts

The candidate catalogue contains 65,558 distinct NFC + case-folded spellings from 21 Spanish locales.

| Evidence | Distinct forms |
|---|---:|
| MCR Spanish lemma match | 27,764 |
| RLA general wordlist match | 51,524 |
| Match in both sources | 26,555 |
| MCR only | 1,209 |
| RLA only | 24,969 |
| No match in either checked source | 12,825 |

The categories overlap: 27,764 + 51,524 - 26,555 = 52,733 forms matched at least one source; 65,558 - 52,733 = 12,825 matched neither.

- RLA-only matches are **not independent confirmation**: the RLA repository describes its original purpose as collecting material for the RLA-ES spellchecker, and the relationship to the Hunspell Spanish wordlists has not been traced.
- MCR is a separate lexical resource, but it is a limited WordNet, not a complete dictionary or a regional authority.
- MCR matches were found for 349 forms present in only one of the 21 Hunspell locale files. This is a useful discovery signal, not proof that the form is specific to that region.
- The 12,825 no-match group includes inflected/derived forms (for example, forms related to `abolir`) as well as rare, regional, names, and possible noise. Absence from these two resources is not proof of invalidity.

## Quality findings

1. **Proper nouns are present.** MCR contains synsets for personal names and geographical names; examples observed in the cross-check include `alexander`, `amberes`, `alabama`, `albania` and `andalucía`. Lowercase normalization cannot distinguish these from common nouns. A category-aware proper-name review is mandatory.
2. **Inflection is not lemma identity.** MCR is lemma/synset-oriented. A valid inflected form may not have an exact lemma row. The next comparison stage must link documented inflections to lemmas without accepting arbitrary suffix stripping.
3. **No-match is a review state, not rejection.** Regional words and valid inflections can be absent from a limited WordNet or a general lemario.
4. **Locale presence is provenance only.** A spelling occurring in one locale's Hunspell list does not by itself establish regional exclusivity or regional correctness.
5. **Hunspell acceptance is not independent proof.** The input forms originate in the paired Hunspell dictionaries, so its self-check validates parsing and pairing, not lexical truth.

## Comparator enhancement

The research comparator now retains MCR sense-level details:
- synset ID;
- part of speech parsed from the synset identifier;
- Spanish definition where supplied by the source.

It also emits `properNameReview` as a mandatory downstream review marker. It does not infer a proper-name classification from capitalization, and it does not approve any word or category.

The follow-up comparator must verify definitions and parts of speech against representative source rows before relying on them for review. Every record remains:
- `lexicalApproval: false`
- `categoryApproval: false`

## Licence and production gates

- RLA content is described by its repository as public domain, but source lineage and currentness still require review.
- MCR Spanish is CC BY 3.0 and requires attribution. This licence remains outside STOP's current conservative runtime allowlist.
- Neither source has been imported into the game.
- No production dictionary, API, database, or runtime validation code has been changed.
- PR #708 remains a draft and has not been merged.

## Next technical stage

Build a controlled morphology/lemma cross-check using a pinned, independently licensed Spanish morphological resource. It must:
- map only explicit, auditable inflection analyses to lemmas;
- retain source, locale, lemma, part of speech and rule provenance;
- reject ambiguous analyses into manual review;
- never use unrestricted suffix stripping;
- keep category and proper-name decisions separate;
- leave all approvals false until reviewed evidence and compatible rights are established.


## Argentine morphology pilot

A second successful run, [workflow 46018917346](https://github.com/jdorta2206/stop-el-juego/actions/runs/46018917346), added the pinned FreeLing Argentine verb dictionary.

- 134 candidate surface forms had an exact form entry in the Argentine verb lexicon.
- 68 of those forms occur in only one Hunspell locale file.
- One form, `parás`, has two analyses (`parar` and `parir`) and must remain ambiguous.
- Six forms map to lemmas absent from both the checked MCR lemma set and RLA wordlist: `descolorí`, `desfacé`, `deshacé`, `embaí`, `embaís`, and `rehacé`. Their FreeLing morphology match alone is insufficient to approve them.
- At least one lemma was found in MCR for 87 of the 134 forms; at least one lemma was found in RLA for 128 forms. These sets overlap. RLA remains lineage-unverified and MCR remains CC BY 3.0.
- The comparator retained the exact lemma and morphology tag, and every record remained unapproved.

This is evidence that an auditable morphology source can recover inflected/voseo forms and link them to lemmas. It does **not** show that all forms are regionally exclusive, nor that the lemma evidence or answer category is sufficient for STOP acceptance.

A follow-up comparator change now attaches the lemma's own MCR synset IDs and RLA line references to each morphology analysis, counts morphology as a source match, and keeps forms with conflicting analyses marked for review. That strengthened version is being rerun in CI before its results are treated as final.
