from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.config import STATIONS
from app.schemas import (
    AssignTables,
    CreateOrder,
    MenuItemIn,
    RefireRequest,
    SeatRequest,
    StaffIn,
)
from app.services import analytics, menu, orders, staff, tables
from app.services.simulation import simulator
from app.ws import hub

router = APIRouter(prefix="/api", tags=["api"])


def _err(e: Exception, code: int = 400) -> HTTPException:
    return HTTPException(status_code=code, detail=str(e))


# ── Health ──────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "ok": True,
        "service": "the-table",
        "version": "3.1.0",
        "clients": hub.count,
    }


@router.get("/stations")
async def get_stations():
    return STATIONS


# ── Tables ──────────────────────────────────────────────

@router.get("/tables")
async def get_tables():
    return await tables.list_tables()


@router.post("/tables/{table_id}/seat")
async def seat_table(table_id: str, body: SeatRequest):
    try:
        return await tables.seat(table_id, body.pax, body.notes)
    except ValueError as e:
        raise _err(e)


@router.post("/tables/{table_id}/clear")
async def clear_table(table_id: str, dirty: bool = True):
    try:
        return await tables.clear_table(table_id, to_dirty=dirty)
    except ValueError as e:
        raise _err(e)


@router.post("/tables/{table_id}/clean")
async def clean_table(table_id: str):
    try:
        return await tables.mark_clean(table_id)
    except ValueError as e:
        raise _err(e)


@router.get("/tables/{table_id}/bill")
async def table_bill(table_id: str):
    return await orders.table_bill(table_id)


# ── Menu ────────────────────────────────────────────────

@router.get("/menu")
async def get_menu(available_only: bool = False):
    return await menu.list_menu(available_only=available_only)


@router.post("/menu")
async def create_menu_item(body: MenuItemIn):
    return await menu.create_item(body.model_dump())


@router.put("/menu/{menu_id}")
async def update_menu_item(menu_id: str, body: MenuItemIn):
    try:
        return await menu.update_item(menu_id, body.model_dump())
    except ValueError as e:
        raise _err(e, 404)


@router.delete("/menu/{menu_id}")
async def delete_menu_item(menu_id: str):
    await menu.delete_item(menu_id)
    return {"ok": True}


@router.post("/menu/{menu_id}/toggle")
async def toggle_menu(menu_id: str):
    try:
        return await menu.toggle_available(menu_id)
    except ValueError as e:
        raise _err(e, 404)


# ── Staff & assignments ─────────────────────────────────

@router.get("/staff")
async def get_staff(role: str | None = None):
    return await staff.list_staff(role=role)


@router.post("/staff")
async def create_staff(body: StaffIn):
    return await staff.create_staff(body.model_dump())


@router.get("/assignments")
async def get_assignments():
    return await staff.list_assignments()


@router.put("/assignments")
async def put_assignments(body: AssignTables):
    try:
        return await staff.set_assignments(body.waiter_id, body.table_ids)
    except ValueError as e:
        raise _err(e)


# ── Orders ──────────────────────────────────────────────

@router.get("/orders")
async def get_orders(
    status: str | None = None,
    active: bool = False,
    table_id: str | None = None,
):
    return await orders.list_orders(status=status, active_only=active, table_id=table_id)


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await orders.get_order(order_id)
    if not o:
        raise _err(ValueError("Not found"), 404)
    return o


@router.post("/orders")
async def create_order(body: CreateOrder):
    try:
        return await orders.create_order(
            table_id=body.table_id,
            items=[i.model_dump() for i in body.items],
            waiter_id=body.waiter_id,
            notes=body.notes,
            guest_count=body.guest_count,
        )
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/fire")
async def fire_order(order_id: str):
    try:
        return await orders.fire_to_kitchen(order_id)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/priority")
async def priority_order(order_id: str, on: bool = True):
    try:
        return await orders.set_priority(order_id, on)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/qc")
async def qc_order(order_id: str):
    try:
        return await orders.qc_pass(order_id)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/pickup")
async def pickup_order(order_id: str, waiter_id: str = Query(...)):
    try:
        return await orders.pickup(order_id, waiter_id)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str):
    try:
        return await orders.deliver(order_id)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str):
    try:
        return await orders.cancel(order_id)
    except ValueError as e:
        raise _err(e)


@router.post("/orders/{order_id}/refire")
async def refire_order(order_id: str, body: RefireRequest):
    try:
        return await orders.refire(order_id, body.note, body.item_ids or None)
    except ValueError as e:
        raise _err(e)


# ── Tickets (stations) ──────────────────────────────────

@router.get("/tickets")
async def get_tickets(station: str | None = None, open_only: bool = True):
    return await orders.list_tickets(station=station, open_only=open_only)


@router.post("/tickets/{ticket_id}/start")
async def start_ticket(ticket_id: str):
    try:
        return await orders.start_ticket(ticket_id)
    except ValueError as e:
        raise _err(e)


@router.post("/tickets/{ticket_id}/complete")
async def complete_ticket(ticket_id: str):
    try:
        return await orders.complete_ticket(ticket_id)
    except ValueError as e:
        raise _err(e)


# ── Analytics ───────────────────────────────────────────

@router.get("/analytics")
async def get_analytics():
    return await analytics.snapshot()


# ── Snapshot for initial WS clients ─────────────────────

@router.get("/state")
async def full_state():
    return {
        "tables": await tables.list_tables(),
        "orders": await orders.list_orders(active_only=False),
        "menu": await menu.list_menu(),
        "staff": await staff.list_staff(active_only=False),
        "assignments": await staff.list_assignments(),
        "tickets": await orders.list_tickets(open_only=False),
        "stations": STATIONS,
        "analytics": await analytics.snapshot(),
        "simulation": simulator.status(),
    }


# ── Simulation (opt-in; drives real domain APIs) ────────

@router.get("/simulation")
async def simulation_status():
    return simulator.status()


@router.post("/simulation/start")
async def simulation_start():
    return await simulator.start()


@router.post("/simulation/stop")
async def simulation_stop():
    return await simulator.stop()
