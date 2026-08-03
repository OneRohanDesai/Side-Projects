"""Background worker — polls Redis + optional SQS (LocalStack)."""
from __future__ import annotations

import json
import logging
import os
import time

import boto3
import redis

logging.basicConfig(level=os.getenv("LOG_LEVEL", "info").upper())
log = logging.getLogger("nimbus.worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SQS_ENDPOINT = os.getenv("SQS_ENDPOINT")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")


def process_redis(r: redis.Redis) -> None:
    item = r.brpop("nimbus:jobs", timeout=2)
    if not item:
        return
    _, payload = item
    log.info("processed redis job: %s", payload)
    r.incr("nimbus:jobs_done")


def process_sqs() -> None:
    if not SQS_ENDPOINT or not SQS_QUEUE_URL:
        return
    client = boto3.client(
        "sqs",
        endpoint_url=SQS_ENDPOINT,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    )
    try:
        resp = client.receive_message(QueueUrl=SQS_QUEUE_URL, MaxNumberOfMessages=5, WaitTimeSeconds=2)
    except Exception as e:
        log.debug("sqs receive failed: %s", e)
        return
    for msg in resp.get("Messages", []):
        log.info("processed sqs message: %s", msg.get("Body"))
        client.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=msg["ReceiptHandle"])


def main() -> None:
    r = redis.from_url(REDIS_URL, decode_responses=True)
    log.info("worker started")
    while True:
        try:
            process_redis(r)
            process_sqs()
        except Exception:
            log.exception("worker loop error")
            time.sleep(2)


if __name__ == "__main__":
    main()
