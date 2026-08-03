from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class SeatRequest(BaseModel):
    pax: int = Field(ge=1, le=30)
    notes: str = ""


class OrderItemIn(BaseModel):
    menu_id: str
    qty: int = Field(default=1, ge=1, le=50)
    notes: str = ""


class CreateOrder(BaseModel):
    table_id: str
    waiter_id: Optional[str] = None
    items: list[OrderItemIn]
    notes: str = ""
    guest_count: int = 0


class MenuItemIn(BaseModel):
    name: str
    category: str = "Main"
    price: float = Field(ge=0)
    station: str = "grill"
    prep_secs: int = Field(default=300, ge=30)
    description: str = ""
    available: bool = True
    prep_steps: list[dict] = Field(default_factory=list)


class StaffIn(BaseModel):
    name: str
    role: str  # waiter | expeditor | cook | manager | executive
    station: Optional[str] = None
    pin: str = ""


class AssignTables(BaseModel):
    waiter_id: str
    table_ids: list[str]


class TicketAction(BaseModel):
    ticket_id: str


class RefireRequest(BaseModel):
    note: str = "Remake requested"
    item_ids: list[str] = Field(default_factory=list)  # empty = whole order


class BillClose(BaseModel):
    method: str = "cash"  # cash | card | other
