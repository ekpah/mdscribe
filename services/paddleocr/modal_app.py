"""PaddleOCR-VL-1.6 on a Modal GPU, serving the same `POST /ocr` contract as server.py.

`text` is PaddleOCR-VL's Markdown with HTML tables, cleaned by postprocess.py.
`results` are PP-OCRv6 text lines whose pixel boxes locate citations; their
text only serves matching and may differ slightly from `text`.

    modal deploy services/paddleocr/modal_app.py

Requests need a Modal proxy token: `Authorization: Bearer <wk-…>.<ws-…>`.
"""

from pathlib import Path

import modal

MODEL_DIR = "/models"
SERVICE_DIR = Path(__file__).parent
# Keep headers and footers (letterheads, form titles, times); drop page numbers.
MARKDOWN_IGNORE_LABELS = ["number"]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libgl1", "libglib2.0-0", "libgomp1")
    .pip_install(
        "paddlepaddle-gpu==3.3.1",
        index_url="https://www.paddlepaddle.org.cn/packages/stable/cu126/",
    )
    .pip_install(
        "paddleocr[doc-parser]==3.7.0",
        "fastapi[standard]==0.131.0",
        "python-multipart==0.0.22",
        "pillow==12.1.1",
        "numpy==2.3.5",
    )
    # vLLM pins torch/CUDA wheels that clash with paddlepaddle-gpu, so the VLM
    # server gets its own virtualenv and runs as a local subprocess.
    .pip_install("uv")
    .run_commands(
        "uv venv /opt/vllm --python 3.12",
        # PaddleX also requires xformers and flash-attn on CUDA; use the prebuilt
        # torch 2.8 wheel instead of compiling flash-attn from source.
        "uv pip install --python /opt/vllm/bin/python 'paddlex[genai-vllm-server]==3.7.0'"
        " torch==2.8.0 xformers==0.0.32.post1"
        " https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/"
        "flash_attn-2.8.3+cu12torch2.8cxx11abiTRUE-cp312-cp312-linux_x86_64.whl",
    )
    # PaddleX keeps downloaded weights under $HOME/.paddlex.
    .env(
        {
            "HOME": MODEL_DIR,
            "DISABLE_MODEL_SOURCE_CHECK": "True",
            # Persist vLLM's torch.compile cache (~45 s per cold start otherwise).
            "VLLM_CACHE_ROOT": f"{MODEL_DIR}/.paddlex/vllm-cache",
            # Exposes vLLM's /sleep and /wake_up endpoints for GPU snapshots.
            "VLLM_SERVER_DEV_MODE": "1",
            # Recommended by Modal: parallel inductor workers break snapshots.
            "TORCHINDUCTOR_COMPILE_THREADS": "1",
            # vLLM's single-GPU process group polls a local TCPStore whose socket
            # does not survive a restore; skip that monitor and its log spam.
            "TORCH_NCCL_ENABLE_MONITORING": "0",
            "TORCH_NCCL_DUMP_ON_TIMEOUT": "0",
        }
    )
    # Reuse the CPU service's upload limits and line formatting.
    .add_local_file(SERVICE_DIR / "server.py", "/root/server.py")
    .add_local_file(SERVICE_DIR / "postprocess.py", "/root/postprocess.py")
)

VLM_PORT = 8118

# Weights survive image rebuilds; only the first container downloads them.
model_cache = modal.Volume.from_name("mdscribe-paddleocr-models", create_if_missing=True)

app = modal.App("mdscribe-paddleocr", image=image)


