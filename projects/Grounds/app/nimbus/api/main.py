"""Nimbus Order API — production-shaped service for local practice."""
from __future__ import annotations

import json
import logging
from typing import Any

import boto3
import redis
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from api.config import settings
from api.db import get_db, init_db
from api.models import Order, OrderItem, Product

logging.basicConfig(level=settings.log_level.upper())
log = logging.getLogger("nimbus")

app = FastAPI(title="Nimbus API", version="1.0.0", description="Local production practice app")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrderIn(BaseModel):
    customer: str = Field(min_length=1, max_length=128)
    items: list[dict[str, int]]  # [{product_id, qty}]


class OrderOut(BaseModel):
    id: int
    customer: str
    status: str
    total_cents: int


def redis_client() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


def s3_client():
    kwargs: dict[str, Any] = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": settings.aws_default_region,
    }
    if settings.s3_endpoint:
        kwargs["endpoint_url"] = settings.s3_endpoint
    return boto3.client("s3", **kwargs)


@app.on_event("startup")
def on_startup() -> None:
    try:
        init_db()
        log.info("database ready")
    except Exception:
        log.exception("database init failed — will retry on requests")


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, Any]:
    checks: dict[str, str] = {"api": "ok"}
    try:
        db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"fail:{e.__class__.__name__}"
    try:
        redis_client().ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"fail:{e.__class__.__name__}"
    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "env": settings.app_env, "checks": checks}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    redis_client().ping()
    return {"status": "ready"}


@app.get("/products")
def list_products(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Product).order_by(Product.id)).all()
    return [
        {"id": p.id, "sku": p.sku, "name": p.name, "price_cents": p.price_cents, "stock": p.stock}
        for p in rows
    ]


@app.post("/orders", response_model=OrderOut)
def create_order(body: OrderIn, db: Session = Depends(get_db)) -> OrderOut:
    if not body.items:
        raise HTTPException(400, "items required")
    total = 0
    order = Order(customer=body.customer, status="pending", total_cents=0)
    db.add(order)
    db.flush()
    for raw in body.items:
        pid = int(raw.get("product_id", 0))
        qty = int(raw.get("qty", 1))
        product = db.get(Product, pid)
        if not product:
            raise HTTPException(404, f"product {pid} not found")
        if product.stock < qty:
            raise HTTPException(409, f"insufficient stock for {product.sku}")
        product.stock -= qty
        line = qty * product.price_cents
        total += line
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                qty=qty,
                unit_price_cents=product.price_cents,
            )
        )
    order.total_cents = total
    order.status = "confirmed"
    db.commit()
    db.refresh(order)

    # cache last order id
    try:
        redis_client().set("nimbus:last_order", str(order.id), ex=3600)
        redis_client().lpush("nimbus:order_events", json.dumps({"id": order.id, "total": total}))
    except Exception:
        log.warning("redis publish failed", exc_info=True)

    return OrderOut(id=order.id, customer=order.customer, status=order.status, total_cents=order.total_cents)


@app.get("/orders")
def list_orders(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.scalars(select(Order).order_by(Order.id.desc()).limit(50)).all()
    return [
        {"id": o.id, "customer": o.customer, "status": o.status, "total_cents": o.total_cents}
        for o in rows
    ]


@app.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "order not found")
    return {
        "id": order.id,
        "customer": order.customer,
        "status": order.status,
        "total_cents": order.total_cents,
        "items": [
            {"product_id": i.product_id, "qty": i.qty, "unit_price_cents": i.unit_price_cents}
            for i in order.items
        ],
    }


@app.post("/assets/ping-s3")
def ping_s3() -> dict[str, Any]:
    """Used by AWS practice scenarios (IAM/S3)."""
    try:
        client = s3_client()
        client.head_bucket(Bucket=settings.s3_bucket)
        return {"ok": True, "bucket": settings.s3_bucket}
    except Exception as e:
        raise HTTPException(503, f"s3 unavailable: {e}") from e


@app.get("/metrics")
def metrics() -> str:
    # minimal prometheus-ish metrics for monitoring tasks
    try:
        r = redis_client()
        last = r.get("nimbus:last_order") or "0"
        depth = r.llen("nimbus:order_events")
    except Exception:
        last, depth = "0", 0
    return (
        f"# HELP nimbus_last_order_id Last order id\n"
        f"# TYPE nimbus_last_order_id gauge\n"
        f"nimbus_last_order_id {last}\n"
        f"# HELP nimbus_order_events Redis list length\n"
        f"# TYPE nimbus_order_events gauge\n"
        f"nimbus_order_events {depth}\n"
    )
