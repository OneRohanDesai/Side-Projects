import os

# Disable OTLP export during unit tests (no collector available).
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("ENVIRONMENT", "test")
