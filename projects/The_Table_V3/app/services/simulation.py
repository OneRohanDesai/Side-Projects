"""Restaurant-wide simulation driver.

Runs only when started via API / simulation page.
All actions go through real domain services so Floor, Waiter,
Expeditor, Station, and Executive pages update live over WebSocket.
"""

from __future__ import annotations

import asyncio
import random
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Optional

from app.database import db
from app.services import analytics, menu, orders, staff, tables
from app.services.clock import now_iso
from app.ws import hub

# Medium pace: lively but readable on tablets
PACE = {
    "tick_seconds": 1.6,
    "prep_scale": 0.045,  # 300s real → ~13.5s sim
    "min_prep": 5,
    "max_prep": 22,
    "target_occupied": 14,
    "max_new_seats_per_tick": 2,
    "max_new_orders_per_tick": 2,
    "max_fires_per_tick": 2,
    "max_ticket_starts_per_tick": 4,
    "max_ticket_completes_per_tick": 5,
    "max_qc_per_tick": 2,
    "max_pickups_per_tick": 2,
    "max_delivers_per_tick": 2,
    "max_clears_per_tick": 2,
    "think_before_order_secs": 8,
    "eat_before_clear_secs": 28,
    "busy_order_chance": 0.55,
    "items_min": 1,
    "items_max": 4,
}


@dataclass
class SimState:
    running: bool = False
    started_at: Optional[str] = None
    stopped_at: Optional[str] = None
    ticks: int = 0
    actions: int = 0
    last_error: Optional[str] = None
    log: Deque[dict] = field(default_factory=lambda: deque(maxlen=250))
    # table_id -> iso when seated (for order delay)
    seated_at: dict[str, str] = field(default_factory=dict)
    # order_id -> iso when delivered (for clear delay)
    delivered_at: dict[str, str] = field(default_factory=dict)
    # ticket_id -> due complete timestamp (epoch)
    ticket_due: dict[str, float] = field(default_factory=dict)


