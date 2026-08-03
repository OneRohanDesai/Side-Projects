import asyncio
import logging
import os
import random
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Response
from opentelemetry.trace import Status, StatusCode
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.common.metrics import (
    ACTIVE_REQUESTS,
    MALFORMED_PACKETS,
    PACKETS_SEND_ERRORS,
    PACKETS_SENT,
    SEND_LATENCY,
)
from app.common.models import create_packet
from app.common.redis_client import get_config
from app.common.telemetry import setup_telemetry

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("generator")

GENERATOR_NAME = os.getenv("GENERATOR_NAME") or os.getenv("HOSTNAME", "generator-1")
RECEIVER_URL = os.getenv("RECEIVER_URL", "http://nginx/receive")
SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "generator")

tracer = setup_telemetry(SERVICE_NAME)

_worker_task: asyncio.Task | None = None


async def worker() -> None:
    sequence = 0
    timeout = httpx.Timeout(5.0, connect=2.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        while True:
            try:
                config = get_config(GENERATOR_NAME)
                mode = config["mode"]
                rate = int(config["rate"])
                latency_ms = int(config["latency_ms"])

                if mode == "silent":
                    await asyncio.sleep(1)
                    continue

                if mode == "random":
                    rate = random.randint(1, 50)
                elif mode == "burst":
                    rate = random.randint(50, 200)

                interval = 1.0 / max(rate, 1)

                with tracer.start_as_current_span("generate_packet") as span:
                    packet = create_packet(
                        source=GENERATOR_NAME,
                        destination="receiver-service",
                        sequence=sequence,
                        mode=mode,
                    )

                    span.set_attribute("packet.id", packet.packet_id)
                    span.set_attribute("packet.source", packet.source)
                    span.set_attribute("packet.destination", packet.destination)
                    span.set_attribute("packet.sequence", packet.sequence)
                    span.set_attribute("packet.mode", packet.traffic_mode)
                    span.set_attribute("packet.size_bytes", packet.size_bytes)
                    span.set_attribute("generator.name", GENERATOR_NAME)
                    span.add_event("packet_created")

                    data = packet.model_dump()

                    if config["malformed"]:
                        data.pop("packet_id", None)
                        MALFORMED_PACKETS.labels(generator=GENERATOR_NAME).inc()
                        span.add_event("packet_malformed")

                ACTIVE_REQUESTS.labels(service=SERVICE_NAME).inc()
                started = time.perf_counter()

                try:
                    with tracer.start_as_current_span("http_send") as span:
                        span.set_attribute("http.method", "POST")
                        span.set_attribute("http.url", RECEIVER_URL)

                        response = await client.post(RECEIVER_URL, json=data)

                        span.set_attribute("http.status_code", response.status_code)
                        span.add_event("response_received")

                        if response.status_code >= 400:
                            span.set_status(Status(StatusCode.ERROR))
                            PACKETS_SEND_ERRORS.labels(
                                generator=GENERATOR_NAME,
                                error_type=f"http_{response.status_code}",
                            ).inc()
                        else:
                            PACKETS_SENT.labels(
                                generator=GENERATOR_NAME,
                                mode=mode,
                            ).inc()

                    SEND_LATENCY.labels(generator=GENERATOR_NAME).observe(
                        time.perf_counter() - started
                    )

                except httpx.HTTPError as exc:
                    PACKETS_SEND_ERRORS.labels(
                        generator=GENERATOR_NAME,
                        error_type=type(exc).__name__,
                    ).inc()
                    logger.warning("send failed generator=%s error=%s", GENERATOR_NAME, exc)
                    with tracer.start_as_current_span("http_send_error") as span:
                        span.record_exception(exc)
                        span.set_status(Status(StatusCode.ERROR))
                finally:
                    ACTIVE_REQUESTS.labels(service=SERVICE_NAME).dec()

                sequence += 1
                await asyncio.sleep(interval + (latency_ms / 1000.0))

            except asyncio.CancelledError:
                logger.info("worker cancelled generator=%s", GENERATOR_NAME)
                raise
            except Exception:
                logger.exception("worker loop error generator=%s", GENERATOR_NAME)
                await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _worker_task
    logger.info(
        "starting generator name=%s receiver=%s",
        GENERATOR_NAME,
        RECEIVER_URL,
    )
    _worker_task = asyncio.create_task(worker(), name=f"worker-{GENERATOR_NAME}")
    try:
        yield
    finally:
        if _worker_task is not None:
            _worker_task.cancel()
            try:
                await _worker_task
            except asyncio.CancelledError:
                pass
        logger.info("generator stopped name=%s", GENERATOR_NAME)


app = FastAPI(title="Telemetry Generator", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "generator": GENERATOR_NAME,
    }


@app.get("/ready")
def ready():
    return {"status": "ready", "generator": GENERATOR_NAME}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
