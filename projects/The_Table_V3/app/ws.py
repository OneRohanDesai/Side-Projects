"""WebSocket hub — push live state to every tablet on the LAN."""

from __future__ import annotations

import json
from typing import Any, Set

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, event: str, data: Any = None) -> None:
        if not self._clients:
            return
        payload = json.dumps({"event": event, "data": data}, ensure_ascii=False, default=str)
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._clients)


hub = Hub()