class RestaurantSimulator:
    def __init__(self) -> None:
        self.state = SimState()
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    def status(self) -> dict[str, Any]:
        return {
            "running": self.state.running,
            "started_at": self.state.started_at,
            "stopped_at": self.state.stopped_at,
            "ticks": self.state.ticks,
            "actions": self.state.actions,
            "last_error": self.state.last_error,
            "pace": "medium",
            "config": PACE,
            "log": list(self.state.log)[-80:],
        }

    async def _emit_log(self, level: str, message: str, **extra: Any) -> None:
        entry = {
            "ts": now_iso(),
            "level": level,
            "message": message,
            **extra,
        }
        self.state.log.append(entry)
        await hub.broadcast("simulation_log", entry)

    async def _broadcast_status(self) -> None:
        await hub.broadcast("simulation_status", self.status())

    async def start(self) -> dict:
        async with self._lock:
            if self.state.running:
                return self.status()
            self.state = SimState(running=True, started_at=now_iso())
            self._task = asyncio.create_task(self._loop(), name="restaurant-sim")
            await self._emit_log("info", "Simulation started (medium pace)")
            await self._broadcast_status()
            return self.status()

    async def stop(self) -> dict:
        async with self._lock:
            if not self.state.running and not self._task:
                return self.status()
            self.state.running = False
            self.state.stopped_at = now_iso()
            task = self._task
            self._task = None
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        await self._emit_log("info", "Simulation stopped")
        await self._broadcast_status()
        return self.status()

    async def _loop(self) -> None:
        try:
            while self.state.running:
                try:
                    await self._tick()
                    self.state.ticks += 1
                    self.state.last_error = None
                    if self.state.ticks % 3 == 0:
                        await self._broadcast_status()
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    self.state.last_error = str(e)
                    await self._emit_log("error", f"Tick error: {e}")
                await asyncio.sleep(PACE["tick_seconds"])
        except asyncio.CancelledError:
            pass
        finally:
            self.state.running = False
            self.state.stopped_at = self.state.stopped_at or now_iso()
            await self._broadcast_status()

    def _scaled_prep(self, duration: int) -> int:
        scaled = int(duration * PACE["prep_scale"])
        return max(PACE["min_prep"], min(PACE["max_prep"], scaled or PACE["min_prep"]))

    def _age_secs(self, iso: str | None) -> float:
        if not iso:
            return 0.0
        try:
            import time
            from datetime import datetime

            t = datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
            return max(0.0, time.time() - t)
        except Exception:
            return 9999.0

    async def _waiter_for(self, table_id: str) -> str:
        rows = await db.fetchall(
            "SELECT waiter_id FROM assignments WHERE table_id=?", (table_id,)
        )
        if rows:
            return rows[0]["waiter_id"]
        waiters = await staff.list_staff(role="waiter")
        return waiters[0]["id"] if waiters else "W1"

    async def _tick(self) -> None:
        all_tables = await tables.list_tables()
        active_orders = await orders.list_orders(active_only=True)
        open_tickets = await orders.list_tickets(open_only=True)
        menu_items = [m for m in await menu.list_menu(available_only=True) if m.get("available", True)]
        if not menu_items:
            menu_items = await menu.list_menu()

        by_table_active = {}
        for o in active_orders:
            by_table_active.setdefault(o["table_id"], []).append(o)

        occupied = [t for t in all_tables if t["status"] == "occupied"]
        vacant = [t for t in all_tables if t["status"] == "vacant"]
        dirty = [t for t in all_tables if t["status"] == "dirty"]

        # 1) Bus dirty tables quickly
        for t in dirty[: PACE["max_clears_per_tick"]]:
            try:
                await tables.mark_clean(t["id"])
                self.state.actions += 1
                await self._emit_log("floor", f"Bussed {t['number']} → vacant", table_id=t["id"])
            except Exception as e:
                await self._emit_log("warn", f"Clean {t['number']}: {e}")

        # 2) Seat new parties
        seats_left = max(0, PACE["target_occupied"] - len(occupied))
        random.shuffle(vacant)
        for t in vacant[: min(seats_left, PACE["max_new_seats_per_tick"])]:
            pax = random.randint(1, min(t["seats"], 6))
            try:
                await tables.seat(t["id"], pax, notes="sim guest")
                self.state.seated_at[t["id"]] = now_iso()
                self.state.actions += 1
                await self._emit_log(
                    "floor",
                    f"Seated {pax} at {t['number']}",
                    table_id=t["id"],
                    pax=pax,
                )
            except Exception as e:
                await self._emit_log("warn", f"Seat {t['number']}: {e}")

        # refresh occupied after seating
        all_tables = await tables.list_tables()
        occupied = [t for t in all_tables if t["status"] == "occupied"]

        # 3) Take orders for occupied tables without active order
        candidates = []
        for t in occupied:
            if by_table_active.get(t["id"]):
                continue
            seated = self.state.seated_at.get(t["id"]) or t.get("occupied_at")
            if self._age_secs(seated) < PACE["think_before_order_secs"]:
                continue
            candidates.append(t)
        random.shuffle(candidates)
        for t in candidates[: PACE["max_new_orders_per_tick"]]:
            if random.random() > PACE["busy_order_chance"] and self.state.ticks > 5:
                continue
            n = random.randint(PACE["items_min"], PACE["items_max"])
            picks = random.sample(menu_items, k=min(n, len(menu_items)))
            items = [{"menu_id": m["id"], "qty": 1, "notes": ""} for m in picks]
            # occasional double
            if random.random() < 0.2 and picks:
                items[0]["qty"] = 2
            wid = await self._waiter_for(t["id"])
            try:
                o = await orders.create_order(
                    table_id=t["id"],
                    items=items,
                    waiter_id=wid,
                    notes="sim order",
                    guest_count=t["pax"],
                )
                self.state.actions += 1
                names = ", ".join(i["name"] for i in o["items"][:4])
                await self._emit_log(
                    "waiter",
                    f"{wid} ordered for {t['number']}: {names}",
                    order_id=o["id"],
                    table_id=t["id"],
                )
            except Exception as e:
                await self._emit_log("warn", f"Order {t['number']}: {e}")

        active_orders = await orders.list_orders(active_only=True)

        # 4) Expeditor fires submitted
        submitted = [o for o in active_orders if o["status"] == "submitted"]
        # priority tables first (longer wait)
        submitted.sort(key=lambda o: o.get("created_at") or "")
        for o in submitted[: PACE["max_fires_per_tick"]]:
            try:
                fired = await orders.fire_to_kitchen(o["id"])
                self.state.actions += 1
                await self._emit_log(
                    "expeditor",
                    f"Fired {fired['table_number']} → {len(fired.get('tickets') or [])} tickets",
                    order_id=o["id"],
                )
                # occasional priority on aging
                if self._age_secs(o.get("created_at")) > 45 and random.random() < 0.4:
                    await orders.set_priority(o["id"], True)
                    await self._emit_log("expeditor", f"Priority {fired['table_number']}", order_id=o["id"])
            except Exception as e:
                await self._emit_log("warn", f"Fire {o['id']}: {e}")

        # 5) Station work: start pending tickets
        open_tickets = await orders.list_tickets(open_only=True)
        pending = [t for t in open_tickets if t["status"] == "pending"]
        # prefer older / priority orders
        pending.sort(key=lambda t: t.get("id") or "")
        random.shuffle(pending)
        for tk in pending[: PACE["max_ticket_starts_per_tick"]]:
            try:
                row = await orders.start_ticket(tk["id"])
                scaled = self._scaled_prep(int(tk.get("duration") or 300))
                await db.execute(
                    "UPDATE tickets SET duration=? WHERE id=?", (scaled, tk["id"])
                )
                await db.commit()
                import time

                self.state.ticket_due[tk["id"]] = time.time() + scaled
                self.state.actions += 1
                await self._emit_log(
                    "station",
                    f"[{tk['station']}] started {tk['dish_name']}: {tk['task']} (~{scaled}s)",
                    ticket_id=tk["id"],
                    station=tk["station"],
                )
                # refresh duration for clients
                await hub.broadcast("tickets_updated", await orders.list_tickets(open_only=False))
            except Exception as e:
                await self._emit_log("warn", f"Start ticket: {e}")

        # 6) Complete tickets that are due
        import time

        now = time.time()
        cooking = [t for t in await orders.list_tickets(open_only=True) if t["status"] == "cooking"]
        due_list = []
        for tk in cooking:
            due = self.state.ticket_due.get(tk["id"])
            if due is None:
                # fallback: use started_at + duration
                if tk.get("started_at"):
                    try:
                        from datetime import datetime

                        start = datetime.fromisoformat(
                            tk["started_at"].replace("Z", "+00:00")
                        ).timestamp()
                        due = start + int(tk.get("duration") or PACE["min_prep"])
                    except Exception:
                        due = now
                else:
                    due = now
            if due <= now:
                due_list.append(tk)
        random.shuffle(due_list)
        for tk in due_list[: PACE["max_ticket_completes_per_tick"]]:
            try:
                await orders.complete_ticket(tk["id"])
                self.state.ticket_due.pop(tk["id"], None)
                self.state.actions += 1
                await self._emit_log(
                    "station",
                    f"[{tk['station']}] DONE {tk['dish_name']}: {tk['task']}",
                    ticket_id=tk["id"],
                    station=tk["station"],
                )
            except Exception as e:
                await self._emit_log("warn", f"Complete ticket: {e}")

        active_orders = await orders.list_orders(active_only=True)

        # 7) QC ready orders
        ready = [o for o in active_orders if o["status"] == "ready"]
        for o in ready[: PACE["max_qc_per_tick"]]:
            try:
                await orders.qc_pass(o["id"])
                self.state.actions += 1
                await self._emit_log(
                    "expeditor",
                    f"QC pass {o.get('table_number')}",
                    order_id=o["id"],
                )
            except Exception as e:
                await self._emit_log("warn", f"QC: {e}")

        active_orders = await orders.list_orders(active_only=True)

        # 8) Waiter pickup
        pickup = [o for o in active_orders if o["status"] == "ready_for_pickup"]
        for o in pickup[: PACE["max_pickups_per_tick"]]:
            wid = o.get("waiter_id") or await self._waiter_for(o["table_id"])
            try:
                await orders.pickup(o["id"], wid)
                self.state.actions += 1
                await self._emit_log(
                    "waiter",
                    f"{wid} picked up {o.get('table_number')}",
                    order_id=o["id"],
                )
            except Exception as e:
                await self._emit_log("warn", f"Pickup: {e}")

        # 9) Deliver
        delivering = [o for o in active_orders if o["status"] == "delivering"]
        for o in delivering[: PACE["max_delivers_per_tick"]]:
            # small delay: only if pickup_at aged a bit
            if self._age_secs(o.get("pickup_at")) < 4:
                continue
            try:
                await orders.deliver(o["id"])
                self.state.delivered_at[o["id"]] = now_iso()
                self.state.actions += 1
                await self._emit_log(
                    "waiter",
                    f"Delivered to {o.get('table_number')}",
                    order_id=o["id"],
                )
            except Exception as e:
                await self._emit_log("warn", f"Deliver: {e}")

        # 10) After eating, clear tables with no open orders
        all_tables = await tables.list_tables()
        active_orders = await orders.list_orders(active_only=True)
        active_tables = {o["table_id"] for o in active_orders}
        cleared = 0
        for t in all_tables:
            if t["status"] != "occupied":
                continue
            if t["id"] in active_tables:
                continue
            # check latest delivered age for this table
            delivered = await db.fetchall(
                """SELECT id, delivered_at FROM orders
                   WHERE table_id=? AND status='delivered'
                   ORDER BY delivered_at DESC LIMIT 1""",
                (t["id"],),
            )
            if not delivered:
                # seated but never ordered long enough — leave them
                if self._age_secs(t.get("occupied_at")) > 90:
                    pass
                else:
                    continue
                # if sitting forever with no order history, still allow clear after long time
                if self._age_secs(t.get("occupied_at")) < 120:
                    continue
            else:
                if self._age_secs(delivered[0].get("delivered_at")) < PACE["eat_before_clear_secs"]:
                    continue
            if cleared >= PACE["max_clears_per_tick"]:
                break
            try:
                await tables.clear_table(t["id"], to_dirty=True)
                self.state.seated_at.pop(t["id"], None)
                self.state.actions += 1
                cleared += 1
                await self._emit_log("floor", f"Cleared {t['number']} → dirty", table_id=t["id"])
            except Exception as e:
                await self._emit_log("warn", f"Clear {t['number']}: {e}")

        # periodic analytics nudge for executive page consumers
        if self.state.ticks % 5 == 0:
            snap = await analytics.snapshot()
            await hub.broadcast("analytics_updated", snap)


simulator = RestaurantSimulator()
