from __future__ import annotations

from app.database import db
from app.services.ids import new_id
from app.ws import hub


async def list_staff(role: str | None = None, active_only: bool = True) -> list[dict]:
    sql = "SELECT id, name, role, station, active FROM staff WHERE 1=1"
    params: list = []
    if active_only:
        sql += " AND active=1"
    if role:
        sql += " AND role=?"
        params.append(role)
    sql += " ORDER BY role, name"
    rows = await db.fetchall(sql, params)
    for r in rows:
        r["active"] = bool(r["active"])
    return rows


async def create_staff(data: dict) -> dict:
    sid = new_id("s")
    # nicer ids for waiters W1, W2...
    if data["role"] == "waiter":
        existing = await db.fetchall("SELECT id FROM staff WHERE role='waiter'")
        sid = f"W{len(existing) + 1}"
    await db.execute(
        "INSERT INTO staff (id, name, role, pin, active, station) VALUES (?,?,?,?,1,?)",
        (sid, data["name"], data["role"], data.get("pin", ""), data.get("station")),
    )
    await db.commit()
    await hub.broadcast("staff_updated", await list_staff(active_only=False))
    return await get_staff(sid)  # type: ignore


async def get_staff(staff_id: str) -> dict | None:
    row = await db.fetchone(
        "SELECT id, name, role, station, active FROM staff WHERE id=?", (staff_id,)
    )
    if row:
        row["active"] = bool(row["active"])
    return row


async def list_assignments() -> list[dict]:
    return await db.fetchall(
        """SELECT a.waiter_id, a.table_id, s.name AS waiter_name, t.number AS table_number
           FROM assignments a
           JOIN staff s ON s.id = a.waiter_id
           JOIN tables t ON t.id = a.table_id
           ORDER BY a.waiter_id, t.number"""
    )


async def set_assignments(waiter_id: str, table_ids: list[str]) -> list[dict]:
    staff = await get_staff(waiter_id)
    if not staff or staff["role"] != "waiter":
        raise ValueError("Waiter not found")
    await db.execute("DELETE FROM assignments WHERE waiter_id=?", (waiter_id,))
    for tid in table_ids:
        await db.execute(
            "INSERT OR IGNORE INTO assignments (waiter_id, table_id) VALUES (?,?)",
            (waiter_id, tid),
        )
    await db.commit()
    result = await list_assignments()
    await hub.broadcast("assignments_updated", result)
    return result


async def tables_for_waiter(waiter_id: str) -> list[str]:
    rows = await db.fetchall(
        "SELECT table_id FROM assignments WHERE waiter_id=?", (waiter_id,)
    )
    return [r["table_id"] for r in rows]
