#!/usr/bin/env python3
"""Cross-check STOP Spanish candidates against pinned lexical sources (research only)."""
from __future__ import annotations

import argparse
import hashlib
import json
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

RLA_GIT_BLOB_SHA = "d087616b163c15af3561796be11cb65cf1c6e8d5"
MCR_GIT_BLOB_SHA = "86c9e367d64a794300b414e55c78b54dbb07eb27"
MCR_LICENSE_GIT_BLOB_SHA = "bee06f5b0102f3648b374210fbb9dad8315e230f"
FREELING_COMMIT = "0bae6b7f6d1b405e67658895de54b59bfb3b6338"
FREELING_AR_GIT_BLOB_SHA = "adbebb9aea96ce4fc24dd594b12b144a8e5f5148"
FREELING_COPYING_GIT_BLOB_SHA = "df5e2741df0283e4e350d0891f7c33208b097034"
FREELING_APACHE_GIT_BLOB_SHA = "d645695673349e3947e8e5ae42332d0ac3164cd7"


def identity(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def verify_pinned_sources(
    rla: Path,
    mcr: Path,
    license_file: Path,
    freeling_ar: Path,
    freeling_copying: Path,
    freeling_apache_license: Path,
) -> None:
    expected = (
        (rla, RLA_GIT_BLOB_SHA),
        (mcr, MCR_GIT_BLOB_SHA),
        (license_file, MCR_LICENSE_GIT_BLOB_SHA),
        (freeling_ar, FREELING_AR_GIT_BLOB_SHA),
        (freeling_copying, FREELING_COPYING_GIT_BLOB_SHA),
        (freeling_apache_license, FREELING_APACHE_GIT_BLOB_SHA),
    )
    for path, digest in expected:
        actual = git_blob_sha(path)
        if actual != digest:
            raise ValueError(f"{path}: pinned Git blob mismatch (expected {digest}, got {actual})")


def read_rla(path: Path) -> dict[str, list[int]]:
    matches: dict[str, list[int]] = {}
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        form = raw.strip()
        if not form:
            continue
        matches.setdefault(identity(form), []).append(line_number)
    return matches


def read_mcr(path: Path) -> tuple[dict[str, list[str]], dict[str, str]]:
    matches: dict[str, list[str]] = {}
    definitions: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw or raw.startswith("#"):
            continue
        columns = raw.split("\t")
        if len(columns) < 3:
            continue
        synset, record_type = columns[0], columns[1]
        if record_type == "spa:lemma":
            lemma = columns[2].strip()
            if lemma:
                values = matches.setdefault(identity(lemma), [])
                if synset not in values:
                    values.append(synset)
        elif record_type == "spa:def":
            definition = columns[-1].strip()
            if definition:
                definitions[synset] = definition
    return (
        {key: sorted(value) for key, value in matches.items()},
        definitions,
    )


def mcr_pos(synset: str) -> str:
    suffix = synset.rsplit("-", 1)[-1]
    return {"n": "noun", "v": "verb", "a": "adjective", "r": "adverb"}.get(suffix, "unknown")


def read_freeling_argentina(path: Path) -> dict[str, list[dict[str, str]]]:
    """Read FreeLing's Argentine verb form, lemma and morph-tag triples."""
    matches: dict[str, list[dict[str, str]]] = {}
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        columns = raw.split()
        if len(columns) != 3:
            raise ValueError(f"{path}:{line_number}: expected exactly form, lemma and tag")
        form, lemma, tag = columns
        analysis = {"lemma": lemma, "tag": tag, "partOfSpeech": "verb"}
        values = matches.setdefault(identity(form), [])
        if analysis not in values:
            values.append(analysis)
    return {key: sorted(value, key=lambda item: (item["lemma"], item["tag"])) for key, value in matches.items()}


def build_crosscheck(
    candidates_path: Path,
    rla_matches: dict[str, list[int]],
    mcr_matches: dict[str, list[str]],
    mcr_definitions: dict[str, str] | None = None,
    freeling_argentina: dict[str, list[dict[str, str]]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    output: list[dict[str, Any]] = []
    counts = Counter()
    for raw in candidates_path.read_text(encoding="utf-8").splitlines():
        if not raw:
            continue
        candidate = json.loads(raw)
        key = candidate["identity"]
        rla_lines = rla_matches.get(key, [])
        synsets = mcr_matches.get(key, [])
        definitions = mcr_definitions or {}
        sense_details = [
            {
                "synsetId": synset,
                "partOfSpeech": mcr_pos(synset),
                "definition": definitions.get(synset, ""),
            }
            for synset in synsets
        ]
        raw_freeling_analyses = (freeling_argentina or {}).get(key, [])
        freeling_analyses = []
        for analysis in raw_freeling_analyses:
            lemma = analysis["lemma"]
            lemma_synsets = mcr_matches.get(identity(lemma), [])
            lemma_rla_lines = rla_matches.get(identity(lemma), [])
            freeling_analyses.append({
                **analysis,
                "lemmaMcrSynsetIds": lemma_synsets,
                "lemmaRlaWordlistLines": lemma_rla_lines,
                "lemmaEvidence": (
                    "mcr_lemma_attested" if lemma_synsets else
                    "rla_lemma_match_lineage_unverified" if lemma_rla_lines else
                    "lemma_not_found_in_checked_sources"
                ),
            })
        counts["candidates"] += 1
        counts["freeling_argentine_morph_match"] += bool(freeling_analyses)
        counts["freeling_lemma_mcr_attested"] += any(item["lemmaMcrSynsetIds"] for item in freeling_analyses)
        counts["freeling_lemma_rla_match"] += any(item["lemmaRlaWordlistLines"] for item in freeling_analyses)
        counts["freeling_lemma_without_checked_attestation"] += bool(freeling_analyses) and not any(
            item["lemmaMcrSynsetIds"] or item["lemmaRlaWordlistLines"] for item in freeling_analyses
        )
        counts["freeling_ambiguous_analysis"] += len(freeling_analyses) > 1
        counts["mcr_synsets_with_definition"] += sum(bool(item["definition"]) for item in sense_details)
        counts["rla_wordlist_match"] += bool(rla_lines)
        counts["mcr_synset_match"] += bool(synsets)
        counts["both_sources_match"] += bool(rla_lines and synsets)
        counts["no_source_match"] += not (rla_lines or synsets or freeling_analyses)
        output.append({
            "identity": key,
            "spellings": candidate.get("spellings", []),
            "locales": candidate.get("locales", []),
            "rlaWordlistLines": rla_lines,
            "mcrSynsetIds": synsets,
            "mcrSenses": sense_details,
            "freelingArgentineAnalyses": freeling_analyses,
            "properNameReview": "required_when_category_or_answer_rules_distinguish_proper_names",
            "evidence": (
                "mcr_synset_match" if synsets else
                "rla_wordlist_match_lineage_unverified" if rla_lines else
                "no_match_in_checked_sources"
            ),
            "lexicalApproval": False,
            "categoryApproval": False,
            "note": "Cross-check only. Source presence does not automatically establish current usage, regional validity, or STOP category eligibility.",
        })
    summary = {
        **dict(counts),
        "rlaSourceIndependence": "not_established; RLA-ES lineage may overlap with Hunspell",
        "mcrSourceIndependence": "separate WordNet lexical resource; limited coverage",
        "allLexicalApprovalFalse": all(row["lexicalApproval"] is False for row in output),
        "allCategoryApprovalFalse": all(row["categoryApproval"] is False for row in output),
        "sources": {
            "rla": {
                "revision": "e4f3043c6d7c15e454d43e6e62dfba0c68378ecf",
                "file": "lemario-general-del-espanol.txt",
                "gitBlobSha1": RLA_GIT_BLOB_SHA,
                "license": "Public-domain dedication stated by repository; lineage/provenance overlap still requires review.",
            },
            "mcr": {
                "release": "omw-data v2.0 (2026-02-01)",
                "file": "wns/mcr/wn-data-spa.tab",
                "gitBlobSha1": MCR_GIT_BLOB_SHA,
                "license": "CC BY 3.0; attribution and license notice required; not approved for STOP runtime.",
                "attribution": "Aitor Gonzalez-Agirre, Egoitz Laparra and German Rigau (2012), Multilingual Central Repository version 3.0, Proceedings of the 6th Global WordNet Conference.",
            },
            "freelingArgentine": {
                "repositoryCommit": FREELING_COMMIT,
                "file": "data/es/es-ar/dictionary/entries/AR.verb",
                "gitBlobSha1": FREELING_AR_GIT_BLOB_SHA,
                "copyingGitBlobSha1": FREELING_COPYING_GIT_BLOB_SHA,
                "apacheLicenseGitBlobSha1": FREELING_APACHE_GIT_BLOB_SHA,
                "license": "Apache-2.0, as identified for the Argentine Spanish dictionary in FreeLing COPYING; research-only pending full source attribution and rights review.",
                "scope": "Argentine Spanish verb forms mapped to lemmas and morphological tags; not a general Spanish dictionary.",
            },
        },
        "warning": "Research-only output. Neither source match grants lexical or category approval. No runtime dictionary is modified.",
    }
    return output, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--rla", type=Path, required=True)
    parser.add_argument("--mcr", type=Path, required=True)
    parser.add_argument("--mcr-license", type=Path, required=True)
    parser.add_argument("--freeling-ar", type=Path, required=True)
    parser.add_argument("--freeling-copying", type=Path, required=True)
    parser.add_argument("--freeling-apache-license", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    verify_pinned_sources(
        args.rla,
        args.mcr,
        args.mcr_license,
        args.freeling_ar,
        args.freeling_copying,
        args.freeling_apache_license,
    )
    mcr_matches, mcr_definitions = read_mcr(args.mcr)
    rows, summary = build_crosscheck(
        args.candidates,
        read_rla(args.rla),
        mcr_matches,
        mcr_definitions,
        read_freeling_argentina(args.freeling_ar),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "sources"}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
