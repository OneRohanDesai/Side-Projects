import json
import logging
import os
from functools import lru_cache
from typing import Any

import redis

from app.common.models import GeneratorConfig

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = GeneratorConfig().model_dump()


@lru_cache(maxsize=1)
def get_redis() -> redis.Redis:
    host = os.getenv("REDIS_HOST", "redis")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "0"))

    client = redis.Redis(
        host=host,
        port=port,
        db=db,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
        retry_on_timeout=True,
        health_check_interval=30,
    )
    return client


def _config_key(generator_name: str) -> str:
    return f"generator:{generator_name}:config"


def get_config(generator_name: str) -> dict[str, Any]:
    client = get_redis()
    try:
        data = client.get(_config_key(generator_name))
    except redis.RedisError as exc:
        logger.warning("redis get failed for %s: %s", generator_name, exc)
        return dict(DEFAULT_CONFIG)

    if data is None:
        # Also check legacy bare key used by older versions.
        try:
            legacy = client.get(generator_name)
        except redis.RedisError:
            legacy = None

        if legacy is not None:
            try:
                parsed = json.loads(legacy)
                return GeneratorConfig(**parsed).model_dump()
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        set_config(generator_name, dict(DEFAULT_CONFIG))
        return dict(DEFAULT_CONFIG)

    try:
        parsed = json.loads(data)
        return GeneratorConfig(**parsed).model_dump()
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logger.warning("invalid config for %s: %s", generator_name, exc)
        return dict(DEFAULT_CONFIG)


def set_config(generator_name: str, config: dict[str, Any]) -> dict[str, Any]:
    validated = GeneratorConfig(**config).model_dump()
    client = get_redis()
    payload = json.dumps(validated)
    try:
        client.set(_config_key(generator_name), payload)
        # Keep legacy key in sync for smooth upgrades.
        client.set(generator_name, payload)
    except redis.RedisError as exc:
        logger.error("redis set failed for %s: %s", generator_name, exc)
        raise
    return validated


def list_generator_keys() -> list[str]:
    client = get_redis()
    try:
        keys = client.keys("generator:*:config")
    except redis.RedisError as exc:
        logger.warning("redis keys failed: %s", exc)
        return []

    names: list[str] = []
    for key in keys:
        # generator:<name>:config
        parts = key.split(":")
        if len(parts) >= 3:
            names.append(parts[1])
    return sorted(names)


def ping() -> bool:
    try:
        return bool(get_redis().ping())
    except redis.RedisError:
        return False
