#!/usr/bin/env python3
"""Extract a review-only candidate inventory from a Hunspell .dic/.aff pair.

The extractor does not generate inflections, decide lexical truth, assign
categories, or modify STOP's runtime dictionary. It checks simple alphabetic
entries with the official Hunspell CLI and leaves other entries for review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Iterable

SIMPLE_WORD = re.compile(r"^[^\W\d_]+$", re.UNICODE)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def comparison_form(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def split_dic_entry(line: str) -> tuple[str, str, str]:
    """Parse word[/flags] and optional morphology without breaking phrases."""
    body = line.rstrip("\r\n")
    if not body:
        raise ValueError("empty dictionary entry")

    separator = -1
    escaped = False
    start = 1 if body.startswith("/") else 0
    for index in range(start, len(body)):
        char = body[index]
        if char == "/" and not escaped:
            separator = index
            break
        if char == "\\" and not escaped:
            escaped = True
        else:
            escaped = False

    if separator < 0:
        morph_match = re.search(r"\s+(?=[a-z]{2}:)", body)
        if morph_match:
            word = body[:morph_match.start()]
            flags, morphology = "", body[morph_match.start() + 1:]
        else:
            word, flags, morphology = body, "", ""
    else:
        word = body[:separator]
        tail = body[separator + 1:]
        match = re.match(r"([^\s]*)(?:\s+(.*))?$", tail)
        flags = match.group(1) if match else ""
        morphology = (match.group(2) or "") if match else ""
    word = word.replace("\\/", "/")
    if not word:
        raise ValueError("dictionary entry has an empty word")
    return word, flags, morphology


def read_dictionary(path: Path) -> tuple[int, list[dict[str, str]]]:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if not lines or not lines[0].strip().isdigit():
        raise ValueError(f"{path}: first line must declare the entry count")
    declared = int(lines[0].strip())
    records: list[dict[str, str]] = []
    for line_number, line in enumerate(lines[1:], start=2):
        if not line:
            continue
        word, flags, morphology = split_dic_entry(line)
        records.append({
            "word": word,
            "flags": flags,
            "morphology": morphology,
            "line": str(line_number),
        })
    if declared != len(records):
        raise ValueError(
            f"{path}: declared {declared} entries but parsed {len(records)} non-empty entries"
        )
    return declared, records


def verify_affix_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8-sig")
    match = re.search(r"(?im)^\s*SET\s+([^\s#]+)", text)
    if not match:
        raise ValueError(f"{path}: missing SET encoding declaration")
    if match.group(1).upper().replace("-", "") != "UTF8":
        raise ValueError(
            f"{path}: encoding {match.group(1)!r} is not UTF-8; refusing lossy conversion"
        )


def hunspell_rejections(
    binary: str, dictionary_base: Path, words: Iterable[str]
) -> set[str]:
    word_list = list(words)
    payload = "".join(word + "\n" for word in word_list)
    if not payload:
        return set()
    completed = subprocess.run(
        [binary, "-l", "-1", "-d", str(dictionary_base)],
        input=payload,
        text=True,
        encoding="utf-8",
        errors="strict",
        capture_output=True,
        check=False,
        timeout=300,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Hunspell failed ({completed.returncode}): "
            f"{completed.stderr.strip() or completed.stdout.strip()}"
        )
    inputs = {comparison_form(word) for word in word_list}
    rejected: set[str] = set()
    for output_line in completed.stdout.splitlines():
        token = output_line.strip()
        if not token:
            continue
        key = comparison_form(token)
        if key not in inputs:
            raise RuntimeError(
                "Hunspell output could not be mapped safely to an input word; "
                f"unexpected token: {token!r}"
            )
        rejected.add(key)
    return rejected


def build_inventory(
    dic_path: Path, aff_path: Path, locale: str, revision: str, hunspell: str
) -> list[dict[str, object]]:
    verify_affix_file(aff_path)
    declared, records = read_dictionary(dic_path)
    simple_words = [r["word"] for r in records if SIMPLE_WORD.fullmatch(r["word"])]
    rejected = hunspell_rejections(hunspell, dic_path.with_suffix(""), simple_words)

    result: list[dict[str, object]] = [{
        "recordType": "source",
        "locale": locale,
        "upstreamRevision": revision,
        "dictionaryFile": dic_path.name,
        "dictionarySha256": sha256_file(dic_path),
        "affixFile": aff_path.name,
        "affixSha256": sha256_file(aff_path),
        "declaredEntryCount": declared,
        "parsedEntryCount": len(records),
        "hunspellBinary": hunspell,
        "classificationNote": (
            "accepted_by_hunspell means only that the paired .dic/.aff accepts "
            "the form; it is not proof of lexical truth or category eligibility"
        ),
    }]
    for record in records:
        word = record["word"]
        if not SIMPLE_WORD.fullmatch(word):
            status = "manual_review"
        elif comparison_form(word) in rejected:
            status = "rejected_by_hunspell"
        else:
            status = "accepted_by_hunspell"
        result.append({
            "recordType": "candidate",
            "locale": locale,
            "word": word,
            "sourceLine": int(record["line"]),
            "hunspellFlags": record["flags"],
            "morphology": record["morphology"],
            "status": status,
            "lexicalApproval": False,
            "categoryApproval": False,
        })
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dic", required=True, type=Path)
    parser.add_argument("--aff", required=True, type=Path)
    parser.add_argument("--locale", required=True, help="For example es-ES or pt-BR")
    parser.add_argument("--revision", required=True, help="Immutable upstream commit or release")
    parser.add_argument("--hunspell", default="hunspell", help="Hunspell CLI executable")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        records = build_inventory(
            args.dic, args.aff, args.locale, args.revision, args.hunspell
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", encoding="utf-8", newline="\n") as stream:
            for record in records:
                stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    except (OSError, UnicodeError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"extract-hunspell-candidates: {error}", file=sys.stderr)
        return 2

    counts: dict[str, int] = {}
    for record in records[1:]:
        status = str(record["status"])
        counts[status] = counts.get(status, 0) + 1
    print(json.dumps({
        "output": str(args.output),
        "locale": args.locale,
        "sourceEntries": len(records) - 1,
        "statusCounts": counts,
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
