"""Order lifecycle — every transition is a real staff action."""

from __future__ import annotations

from app.database import db
from app.services.clock import now_iso
from app.services.ids import new_id
from app.services import menu as menu_svc
from app.services import tables as tables_svc
from app.ws import hub


ACTIVE = ("submitted", "in_kitchen", "ready", "ready_for_pickup", "delivering")


async def _hydrate(order: dict) -> dict:
    order["priority"] = bool(order["priority"])
    order["items"] = await db.fetchall(
        "SELECT * FROM order_items WHERE order_id=? ORDER BY name", (order["id"],)
    )
    order["tickets"] = await db.fetchall(
        "SELECT * FROM tickets WHERE order_id=? ORDER BY station, dish_name",
        (order["id"],),
    )
    table = await tables_svc.get_table(order["table_id"])
    order["table_number"] = table["number"] if table else order["table_id"]
    return order


async def get_order(order_id: str) -> dict | None:
    row = await db.fetchone("SELECT * FROM orders WHERE id=?", (order_id,))
    if not row:
        return None
    return await _hydrate(row)


async def list_orders(
    status: str | None = None,
    active_only: bool = False,
    table_id: str | None = None,
) -> list[dict]:
    sql = "SELECT * FROM orders WHERE 1=1"
    params: list = []
    if status:
        sql += " AND status=?"
        params.append(status)
    if active_only:
        placeholders = ",".join("?" * len(ACTIVE))
        sql += f" AND status IN ({placeholders})"
        params.extend(ACTIVE)
    if table_id:
        sql += " AND table_id=?"
        params.append(table_id)
    sql += " ORDER BY priority DESC, created_at ASC"
    rows = await db.fetchall(sql, params)
    return [await _hydrate(r) for r in rows]


async def _broadcast_orders() -> None:
    await hub.broadcast("orders_updated", await list_orders(active_only=False))
    await hub.broadcast("tickets_updated", await list_tickets())


async def list_tickets(station: str | None = None, open_only: bool = True) -> list[dict]:
    sql = "SELECT * FROM tickets WHERE 1=1"
    params: list = []
    if station:
        sql += " AND station=?"
        params.append(station)
    if open_only:
        sql += " AND status IN ('pending','cooking')"
    sql += " ORDER BY CASE status WHEN 'cooking' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, started_at"
    return await db.fetchall(sql, params)


async def create_order(
    table_id: str,
    items: list[dict],
    waiter_id: str | None = None,
    notes: str = "",
    guest_count: int = 0,
) -> dict:
    table = await tables_svc.get_table(table_id)
    if not table:
        raise ValueError("Table not found")
    if table["status"] != "occupied":
        raise ValueError("Seat the table before taking an order")
    if not items:
        raise ValueError("Order needs at least one item")

    oid = new_id("o")
    ts = now_iso()
    await db.execute(
        """INSERT INTO orders
           (id, table_id, waiter_id, status, priority, notes, guest_count, created_at)
           VALUES (?,?,?,'submitted',0,?,?,?)""",
        (oid, table_id, waiter_id, notes, guest_count or table["pax"], ts),
    )

    for raw in items:
        mi = await menu_svc.get_item(raw["menu_id"])
        if not mi or not mi["available"]:
            raise ValueError(f"Menu item unavailable: {raw['menu_id']}")
        qty = int(raw.get("qty", 1))
        for _ in range(qty):
            iid = new_id("i")
            await db.execute(
                """INSERT INTO order_items
                   (id, order_id, menu_id, name, price, qty, station, notes, status)
                   VALUES (?,?,?,?,?,1,?,?,'pending')""",
                (
                    iid,
                    oid,
                    mi["id"],
                    mi["name"],
                    mi["price"],
                    mi["station"],
                    raw.get("notes", ""),
                ),
            )

    await db.commit()
    order = await get_order(oid)
    await _broadcast_orders()
    await hub.broadcast("order_created", order)
    return order  # type: ignore


