import os
import random
import time
import uuid
from typing import Literal

from pydantic import BaseModel, Field

TrafficMode = Literal["stable", "random", "burst", "silent"]


class TelemetryPacket(BaseModel):
    packet_id: str
    source: str
    destination: str
    timestamp: float
    sequence: int
    traffic_mode: str
    size_bytes: int = Field(ge=0)
    environment: str
    region: str
    value: float


class GeneratorConfig(BaseModel):
    mode: TrafficMode = "stable"
    rate: int = Field(default=10, ge=0, le=1000)
    malformed: bool = False
    latency_ms: int = Field(default=0, ge=0, le=60_000)


def create_packet(
    source: str,
    destination: str,
    sequence: int,
    mode: str,
    environment: str | None = None,
    region: str | None = None,
) -> TelemetryPacket:
    return TelemetryPacket(
        packet_id=str(uuid.uuid4()),
        source=source,
        destination=destination,
        timestamp=time.time(),
        sequence=sequence,
        traffic_mode=mode,
        size_bytes=random.randint(256, 8192),
        environment=environment or os.getenv("ENVIRONMENT", "dev"),
        region=region or os.getenv("REGION", "local"),
        value=random.random() * 100,
    )
