from __future__ import annotations

from app.database import db
from app.services.ids import new_id
from app.ws import hub


async def list_menu(available_only: bool = False) -> list[dict]:
    sql = "SELECT * FROM menu_items"
    if available_only:
        sql += " WHERE available=1"
    sql += " ORDER BY category, sort_order, name"
    items = await db.fetchall(sql)
    for item in items:
        item["prep_steps"] = await db.fetchall(
            "SELECT task, station, duration, step_order FROM prep_steps WHERE menu_id=? ORDER BY step_order",
            (item["id"],),
        )
        item["available"] = bool(item["available"])
    return items


async def get_item(menu_id: str) -> dict | None:
    item = await db.fetchone("SELECT * FROM menu_items WHERE id=?", (menu_id,))
    if not item:
        return None
    item["prep_steps"] = await db.fetchall(
        "SELECT task, station, duration, step_order FROM prep_steps WHERE menu_id=? ORDER BY step_order",
        (menu_id,),
    )
    item["available"] = bool(item["available"])
    return item


async def create_item(data: dict) -> dict:
    mid = new_id("m")
    await db.execute(
        """INSERT INTO menu_items (id, name, category, price, station, prep_secs, available, description, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            mid,
            data["name"],
            data.get("category", "Main"),
            data["price"],
            data.get("station", "grill"),
            data.get("prep_secs", 300),
            1 if data.get("available", True) else 0,
            data.get("description", ""),
            data.get("sort_order", 0),
        ),
    )
    steps = data.get("prep_steps") or [
        {
            "task": f"Prep {data['name']}",
            "station": data.get("station", "grill"),
            "duration": data.get("prep_secs", 300),
        }
    ]
    for i, step in enumerate(steps):
        await db.execute(
            "INSERT INTO prep_steps (menu_id, task, station, duration, step_order) VALUES (?,?,?,?,?)",
            (
                mid,
                step.get("task") or f"Prep {data['name']}",
                step.get("station") or data.get("station", "grill"),
                int(step.get("duration") or data.get("prep_secs", 300)),
                i,
            ),
        )
    await db.commit()
    item = await get_item(mid)
    await hub.broadcast("menu_updated", await list_menu())
    return item  # type: ignore


async def update_item(menu_id: str, data: dict) -> dict:
    existing = await get_item(menu_id)
    if not existing:
        raise ValueError("Menu item not found")
    await db.execute(
        """UPDATE menu_items SET name=?, category=?, price=?, station=?, prep_secs=?,
           available=?, description=? WHERE id=?""",
        (
            data.get("name", existing["name"]),
            data.get("category", existing["category"]),
            data.get("price", existing["price"]),
            data.get("station", existing["station"]),
            data.get("prep_secs", existing["prep_secs"]),
            1 if data.get("available", existing["available"]) else 0,
            data.get("description", existing["description"]),
            menu_id,
        ),
    )
    if "prep_steps" in data:
        await db.execute("DELETE FROM prep_steps WHERE menu_id=?", (menu_id,))
        for i, step in enumerate(data["prep_steps"]):
            await db.execute(
                "INSERT INTO prep_steps (menu_id, task, station, duration, step_order) VALUES (?,?,?,?,?)",
                (
                    menu_id,
                    step["task"],
                    step["station"],
                    int(step["duration"]),
                    i,
                ),
            )
    await db.commit()
    item = await get_item(menu_id)
    await hub.broadcast("menu_updated", await list_menu())
    return item  # type: ignore


async def delete_item(menu_id: str) -> None:
    await db.execute("DELETE FROM prep_steps WHERE menu_id=?", (menu_id,))
    await db.execute("DELETE FROM menu_items WHERE id=?", (menu_id,))
    await db.commit()
    await hub.broadcast("menu_updated", await list_menu())


async def toggle_available(menu_id: str) -> dict:
    item = await get_item(menu_id)
    if not item:
        raise ValueError("Not found")
    new_val = 0 if item["available"] else 1
    await db.execute("UPDATE menu_items SET available=? WHERE id=?", (new_val, menu_id))
    await db.commit()
    result = await get_item(menu_id)
    await hub.broadcast("menu_updated", await list_menu())
    return result  # type: ignore
