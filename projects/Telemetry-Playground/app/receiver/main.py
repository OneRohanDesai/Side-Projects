import asyncio
import logging
import os
import random
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry.trace import Status, StatusCode
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.common.metrics import (
    ACTIVE_REQUESTS,
    PACKETS_RECEIVED,
    PACKETS_REJECTED,
    REQUEST_LATENCY,
)
from app.common.models import TelemetryPacket
from app.common.telemetry import setup_telemetry

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("receiver")

RECEIVER_NAME = os.getenv("RECEIVER_NAME") or os.getenv("HOSTNAME", "receiver")
SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "receiver")

tracer = setup_telemetry(SERVICE_NAME)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("starting receiver name=%s", RECEIVER_NAME)
    yield
    logger.info("receiver stopped name=%s", RECEIVER_NAME)


app = FastAPI(title="Telemetry Receiver", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    PACKETS_REJECTED.labels(receiver=RECEIVER_NAME, reason="validation").inc()
    logger.warning("rejected malformed packet errors=%s", exc.errors())
    return JSONResponse(status_code=422, content={"ok": False, "detail": exc.errors()})


@app.post("/receive")
async def receive(packet: TelemetryPacket):
    ACTIVE_REQUESTS.labels(service=SERVICE_NAME).inc()

    with tracer.start_as_current_span("process_packet") as span:
        span.set_attribute("packet.id", packet.packet_id)
        span.set_attribute("packet.source", packet.source)
        span.set_attribute("packet.destination", packet.destination)
        span.set_attribute("packet.sequence", packet.sequence)
        span.set_attribute("packet.mode", packet.traffic_mode)
        span.set_attribute("packet.size_bytes", packet.size_bytes)
        span.set_attribute("receiver.name", RECEIVER_NAME)
        span.add_event("packet_received")

        try:
            with tracer.start_as_current_span("business_logic"):
                # Simulate variable processing cost.
                await asyncio.sleep(random.uniform(0.0, 0.05))

            latency_seconds = max(time.time() - packet.timestamp, 0.0)

            with tracer.start_as_current_span("metrics"):
                PACKETS_RECEIVED.labels(
                    receiver=RECEIVER_NAME,
                    mode=packet.traffic_mode,
                ).inc()
                REQUEST_LATENCY.observe(latency_seconds)

            span.set_attribute("packet.latency_seconds", latency_seconds)
            span.add_event("metrics_recorded")

            logger.info(
                "received source=%s mode=%s seq=%s latency_ms=%.1f",
                packet.source,
                packet.traffic_mode,
                packet.sequence,
                latency_seconds * 1000,
            )

            span.add_event("response_sent")
            return {"ok": True, "receiver": RECEIVER_NAME}

        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR))
            logger.exception("failed to process packet id=%s", packet.packet_id)
            raise
        finally:
            ACTIVE_REQUESTS.labels(service=SERVICE_NAME).dec()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "receiver": RECEIVER_NAME,
    }


@app.get("/ready")
def ready():
    return {"status": "ready", "receiver": RECEIVER_NAME}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
