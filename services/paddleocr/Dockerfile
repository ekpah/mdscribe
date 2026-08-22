ARG PADDLEOCR_PLATFORM=linux/amd64
FROM --platform=${PADDLEOCR_PLATFORM} python:3.12-slim-bookworm

ENV HOME=/models

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./

RUN python -m pip install --no-cache-dir \
        --index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
        paddlepaddle==3.3.0 \
    && python -m pip install --no-cache-dir --requirement requirements.txt

RUN groupadd --system paddleocr \
    && useradd --system --gid paddleocr --home-dir /models paddleocr \
    && mkdir -p /models/.paddlex \
    && chown -R paddleocr:paddleocr /models

COPY --chown=paddleocr:paddleocr server.py ./server.py

USER paddleocr

VOLUME ["/models"]
EXPOSE 8829

HEALTHCHECK --interval=30s --timeout=10s --start-period=10m --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8829/health', timeout=5)"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8829", "--workers", "1"]
