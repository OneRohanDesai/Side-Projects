"""
Just Orange — AWS Lambda handler
Cheap defaults: gpt-4o-mini, low max_tokens, DynamoDB cache, CORS.
"""
import json
import os
import hashlib
import time
import re
import boto3
import urllib3
from urllib3.util.retry import Retry

MODEL = os.environ.get("JO_MODEL", "gpt-4o-mini")
MAX_TOKENS = int(os.environ.get("JO_MAX_TOKENS", "180"))
CACHE_TTL = int(os.environ.get("JO_CACHE_TTL", "86400"))
TABLE_NAME = os.environ.get("JO_CACHE_TABLE", "JustOrangeCache")
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

http = urllib3.PoolManager(
    retries=Retry(total=3, backoff_factor=0.4, status_forcelist=[429, 500, 502, 503, 504]),
    timeout=urllib3.Timeout(connect=5.0, read=25.0),
)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def get_cache_key(payload: dict) -> str:
    key_str = "|".join(
        [
            _norm(payload.get("ingredients", "")),
            _norm(payload.get("taste", "mild")),
            str(int(payload.get("prep", 0))),
            str(int(payload.get("eat", 0))),
            _norm(payload.get("allergens", "")),
            _norm(payload.get("exclusions", "")),
        ]
    )
    return hashlib.sha256(key_str.encode()).hexdigest()


def get_cached_recipe(cache_key: str):
    try:
        resp = table.get_item(Key={"hash": cache_key})
        item = resp.get("Item")
        if item and int(item.get("expires", 0)) > int(time.time()):
            print("Cache HIT")
            return item["recipe"]
    except Exception as e:
        print(f"Cache read error: {e}")
    return None


def cache_recipe(cache_key: str, recipe: str):
    try:
        table.put_item(
            Item={
                "hash": cache_key,
                "recipe": recipe,
                "expires": int(time.time()) + CACHE_TTL,
            }
        )
        print("Recipe cached")
    except Exception as e:
        print(f"Cache write error: {e}")


def generate_recipe(payload: dict) -> str:
    ingredients = payload["ingredients"].strip()
    taste = (payload.get("taste") or "mild").strip() or "mild"
    prep = int(payload["prep"])
    eat = int(payload["eat"])
    allergens = (payload.get("allergens") or "").strip()
    exclusions = (payload.get("exclusions") or "").strip()

    # Hard caps keep spend predictable
    prep = max(1, min(prep, 120))
    eat = max(1, min(eat, 180))
    if len(ingredients) > 500:
        ingredients = ingredients[:500]

    prompt = f"""Using only these exact ingredients: {ingredients}.
Create one very short {taste} recipe.
Prep ≤{prep}min, ready to eat ≤{eat}min.
Never add anything else.
{"Avoid allergens: " + allergens + "." if allergens else ""}
{"Never use: " + exclusions + "." if exclusions else ""}
Strict format only:
TITLE
Ingredients (quantities):
- item (qty)
Steps:
1. First step.
2. Second step.
3. Serve."""

    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.3,
    }

    print(f"Calling OpenAI… prompt_len={len(prompt)} model={MODEL}")

    response = http.request(
        "POST",
        "https://api.openai.com/v1/chat/completions",
        body=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
    )

    if response.status != 200:
        error_msg = response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI error {response.status}: {error_msg[:400]}")

    data = json.loads(response.data.decode("utf-8"))
    recipe = data["choices"][0]["message"]["content"].strip()
    print(f"Success — recipe_len={len(recipe)}")
    return recipe


def _response(status: int, body: dict):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    print("Request received")

    if event.get("httpMethod") == "OPTIONS" or event.get("requestContext", {}).get(
        "http", {}
    ).get("method") == "OPTIONS":
        return _response(200, {})

    try:
        raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            import base64

            raw = base64.b64decode(raw).decode("utf-8")
        body = json.loads(raw) if isinstance(raw, str) else raw

        if not body.get("ingredients") or body.get("prep") is None or body.get("eat") is None:
            return _response(400, {"error": "Missing fields: ingredients, prep, eat"})

        cache_key = get_cache_key(body)
        cached = get_cached_recipe(cache_key)
        if cached:
            return _response(200, {"recipe": cached, "source": "cache"})

        recipe = generate_recipe(body)
        cache_recipe(cache_key, recipe)
        return _response(200, {"recipe": recipe, "source": "openai"})

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()
        return _response(500, {"error": "Service unavailable — try again"})
