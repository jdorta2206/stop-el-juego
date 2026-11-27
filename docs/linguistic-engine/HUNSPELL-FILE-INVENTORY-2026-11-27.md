# Hunspell file inventory — pinned upstream revision

Date: 2026-11-27

Repository: https://github.com/LibreOffice/dictionaries
Pinned revision: `79195b017e6d70151337856c59e7d13d311d6630`
Commit URL: https://github.com/LibreOffice/dictionaries/commit/79195b017e6d70151337856c59e7d13d311d6630

## Important checksum distinction

The identifiers below are GitHub Git blob object IDs (SHA-1), returned by GitHub for the exact files at the pinned revision. They are **not SHA-256 checksums**. The execution environment could not resolve raw.githubusercontent.com, so a byte-for-byte download and SHA-256 calculation could not be completed. Do not label these values SHA-256 or use them as a substitute. A later reproducible download step must calculate SHA-256 locally before any import.

For Spanish `.dic` files, GitHub returned the first-line declared entry count and the file blob ID. The count is the upstream file's declared raw entry count, not the number of unique playable lemmas: Hunspell flags, compounds, capitalization, proper names and inflection policy still require parsing and filtering.

## Spanish regional dictionaries

Source notice: `es/README_hunspell_es.txt` and `es/LICENSE.md`. The upstream notice offers GPL-3.0-or-later OR LGPL-3.0-or-later OR MPL-1.1-or-later. STOP has not selected or approved a licensing route.

| Locale | Declared .dic entries | .dic Git blob SHA-1 | .aff Git blob SHA-1 |
|---|---:|---|---|
| es_AR | 57,437 | `29b1759a105c35f8a701b0411b7c46368450448f` | `47abbea470d6833f167bbef45fdfc069798f2d98` |
| es_BO | 56,899 | `7dd6700d1c4e04cd347bac6b7b636ea328fb2934` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_CL | 57,174 | `c6a97dbb763423b1f0b70f4a82396479dc38bf63` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_CO | 62,280 | `a964745f64f1f6b1294cfc801207478b007bf296` | `7006bd57f81057ca2a372a6476b9251a9af9baeb` |
| es_CR | 56,699 | `1db3bd51307d40912ce0b047b3c4c4e2dda626ed` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_CU | 56,892 | `883b1c603b2bd2bb28cde446ec636fc1de2f3af4` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_DO | 56,581 | `fe4f9f3d446e5ade8665affee25b7ae7014c8f1b` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_EC | 56,749 | `e100469c7cf75f6a0d313090e71cd3f2069e8cd4` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_ES | 58,221 | `4a1b9b29175abc663949c16aacd5650475cc4f85` | `8ece2647bffe4e36f5deaf38f1a40e7452e9edf6` |
| es_GQ | 71,199 | `1ebe40e99e2424a49eb7b2a5259c6d5878b54a4c` | `410df2287a06cf30af8e5d8f9b3ada29bd01dcfc` |
| es_GT | 56,666 | `3e185112ce60c30fa24dd7eab38854f1d9ad2039` | `d7f251cd3671d05d92ad9a99d44e3c6d04bd06b3` |
| es_HN | 56,841 | `5344a6cf425e42935c0018a73baa3d2fafd994a2` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_MX | 59,093 | `60fbc98976417a58bae2a74b1fb95d747f963614` | `e8fc101aabecedfa1423da4d51a2f620eee46762` |
| es_NI | 56,743 | `4a611b9fc9844ed224beb010ef03d02b48a5b64b` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_PA | 56,635 | `f0ea34f296376586625053f5586c2c61e93fcb0f` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_PE | 58,445 | `e67af62a78d8403a50179a4732596756e05b9d58` | `e8fc101aabecedfa1423da4d51a2f620eee46762` |
| es_PH | 67,762 | `c0f65a80787721a638f75a331c76bc722c20e0db` | `410df2287a06cf30af8e5d8f9b3ada29bd01dcfc` |
| es_PR | 56,592 | `4da6c9876035a22a55b536b2df840eb74802b146` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_PY | 56,650 | `d21d98551cd34ba08b247d6caf55b737ea03b266` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_SV | 56,703 | `47cdc64d95f30cec9fce13c033e979ea9b97e9af` | `166b7c3219494e3c9d890fc3c90c519b09c0989f` |
| es_US | 56,293 | `ad0c81ddefa64af750a6279ddb56e7676e114a88` | `410df2287a06cf30af8e5d8f9b3ada29bd01dcfc` |
| es_UY | 56,833 | `e12a18218d4085b52774ba29b7f367c713dfc810` | `830666f27e284dbb58fcf02e08028ca992d81add` |
| es_VE | 57,108 | `16f99378d884d32dfec0c93ea429f396be8ffce0` | `e8fc101aabecedfa1423da4d51a2f620eee46762` |

### Spanish interpretation

- The LibreOffice makefile lists exactly these 23 locale pairs as packaged Spanish Hunspell files.
- There are 23 distinct `.dic` blob IDs, but only 8 distinct `.aff` blob IDs in this revision. Therefore the locales are not 23 fully independent morphology implementations.
- Declared entry counts range from 56,293 to 71,199. Those figures must not be presented as numbers of validated STOP answers.
- The previous inventory comparison of locale lists found overlap and non-overlap across regional word lists; actual unique, normalized, reviewed lemmas still require a parser and manual/lexicographic review.

## Portuguese and French files

The upstream makefiles identify the exact word-list and affix paths. GitHub returned blob IDs for each, but the file-content endpoint returned empty content for these large `.dic` files, including when a small line range was requested. Consequently, no raw entry counts are asserted here.

| Locale | File | Git blob SHA-1 | Retrieval note |
|---|---|---|---|
| pt-BR | `pt_BR/pt_BR.dic` | `849c1dcaf873e72e364f7a64b6f1f2a679bbb097` | Content not exposed by connector |
| pt-BR | `pt_BR/pt_BR.aff` | `4664ad6fc893e5683c1140eab8c1e1faeca802d3` | Content fetched; 27,372 lines |
| pt-PT | `pt_PT/pt_PT.dic` | `2b6da831cdf48eeb3df605ad2841732ef5f13981` | Content not exposed by connector |
| pt-PT | `pt_PT/pt_PT.aff` | `ef6aaf55ccc2cfba2948cf5a92eb5f4849634c12` | Content fetched; 1,436 lines |
| fr-FR | `fr_FR/dictionaries/fr.dic` | `fdb058b940dbb690ac17c0c8e231497d678d216e` | Content not exposed by connector |
| fr-FR | `fr_FR/dictionaries/fr.aff` | `bc5cee894fa19d37c10b65192128677fbbc68ccb` | Content fetched; 5,975 lines |

French makefile selects `fr.dic` and `fr.aff` (the classical profile described as recommended in its README). The separate orthographic variants must not be merged blindly.

## Outcome

This is a pinned-file inventory, not a playable vocabulary import. No data has been copied into STOP, no source has been approved in `source-manifest.json`, and the manifest remains empty. Licensing decisions remain as documented in `HUNSPELL-UPSTREAM-AUDIT-2026-11-27.md`.

Next gate: obtain exact bytes for the large Portuguese/French lists and all selected Spanish files, calculate SHA-256, run a Hunspell-aware parser against the matching affix rules, then create a filtered candidate list for human review. Keep category evidence separate from lexical evidence.