async def fire_to_kitchen(order_id: str) -> dict:
    """Expeditor fires order → generate station tickets from prep steps."""
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")
    if order["status"] not in ("submitted",):
        # allow re-fire only if cancelled tickets? keep strict
        if order["status"] != "in_kitchen":
            raise ValueError(f"Cannot fire order in status {order['status']}")

    ts = now_iso()
    if order["status"] == "submitted":
        await db.execute(
            "UPDATE orders SET status='in_kitchen', fired_at=? WHERE id=?",
            (ts, order_id),
        )

    # Create tickets for items that don't have any yet
    for item in order["items"]:
        existing = [t for t in order["tickets"] if t["item_id"] == item["id"]]
        if existing:
            continue
        mi = await menu_svc.get_item(item["menu_id"])
        steps = (mi or {}).get("prep_steps") or [
            {
                "task": f"Cook {item['name']}",
                "station": item["station"],
                "duration": (mi or {}).get("prep_secs", 300),
            }
        ]
        for step in steps:
            if not step.get("task"):
                continue
            tid = new_id("t")
            await db.execute(
                """INSERT INTO tickets
                   (id, order_id, item_id, table_id, dish_name, task, station, duration, status)
                   VALUES (?,?,?,?,?,?,?,?,'pending')""",
                (
                    tid,
                    order_id,
                    item["id"],
                    order["table_id"],
                    item["name"],
                    step["task"],
                    step["station"],
                    int(step["duration"]),
                ),
            )
        await db.execute(
            "UPDATE order_items SET status='in_kitchen' WHERE id=?", (item["id"],)
        )

    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    await hub.broadcast("order_fired", order)
    return order  # type: ignore


async def set_priority(order_id: str, priority: bool = True) -> dict:
    await db.execute(
        "UPDATE orders SET priority=? WHERE id=?", (1 if priority else 0, order_id)
    )
    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    return order  # type: ignore


async def start_ticket(ticket_id: str) -> dict:
    ticket = await db.fetchone("SELECT * FROM tickets WHERE id=?", (ticket_id,))
    if not ticket:
        raise ValueError("Ticket not found")
    if ticket["status"] != "pending":
        raise ValueError(f"Ticket is {ticket['status']}")
    await db.execute(
        "UPDATE tickets SET status='cooking', started_at=? WHERE id=?",
        (now_iso(), ticket_id),
    )
    await db.commit()
    await _broadcast_orders()
    row = await db.fetchone("SELECT * FROM tickets WHERE id=?", (ticket_id,))
    await hub.broadcast("ticket_started", row)
    return row  # type: ignore


async def complete_ticket(ticket_id: str) -> dict:
    ticket = await db.fetchone("SELECT * FROM tickets WHERE id=?", (ticket_id,))
    if not ticket:
        raise ValueError("Ticket not found")
    if ticket["status"] not in ("pending", "cooking"):
        raise ValueError(f"Ticket is {ticket['status']}")
    await db.execute(
        "UPDATE tickets SET status='done', completed_at=? WHERE id=?",
        (now_iso(), ticket_id),
    )

    # If all tickets for this order item are done → item ready
    pending_item = await db.fetchone(
        """SELECT id FROM tickets WHERE item_id=? AND status!='done'""",
        (ticket["item_id"],),
    )
    if not pending_item:
        await db.execute(
            "UPDATE order_items SET status='ready' WHERE id=?", (ticket["item_id"],)
        )

    # If all tickets for order done → order ready for QC
    pending_order = await db.fetchone(
        """SELECT id FROM tickets WHERE order_id=? AND status!='done'""",
        (ticket["order_id"],),
    )
    if not pending_order:
        await db.execute(
            "UPDATE orders SET status='ready', ready_at=? WHERE id=? AND status='in_kitchen'",
            (now_iso(), ticket["order_id"]),
        )

    await db.commit()
    await _broadcast_orders()
    row = await db.fetchone("SELECT * FROM tickets WHERE id=?", (ticket_id,))
    order = await get_order(ticket["order_id"])
    await hub.broadcast("ticket_completed", {"ticket": row, "order": order})
    return row  # type: ignore


async def qc_pass(order_id: str) -> dict:
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")
    if order["status"] != "ready":
        raise ValueError("Order is not ready for QC")
    await db.execute(
        "UPDATE orders SET status='ready_for_pickup', qc_at=? WHERE id=?",
        (now_iso(), order_id),
    )
    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    await hub.broadcast("qc_passed", order)
    return order  # type: ignore


