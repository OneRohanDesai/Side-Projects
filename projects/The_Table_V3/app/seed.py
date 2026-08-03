"""Seed a real restaurant floor: 50 tables, brigade menu, waiters, stations."""

from __future__ import annotations

from app.database import db
from app.services.clock import now_iso

MENU = [
    {
        "id": "m1",
        "name": "Grilled Atlantic Salmon",
        "category": "Mains",
        "price": 42.0,
        "station": "grill",
        "prep_secs": 720,
        "description": "Charred lemon, asparagus, beurre blanc",
        "steps": [
            ("Grill salmon fillet", "grill", 480),
            ("Sauté asparagus", "saute", 180),
            ("Finish beurre blanc", "sauce", 120),
        ],
    },
    {
        "id": "m2",
        "name": "Ribeye Steak 12oz",
        "category": "Mains",
        "price": 58.0,
        "station": "grill",
        "prep_secs": 900,
        "description": "Dry-aged, herb butter, roasted potato",
        "steps": [
            ("Grill ribeye to temp", "grill", 600),
            ("Roast potatoes", "saute", 300),
            ("Herb butter finish", "sauce", 60),
        ],
    },
    {
        "id": "m3",
        "name": "Chicken Milanese",
        "category": "Mains",
        "price": 28.0,
        "station": "fry",
        "prep_secs": 600,
        "description": "Pounded breast, arugula, parmesan",
        "steps": [
            ("Bread & fry chicken", "fry", 420),
            ("Dress salad", "cold", 120),
        ],
    },
    {
        "id": "m4",
        "name": "House Burger",
        "category": "Mains",
        "price": 22.0,
        "station": "grill",
        "prep_secs": 540,
        "description": "Chuck blend, cheddar, brioche, fries",
        "steps": [
            ("Grill patty", "grill", 360),
            ("Fry shoestring fries", "fry", 240),
        ],
    },
    {
        "id": "m5",
        "name": "Mushroom Risotto",
        "category": "Mains",
        "price": 26.0,
        "station": "saute",
        "prep_secs": 900,
        "description": "Porcini, pecorino, truffle oil",
        "steps": [
            ("Cook risotto", "saute", 720),
            ("Finish with pecorino", "sauce", 60),
        ],
    },
    {
        "id": "m6",
        "name": "Pan-Seared Scallops",
        "category": "Mains",
        "price": 38.0,
        "station": "saute",
        "prep_secs": 480,
        "description": "Cauliflower purée, brown butter",
        "steps": [
            ("Sear scallops", "saute", 240),
            ("Cauliflower purée", "sauce", 180),
        ],
    },
    {
        "id": "m7",
        "name": "Caesar Salad",
        "category": "Starters",
        "price": 14.0,
        "station": "cold",
        "prep_secs": 240,
        "description": "Romaine, anchovy dressing, croutons",
        "steps": [("Assemble Caesar", "cold", 240)],
    },
    {
        "id": "m8",
        "name": "Beef Tartare",
        "category": "Starters",
        "price": 19.0,
        "station": "cold",
        "prep_secs": 360,
        "description": "Hand-cut, quail egg, mustard",
        "steps": [("Prep tartare", "cold", 360)],
    },
    {
        "id": "m9",
        "name": "French Onion Soup",
        "category": "Starters",
        "price": 12.0,
        "station": "sauce",
        "prep_secs": 300,
        "description": "Gruyère croute",
        "steps": [
            ("Heat soup & gratin", "sauce", 300),
        ],
    },
    {
        "id": "m10",
        "name": "Calamari Fritti",
        "category": "Starters",
        "price": 16.0,
        "station": "fry",
        "prep_secs": 360,
        "description": "Lemon aioli",
        "steps": [("Fry calamari", "fry", 300), ("Plate aioli", "cold", 60)],
    },
    {
        "id": "m11",
        "name": "Chocolate Fondant",
        "category": "Desserts",
        "price": 14.0,
        "station": "pastry",
        "prep_secs": 720,
        "description": "Molten center, vanilla ice cream",
        "steps": [("Bake fondant", "pastry", 600), ("Plate with ice cream", "pastry", 60)],
    },
    {
        "id": "m12",
        "name": "Crème Brûlée",
        "category": "Desserts",
        "price": 12.0,
        "station": "pastry",
        "prep_secs": 180,
        "description": "Madagascar vanilla, torched sugar",
        "steps": [("Torch & plate", "pastry", 180)],
    },
    {
        "id": "m13",
        "name": "Espresso",
        "category": "Drinks",
        "price": 4.0,
        "station": "beverage",
        "prep_secs": 90,
        "description": "Double shot",
        "steps": [("Pull espresso", "beverage", 90)],
    },
    {
        "id": "m14",
        "name": "House Red Wine Glass",
        "category": "Drinks",
        "price": 11.0,
        "station": "beverage",
        "prep_secs": 60,
        "description": "Cabernet Sauvignon",
        "steps": [("Pour wine", "beverage", 60)],
    },
    {
        "id": "m15",
        "name": "Sparkling Water",
        "category": "Drinks",
        "price": 5.0,
        "station": "beverage",
        "prep_secs": 30,
        "description": "750ml",
        "steps": [("Serve water", "beverage", 30)],
    },
    {
        "id": "m16",
        "name": "Fish & Chips",
        "category": "Mains",
        "price": 24.0,
        "station": "fry",
        "prep_secs": 720,
        "description": "Beer batter, mushy peas, tartar",
        "steps": [
            ("Fry fish", "fry", 480),
            ("Fry chips", "fry", 300),
            ("Plate tartar", "cold", 60),
        ],
    },
]

