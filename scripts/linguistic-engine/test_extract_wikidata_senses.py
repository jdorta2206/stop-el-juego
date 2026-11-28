import tempfile
import unittest
from pathlib import Path

from extract_wikidata_senses import extract_senses, iter_entities


def lexeme():
    return {
        "type": "lexeme",
        "id": "L123",
        "language": "Q1321",
        "senses": [{
            "id": "L123-S1",
            "glosses": {
                "es": {"language": "es", "value": "edificio para habitar"},
                "en": {"language": "en", "value": "building for human habitation"},
            },
            "claims": {
                "P5185": [{
                    "id": "L123-S1$statement1",
                    "type": "statement",
                    "rank": "normal",
                    "mainsnak": {"snaktype": "value", "property": "P5185", "datatype": "wikibase-item"},
                }]
            },
        }],
    }


class WikidataSenseExtractorTests(unittest.TestCase):
    def test_extracts_sense_id_and_all_language_tagged_glosses(self):
        rows = extract_senses(lexeme())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["senseId"], "L123-S1")
        self.assertEqual(rows[0]["lexemeId"], "L123")
        self.assertEqual(
            rows[0]["glosses"],
            [
                {"languageTag": "en", "gloss": "building for human habitation"},
                {"languageTag": "es", "gloss": "edificio para habitar"},
            ],
        )
        self.assertTrue(rows[0]["researchOnly"])
        self.assertEqual(rows[0]["claimPropertyIds"], ["P5185"])
        self.assertEqual(rows[0]["claimCount"], 1)
        self.assertEqual(rows[0]["claims"]["P5185"][0]["rank"], "normal")

    def test_accepts_special_entity_data_envelope(self):
        wrapped = {"entities": {"L123": lexeme()}}
        rows = extract_senses(wrapped)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["lexemeId"], "L123")

    def test_rejects_mismatched_special_entity_data_key(self):
        wrapped = {"entities": {"L999": lexeme()}}
        with self.assertRaisesRegex(ValueError, "key must match"):
            extract_senses(wrapped)

    def test_ignores_non_target_language(self):
        entity = lexeme()
        entity["language"] = "Q1860"
        self.assertEqual(extract_senses(entity), [])

    def test_rejects_sense_id_from_another_lexeme(self):
        entity = lexeme()
        entity["senses"][0]["id"] = "L999-S1"
        with self.assertRaisesRegex(ValueError, "invalid sense ID"):
            extract_senses(entity)

    def test_rejects_empty_gloss(self):
        entity = lexeme()
        entity["senses"][0]["glosses"]["es"]["value"] = ""
        with self.assertRaisesRegex(ValueError, "missing gloss"):
            extract_senses(entity)

    def test_rejects_malformed_sense_claims(self):
        entity = lexeme()
        entity["senses"][0]["claims"] = {"not-a-property": []}
        with self.assertRaisesRegex(ValueError, "invalid property ID"):
            extract_senses(entity)
        entity = lexeme()
        entity["senses"][0]["claims"] = {"P5185": "not-an-array"}
        with self.assertRaisesRegex(ValueError, "array of statement objects"):
            extract_senses(entity)

    def test_reads_array_wrapped_line_oriented_dump(self):
        import json
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "sample.json"
            source.write_text(
                "[\n" + json.dumps(lexeme()) + ",\n" + json.dumps(lexeme()) + "\n]\n",
                encoding="utf-8",
            )
            entities = [entity for _, entity in iter_entities(source)]
            self.assertEqual(len(entities), 2)


if __name__ == "__main__":
    unittest.main()
