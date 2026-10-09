import io
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import numpy as np
from fastapi import HTTPException
from PIL import Image

import server


class FakeResult:
    def __init__(self, markdown, overall):
        self.markdown = markdown
        self.json = {"res": {"overall_ocr_res": overall}}


class NativeResultTests(unittest.TestCase):
    def test_orientation_classifier_is_disabled(self):
        constructor = Mock()
        with patch.dict(sys.modules, {"paddleocr": SimpleNamespace(PPStructureV3=constructor)}):
            server._create_pipeline()
        options = constructor.call_args.kwargs
        self.assertIs(options["use_doc_orientation_classify"], False)
        self.assertIs(options["use_doc_unwarping"], False)
        self.assertIs(options["use_textline_orientation"], False)
        self.assertIs(options["use_table_recognition"], True)

    def test_disabled_classifier_metadata_never_rotates_the_input_frame(self):
        for angle in [-1, 0, 90, 180, 270]:
            with self.subTest(angle=angle):
                box = [10, 120, 40, 180]
                result = FakeResult({"markdown_texts": "dose"}, {
                    "rec_texts": ["dose"], "rec_boxes": [box],
                })
                result.json["res"]["doc_preprocessor_res"] = {"angle": angle}
                response = server._native_response([result], 100, 200)
                self.assertNotIn("rotation", response.model_dump())
                self.assertEqual(response.results[0].bbox, box)

    def test_dict_subclass_exposes_markdown_as_a_property(self):
        class PaddleResult(dict):
            @property
            def markdown(self):
                return {"markdown_texts": "<table><tr><td>1</td></tr></table>"}

        result = PaddleResult(overall_ocr_res={
            "rec_texts": ["1"], "rec_boxes": [[1, 2, 10, 12]],
        })
        response = server._native_response([result], 20, 20)
        self.assertEqual(response.text, result.markdown["markdown_texts"])
        self.assertEqual(response.results[0].bbox, [1, 2, 10, 12])

    def test_preserves_native_table_html_and_raw_overall_ocr_boxes(self):
        table = '<table><tr><td rowspan="2" colspan="3">Dosis</td></tr></table>'
        overall = {
            "rec_texts": ["Dosis"],
            "rec_scores": np.array([0.91]),
            "rec_boxes": np.array([[11, 22, 101, 62]]),
            "rec_polys": np.array([[[11, 22], [101, 22], [101, 62], [11, 62]]]),
        }

        response = server._native_response(
            [FakeResult({"markdown_texts": table}, overall)], 200, 100
        )

        self.assertEqual(response.text, table)
        self.assertEqual(response.results[0].bbox, [11.0, 22.0, 101.0, 62.0])
        self.assertEqual(response.results[0].polygon[0], [11.0, 22.0])

    def test_blank_page_is_valid(self):
        response = server._native_response(
            [FakeResult({"markdown_texts": ""}, {})], 20, 20
        )
        self.assertEqual(response.text, "")
        self.assertEqual(response.results, [])

    def test_missing_native_markdown_is_an_error(self):
        with self.assertRaises(server.NativeResultError):
            server._native_response([FakeResult({}, {})], 20, 20)

    def test_missing_prediction_is_an_error(self):
        with self.assertRaises(server.NativeResultError):
            server._native_response([], 20, 20)

    def test_missing_overall_ocr_is_an_error(self):
        result = FakeResult({"markdown_texts": "Text"}, {})
        result.json = {"res": {}}
        with self.assertRaises(server.NativeResultError):
            server._native_response([result], 20, 20)


class ImageDecodeTests(unittest.TestCase):
    def test_rejects_invalid_image(self):
        with self.assertRaises(HTTPException) as raised:
            server._decode_image(b"not an image")
        self.assertEqual(raised.exception.status_code, 400)

    def test_rejects_image_over_pixel_limit(self):
        original_limit = server.MAX_IMAGE_PIXELS
        server.MAX_IMAGE_PIXELS = 3
        try:
            image = Image.new("RGB", (2, 2))
            encoded = io.BytesIO()
            image.save(encoded, "PNG")
            with self.assertRaises(HTTPException) as raised:
                server._decode_image(encoded.getvalue())
            self.assertEqual(raised.exception.status_code, 413)
        finally:
            server.MAX_IMAGE_PIXELS = original_limit


if __name__ == "__main__":
    unittest.main()
