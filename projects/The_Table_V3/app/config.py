from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "thetable.db"
FRONTEND_DIR = ROOT / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"
SIMULATION_DIR = ROOT / "simulation"

# Kitchen stations (real brigade roles)
STATIONS = [
    {"id": "grill", "name": "Grill", "color": "#ef4444"},
    {"id": "saute", "name": "Sauté", "color": "#f59e0b"},
    {"id": "sauce", "name": "Sauce", "color": "#8b5cf6"},
    {"id": "fry", "name": "Fry", "color": "#f97316"},
    {"id": "cold", "name": "Cold / Garde Manger", "color": "#22c55e"},
    {"id": "pastry", "name": "Pastry", "color": "#ec4899"},
    {"id": "beverage", "name": "Beverage", "color": "#06b6d4"},
]

# Order lifecycle (staff-driven, never simulated)
ORDER_STATUSES = (
    "submitted",        # waiter placed
    "in_kitchen",       # expeditor fired; stations working tickets
    "ready",            # all tickets done; waiting QC
    "ready_for_pickup", # QC passed; waiter can take
    "delivering",       # waiter en route
    "delivered",        # food at table
    "cancelled",
)

TABLE_STATUSES = ("vacant", "occupied", "dirty", "reserved")

HOST = "0.0.0.0"
PORT = 8000
