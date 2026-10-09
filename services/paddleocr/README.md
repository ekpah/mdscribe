# PaddleOCR service

A CPU-only PP-StructureV3 HTTP service. It keeps the existing LiteParse-style
multipart `POST /ocr` request and `results` array, and adds `text`, containing
PP-StructureV3's native Markdown. Native table HTML is returned unchanged, so
attributes such as `rowspan` and `colspan` are not lost to line-text reflow.

The service uses opinionated defaults for MDScribe documents:

- PP-StructureV3 with German PP-OCRv5 and table recognition
- Formula, seal, chart, and region recognition disabled
- Document orientation classification/correction, unwarping and text-line
  orientation disabled: users must manually align images before OCR
- Four CPU threads with MKLDNN disabled
- Text detection limited to 1600 px on the longest side; boxes are still
  returned in input pixels
- Port 8829
- One OCR request at a time
- 25 MB upload and 50-million-pixel image limits

## Run locally

Build and start the container:

```bash
docker build -t mdscribe-paddleocr services/paddleocr
docker run --detach \
  --name paddleocr \
  --platform linux/amd64 \
  --publish 127.0.0.1:8829:8829 \
  --volume paddleocr-models:/models \
  mdscribe-paddleocr
```

The first start downloads the model weights and can take several minutes. The
named volume keeps them across container replacements. Follow startup progress
with:

```bash
docker logs --follow paddleocr
```

Check the service:

```bash
curl http://127.0.0.1:8829/health
curl -F "file=@document.png" -F "language=de" http://127.0.0.1:8829/ocr
```

The port is bound to localhost because uploaded documents may contain sensitive
data. Stop and restart the container with `docker stop paddleocr` and
`docker start paddleocr`.

## Response

```json
{
  "text": "Text before the table\n\n<table>...</table>",
  "results": [{ "text": "Text", "bbox": [10, 20, 50, 40], "confidence": 0.99 }]
}
```

`results` comes from `result.json["res"]["overall_ocr_res"]`; its pixel coordinates
refer directly to the submitted, manually aligned raster with top-left origin.
There is no rotation field or coordinate-axis swapping. Manual alignment is a
deliberate MDScribe product requirement, not a provider fallback. The app offers
left/right rotation and requires explicit confirmation before image OCR; the
service does not infer or correct orientation. `text` comes from
`result.markdown["markdown_texts"]`. Missing native
Markdown or overall OCR output is a server error, not a silent line fallback.
An empty `text` plus an empty `results` array is a valid blank page. The
`language` form field is accepted for request compatibility, but this service
is fixed to German and does not reload models per request.

The image targets `linux/amd64` because current PaddlePaddle 3.x ARM64 inference
is not reliable. Docker Desktop and OrbStack can emulate this target on Apple
Silicon.

## Accuracy and performance

PP-StructureV3 (`paddleocr[doc-parser]==3.7.0`, German PP-OCRv5, CPU,
four threads, MKLDNN disabled) was evaluated on one medication plan and one
pneumology letter. Table recognition was enabled; orientation correction,
unwarping, formula, seal, chart, and region recognition were disabled.

It preserved the medication plan's four-column PRN cell, but dropped a dose
dash. In the letter it merged distinct lung-function rows and read one
`COPD GOLD II` as `III`. Its text-line boxes were well localized, but those
boxes do not repair incorrect table associations. The two CPU runs took
48.3 and 42.3 seconds after model initialization.

This service now uses that PP-Structure pipeline and native table HTML instead
of PP-OCRv6 Small plus LiteParse reflow. Expect substantially higher CPU
latency and memory use in exchange for structure-aware output. A medication-plan
request exhausted memory in an 8 GB orb also running the app, even though the
service's startup health check passed. Startup health does not establish that
there is enough memory for inference; size the deployment using representative
documents and measure peak memory under load.

Without the text-detection limit, a 3000 × 2250 px phone photo (the size the app
sends) exhausted 15 GB. With it, the same photo succeeded in about 45 seconds,
using roughly 10 GB above the idle service.

Native HTML avoids reflow damage but does not correct recognition or association errors. Two
examples are not a clinical validation set; verify every extracted dose, unit,
negation, and table association against its source.
