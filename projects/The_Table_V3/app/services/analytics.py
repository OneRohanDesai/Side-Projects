from __future__ import annotations

from app.database import db
from app.services.clock import now_iso


async def snapshot() -> dict:
    today = now_iso()[:10]

    delivered = await db.fetchall(
        """SELECT o.id, o.created_at, o.delivered_at, o.table_id
           FROM orders o
           WHERE o.status='delivered' AND o.created_at LIKE ?""",
        (f"{today}%",),
    )
    items = await db.fetchall(
        """SELECT oi.name, COUNT(*) AS qty, SUM(oi.price * oi.qty) AS revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.status='delivered' AND o.created_at LIKE ?
           GROUP BY oi.name
           ORDER BY qty DESC
           LIMIT 10""",
        (f"{today}%",),
    )
    revenue = sum(float(i["revenue"] or 0) for i in items)
    # revenue from all delivered items today (not just top 10)
    rev_row = await db.fetchone(
        """SELECT COALESCE(SUM(oi.price * oi.qty), 0) AS revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.status='delivered' AND o.created_at LIKE ?""",
        (f"{today}%",),
    )
    revenue = float(rev_row["revenue"]) if rev_row else 0.0

    active = await db.fetchone(
        """SELECT COUNT(*) AS n FROM orders
           WHERE status IN ('submitted','in_kitchen','ready','ready_for_pickup','delivering')"""
    )
    occupied = await db.fetchone(
        "SELECT COUNT(*) AS n FROM tables WHERE status='occupied'"
    )
    vacant = await db.fetchone(
        "SELECT COUNT(*) AS n FROM tables WHERE status='vacant'"
    )
    tickets_open = await db.fetchone(
        "SELECT COUNT(*) AS n FROM tickets WHERE status IN ('pending','cooking')"
    )

    avg_mins = None
    times = []
    for o in delivered:
        if o.get("delivered_at") and o.get("created_at"):
            try:
                from datetime import datetime

                def parse(s: str) -> datetime:
                    return datetime.fromisoformat(s.replace("Z", "+00:00"))

                delta = (parse(o["delivered_at"]) - parse(o["created_at"])).total_seconds() / 60
                times.append(delta)
            except Exception:
                pass
    if times:
        avg_mins = round(sum(times) / len(times), 1)

    by_station = await db.fetchall(
        """SELECT station,
                  SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
                  SUM(CASE WHEN status='cooking' THEN 1 ELSE 0 END) AS cooking,
                  SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done
           FROM tickets
           WHERE date(COALESCE(started_at, completed_at, 'now')) = date('now')
              OR status IN ('pending','cooking')
           GROUP BY station"""
    )

    return {
        "date": today,
        "orders_delivered": len(delivered),
        "orders_active": active["n"] if active else 0,
        "revenue": round(revenue, 2),
        "tables_occupied": occupied["n"] if occupied else 0,
        "tables_vacant": vacant["n"] if vacant else 0,
        "tickets_open": tickets_open["n"] if tickets_open else 0,
        "avg_fulfillment_mins": avg_mins,
        "top_dishes": items,
        "stations": by_station,
        "generated_at": now_iso(),
    }
