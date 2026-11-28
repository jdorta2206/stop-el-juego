import json
import tempfile
import unittest
from pathlib import Path

from build_hunspell_catalogue import REVISION, build_catalogue, classify_form, identity


def write_inventory(root: Path, locale: str, words: list[dict]) -> Path:
    source = {
        "recordType": "source", "locale": locale,
        "dictionaryFile": f"{locale}.dic", "dictionarySha256": "a" * 64,
        "affixFile": f"{locale}.aff", "affixSha256": "b" * 64,
        "upstreamRevision": REVISION,
    }
    rows = [source] + [
        {"recordType": "candidate", "locale": locale, "word": item["word"],
         "sourceLine": i + 2, "hunspellFlags": item.get("flags", ""),
         "morphology": item.get("morphology", ""), "status": "accepted_by_hunspell",
         "lexicalApproval": False, "categoryApproval": False}
        for i, item in enumerate(words)
    ]
    path = root / f"{locale}.jsonl"
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    return path


class CatalogueTests(unittest.TestCase):
    def test_identity_preserves_accents_and_normalizes_unicode(self):
        self.assertEqual(identity("cafe\u0301"), "café")
        self.assertNotEqual(identity("café"), identity("cafe"))

    def test_deduplicates_across_locales_and_retains_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [
                write_inventory(root, "es-ES", [{"word": "árbol", "flags": "A", "morphology": "po:noun"}]),
                write_inventory(root, "es-MX", [{"word": "ÁRBOL"}, {"word": "güey"}]),
            ]
            rows, summary = build_catalogue(paths)
            by_key = {row["identity"]: row for row in rows}
            tree = by_key["árbol"]
            self.assertEqual(tree["localeCount"], 2)
            self.assertEqual(tree["occurrenceCount"], 2)
            self.assertEqual(tree["provenance"][0]["sourceLine"], 2)
            self.assertEqual(tree["provenance"][0]["hunspellFlags"], "A")
            self.assertEqual(summary["rawEntries"], 3)
            self.assertEqual(summary["uniqueSpellings"], 2)
            self.assertFalse(tree["lexicalApproval"])
            self.assertFalse(tree["categoryApproval"])

    def test_flags_uppercase_and_phrases_without_calling_them_proper_names(self):
        self.assertIn("uppercase_review", classify_form("MÉXICO"))
        self.assertIn("phrase_or_whitespace", classify_form("a lot"))
        self.assertNotIn("proper_name", classify_form("MÉXICO"))

    def test_flags_invisible_and_control_characters(self):
        self.assertIn("invisible_or_control_character", classify_form("pape\u00adlería"))

    def test_rejects_mismatched_locale_and_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = write_inventory(root, "es-ES", [{"word": "casa"}])
            data = path.read_text(encoding="utf-8").replace('"locale": "es-ES", "word"', '"locale": "es-MX", "word"')
            path.write_text(data, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "locale mismatch"):
                build_catalogue([path])


if __name__ == "__main__":
    unittest.main()
