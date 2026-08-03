from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from api.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from api import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    # seed products if empty
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM products")).scalar() or 0
        if count == 0:
            conn.execute(
                text(
                    "INSERT INTO products (sku, name, price_cents, stock) VALUES "
                    "('NIM-001', 'Nimbus Starter', 999, 100),"
                    "('NIM-002', 'Nimbus Pro', 2999, 50),"
                    "('NIM-003', 'Nimbus Edge', 4999, 25)"
                )
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
