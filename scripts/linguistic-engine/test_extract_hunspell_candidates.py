import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("extract_hunspell_candidates.py")
SPEC = importlib.util.spec_from_file_location("extract_hunspell_candidates", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class HunspellExtractorTests(unittest.TestCase):
    def test_comparison_key_preserves_capitalization(self):
        self.assertNotEqual(
            MODULE.comparison_form("México"),
            MODULE.comparison_form("méxico"),
        )

    def test_parses_flags_and_morphology(self):
        self.assertEqual(
            MODULE.split_dic_entry("gato/AB po:noun"),
            ("gato", "AB", "po:noun"),
        )

    def test_parses_morphology_without_flags(self):
        self.assertEqual(
            MODULE.split_dic_entry("gato po:noun"),
            ("gato", "", "po:noun"),
        )

    def test_preserves_phrases_for_manual_review(self):
        self.assertEqual(
            MODULE.split_dic_entry("a lot"),
            ("a lot", "", ""),
        )

    def test_handles_escaped_slash(self):
        self.assertEqual(
            MODULE.split_dic_entry(r"casa\/rural/X"),
            ("casa/rural", "X", ""),
        )

    def test_handles_word_starting_with_slash(self):
        self.assertEqual(
            MODULE.split_dic_entry("/foo/X"),
            ("/foo", "X", ""),
        )
        self.assertEqual(
            MODULE.split_dic_entry("/foo"),
            ("/foo", "", ""),
        )

    def test_preserves_approximate_declared_count(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.dic"
            path.write_text("2\\nuno\\ndos\\ntres\\n", encoding="utf-8")
            declared, records = MODULE.read_dictionary(path)
            self.assertEqual(declared, 2)
            self.assertEqual(len(records), 3)

    def test_checks_hunspell_and_marks_complex_entries_for_review(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dic = root / "sample.dic"
            aff = root / "sample.aff"
            fake = root / "fake-hunspell"
            dic.write_text("3\ngood\nbad\na lot\n", encoding="utf-8")
            aff.write_text("SET UTF-8\n", encoding="utf-8")
            fake.write_text(
                "#!/usr/bin/env python3\n"
                "import sys\n"
                "for line in sys.stdin:\n"
                "    if line.strip().casefold() == 'bad': print(line.strip())\n",
                encoding="utf-8",
            )
            fake.chmod(fake.stat().st_mode | 0o111)
            records = MODULE.build_inventory(
                dic, aff, "en-US", "test-revision", str(fake)
            )
            by_word = {r["word"]: r for r in records[1:]}
            self.assertEqual(by_word["good"]["status"], "accepted_by_hunspell")
            self.assertEqual(by_word["bad"]["status"], "rejected_by_hunspell")
            self.assertEqual(by_word["a lot"]["status"], "manual_review")
            self.assertFalse(by_word["good"]["lexicalApproval"])
            self.assertEqual(len(records[0]["dictionarySha256"]), 64)
            self.assertEqual(len(records[0]["affixSha256"]), 64)

    def test_requires_matching_affix_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dic = root / "sample.dic"
            aff = root / "other.aff"
            dic.write_text("1\\nword\\n", encoding="utf-8")
            aff.write_text("SET UTF-8\\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "paired file"):
                MODULE.build_inventory(dic, aff, "en-US", "revision", "unused")

    def test_refuses_non_utf8_affix_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.aff"
            path.write_text("SET ISO8859-1\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "not UTF-8"):
                MODULE.verify_affix_file(path)


if __name__ == "__main__":
    unittest.main()
