import io
import unittest

from fastapi import HTTPException
from PIL import Image

import server


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
