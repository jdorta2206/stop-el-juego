import json
import tempfile
import unittest
from pathlib import Path

from crosscheck_spanish_sources import (
    MCR_GIT_BLOB_SHA, RLA_GIT_BLOB_SHA, build_crosscheck,
    git_blob_sha, identity, read_mcr, read_rla,
)


class SpanishSourceCrosscheckTests(unittest.TestCase):
    def test_identity_preserves_accents(self):
        self.assertEqual(identity("CAFE\u0301"), "café")
        self.assertNotEqual(identity("café"), identity("cafe"))

    def test_git_blob_hash_uses_git_object_header(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.txt"
            path.write_bytes(b"hello\n")
            self.assertEqual(git_blob_sha(path), "ce013625030ba8dba906f756967f9e9ca394464a")

    def test_rla_reader_keeps_line_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rla.txt"
            path.write_text("casa\n\nCasa\nperro\n", encoding="utf-8")
            self.assertEqual(read_rla(path)["casa"], [1, 3])
            self.assertEqual(read_rla(path)["perro"], [4])

    def test_mcr_reader_only_uses_spanish_lemma_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "mcr.tab"
            path.write_text(
                "# header\n00000001\tspa:lemma\tcasa\n"
                "00000001\tspa:def\t0\tconstrucción\n"
                "00000002\teng:lemma\thouse\n"
                "00000003\tspa:lemma\tcasa\n",
                encoding="utf-8",
            )
            matches, definitions = read_mcr(path)
            self.assertEqual(matches["casa"], ["00000001", "00000003"])
            self.assertNotIn("construcción", matches)
            self.assertEqual(definitions["00000001"], "construcción")

    def test_crosscheck_never_approves_lexical_or_category(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "candidates.jsonl"
            path.write_text(
                json.dumps({"identity": "casa", "spellings": ["casa"], "locales": ["es-ES"]}) + "\n"
                + json.dumps({"identity": "inventada", "spellings": ["inventada"], "locales": ["es-MX"]}) + "\n",
                encoding="utf-8",
            )
            rows, summary = build_crosscheck(
                path,
                {"casa": [42]},
                {"casa": ["00000001"]},
                {"00000001": "construcción para habitar"},
            )
            self.assertEqual(rows[0]["evidence"], "mcr_synset_match")
            self.assertEqual(rows[0]["mcrSenses"][0]["partOfSpeech"], "noun")
            self.assertEqual(rows[0]["mcrSenses"][0]["definition"], "construcción para habitar")
            self.assertIn("proper_names", rows[0]["properNameReview"])
            self.assertEqual(rows[0]["rlaWordlistLines"], [42])
            self.assertEqual(rows[1]["evidence"], "no_match_in_checked_sources")
            self.assertTrue(all(row["lexicalApproval"] is False for row in rows))
            self.assertTrue(all(row["categoryApproval"] is False for row in rows))
            self.assertEqual(summary["both_sources_match"], 1)
            self.assertEqual(summary["no_source_match"], 1)
            self.assertIn("not_established", summary["rlaSourceIndependence"])


if __name__ == "__main__":
    unittest.main()
