import logging
import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

logger = logging.getLogger(__name__)

_initialized = False


def _normalize_otlp_endpoint(raw: str) -> str:
    """OTLP gRPC exporter expects host:port without a scheme."""
    endpoint = raw.strip()
    for prefix in ("https://", "http://"):
        if endpoint.startswith(prefix):
            endpoint = endpoint[len(prefix) :]
            break
    return endpoint.rstrip("/")


def _sdk_disabled() -> bool:
    return os.getenv("OTEL_SDK_DISABLED", "").lower() in {"1", "true", "yes"}


def setup_telemetry(service_name: str):
    """Configure OpenTelemetry tracing once and return a tracer.

    Failures are logged and swallowed so services still start when the
    collector is temporarily unavailable (common during local bootstrap).
    """
    global _initialized

    resolved_name = os.getenv("OTEL_SERVICE_NAME", service_name)

    if _initialized:
        return trace.get_tracer(resolved_name)

    if _sdk_disabled():
        provider = TracerProvider()
        trace.set_tracer_provider(provider)
        _initialized = True
        logger.info("otel sdk disabled")
        return trace.get_tracer(resolved_name)

    resource_attrs = {
        "service.name": resolved_name,
        "service.namespace": os.getenv("OTEL_SERVICE_NAMESPACE", "telemetry"),
        "deployment.environment": os.getenv("ENVIRONMENT", "dev"),
    }

    extra = os.getenv("OTEL_RESOURCE_ATTRIBUTES", "")
    for pair in extra.split(","):
        if "=" in pair:
            key, value = pair.split("=", 1)
            resource_attrs[key.strip()] = value.strip()

    resource = Resource.create(resource_attrs)
    provider = TracerProvider(resource=resource)

    endpoint = _normalize_otlp_endpoint(
        os.getenv(
            "OTEL_EXPORTER_OTLP_ENDPOINT",
            "otel-collector.observability.svc.cluster.local:4317",
        )
    )

    insecure = os.getenv("OTEL_EXPORTER_OTLP_INSECURE", "true").lower() in {
        "1",
        "true",
        "yes",
    }

    try:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )

        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=insecure)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        logger.info("otlp exporter configured endpoint=%s", endpoint)
    except Exception as exc:  # pragma: no cover - defensive bootstrap path
        logger.warning("otlp exporter unavailable (%s); using console exporter", exc)
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    _initialized = True
    return trace.get_tracer(resolved_name)
