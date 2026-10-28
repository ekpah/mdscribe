# dots.mocr OCR service (Modal)

[dots.mocr](https://huggingface.co/dots-studio/dots.mocr) (3B, MIT) on a Modal GPU.
It serves the same multipart `POST /ocr` contract as `services/paddleocr`, so the
app uses it through the existing **OCR HTTP** provider without code changes.

Unlike the PaddleOCR deployment, one model pass returns both the text and the
citation boxes:

- `text`: the page as Markdown with HTML tables in reading order, cleaned by
  `services/paddleocr/postprocess.py` (LaTeX to Unicode, pressure readings).
- `results`: one entry per layout block (paragraph, list item, table, table
  cell region) with its plain text and an XYXY box in pixels of the uploaded,
  manually aligned image. dots.mocr reports no confidence, so it is always `1.0`.

Truncated or malformed model output is a 500 error, never a partial page.

## Deploy

```bash
modal deploy services/dotsocr/modal_app.py
```

The deployment uses an H100 (dots.mocr needs 30–55 s per page on an L4, 5–10 s
on an H100), scales to zero after 5 idle minutes and runs at most one container.
Weights and vLLM's compile cache live in the `mdscribe-dotsocr-models` volume.
A GPU memory snapshot restores the loaded and warmed-up model on cold starts.
After each deploy, the first start rebuilds that snapshot and takes a few minutes.

Requests need a Modal proxy token:

```bash
curl -H "Authorization: Bearer $MODAL_PROXY_TOKEN_ID.$MODAL_SECRET_KEY" \
  -F "file=@page.jpg" -F "language=de" \
  https://<workspace>--mdscribe-dotsocr-dotsocr-web.us-east.modal.run/ocr
```

In the app, add an **OCR HTTP** connection with that `/ocr` URL as base URL and
`<token id>.<token secret>` as API key, then select it as the document model.

## Tests

```bash
cd services/dotsocr && python3 -m unittest test_layout
```
