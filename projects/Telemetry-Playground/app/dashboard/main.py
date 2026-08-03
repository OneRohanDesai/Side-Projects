import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.common.metrics import CONFIG_UPDATES
from app.common.models import GeneratorConfig
from app.common.redis_client import get_config, list_generator_keys, ping, set_config

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("dashboard")

STATIC_PATH = os.getenv(
    "DASHBOARD_STATIC_PATH",
    os.path.join(os.path.dirname(__file__), "static", "index.html"),
)


def expected_generators() -> list[str]:
    count = int(os.getenv("GENERATOR_REPLICAS", "3"))
    return [f"generator-{i}" for i in range(count)]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("starting dashboard static=%s", STATIC_PATH)
    yield
    logger.info("dashboard stopped")


app = FastAPI(title="Telemetry Dashboard", lifespan=lifespan)


@app.get("/")
def index():
    if not os.path.isfile(STATIC_PATH):
        raise HTTPException(status_code=500, detail="dashboard UI missing")
    return FileResponse(STATIC_PATH)


@app.get("/generators")
def generators():
    """Return known generators (configured replicas + any redis-registered)."""
    known = set(expected_generators())
    known.update(list_generator_keys())
    return sorted(known)


@app.get("/generator/{name}")
def get_generator(name: str):
    return {"name": name, "config": get_config(name)}


@app.post("/generator/{name}")
def update_generator(name: str, config: GeneratorConfig):
    if not name or not name.startswith("generator-"):
        raise HTTPException(status_code=400, detail="invalid generator name")

    try:
        saved = set_config(name, config.model_dump())
    except Exception as exc:
        logger.exception("failed to update %s", name)
        raise HTTPException(status_code=503, detail=f"redis unavailable: {exc}") from exc

    CONFIG_UPDATES.labels(generator=name).inc()
    logger.info("updated %s config=%s", name, saved)
    return {"updated": name, "config": saved}


@app.get("/health")
def health():
    redis_ok = ping()
    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": redis_ok,
        "service": "dashboard",
    }


@app.get("/ready")
def ready():
    if not ping():
        raise HTTPException(status_code=503, detail="redis not ready")
    return {"status": "ready"}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
