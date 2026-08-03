from __future__ import annotations

from app.database import db
from app.services.clock import now_iso
from app.ws import hub


async def list_tables() -> list[dict]:
    return await db.fetchall(
        "SELECT * FROM tables ORDER BY CAST(SUBSTR(number, 7) AS INTEGER), number"
    )


async def get_table(table_id: str) -> dict | None:
    return await db.fetchone("SELECT * FROM tables WHERE id = ?", (table_id,))


async def seat(table_id: str, pax: int, notes: str = "") -> dict:
    table = await get_table(table_id)
    if not table:
        raise ValueError("Table not found")
    if table["status"] not in ("vacant", "reserved"):
        raise ValueError(f"Table is {table['status']}, cannot seat")
    if pax > table["seats"]:
        raise ValueError(f"Only {table['seats']} seats available")

    await db.execute(
        """UPDATE tables SET status='occupied', pax=?, occupied_at=?, notes=? WHERE id=?""",
        (pax, now_iso(), notes, table_id),
    )
    await db.commit()
    result = await get_table(table_id)
    await hub.broadcast("tables_updated", await list_tables())
    await hub.broadcast("table_seated", result)
    return result  # type: ignore


async def clear_table(table_id: str, to_dirty: bool = True) -> dict:
    table = await get_table(table_id)
    if not table:
        raise ValueError("Table not found")

    # Block if open (non-delivered/cancelled) orders remain
    open_orders = await db.fetchall(
        """SELECT id FROM orders
           WHERE table_id=? AND status NOT IN ('delivered','cancelled')""",
        (table_id,),
    )
    if open_orders:
        raise ValueError("Close or cancel open orders before clearing table")

    status = "dirty" if to_dirty else "vacant"
    await db.execute(
        """UPDATE tables SET status=?, pax=0, occupied_at=NULL, notes='' WHERE id=?""",
        (status, table_id),
    )
    await db.commit()
    result = await get_table(table_id)
    await hub.broadcast("tables_updated", await list_tables())
    return result  # type: ignore


async def mark_clean(table_id: str) -> dict:
    table = await get_table(table_id)
    if not table:
        raise ValueError("Table not found")
    if table["status"] != "dirty":
        raise ValueError("Table is not dirty")
    await db.execute(
        "UPDATE tables SET status='vacant', pax=0, occupied_at=NULL, notes='' WHERE id=?",
        (table_id,),
    )
    await db.commit()
    result = await get_table(table_id)
    await hub.broadcast("tables_updated", await list_tables())
    return result  # type: ignore


async def set_status(table_id: str, status: str) -> dict:
    if status not in ("vacant", "occupied", "dirty", "reserved"):
        raise ValueError("Invalid status")
    await db.execute("UPDATE tables SET status=? WHERE id=?", (status, table_id))
    await db.commit()
    result = await get_table(table_id)
    await hub.broadcast("tables_updated", await list_tables())
    return result  # type: ignore
