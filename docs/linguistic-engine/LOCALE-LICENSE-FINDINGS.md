# Locale coverage and licensing findings

Audit date: 2026-11-25
Status: preliminary research only; no source or locale is approved for import.

## What the upstream evidence establishes

The LibreOffice dictionaries repository is a maintained upstream collection of Hunspell dictionaries. Its current tree includes distinct directories for `pt_BR`, `pt_PT`, and `fr_FR`, as well as general `es` and `en` directories. The repository tree alone does not prove that every STOP target locale has an independent dictionary.

A separate downstream inventory reports Spanish files for many regional codes, including es_AR, es_BO, es_CL, es_CO, es_CR, es_CU, es_DO, es_EC, es_ES, es_GT, es_HN, es_MX, es_NI, es_PA, es_PE, es_PR, es_PY, es_SV, es_UY, and es_VE. Treat this only as a lead: each file must be confirmed in the canonical upstream tree at a pinned commit before it is recorded as an import candidate.

Fedora's 2026 packaging proposal documents five distinct English dictionary subpackages: en-AU, en-CA, en-GB, en-US, and en-ZA. Its packaging notes mention en-IE and en-NZ as aliases/symlinks in the packaged Hunspell layout, not independent English dictionary datasets. STOP must not count an alias as an independently sourced locale.

## Preliminary coverage matrix

| STOP locale family | Evidence found | Next verification required | Decision |
|---|---|---|---|
| Spanish es-ES and Latin American locales | Downstream inventory lists many locale-specific .aff/.dic pairs under LibreOffice's Spanish dictionary collection | Confirm every requested file and its exact upstream path, revision, provenance and notices | Candidate only |
| English en-US, en-GB, en-CA, en-AU, en-ZA | Fedora proposal identifies five distinct locale subpackages sourced from LibreOffice | Pin exact upstream files and review the exact license/notice for each locale | Candidate only |
| English en-IE, en-NZ | Fedora packaging notes describe aliases/symlinks to other dictionaries | Decide whether alias coverage is linguistically acceptable; do not claim independent source coverage | Alias only; not an independent dataset |
| Portuguese pt-BR | Canonical upstream has a distinct pt_BR directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| Portuguese pt-PT | Canonical upstream has a distinct pt_PT directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| French fr-FR | Canonical upstream has a fr_FR directory | Pin exact files/revision and confirm license text and notices | Candidate only |
| French fr-BE, fr-CH, fr-CA, fr-LU | No independent locale directory established by this check | Search for separately licensed, canonical sources; do not silently substitute fr_FR | Unverified |

## Licensing findings

LibreOffice's published licensing index lists the Spanish spelling dictionary under GPLv3, LGPLv3, and MPL 1.1 terms. Its Portuguese (Portugal) spelling dictionary is listed as GPL 2.0 / LGPL 2.1 / MPL 1.1 tri-license. The Portuguese (Brazil) dictionary is described separately under LGPLv3 and MPL 1.1, with credits pointing to the VERO project.

These are collection-level discovery findings, not a legal conclusion for a particular file or release. The exact locale files may have additional upstream notices or different provenance. In particular:

- Do not infer the license of every file from the repository's top-level license.
- Retain the exact license text and copyright/attribution notices distributed with the selected locale package.
- Confirm whether the chosen license option permits STOP's intended commercial use, modification, and redistribution, and document all obligations.
- If the exact terms or file provenance are ambiguous, keep the source blocked pending legal review.

## Sources

- Canonical LibreOffice dictionaries repository: https://github.com/LibreOffice/dictionaries
- LibreOffice licensing index: https://api.libreoffice.org/share/readme/LICENSE.html
- Fedora proposal documenting five English locale subpackages and en-IE/en-NZ aliases: https://fedoraproject.org/wiki/Changes/LibreOfficeDictionaries
- Downstream Spanish locale inventory, used only as a discovery lead: https://github.com/wachin/libreoffice-dictionaries-collection/blob/main/dictionary_report.txt

## Safety conclusion

No data files were downloaded or imported. No manifest source was marked approved. No runtime validator, scoring, game data, online/offline behavior, production service, or Android artifact was changed. This document is not legal advice and does not grant redistribution rights.


## Canonical Spanish file-pair verification (pinned snapshot)

Verification date: 2026-11-25.
Canonical repository: https://github.com/LibreOffice/dictionaries
Pinned upstream commit observed: `79195b017e6d70151337856c59e7d13d311d6630` (commit timestamp reported by GitHub: 2026-11-24T12:38:09Z).

The GitHub Contents API listing for the canonical `es/` directory at the `master` snapshot above was inspected by filename. It contains both an `.aff` and a matching `.dic` file for each of these 23 regional codes:

`es_AR`, `es_BO`, `es_CL`, `es_CO`, `es_CR`, `es_CU`, `es_DO`, `es_EC`, `es_ES`, `es_GQ`, `es_GT`, `es_HN`, `es_MX`, `es_NI`, `es_PA`, `es_PE`, `es_PH`, `es_PR`, `es_PY`, `es_SV`, `es_US`, `es_UY`, and `es_VE`.

All 23 pairs were present in the directory listing; no missing `.aff` or `.dic` partner was found. This corrects the earlier incomplete downstream discovery list by adding Equatorial Guinea (`es_GQ`), Philippines (`es_PH`), and United States Spanish (`es_US`).

Important limits:
- This proves file-pair presence at the pinned repository snapshot, not independent linguistic review or quality for every region.
- Several locale files may share identical contents or affix rules; distinct filenames do not prove distinct regional vocabulary. A future audit must compare hashes and inspect the upstream locale descriptions.
- GitHub's directory listing provides Git blob object SHAs, not the SHA-256 values required by STOP's manifest. The exact file bytes and license texts still need to be fetched and SHA-256 hashed before any manifest entry can be approved.
- The Spanish directory contains license texts and a package README, but a legal reviewer must select and document the exact license grant and confirm file-level notices before redistribution.
- No dictionary data was downloaded into STOP, imported, or bundled. All locales remain candidates only.

Reproducible source locations:
- Pinned directory: https://github.com/LibreOffice/dictionaries/tree/79195b017e6d70151337856c59e7d13d311d6630/es
- Pinned Spanish manifest: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/Dictionary_es.mk
- Pinned Spanish license README: https://github.com/LibreOffice/dictionaries/blob/79195b017e6d70151337856c59e7d13d311d6630/es/README_hunspell_es.txt
