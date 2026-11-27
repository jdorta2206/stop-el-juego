#!/usr/bin/env python3
"""Extract Spanish Wikidata lexeme structure as research-only evidence.

Input is newline-delimited JSON: one Wikibase Lexeme entity per line.
This parser does not fetch Wikidata, approve words, or modify the game dictionary.
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

LEXEME_ID = re.compile(r"^L[1-9][0-9]*$")
ITEM_ID = re.compile(r"^Q[1-9][0-9]*$")
SPANISH_LANGUAGE_ID = "Q1321"
PROPER_NOUN_CATEGORY_ID = "Q147276"


def identity(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def require_item_id(value: Any, field: str) -> str:
    if not isinstance(value, str) or not ITEM_ID.fullmatch(value):
        raise ValueError(f"{field}: expected a Wikidata item ID")
    return value


def read_representations(value: Any, field: str) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        raise ValueError(f"{field}: expected a representation map")
    output = []
    for key in sorted(value):
        item = value[key]
        if not isinstance(item, dict):
            raise ValueError(f"{field}.{key}: expected an object")
        language = item.get("language", key)
        spelling = item.get("value")
        if not isinstance(language, str) or not language.strip():
            raise ValueError(f"{field}.{key}: missing language tag")
        if not isinstance(spelling, str) or not spelling.strip():
            raise ValueError(f"{field}.{key}: missing spelling")
        output.append({"languageTag": language, "spelling": spelling})
    return output


def extract_lexeme(entity: Any, spanish_language_id: str = SPANISH_LANGUAGE_ID) -> list[dict[str, Any]]:
    if not isinstance(entity, dict) or entity.get("type") != "lexeme":
        raise ValueError("entity: expected a Wikibase Lexeme entity")
    lexeme_id = entity.get("id")
    if not isinstance(lexeme_id, str) or not LEXEME_ID.fullmatch(lexeme_id):
        raise ValueError("entity.id: expected a Wikidata lexeme ID")
    language_id = require_item_id(entity.get("language"), "entity.language")
    if language_id != spanish_language_id:
        return []
    category_id = require_item_id(entity.get("lexicalCategory"), "entity.lexicalCategory")
    lemmas = read_representations(entity.get("lemmas"), "entity.lemmas")
    if not lemmas:
        raise ValueError(f"{lexeme_id}: Spanish lexeme has no lemma representations")

    output: list[dict[str, Any]] = []

    def emit(record_type: str, record_id: str, representation: dict[str, str], features: list[str]) -> None:
        spelling = representation["spelling"]
        output.append({
            "identity": identity(spelling),
            "spelling": spelling,
            "recordType": record_type,
            "lexemeId": lexeme_id,
            "recordId": record_id,
            "languageItemId": language_id,
            "languageTag": representation["languageTag"],
            "lexicalCategoryId": category_id,
            "grammaticalFeatureIds": features,
            "properNameEvidence": category_id == PROPER_NOUN_CATEGORY_ID,
            "lexicalApproval": False,
            "categoryApproval": False,
            "source": "Wikidata Lexicographical Data",
            "note": "Research evidence only; not a dictionary approval or STOP category decision.",
        })

    for representation in lemmas:
        emit("lemma", lexeme_id, representation, [])

    forms = entity.get("forms", [])
    if not isinstance(forms, list):
        raise ValueError(f"{lexeme_id}: forms must be an array")
    for index, form in enumerate(forms):
        if not isinstance(form, dict):
            raise ValueError(f"{lexeme_id}.forms[{index}]: expected an object")
        form_id = form.get("id")
        if not isinstance(form_id, str) or not form_id.startswith(lexeme_id + "-F"):
            raise ValueError(f"{lexeme_id}.forms[{index}]: invalid form ID")
        features = form.get("grammaticalFeatures", [])
        if not isinstance(features, list):
            raise ValueError(f"{form_id}: grammaticalFeatures must be an array")
        feature_ids = sorted({require_item_id(item, f"{form_id}.grammaticalFeatures") for item in features})
        representations = read_representations(form.get("representations"), f"{form_id}.representations")
        for representation in representations:
            emit("form", form_id, representation, feature_ids)

    return output


def extract_jsonl(input_path: Path, output_path: Path, spanish_language_id: str) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    counts = Counter()
    with input_path.open(encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, start=1):
            if not raw.strip():
                continue
            try:
                entity = json.loads(raw)
                extracted = extract_lexeme(entity, spanish_language_id)
            except (json.JSONDecodeError, ValueError) as error:
                raise ValueError(f"{input_path}:{line_number}: {error}") from error
            counts["entitiesRead"] += 1
            if entity.get("type") == "lexeme" and entity.get("language") == spanish_language_id:
                counts["spanishLexemes"] += 1
            for record in extracted:
                records.append(record)
                counts["properNameRecords"] += record["properNameEvidence"]
                counts["lemmaRecords"] += record["recordType"] == "lemma"
                counts["formRecords"] += record["recordType"] == "form"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    summary = {
        **dict(counts),
        "records": len(records),
        "allLexicalApprovalFalse": all(item["lexicalApproval"] is False for item in records),
        "allCategoryApprovalFalse": all(item["categoryApproval"] is False for item in records),
        "spanishLanguageItemId": spanish_language_id,
        "properNounCategoryId": PROPER_NOUN_CATEGORY_ID,
        "warning": "Research-only extraction. Wikidata presence does not prove correctness, current usage, regional validity, or category eligibility.",
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-jsonl", type=Path, required=True)
    parser.add_argument("--output-jsonl", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--spanish-language-id", default=SPANISH_LANGUAGE_ID)
    args = parser.parse_args()
    require_item_id(args.spanish_language_id, "--spanish-language-id")
    summary = extract_jsonl(args.input_jsonl, args.output_jsonl, args.spanish_language_id)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
