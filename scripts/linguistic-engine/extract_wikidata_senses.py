#!/usr/bin/env python3
"""Extract Wikidata Lexeme senses and glosses to a research-only JSONL sidecar."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

LEXEME_ID = re.compile(r"^L[1-9][0-9]*$")
SENSE_ID = re.compile(r"^(L[1-9][0-9]*)-S[1-9][0-9]*$")
ITEM_ID = re.compile(r"^Q[1-9][0-9]*$")
SPANISH_LANGUAGE_ID = "Q1321"


def extract_senses(entity: Any, language_item_id: str = SPANISH_LANGUAGE_ID) -> list[dict[str, Any]]:
    if not isinstance(entity, dict) or entity.get("type") != "lexeme":
        raise ValueError("entity: expected a Wikibase Lexeme entity")
    lexeme_id = entity.get("id")
    if not isinstance(lexeme_id, str) or not LEXEME_ID.fullmatch(lexeme_id):
        raise ValueError("entity.id: invalid lexeme ID")
    language = entity.get("language")
    if not isinstance(language, str) or not ITEM_ID.fullmatch(language):
        raise ValueError("entity.language: invalid item ID")
    if language != language_item_id:
        return []
    senses = entity.get("senses", [])
    if not isinstance(senses, list):
        raise ValueError(f"{lexeme_id}: senses must be an array")
    result = []
    for index, sense in enumerate(senses):
        if not isinstance(sense, dict):
            raise ValueError(f"{lexeme_id}.senses[{index}]: expected object")
        sense_id = sense.get("id")
        if (not isinstance(sense_id, str) or not SENSE_ID.fullmatch(sense_id)
                or not sense_id.startswith(lexeme_id + "-S")):
            raise ValueError(f"{lexeme_id}.senses[{index}]: invalid sense ID")
        gloss_map = sense.get("glosses")
        if not isinstance(gloss_map, dict) or not gloss_map:
            raise ValueError(f"{sense_id}: glosses must be a non-empty object")
        glosses = []
        for tag in sorted(gloss_map):
            gloss = gloss_map[tag]
            if not isinstance(gloss, dict):
                raise ValueError(f"{sense_id}.glosses.{tag}: expected object")
            language_tag = gloss.get("language", tag)
            value = gloss.get("value")
            if not isinstance(language_tag, str) or not language_tag.strip():
                raise ValueError(f"{sense_id}.glosses.{tag}: missing language tag")
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{sense_id}.glosses.{tag}: missing gloss")
            glosses.append({"languageTag": language_tag, "gloss": value})
        claims = sense.get("claims", {})
        if not isinstance(claims, dict):
            raise ValueError(f"{sense_id}: claims must be an object keyed by property ID")
        claim_count = 0
        for property_id, statements in claims.items():
            if not isinstance(property_id, str) or not re.fullmatch(r"P[1-9][0-9]*", property_id):
                raise ValueError(f"{sense_id}.claims: invalid property ID")
            if not isinstance(statements, list) or any(not isinstance(item, dict) for item in statements):
                raise ValueError(f"{sense_id}.claims.{property_id}: expected an array of statement objects")
            claim_count += len(statements)
        result.append({
            "senseId": sense_id,
            "lexemeId": lexeme_id,
            "languageItemId": language,
            "glosses": glosses,
            "claims": claims,
            "claimPropertyIds": sorted(claims),
            "claimCount": claim_count,
            "source": "Wikidata Lexicographical Data",
            "researchOnly": True,
            "note": "Source glosses are not independently verified dictionary definitions.",
        })
    return result


def iter_entities(path: Path):
    with path.open(encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, 1):
            line = raw.strip()
            if not line or line in {"[", "]"}:
                continue
            if line.endswith(","):
                line = line[:-1].rstrip()
            try:
                yield line_number, json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSON entity: {error}") from error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-jsonl", type=Path, required=True)
    parser.add_argument("--output-jsonl", type=Path, required=True)
    parser.add_argument("--language-item-id", default=SPANISH_LANGUAGE_ID)
    args = parser.parse_args()
    if not ITEM_ID.fullmatch(args.language_item_id):
        parser.error("--language-item-id must be a Wikidata item ID")
    args.output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    counts = {"entitiesRead": 0, "senses": 0, "glosses": 0, "senseClaims": 0}
    with args.output_jsonl.open("w", encoding="utf-8", newline="\n") as output:
        for line_number, entity in iter_entities(args.input_jsonl):
            try:
                senses = extract_senses(entity, args.language_item_id)
            except ValueError as error:
                raise ValueError(f"{args.input_jsonl}:{line_number}: {error}") from error
            counts["entitiesRead"] += 1
            for sense in senses:
                output.write(json.dumps(sense, ensure_ascii=False, sort_keys=True) + "\n")
                counts["senses"] += 1
                counts["glosses"] += len(sense["glosses"])
                counts["senseClaims"] += sense["claimCount"]
    print(json.dumps({**counts, "researchOnly": True, "streaming": True}, sort_keys=True))


if __name__ == "__main__":
    main()