async def pickup(order_id: str, waiter_id: str) -> dict:
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")
    if order["status"] != "ready_for_pickup":
        raise ValueError("Order is not ready for pickup")
    await db.execute(
        "UPDATE orders SET status='delivering', pickup_at=?, delivered_by=? WHERE id=?",
        (now_iso(), waiter_id, order_id),
    )
    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    await hub.broadcast("order_pickup", order)
    return order  # type: ignore


async def deliver(order_id: str) -> dict:
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")
    if order["status"] != "delivering":
        raise ValueError("Order is not being delivered")
    await db.execute(
        "UPDATE orders SET status='delivered', delivered_at=? WHERE id=?",
        (now_iso(), order_id),
    )
    await db.execute(
        "UPDATE order_items SET status='delivered' WHERE order_id=?", (order_id,)
    )
    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    await hub.broadcast("order_delivered", order)
    return order  # type: ignore


async def cancel(order_id: str) -> dict:
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")
    if order["status"] in ("delivered", "cancelled"):
        raise ValueError("Cannot cancel")
    await db.execute(
        "UPDATE orders SET status='cancelled', cancelled_at=? WHERE id=?",
        (now_iso(), order_id),
    )
    await db.execute(
        "UPDATE tickets SET status='cancelled' WHERE order_id=? AND status IN ('pending','cooking')",
        (order_id,),
    )
    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    return order  # type: ignore


async def refire(order_id: str, note: str = "Remake", item_ids: list[str] | None = None) -> dict:
    """Re-queue tickets for remake (whole order or specific items)."""
    order = await get_order(order_id)
    if not order:
        raise ValueError("Order not found")

    targets = order["items"]
    if item_ids:
        targets = [i for i in order["items"] if i["id"] in item_ids]
    if not targets:
        raise ValueError("No items to refire")

    await db.execute(
        """UPDATE orders SET status='in_kitchen', refire_note=?, ready_at=NULL, qc_at=NULL,
           priority=1 WHERE id=?""",
        (note, order_id),
    )

    for item in targets:
        # Cancel old open tickets for item
        await db.execute(
            """UPDATE tickets SET status='cancelled'
               WHERE item_id=? AND status IN ('pending','cooking','done')""",
            (item["id"],),
        )
        mi = await menu_svc.get_item(item["menu_id"])
        steps = (mi or {}).get("prep_steps") or [
            {
                "task": f"REFIRE {item['name']}",
                "station": item["station"],
                "duration": (mi or {}).get("prep_secs", 300),
            }
        ]
        for step in steps:
            if not step.get("task"):
                continue
            tid = new_id("t")
            task_label = step["task"] if step["task"].startswith("REFIRE") else f"REFIRE: {step['task']}"
            await db.execute(
                """INSERT INTO tickets
                   (id, order_id, item_id, table_id, dish_name, task, station, duration, status)
                   VALUES (?,?,?,?,?,?,?,?,'pending')""",
                (
                    tid,
                    order_id,
                    item["id"],
                    order["table_id"],
                    item["name"],
                    task_label,
                    step["station"],
                    int(step["duration"]),
                ),
            )
        await db.execute(
            "UPDATE order_items SET status='in_kitchen' WHERE id=?", (item["id"],)
        )

    await db.commit()
    order = await get_order(order_id)
    await _broadcast_orders()
    await hub.broadcast("order_refired", order)
    return order  # type: ignore


async def order_total(order_id: str) -> float:
    row = await db.fetchone(
        "SELECT COALESCE(SUM(price * qty), 0) AS total FROM order_items WHERE order_id=?",
        (order_id,),
    )
    return float(row["total"]) if row else 0.0


async def table_bill(table_id: str) -> dict:
    orders = await db.fetchall(
        """SELECT * FROM orders WHERE table_id=? AND status='delivered'""",
        (table_id,),
    )
    hydrated = [await _hydrate(o) for o in orders]
    total = 0.0
    for o in hydrated:
        for it in o["items"]:
            total += it["price"] * it["qty"]
    return {"table_id": table_id, "orders": hydrated, "total": round(total, 2)}
