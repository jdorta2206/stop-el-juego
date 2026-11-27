#!/usr/bin/env python3
"""Build a deterministic, review-only catalogue from Hunspell JSONL inventories.

This tool deduplicates spellings for research. It never approves lexical truth,
category eligibility, or scoring, and it does not write into the game runtime.
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any


REVISION = "79195b017e6d70151337856c59e7d13d311d6630"
INVISIBLE = {"\u00ad", "\u200b", "\u200c", "\u200d", "\u2060", "\ufeff"}
WORD_RE = re.compile(r"^[^\W\d_]+(?:['’\-][^\W\d_]+)*$", re.UNICODE)


def identity(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def classify_form(word: str) -> list[str]:
    """Conservative structural flags only; never guesses proper-name status."""
    flags: list[str] = []
    if any(ch in INVISIBLE or unicodedata.category(ch) in {"Cf", "Cc"} for ch in word):
        flags.append("invisible_or_control_character")
    if any(ch.isspace() for ch in word):
        flags.append("phrase_or_whitespace")
    if any(ch.isdigit() for ch in word):
        flags.append("contains_digit")
    if not WORD_RE.fullmatch(word):
        flags.append("non_simple_token")
    letters = [ch for ch in word if ch.isalpha()]
    if letters and word == word.upper() and any(ch.isalpha() for ch in word):
        flags.append("uppercase_review")
    if any(unicodedata.category(ch).startswith("P") for ch in word):
        flags.append("contains_punctuation")
    scripts = {
        "LATIN" if "LATIN" in unicodedata.name(ch, "") else
        "OTHER" if ch.isalpha() else None
        for ch in letters
    } - {None}
    if len(scripts) > 1:
        flags.append("mixed_script_review")
    if not flags:
        flags.append("simple_alphabetic_candidate")
    return sorted(set(flags))


def read_inventory(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not records or records[0].get("recordType") != "source":
        raise ValueError(f"{path}: missing source header")
    source = records[0]
    required = ("locale", "dictionaryFile", "dictionarySha256", "affixFile", "affixSha256", "upstreamRevision")
    if any(not source.get(key) for key in required):
        raise ValueError(f"{path}: incomplete source provenance")
    if source["upstreamRevision"] != REVISION:
        raise ValueError(f"{path}: unexpected upstream revision")
    candidates = records[1:]
    for row_number, item in enumerate(candidates, start=2):
        if item.get("recordType") != "candidate" or not isinstance(item.get("word"), str):
            raise ValueError(f"{path}:{row_number}: malformed candidate record")
        if item.get("locale") != source["locale"]:
            raise ValueError(f"{path}:{row_number}: candidate locale mismatch")
    return source, candidates


def build_catalogue(paths: list[Path]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    per_locale = Counter()
    for path in sorted(paths, key=lambda p: p.name):
        source, candidates = read_inventory(path)
        locale = source["locale"]
        if locale in per_locale:
            raise ValueError(f"duplicate locale inventory: {locale}")
        per_locale[locale] = len(candidates)
        for item in candidates:
            word = item["word"]
            key = identity(word)
            entry = grouped.setdefault(key, {
                "identity": key,
                "spellings": set(),
                "locales": set(),
                "provenance": [],
                "statuses": set(),
                "reviewFlags": set(),
                "allLexicalApprovalFalse": True,
                "allCategoryApprovalFalse": True,
            })
            entry["spellings"].add(unicodedata.normalize("NFC", word))
            entry["locales"].add(locale)
            entry["statuses"].add(item.get("status", "unknown"))
            entry["reviewFlags"].update(classify_form(word))
            entry["allLexicalApprovalFalse"] &= item.get("lexicalApproval") is False
            entry["allCategoryApprovalFalse"] &= item.get("categoryApproval") is False
            entry["provenance"].append({
                "locale": locale,
                "sourceRevision": source["upstreamRevision"],
                "dictionaryFile": source["dictionaryFile"],
                "dictionarySha256": source["dictionarySha256"],
                "affixFile": source["affixFile"],
                "affixSha256": source["affixSha256"],
                "sourceLine": item.get("sourceLine"),
                "hunspellFlags": item.get("hunspellFlags", ""),
                "morphology": item.get("morphology", ""),
                "hunspellStatus": item.get("status", "unknown"),
            })

    output = []
    for key in sorted(grouped):
        entry = grouped[key]
        output.append({
            "identity": key,
            "spellings": sorted(entry["spellings"]),
            "locales": sorted(entry["locales"]),
            "localeCount": len(entry["locales"]),
            "occurrenceCount": len(entry["provenance"]),
            "provenance": sorted(entry["provenance"], key=lambda p: (p["locale"], p["sourceLine"] or 0)),
            "hunspellStatuses": sorted(entry["statuses"]),
            "reviewFlags": sorted(entry["reviewFlags"]),
            "lexicalApproval": False,
            "categoryApproval": False,
            "note": "Research candidate only; Hunspell acceptance is not independent lexical evidence.",
        })
    summary = {
        "locales": len(per_locale),
        "rawEntries": sum(per_locale.values()),
        "uniqueSpellings": len(output),
        "duplicateOccurrences": sum(per_locale.values()) - len(output),
        "singleLocaleSpellings": sum(1 for row in output if row["localeCount"] == 1),
        "allLexicalApprovalFalse": all(row["lexicalApproval"] is False for row in output),
        "allCategoryApprovalFalse": all(row["categoryApproval"] is False for row in output),
        "flagCounts": dict(sorted(Counter(flag for row in output for flag in row["reviewFlags"]).items())),
    }
    return output, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    rows, summary = build_catalogue(list(args.input_dir.glob("*.jsonl")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
