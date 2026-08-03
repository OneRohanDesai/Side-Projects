from fastapi.testclient import TestClient

from app.common.models import create_packet
from app.receiver.main import app as receiver_app


def test_receiver_health():
    client = TestClient(receiver_app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "receiver"


def test_receiver_accepts_valid_packet():
    client = TestClient(receiver_app)
    packet = create_packet(
        source="generator-0",
        destination="receiver-service",
        sequence=1,
        mode="stable",
    )
    response = client.post("/receive", json=packet.model_dump())
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_receiver_rejects_malformed_packet():
    client = TestClient(receiver_app)
    response = client.post(
        "/receive",
        json={
            "source": "generator-0",
            "destination": "receiver-service",
            "timestamp": 1.0,
            "sequence": 1,
            "traffic_mode": "stable",
            "size_bytes": 100,
            "environment": "test",
            "region": "ci",
            "value": 1.0,
            # packet_id intentionally missing
        },
    )
    assert response.status_code == 422


def test_receiver_metrics_endpoint():
    client = TestClient(receiver_app)
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "telemetry_packets_received_total" in response.text or response.text.startswith("#")
