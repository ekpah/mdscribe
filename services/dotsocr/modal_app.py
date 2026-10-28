"""dots.mocr on a Modal GPU, serving the same `POST /ocr` contract as services/paddleocr.

One model pass returns both: `text` is the page as Markdown with HTML tables
(cleaned by paddleocr/postprocess.py), and `results` are its layout blocks
(paragraphs, list items, table cells) as pixel boxes for citations.

    modal deploy services/dotsocr/modal_app.py

Requests need a Modal proxy token: `Authorization: Bearer <wk-…>.<ws-…>`.
"""

from pathlib import Path

import modal

SERVICE_DIR = Path(__file__).parent
PADDLE_DIR = SERVICE_DIR.parent / "paddleocr"
MODEL = "dots-studio/dots.mocr"
CACHE_DIR = "/cache"
VLM_PORT = 8118
# L4 takes 30-55 s per page for dots.mocr (3B); H100 5-10 s.
GPU = "H100"

image = (
    modal.Image.from_registry("vllm/vllm-openai:v0.17.0")
    .entrypoint([])
    # Modal looks for `python`; the vLLM image only ships `python3`.
    .run_commands("ln -sf $(command -v python3) /usr/local/bin/python")
    .pip_install("python-multipart==0.0.22")
    .env(
        {
            "HF_HOME": f"{CACHE_DIR}/hf",
            # Persist vLLM's torch.compile cache across image rebuilds.
            "VLLM_CACHE_ROOT": f"{CACHE_DIR}/vllm",
            # Exposes vLLM's /sleep and /wake_up endpoints for GPU snapshots.
            "VLLM_SERVER_DEV_MODE": "1",
            # Recommended by Modal: parallel inductor workers break snapshots.
            "TORCHINDUCTOR_COMPILE_THREADS": "1",
            # The single-GPU process group's TCPStore socket does not survive a restore.
            "TORCH_NCCL_ENABLE_MONITORING": "0",
            "TORCH_NCCL_DUMP_ON_TIMEOUT": "0",
        }
    )
    # Reuse the Paddle service's request limits, response model and text cleanup.
    .add_local_file(PADDLE_DIR / "server.py", "/root/server.py")
    .add_local_file(PADDLE_DIR / "postprocess.py", "/root/postprocess.py")
    .add_local_file(SERVICE_DIR / "layout.py", "/root/layout.py")
)

# Weights and compile cache survive image rebuilds; only the first container downloads them.
model_cache = modal.Volume.from_name("mdscribe-dotsocr-models", create_if_missing=True)

app = modal.App("mdscribe-dotsocr", image=image)


@app.cls(
    gpu=GPU,
    cpu=4,
    volumes={CACHE_DIR: model_cache},
    # Scale to zero after 5 idle minutes.
    scaledown_window=300,
    max_containers=1,
    timeout=600,
    # Restores the loaded, compiled and warmed-up model instead of redoing it.
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
)
@modal.concurrent(max_inputs=1)
class DotsOcr:
    @modal.enter(snap=True)
    def load(self) -> None:
        import subprocess
        import time
        import urllib.request

        from PIL import Image, ImageDraw, ImageFont

        self.vlm = subprocess.Popen(
            [
                "vllm", "serve", MODEL,
                "--served-model-name", "dots",
                "--host", "127.0.0.1",
                "--port", str(VLM_PORT),
                "--trust-remote-code",
                "--chat-template-content-format", "string",
                "--max-model-len", "24000",
                "--gpu-memory-utilization", "0.88",
                "--enable-sleep-mode",
            ]
        )
        deadline = time.monotonic() + 900
        while True:
            if self.vlm.poll() is not None:
                raise RuntimeError("vLLM server exited during startup")
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{VLM_PORT}/health", timeout=2).close()
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(2)

        # Warm up so the snapshot includes first-run kernel initialization.
        page = Image.new("RGB", (1000, 1400), "white")
        draw = ImageDraw.Draw(page)
        font = ImageFont.load_default(size=32)
        draw.text((80, 80), "Medikationsplan", font=font, fill="black")
        for row in range(4):
            draw.text((80, 200 + row * 60), f"Ramipril   5 mg   1 - 0 - {row}", font=font, fill="black")
        for _ in range(2):
            self._layout(page)
        model_cache.commit()

        self._vlm_post("/sleep?level=1")

    @modal.enter(snap=False)
    def wake(self) -> None:
        self._vlm_post("/wake_up")

    def _vlm_post(self, path: str) -> None:
        import urllib.request

        request = urllib.request.Request(f"http://127.0.0.1:{VLM_PORT}{path}", method="POST")
        urllib.request.urlopen(request, timeout=120).close()

    def _layout(self, page):
        """Returns (sent size, raw model output) for one page image."""
        import base64
        import io
        import json
        import urllib.request

        from layout import PROMPT, fit_to_grid

        size = fit_to_grid(*page.size)
        buffer = io.BytesIO()
        page.resize(size).save(buffer, format="PNG")
        body = {
            "model": "dots",
            "max_tokens": 16000,
            "temperature": 0.0,
            "messages": [{"role": "user", "content": [
                {"type": "image_url",
                 "image_url": {"url": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()}},
                # Without these tokens vLLM inserts a newline before the prompt.
                {"type": "text", "text": "<|img|><|imgpad|><|endofimg|>" + PROMPT},
            ]}],
        }
        request = urllib.request.Request(
            f"http://127.0.0.1:{VLM_PORT}/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            choice = json.loads(response.read())["choices"][0]
        if choice.get("finish_reason") == "length":
            raise ValueError("Layout output was truncated")
        return size, choice["message"]["content"]

    @modal.exit()
    def stop(self) -> None:
        self.vlm.terminate()

    @modal.asgi_app(requires_proxy_auth=True)
    def web(self):
        import logging
        import time

        from fastapi import FastAPI, File, Form, HTTPException, UploadFile
        from PIL import Image

        from layout import parse_layout
        from postprocess import clean_markdown
        from server import MAX_UPLOAD_BYTES, OcrResponse, _decode_image

        logger = logging.getLogger("dotsocr-modal")
        api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


        @api.get("/health")
        def health() -> dict:
            return {"model": "dots.mocr", "status": "healthy"}

        @api.post("/ocr", response_model=OcrResponse)
        def ocr(file: UploadFile = File(...), language: str = Form("de")) -> OcrResponse:
            del language  # Accepted for client compatibility; the model is multilingual.
            data = file.file.read(MAX_UPLOAD_BYTES + 1)
            if not data:
                raise HTTPException(400, "The uploaded image is empty")
            if len(data) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "The uploaded image is too large")
            page = Image.fromarray(_decode_image(data))

            started = time.monotonic()
            try:
                sent, raw = self._layout(page)
                markdown, results = parse_layout(raw, sent, page.size)
            except (ValueError, KeyError, TypeError) as error:
                # Never log the output itself: it contains document text.
                logger.warning("OCR output rejected: %s", type(error).__name__)
                raise HTTPException(500, "OCR model returned incomplete output") from error
            logger.warning("OCR page took %.1f s", time.monotonic() - started)
            return OcrResponse(text=clean_markdown(markdown), results=results)

        return api
