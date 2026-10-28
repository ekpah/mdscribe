import json
import unittest

from layout import MAX_PIXELS, fit_to_grid, parse_layout


class LayoutTests(unittest.TestCase):
    def test_boxes_map_to_original_pixels_per_axis(self):
        raw = json.dumps([
            {"bbox": [10, 20, 110, 70], "category": "Title", "text": "Arztbrief"},
            # Extends past the page; clipped instead of failing the bounds check.
            {"bbox": [900, 400, 1100, 600], "category": "Text", "text": "Seite 1"},
        ])
        text, results = parse_layout(raw, sent=(1000, 500), original=(2000, 1500))
        self.assertEqual(text, "Arztbrief\n\nSeite 1")
        self.assertEqual([r["bbox"] for r in results], [[20, 60, 220, 210], [1800, 1200, 2000, 1500]])

    def test_tables_keep_html_in_text_but_not_in_citations(self):
        table = "<table><tr><td>PAP mmHg</td><td>52/26 (36)</td></tr></table>"
        raw = json.dumps([
            {"bbox": [0, 0, 10, 10], "category": "Picture"},
            {"bbox": [0, 10, 100, 50], "category": "Table", "text": table},
            {"bbox": [0, 50, 100, 60], "category": "Formula", "text": "x^2"},
        ])
        text, results = parse_layout(raw, sent=(100, 100), original=(100, 100))
        self.assertEqual(text, f"{table}\n\n$$\nx^2\n$$")
        self.assertEqual([r["text"] for r in results], ["PAP mmHg 52/26 (36)", "x^2"])

    def test_truncated_output_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_layout('[{"bbox": [0, 0, 10, 10], "category": "Text", "text": "VC 3,1', (10, 10), (10, 10))

    def test_grid_size_stays_within_pixel_budget(self):
        self.assertEqual(fit_to_grid(3000, 2250), (2996, 2240))
        width, height = fit_to_grid(6000, 4000)
        self.assertEqual((width % 28, height % 28), (0, 0))
        self.assertLessEqual(width * height, MAX_PIXELS)
        self.assertAlmostEqual(width / height, 1.5, delta=0.02)


if __name__ == "__main__":
    unittest.main()