@app.cls(
    gpu="L4",
    # vLLM and Paddle start in parallel; the default CPU share makes both crawl.
    cpu=4,
    volumes={f"{MODEL_DIR}/.paddlex": model_cache},
    # Scale to zero after 5 idle minutes; never more than one GPU for the test.
    scaledown_window=300,
    max_containers=1,
    timeout=600,
    # Cold starts restore CPU+GPU memory after vLLM compile, CUDA graph capture,
    # Paddle init and warmup instead of redoing them. GPU snapshots are alpha.
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
)
@modal.concurrent(max_inputs=1)
class PaddleOcr:
    @modal.enter(snap=True)
    def load(self) -> None:
        import subprocess
        import time
        import urllib.request

        from paddleocr import PaddleOCR, PaddleOCRVL

        # Sleep mode lets vLLM offload weights and drop its KV cache before the
        # snapshot; a single API server keeps sleep/wake on one process.
        config = "/tmp/vllm-config.yaml"
        with open(config, "w") as file:
            file.write("enable-sleep-mode: true\napi-server-count: 1\n")
        # Paddle's eager VLM decoding is CPU-bound (GPU idle, minutes per dense
        # page); vLLM batches all layout blocks of a page on the GPU.
        self.vlm = subprocess.Popen(
            [
                "/opt/vllm/bin/paddlex_genai_server",
                "--model_name", "PaddleOCR-VL-1.6-0.9B",
                "--backend", "vllm",
                "--backend_config", config,
                "--host", "127.0.0.1",
                "--port", str(VLM_PORT),
            ]
        )
        # Load the layout pipeline while vLLM starts; it only calls the server
        # when predicting.
        self.pipeline = PaddleOCRVL(
            pipeline_version="v1.6",
            device="gpu",
            vl_rec_backend="vllm-server",
            vl_rec_server_url=f"http://127.0.0.1:{VLM_PORT}/v1",
            # Users align pages manually; never infer or correct orientation.
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
        )
        # VL only returns layout-block boxes (one box for a whole form), so
        # PP-OCRv6 supplies line boxes for citations.
        self.lines = PaddleOCR(
            lang="de",
            device="gpu",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        deadline = time.monotonic() + 600
        while True:
            if self.vlm.poll() is not None:
                raise RuntimeError("vLLM server exited during startup")
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{VLM_PORT}/health", timeout=2)
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(1)

        # Warm up with a text page so the snapshot includes the layout model's
        # and the VLM's first-run kernel initialization.
        import numpy as np
        from PIL import Image, ImageDraw, ImageFont

        page = Image.new("RGB", (1000, 1400), "white")
        draw = ImageDraw.Draw(page)
        font = ImageFont.load_default(size=32)
        draw.text((80, 80), "Medikationsplan", font=font, fill="black")
        for row in range(4):
            draw.text((80, 200 + row * 60), f"Ramipril   5 mg   1 - 0 - {row}", font=font, fill="black")
        draw.text((80, 520), "Diagnose: COPD GOLD II, Kontrolle in 3 Monaten.", font=font, fill="black")
        for _ in range(2):
            list(self.pipeline.predict(np.asarray(page)))
            list(self.lines.predict(np.asarray(page)))
        model_cache.commit()

        self._vlm_post("/sleep?level=1")

    @modal.enter(snap=False)
    def wake(self) -> None:
        self._vlm_post("/wake_up")

    def _vlm_post(self, path: str) -> None:
        import urllib.request

        request = urllib.request.Request(f"http://127.0.0.1:{VLM_PORT}{path}", method="POST")
        urllib.request.urlopen(request, timeout=120).close()

    @modal.exit()
    def stop(self) -> None:
        self.vlm.terminate()

    @modal.asgi_app(requires_proxy_auth=True)
    def web(self):
        import logging
        import time
        from concurrent.futures import ThreadPoolExecutor

        from fastapi import FastAPI, File, Form, HTTPException, UploadFile

        from postprocess import clean_markdown
        from server import MAX_UPLOAD_BYTES, OcrResponse, _decode_image, format_results

        logger = logging.getLogger("paddleocr-modal")
        api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
        # Document parsing and line detection are independent; run them together.
        pool = ThreadPoolExecutor(max_workers=2)

        @api.get("/health")
        def health() -> dict:
            return {"model": "PaddleOCR-VL-1.6 + PP-OCRv6", "status": "healthy"}

        @api.post("/ocr", response_model=OcrResponse)
        def ocr(file: UploadFile = File(...), language: str = Form("de")) -> OcrResponse:
            del language  # Accepted for client compatibility; both models cover German.
            data = file.file.read(MAX_UPLOAD_BYTES + 1)
            if not data:
                raise HTTPException(400, "The uploaded image is empty")
            if len(data) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "The uploaded image is too large")
            pixels = _decode_image(data)
            height, width = pixels.shape[:2]

            started = time.monotonic()
            parsed = pool.submit(
                lambda: next(
                    iter(self.pipeline.predict(pixels, markdown_ignore_labels=MARKDOWN_IGNORE_LABELS)),
                    None,
                )
            )
            lines = pool.submit(lambda: next(iter(self.lines.predict(pixels)), None))
            result, line_result = parsed.result(), lines.result()
            # Log timing only: document text must never reach the logs.
            logger.warning("OCR page took %.1f s", time.monotonic() - started)
            markdown = getattr(result, "markdown", None)
            if (
                not isinstance(markdown, dict)
                or not isinstance(markdown.get("markdown_texts"), str)
                or line_result is None
            ):
                raise HTTPException(500, "OCR pipeline returned incomplete output")
            return OcrResponse(
                text=clean_markdown(markdown["markdown_texts"]),
                results=format_results(line_result, width, height),
            )

        return api
