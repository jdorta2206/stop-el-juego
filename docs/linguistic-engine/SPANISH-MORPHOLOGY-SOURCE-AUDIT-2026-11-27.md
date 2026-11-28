# Spanish morphology source audit — 2026-11-27

## Decision summary

A morphology resource is needed because an exact WordNet lemma lookup misses many legitimate inflected forms. The next comparison must map a form to a documented lemma and retain part of speech and inflection tags. It must not infer a lemma by arbitrary suffix stripping.

## 1. FreeLing Argentine Spanish verb dictionary — research candidate

- Upstream: [TALP-UPC/FreeLing](https://github.com/TALP-UPC/FreeLing)
- Pinned repository commit: `0bae6b7f6d1b405e67658895de54b59bfb3b6338` (2026-03-09).
- File: `data/es/es-ar/dictionary/entries/AR.verb`.
- Size: 636,371 bytes.
- Git blob SHA-1: `adbebb9aea96ce4fc24dd594b12b144a8e5f5148`.
- Each inspected row has the structure: surface form, lemma, morphological tag. Example records include Argentine voseo forms mapped to their infinitive and tags.
- FreeLing's `COPYING` explicitly identifies the Argentine Spanish dictionary as developed by Agustin Gravano at Universidad de Buenos Aires and distributed under Apache License 2.0.
- Pinned `COPYING` Git blob: `df5e2741df0283e4e350d0891f7c33208b097034`.
- Pinned Apache license Git blob: `d645695673349e3947e8e5ae42332d0ac3164cd7`.
- **Scope limit:** this is a verb lexicon for Argentine Spanish, not a general dictionary. It cannot validate nouns, adjectives, all regional vocabulary, or all Spanish verb forms.
- **Status:** good research-only morphology source; no runtime import or approval. Keep the exact license and attribution with any later proposed use.

The comparator now downloads these exact files, checks all three Git blob hashes and retains the form-to-lemma-to-tag analysis. It records matches as Argentine morphological evidence only.

## 2. Other FreeLing Spanish resources — not currently approved

The official FreeLing linguistic-data documentation reports more than 555,000 forms and over 76,000 lemma/POS combinations for its general Spanish dictionary, and says that the language dictionaries have different source owners and licenses. Its `COPYING` assigns the main Spanish dictionary to the Spanish Resource Grammar / UPF and the Lesser General Public License for Linguistic Resources (LGPLLR).

LGPLLR is not a permissive licence for a proprietary dictionary bundle: modifications of a linguistic resource must themselves be made available under LGPLLR at no charge, with notices. Its section 4 has a special exception for packages containing a work that uses the resource, but it requires customer modification and reverse engineering rights. This needs a separate legal compatibility review before considering distribution inside STOP.

The FreeLing Chilean Spanish dictionary is listed under AGPL-3.0. It is not imported.

## 3. Other morphology resources screened

| Resource | Coverage / utility | License / decision |
|---|---|---|
| UniMorph Spanish | 1,196,245 inflectional forms across nouns, adjectives and verbs; sourced from English Wiktionary | CC BY-SA 3.0; share-alike, not suitable for current proprietary runtime bundle |
| esMorph | Spanish morphological analyser, lemma/POS/features and inflection generation | Code MIT, dictionary CC BY-SA 4.0 from Wiktionary and UD treebanks; data not suitable for current proprietary bundle |
| GLiCom Spanish Wordform List v.1 | 1,152,242 forms; includes regular words, toponyms, anthroponyms, abbreviations and verb-clitic combinations | © Universitat Pompeu Fabra; available for commercial licensing, not a free import. Ask UPF for terms and a sample before use |
| SVMorph | Over 1,000 Spanish verb types and inflection information | No clear dataset licence was verified in this audit; do not ingest |
| FreeLing general Spanish dictionary | Large form-to-lemma/POS lexicon | LGPLLR; legal review required before redistribution |

## 4. Required gates for the morphology comparator

- Exact, pinned source files and cryptographic hashes.
- Preserve the original surface form, lemma, tag, source and locale.
- Accept only explicit source analyses; no unrestricted suffix stripping.
- Multiple or conflicting analyses remain ambiguous/manual-review.
- Regional form provenance does not become an automatic regional-exclusive claim.
- Proper names, common nouns, inflections and category eligibility remain separate decisions.
- No morphology match automatically approves a lexical entry or awards STOP points.

## References

- FreeLing linguistic data and source-size/licence notes: https://nlp.lsi.upc.edu/freeling/index.php/node/12
- FreeLing upstream COPYING: https://github.com/TALP-UPC/FreeLing/blob/0bae6b7f6d1b405e67658895de54b59bfb3b6338/COPYING
- LGPLLR terms: https://spdx.org/licenses/LGPLLR.html
- UniMorph Spanish repository: https://github.com/unimorph/spa
- esMorph dataset and licence: https://huggingface.co/datasets/SergeyShk/esmorph-wiktionary
- GLiCom technical description: https://www.upf.edu/documents/107805982/109136461/tec0128_glicom_tbadia.pdf/07632628-f275-425e-b59c-417433c6a327
- SVMorph repository: https://github.com/CoDaS-Lab/SVMorph

No source in this audit has been added to the playable dictionary. The current task is source comparison and evidence preservation only.
