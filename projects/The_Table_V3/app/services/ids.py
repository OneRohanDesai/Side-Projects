import secrets
import time


def new_id(prefix: str = "") -> str:
    """Short unique id: prefix + base36 time + random."""
    t = int(time.time() * 1000)
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while t:
        t, r = divmod(t, 36)
        out.append(alphabet[r])
    stamp = "".join(reversed(out)) or "0"
    return f"{prefix}{stamp}{secrets.token_hex(2)}"
