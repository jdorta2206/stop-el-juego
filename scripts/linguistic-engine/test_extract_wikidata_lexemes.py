import json
import tempfile
import unittest
from pathlib import Path

from extract_wikidata_lexemes import extract_jsonl, extract_lexeme, identity


def spanish_lexeme(category="Q1084", lexeme_id="L123"):
    return {
        "type": "lexeme",
        "id": lexeme_id,
        "language": "Q1321",
        "lexicalCategory": category,
        "lemmas": {"es": {"language": "es", "value": "casa"}},
        "forms": [
            {
                "id": f"{lexeme_id}-F1",
                "representations": {"es": {"language": "es", "value": "casas"}},
                "grammaticalFeatures": ["Q146786"],
            }
        ],
    }


class WikidataLexemeExtractorTests(unittest.TestCase):
    def test_identity_preserves_accents(self):
        self.assertEqual(identity("CAFE\u0301"), "café")
        self.assertNotEqual(identity("café"), identity("cafe"))

    def test_extracts_lemma_and_explicit_form_with_provenance(self):
        rows = extract_lexeme(spanish_lexeme())
        self.assertEqual([row["spelling"] for row in rows], ["casa", "casas"])
        self.assertEqual([row["recordType"] for row in rows], ["lemma", "form"])
        self.assertEqual(rows[1]["recordId"], "L123-F1")
        self.assertEqual(rows[1]["grammaticalFeatureIds"], ["Q146786"])
        self.assertEqual(rows[0]["lexicalCategoryId"], "Q1084")
        self.assertTrue(all(row["lexicalApproval"] is False for row in rows))
        self.assertTrue(all(row["categoryApproval"] is False for row in rows))

    def test_explicit_proper_noun_category_is_evidence_not_approval(self):
        rows = extract_lexeme(spanish_lexeme("Q147276"))
        self.assertTrue(all(row["properNameEvidence"] for row in rows))
        self.assertTrue(all(row["lexicalApproval"] is False for row in rows))
        self.assertTrue(all(row["categoryApproval"] is False for row in rows))

    def test_does_not_reject_same_spelling_under_common_noun_category(self):
        proper = extract_lexeme(spanish_lexeme("Q147276", "L123"))[0]
        common = extract_lexeme(spanish_lexeme("Q1084", "L124"))[0]
        self.assertEqual(proper["identity"], common["identity"])
        self.assertNotEqual(proper["lexemeId"], common["lexemeId"])
        self.assertTrue(proper["properNameEvidence"])
        self.assertFalse(common["properNameEvidence"])

    def test_ignores_non_spanish_lexeme(self):
        entity = spanish_lexeme()
        entity["language"] = "Q1860"
        self.assertEqual(extract_lexeme(entity), [])

    def test_rejects_malformed_form_or_feature_ids(self):
        entity = spanish_lexeme()
        entity["forms"][0]["id"] = "L123-Foops"
        with self.assertRaisesRegex(ValueError, "invalid form ID"):
            extract_lexeme(entity)

        entity = spanish_lexeme()
        entity["forms"][0]["grammaticalFeatures"] = ["not-an-item"]
        with self.assertRaisesRegex(ValueError, "grammaticalFeatures"):
            extract_lexeme(entity)

    def test_jsonl_output_is_research_only_and_counts_proper_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "lexemes.jsonl"
            output = root / "records.jsonl"
            source.write_text(
                json.dumps(spanish_lexeme("Q147276", "L123")) + "\n"
                + json.dumps(spanish_lexeme("Q1084", "L124")) + "\n",
                encoding="utf-8",
            )
            summary = extract_jsonl(source, output, "Q1321")
            rows = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(rows), 4)
            self.assertEqual(summary["spanishLexemes"], 2)
            self.assertEqual(summary["properNameRecords"], 2)
            self.assertTrue(summary["allLexicalApprovalFalse"])
            self.assertTrue(summary["allCategoryApprovalFalse"])
            self.assertEqual(summary["records"], 4)


if __name__ == "__main__":
    unittest.main()
