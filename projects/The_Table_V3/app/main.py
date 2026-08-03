"""The Table — restaurant operations OS.

LAN-only. Real staff actions by default.
Optional medium-pace simulation drives the same APIs when enabled.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.config import FRONTEND_DIR, ROOT, STATIC_DIR
from app.database import db
from app.routers import api
from app.seed import seed_if_empty
from app.services.simulation import simulator
from app.ws import hub

SIM_DIR = ROOT / "simulation"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    seeded = await seed_if_empty()
    if seeded:
        print("[the-table] Seeded floor, menu, and staff")
    print(f"[the-table] v{__version__} ready — open http://0.0.0.0:8000")
    print("[the-table] Simulation page: /simulation (off until you click Run)")
    yield
    await simulator.stop()
    await db.close()


app = FastAPI(
    title="The Table",
    description="Zero-internet restaurant operations OS",
    version=__version__,
    lifespan=lifespan,
)

app.include_router(api.router)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _page(name: str) -> FileResponse:
    path = FRONTEND_DIR / name
    if not path.exists():
        path = FRONTEND_DIR / "index.html"
    return FileResponse(path)


@app.get("/")
async def hub_page():
    return _page("index.html")


@app.get("/floor")
async def floor_page():
    return _page("floor.html")


@app.get("/waiter")
async def waiter_page():
    return _page("waiter.html")


@app.get("/expeditor")
async def expeditor_page():
    return _page("expeditor.html")


@app.get("/station")
async def station_page():
    return _page("station.html")


@app.get("/executive")
async def executive_page():
    return _page("executive.html")


@app.get("/simulation")
@app.get("/simulation/")
async def simulation_page():
    path = SIM_DIR / "index.html"
    if path.exists():
        return FileResponse(path)
    return _page("index.html")


# Legacy redirects (old bookmarks)
@app.get("/head_chef")
async def legacy_head():
    return _page("expeditor.html")


@app.get("/deputy_chef")
async def legacy_deputy():
    return _page("expeditor.html")


@app.get("/sub_chef")
async def legacy_sub():
    return _page("station.html")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        from app.services import analytics, menu, orders, staff, tables
        from app.config import STATIONS

        snapshot = {
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
        await ws.send_json({"event": "snapshot", "data": snapshot})

        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_json({"event": "pong", "data": None})
    except WebSocketDisconnect:
        hub.disconnect(ws)
    except Exception:
        hub.disconnect(ws)
