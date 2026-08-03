from prometheus_client import Counter, Gauge, Histogram

PACKETS_SENT = Counter(
    "telemetry_packets_sent_total",
    "Total packets successfully sent by generators",
    ["generator", "mode"],
)

PACKETS_SEND_ERRORS = Counter(
    "telemetry_packets_send_errors_total",
    "Total packet send failures",
    ["generator", "error_type"],
)

PACKETS_RECEIVED = Counter(
    "telemetry_packets_received_total",
    "Total packets successfully received",
    ["receiver", "mode"],
)

MALFORMED_PACKETS = Counter(
    "telemetry_malformed_packets_total",
    "Malformed packets intentionally generated",
    ["generator"],
)

PACKETS_REJECTED = Counter(
    "telemetry_packets_rejected_total",
    "Packets rejected by the receiver (validation failures)",
    ["receiver", "reason"],
)

REQUEST_LATENCY = Histogram(
    "telemetry_request_latency_seconds",
    "End-to-end packet latency from generation timestamp",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

SEND_LATENCY = Histogram(
    "telemetry_send_latency_seconds",
    "HTTP send latency observed by generators",
    ["generator"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

ACTIVE_REQUESTS = Gauge(
    "telemetry_active_requests",
    "Requests currently in progress",
    ["service"],
)

CONFIG_UPDATES = Counter(
    "telemetry_config_updates_total",
    "Generator configuration updates applied via dashboard",
    ["generator"],
)
