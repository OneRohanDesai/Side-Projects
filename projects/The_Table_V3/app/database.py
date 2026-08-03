"""SQLite persistence — local, durable, zero-internet."""

from __future__ import annotations

import json
import aiosqlite
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from app.config import DATA_DIR, DB_PATH

_SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tables (
    id          TEXT PRIMARY KEY,
    number      TEXT NOT NULL UNIQUE,
    seats       INTEGER NOT NULL,
    zone        TEXT NOT NULL DEFAULT 'main',
    status      TEXT NOT NULL DEFAULT 'vacant',
    pax         INTEGER NOT NULL DEFAULT 0,
    occupied_at TEXT,
    notes       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS staff (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    role     TEXT NOT NULL,
    pin      TEXT DEFAULT '',
    active   INTEGER NOT NULL DEFAULT 1,
    station  TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
    waiter_id TEXT NOT NULL,
    table_id  TEXT NOT NULL,
    PRIMARY KEY (waiter_id, table_id),
    FOREIGN KEY (waiter_id) REFERENCES staff(id),
    FOREIGN KEY (table_id)  REFERENCES tables(id)
);

CREATE TABLE IF NOT EXISTS menu_items (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       REAL NOT NULL,
    station     TEXT NOT NULL,
    prep_secs   INTEGER NOT NULL DEFAULT 300,
    available   INTEGER NOT NULL DEFAULT 1,
    description TEXT DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prep_steps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id   TEXT NOT NULL,
    task      TEXT NOT NULL,
    station   TEXT NOT NULL,
    duration  INTEGER NOT NULL,
    step_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    table_id      TEXT NOT NULL,
    waiter_id     TEXT,
    status        TEXT NOT NULL DEFAULT 'submitted',
    priority      INTEGER NOT NULL DEFAULT 0,
    notes         TEXT DEFAULT '',
    guest_count   INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL,
    fired_at      TEXT,
    ready_at      TEXT,
    qc_at         TEXT,
    pickup_at     TEXT,
    delivered_at  TEXT,
    cancelled_at  TEXT,
    delivered_by  TEXT,
    refire_note   TEXT,
    FOREIGN KEY (table_id) REFERENCES tables(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL,
    menu_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    price       REAL NOT NULL,
    qty         INTEGER NOT NULL DEFAULT 1,
    station     TEXT NOT NULL,
    notes       TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL,
    item_id     TEXT NOT NULL,
    table_id    TEXT NOT NULL,
    dish_name   TEXT NOT NULL,
    task        TEXT NOT NULL,
    station     TEXT NOT NULL,
    duration    INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    started_at  TEXT,
    completed_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id)  REFERENCES order_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_tickets_station ON tickets(station, status);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
"""


class Database:
    def __init__(self, path: str | None = None):
        self.path = str(path or DB_PATH)
        self._db: Optional[aiosqlite.Connection] = None

    async def connect(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self.path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(_SCHEMA)
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if not self._db:
            raise RuntimeError("Database not connected")
        return self._db

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        try:
            yield self.conn
            await self.conn.commit()
        except Exception:
            await self.conn.rollback()
            raise

    async def execute(self, sql: str, params: tuple | list = ()) -> aiosqlite.Cursor:
        return await self.conn.execute(sql, params)

    async def executemany(self, sql: str, seq: list) -> aiosqlite.Cursor:
        return await self.conn.executemany(sql, seq)

    async def fetchone(self, sql: str, params: tuple | list = ()) -> Optional[dict]:
        cur = await self.conn.execute(sql, params)
        row = await cur.fetchone()
        return dict(row) if row else None

    async def fetchall(self, sql: str, params: tuple | list = ()) -> list[dict]:
        cur = await self.conn.execute(sql, params)
        rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def commit(self) -> None:
        await self.conn.commit()


db = Database()


def row_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)