WAITERS = [
    ("W1", "Alice"),
    ("W2", "Bob"),
    ("W3", "Charlie"),
    ("W4", "Diana"),
    ("W5", "Eve"),
    ("W6", "Frank"),
    ("W7", "Grace"),
    ("W8", "Hank"),
    ("W9", "Ivy"),
    ("W10", "Jack"),
    ("W11", "Kate"),
    ("W12", "Leo"),
    ("W13", "Mia"),
    ("W14", "Noah"),
    ("W15", "Olivia"),
]

COOKS = [
    ("C1", "Grill Lead", "grill"),
    ("C2", "Sauté Lead", "saute"),
    ("C3", "Sauce Lead", "sauce"),
    ("C4", "Fry Lead", "fry"),
    ("C5", "Cold Lead", "cold"),
    ("C6", "Pastry Lead", "pastry"),
    ("C7", "Bar Lead", "beverage"),
]

# Table layout: mix of 2/4/6/8 tops across zones
TABLE_SPEC = []
for i in range(1, 51):
    if i <= 12:
        seats, zone = (2 if i % 2 else 4), "patio"
    elif i <= 30:
        seats, zone = (4 if i % 3 else 6), "main"
    elif i <= 42:
        seats, zone = (2 if i % 2 else 4), "bar"
    else:
        seats, zone = (6 if i % 2 else 8), "private"
    TABLE_SPEC.append((f"t{i:02d}", f"Table {i}", seats, zone))


async def seed_if_empty() -> bool:
    row = await db.fetchone("SELECT COUNT(*) AS n FROM tables")
    if row and row["n"] > 0:
        return False

    for tid, number, seats, zone in TABLE_SPEC:
        await db.execute(
            "INSERT INTO tables (id, number, seats, zone, status, pax) VALUES (?,?,?,?, 'vacant', 0)",
            (tid, number, seats, zone),
        )

    for wid, name in WAITERS:
        await db.execute(
            "INSERT INTO staff (id, name, role, active) VALUES (?,?, 'waiter', 1)",
            (wid, name),
        )

    for cid, name, station in COOKS:
        await db.execute(
            "INSERT INTO staff (id, name, role, station, active) VALUES (?,?, 'cook', ?, 1)",
            (cid, name, station),
        )

    await db.execute(
        "INSERT INTO staff (id, name, role, active) VALUES ('E1', 'Chef de Cuisine', 'executive', 1)"
    )
    await db.execute(
        "INSERT INTO staff (id, name, role, active) VALUES ('H1', 'Head Expeditor', 'expeditor', 1)"
    )
    await db.execute(
        "INSERT INTO staff (id, name, role, active) VALUES ('M1', 'Floor Manager', 'manager', 1)"
    )

    # Assign ~3 tables per waiter
    for i, (wid, _) in enumerate(WAITERS):
        for j in range(3):
            tnum = i * 3 + j + 1
            if tnum > 50:
                break
            await db.execute(
                "INSERT INTO assignments (waiter_id, table_id) VALUES (?,?)",
                (wid, f"t{tnum:02d}"),
            )
    # leftover tables 46-50 → W15 already has 43-45; assign extras to W1-W5
    for extra, wid in enumerate(["W1", "W2", "W3", "W4", "W5"], start=46):
        await db.execute(
            "INSERT OR IGNORE INTO assignments (waiter_id, table_id) VALUES (?,?)",
            (wid, f"t{extra:02d}"),
        )

    for sort, dish in enumerate(MENU):
        await db.execute(
            """INSERT INTO menu_items
               (id, name, category, price, station, prep_secs, available, description, sort_order)
               VALUES (?,?,?,?,?,?,1,?,?)""",
            (
                dish["id"],
                dish["name"],
                dish["category"],
                dish["price"],
                dish["station"],
                dish["prep_secs"],
                dish["description"],
                sort,
            ),
        )
        for step_i, (task, station, duration) in enumerate(dish["steps"]):
            await db.execute(
                "INSERT INTO prep_steps (menu_id, task, station, duration, step_order) VALUES (?,?,?,?,?)",
                (dish["id"], task, station, duration, step_i),
            )

    await db.execute(
        "INSERT INTO events (kind, payload, created_at) VALUES ('seed', '{}', ?)",
        (now_iso(),),
    )
    await db.commit()
    return True
