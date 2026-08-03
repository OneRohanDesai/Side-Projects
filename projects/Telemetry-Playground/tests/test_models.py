from app.common.models import GeneratorConfig, TelemetryPacket, create_packet


def test_create_packet_fields():
    packet = create_packet(
        source="generator-0",
        destination="receiver-service",
        sequence=7,
        mode="stable",
        environment="test",
        region="ci",
    )

    assert isinstance(packet, TelemetryPacket)
    assert packet.source == "generator-0"
    assert packet.destination == "receiver-service"
    assert packet.sequence == 7
    assert packet.traffic_mode == "stable"
    assert packet.environment == "test"
    assert packet.region == "ci"
    assert 256 <= packet.size_bytes <= 8192
    assert packet.packet_id


def test_generator_config_defaults():
    config = GeneratorConfig()
    assert config.mode == "stable"
    assert config.rate == 10
    assert config.malformed is False
    assert config.latency_ms == 0


def test_generator_config_validation():
    config = GeneratorConfig(mode="burst", rate=100, malformed=True, latency_ms=25)
    assert config.model_dump() == {
        "mode": "burst",
        "rate": 100,
        "malformed": True,
        "latency_ms": 25,
    }
