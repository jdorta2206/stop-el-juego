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


def identity(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def verify_pinned_sources(rla: Path, mcr: Path, license_file: Path) -> None:
    expected = (
        (rla, RLA_GIT_BLOB_SHA),
        (mcr, MCR_GIT_BLOB_SHA),
        (license_file, MCR_LICENSE_GIT_BLOB_SHA),
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


def build_crosscheck(
    candidates_path: Path,
    rla_matches: dict[str, list[int]],
    mcr_matches: dict[str, list[str]],
    mcr_definitions: dict[str, str] | None = None,
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
        counts["candidates"] += 1
        counts["mcr_synsets_with_definition"] += sum(bool(item["definition"]) for item in sense_details)
        counts["rla_wordlist_match"] += bool(rla_lines)
        counts["mcr_synset_match"] += bool(synsets)
        counts["both_sources_match"] += bool(rla_lines and synsets)
        counts["no_source_match"] += not (rla_lines or synsets)
        output.append({
            "identity": key,
            "spellings": candidate.get("spellings", []),
            "locales": candidate.get("locales", []),
            "rlaWordlistLines": rla_lines,
            "mcrSynsetIds": synsets,
            "mcrSenses": sense_details,
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
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    verify_pinned_sources(args.rla, args.mcr, args.mcr_license)
    rows, summary = build_crosscheck(args.candidates, read_rla(args.rla), read_mcr(args.mcr))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "sources"}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
