import unittest

from postprocess import clean_markdown


class LatexTests(unittest.TestCase):
    def test_units_and_indices_read_as_text(self):
        # Verbatim PaddleOCR-VL-1.6 output from the benchmark documents.
        cases = {
            "Ruhe  $ O^{{2}} $": "Ruhe  O²",
            "SV-Index ml/ $ m^{{2}} $": "SV-Index ml/m²",
            "PVR dyn  $ \\times $ s  $ \\times $ cm $ ^{-5} $": "PVR dyn  × s  × cm⁻⁵",
            "100 \\mu g/Hub": "100 µg/Hub",
            "SpO$_{2}$ 95 %": "SpO₂ 95 %",
            "37 $^{\\circ}$C, $5 \\pm 2$ mg": "37 °C, 5 ± 2 mg",
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(clean_markdown(source), expected)

    def test_plain_text_is_unchanged(self):
        for text in ["Preis 5 $ und 6 $", "RR 120/80 mmHg", "FEV1/VC 59 %", "1-0-0"]:
            with self.subTest(text=text):
                self.assertEqual(clean_markdown(text), text)

    def test_literal_cell_breaks_are_not_commands(self):
        self.assertEqual(
            clean_markdown("<td>Name, Vorname\\nBerger, Thomas</td>"),
            "<td>Name, Vorname<br>Berger, Thomas</td>",
        )

    def test_dangling_figure_tags_are_removed(self):
        signature = (
            '<div style="text-align: center;"><img src="imgs/img_in_image_box_1_2_3_4.jpg"'
            ' alt="Image" width="22%" /></div>\n'
        )
        self.assertEqual(clean_markdown(f"Grüßen\n\n{signature}Dr. med."), "Grüßen\n\nDr. med.")


class PressureReadingTests(unittest.TestCase):
    def test_slash_read_as_one_is_restored(self):
        # Handwritten 52/26 (36) and 143/69 (90), as read by the VLM.
        self.assertEqual(clean_markdown("<td>52.126 (36)</td>"), "<td>52/26 (36)</td>")
        self.assertEqual(clean_markdown("<td>143169 (90)</td>"), "<td>143/69 (90)</td>")
        self.assertEqual(clean_markdown("PAP 52|26 (36)"), "PAP 52/26 (36)")
        # dots.mocr keeps the stroke's gap as a space.
        self.assertEqual(clean_markdown("<td>52 126 (36)</td>"), "<td>52/26 (36)</td>")

    def test_handwritten_one_read_as_seven_is_restored(self):
        # The same 143/69 (90) as read in other runs by the VLM and PP-OCRv6.
        for text in ["743/69/90", "743169(90)", "743/69 (90)"]:
            with self.subTest(text=text):
                self.assertEqual(clean_markdown(f"<td>{text}</td>"), "<td>143/69 (90)</td>")

    def test_inconsistent_or_decimal_readings_are_left_alone(self):
        for text in [
            "4.912 (49)",  # no split gives dia < mean < sys
            "12.5 (10)",  # a decimal point never stands in for the slash
            "3,12 l (78 % Soll)",
            "1405 (12)",
            "120/80/20",  # a third number that is not the mean
            "760/80 (93)",  # 160/80 does not fit the mean of 93 either
            "1/2/2026",
            # RV 49/12 (19) is real although its mean breaks the arterial formula,
            # so neither the reading nor a "1" that may be its digit is rewritten.
            "49/12 (19)",
            "4912 (19)",
            "4.912 (19)",
            "74/31/64 (90)",  # several slashes: no single reading to restore
            "Gewicht 85 52 (36)",  # two separate values, no consistent split
            "Hb 12 148 (90)",
        ]:
            with self.subTest(text=text):
                self.assertEqual(clean_markdown(text), text)


if __name__ == "__main__":
    unittest.main()
