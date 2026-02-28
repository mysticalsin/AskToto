"""
Local Faster-Whisper transcription server for AskToto.
Run with: python server.py
Requires: pip install -r requirements.txt

Environment variables:
  WHISPER_MODEL  - Model size: tiny, base, small, medium, large-v3 (default: base)
  WHISPER_DEVICE - Compute device: cpu, cuda, auto (default: cpu)
  WHISPER_LANG   - Default language code, e.g. 'en', 'fr', 'auto' (default: auto)
  WHISPER_PORT   - Server port (default: 8765)
  MAX_FILE_SIZE  - Max upload size in MB (default: 25)
"""

import os
import sys
import time
import tempfile
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# ── Configuration from environment ────────────────────────────────────
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_LANG = os.getenv("WHISPER_LANG", "auto")
WHISPER_PORT = int(os.getenv("WHISPER_PORT", "8765"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE", "25"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 30

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("asktoto-whisper")

# ── Model management ─────────────────────────────────────────────────
_model = None


def get_model():
    """Lazy-load the Whisper model on first request."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        compute_type = "int8" if WHISPER_DEVICE == "cpu" else "float16"
        log.info(
            f"Loading Whisper model: {WHISPER_MODEL} "
            f"(device={WHISPER_DEVICE}, compute_type={compute_type})"
        )
        _model = WhisperModel(
            WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=compute_type
        )
        log.info("Whisper model loaded successfully")
    return _model


# ── App lifecycle ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        f"AskToto Whisper Server starting on port {WHISPER_PORT} "
        f"(model={WHISPER_MODEL}, device={WHISPER_DEVICE}, lang={WHISPER_LANG})"
    )
    yield
    log.info("AskToto Whisper Server shutting down")


# ── FastAPI app ───────────────────────────────────────────────────────
app = FastAPI(
    title="AskToto Whisper Server",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Error handlers ────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status_code": 500},
    )


# ── Routes ────────────────────────────────────────────────────────────
@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Query(default=None, description="Language code (e.g., 'en', 'fr')"),
):
    """
    Transcribe an audio file and return segments with timestamps.

    - Max file size: configurable via MAX_FILE_SIZE env var (default 25MB)
    - Supports WAV, MP3, FLAC, OGG, M4A formats
    - Language auto-detected if not specified
    """
    # Validate file size via content-length header (fast check)
    if audio.size and audio.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    # Read content with size limit enforcement
    content = await audio.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) // (1024*1024)}MB). Maximum is {MAX_FILE_SIZE_MB}MB.",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # Validate file extension
    allowed_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm", ".opus"}
    suffix = os.path.splitext(audio.filename or "audio.wav")[1].lower() or ".wav"
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{suffix}'. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    # Save to temp file for Whisper processing
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Resolve language
        lang = language or (None if WHISPER_LANG == "auto" else WHISPER_LANG)

        start_time = time.time()
        model = get_model()

        transcribe_kwargs = {"beam_size": 5}
        if lang:
            transcribe_kwargs["language"] = lang

        segments, info = model.transcribe(tmp_path, **transcribe_kwargs)

        result_segments = []
        full_text = ""
        for segment in segments:
            elapsed = time.time() - start_time
            if elapsed > REQUEST_TIMEOUT_SECONDS:
                log.warning(
                    f"Transcription timeout after {elapsed:.1f}s "
                    f"({len(result_segments)} segments processed)"
                )
                break

            result_segments.append(
                {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip(),
                }
            )
            full_text += segment.text

        elapsed = time.time() - start_time
        log.info(
            f"Transcribed {len(result_segments)} segments in {elapsed:.2f}s "
            f"(lang={info.language}, duration={info.duration:.1f}s)"
        )

        return {
            "text": full_text.strip(),
            "segments": result_segments,
            "language": info.language,
            "duration": round(info.duration, 2),
            "processing_time": round(elapsed, 2),
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@app.get("/health")
async def health():
    """Health check endpoint. Returns model configuration."""
    return {
        "status": "ok",
        "model": f"faster-whisper-{WHISPER_MODEL}",
        "device": WHISPER_DEVICE,
        "language": WHISPER_LANG,
        "max_file_size_mb": MAX_FILE_SIZE_MB,
        "model_loaded": _model is not None,
    }


# ── Entry point ───────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info(f"Starting AskToto Whisper Server on port {WHISPER_PORT}...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=WHISPER_PORT,
        log_level="info",
        timeout_keep_alive=30,
    )
