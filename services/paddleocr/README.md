# PaddleOCR service

A small, CPU-only PP-OCRv6 HTTP service compatible with
[LiteParse's OCR API](https://github.com/run-llama/liteparse/blob/main/OCR_API_SPEC.md).
It accepts a page image at `POST /ocr` and returns recognized text with bounding
boxes, confidence values, and polygons.

The service uses opinionated defaults for MDScribe documents:

- PP-OCRv6 medium models
- Text-line orientation enabled
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

## Use with LiteParse

```bash
lit parse document.pdf \
  --ocr-server-url http://127.0.0.1:8829/ocr \
  --ocr-language de
```

PP-OCRv6 uses one recognition model for Chinese, English, Japanese, and its
supported Latin-script languages. The `language` field is accepted for API
compatibility and does not reload the model.

The image targets `linux/amd64` because current PaddlePaddle 3.x ARM64 inference
is not reliable. Docker Desktop and OrbStack can emulate this target on Apple
Silicon.
