"""
See1Right V1 — All-in-One (single file)

What this includes (in one file):
- FastAPI API (/health, /dashboard/summaries GET+POST)
- Reddit miner (read-only) that pulls new posts from selected subreddits
- SQLite persistence (so data survives restarts)
- CLI entrypoint to run API or run miner

Prereqs (PowerShell, with venv active):
  python -m pip install fastapi uvicorn requests python-dotenv praw

Files you need in the same folder as this script:
  .env  (credentials + config)

Run (two PowerShell windows):
  # Window A (API)
  python see1right_v1_allinone.py api

  # Window B (Miner)
  python see1right_v1_allinone.py mine

Then open:
  http://127.0.0.1:8000/health
  http://127.0.0.1:8000/dashboard/summaries
"""

import os
import sys
import uuid
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
import praw
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# -----------------------------
# CONFIG (.env)
# -----------------------------
load_dotenv()

APP_TITLE = os.getenv("APP_TITLE", "See1Right V1 API")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

DB_PATH = os.getenv("DB_PATH", "see1right_v1.sqlite3")

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "see1right_dev:v1")

SUBREDDITS = [s.strip() for s in os.getenv(
    "SUBREDDITS",
    "see1right_dev,virtualreality,oculus,augmentedreality,accessibility,eyestrain,optometry"
).split(",") if s.strip()]

POST_LIMIT = int(os.getenv("POST_LIMIT", "5"))

# If you run API and miner on the same machine, keep this as localhost
API_BASE = os.getenv("API_BASE", f"http://{HOST}:{PORT}")


# -----------------------------
# UTILS
# -----------------------------
def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -----------------------------
# SQLITE (persistent storage)
# -----------------------------
def db_connect() -> sqlite3.Connection:
    # check_same_thread=False is fine for this small V1
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def db_init() -> None:
    conn = db_connect()
    try:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            category TEXT,
            headline TEXT,
            created_at TEXT,
            source TEXT,
            permalink TEXT
        )
        """)
        conn.commit()
    finally:
        conn.close()

def db_insert_event(e: Dict[str, Any]) -> None:
    conn = db_connect()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO events (id, category, headline, created_at, source, permalink) VALUES (?, ?, ?, ?, ?, ?)",
            (
                e.get("id"),
                e.get("category"),
                e.get("headline"),
                e.get("created_at"),
                e.get("source"),
                e.get("permalink"),
            ),
        )
        conn.commit()
    finally:
        conn.close()

def db_list_events(limit: int = 50) -> List[Dict[str, Any]]:
    conn = db_connect()
    try:
        rows = conn.execute(
            "SELECT id, category, headline, created_at, source, permalink FROM events ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# -----------------------------
# FASTAPI
# -----------------------------
db_init()

app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/dashboard/summaries")
def get_summaries():
    return db_list_events(limit=50)

@app.post("/dashboard/summaries")
def add_summary(data: Dict[str, Any]):
    # Minimal validation for V1
    if "id" not in data:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = now_utc_iso()

    db_insert_event(data)
    return {"status": "stored"}


# -----------------------------
# REDDIT MINER
# -----------------------------
def reddit_client() -> praw.Reddit:
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        raise RuntimeError("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET in .env")
    return praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=REDDIT_USER_AGENT,
    )

def fetch_new_posts(subreddit_name: str, limit: int) -> List[Any]:
    r = reddit_client()
    return list(r.subreddit(subreddit_name).new(limit=limit))

def summarize_post(post: Any) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "category": getattr(post.subreddit, "display_name", "unknown"),
        "headline": getattr(post, "title", ""),
        "created_at": now_utc_iso(),
        "source": "reddit",
        "permalink": f"https://www.reddit.com{getattr(post, 'permalink', '')}",
    }

def post_to_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{API_BASE}/dashboard/summaries"
    resp = requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()

def run_miner_once() -> None:
    for sub in SUBREDDITS:
        try:
            posts = fetch_new_posts(sub, POST_LIMIT)
        except Exception as e:
            print(f"[miner] subreddit fetch failed: {sub} :: {e}")
            continue

        for p in posts:
            try:
                payload = summarize_post(p)
                post_to_api(payload)
                print(f"stored: [{payload['category']}] {payload['headline']}")
            except Exception as e:
                print(f"[miner] store failed: {sub} :: {e}")


# -----------------------------
# CLI ENTRYPOINT
# -----------------------------
def print_env_template() -> None:
    print(r"""
Create a .env file in the same folder as this script with:

APP_TITLE=See1Right V1 API
HOST=127.0.0.1
PORT=8000
API_BASE=http://127.0.0.1:8000
DB_PATH=see1right_v1.sqlite3

REDDIT_CLIENT_ID=PASTE_YOURS_HERE
REDDIT_CLIENT_SECRET=PASTE_YOURS_HERE
REDDIT_USER_AGENT=see1right_dev:v1 by u/YOUR_REDDIT_USERNAME

SUBREDDITS=see1right_dev,virtualreality,oculus,augmentedreality,accessibility,eyestrain,optometry
POST_LIMIT=5
""".strip())

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python see1right_v1_allinone.py api | mine | env")
        raise SystemExit(1)

    mode = sys.argv[1].lower().strip()

    if mode == "env":
        print_env_template()
        return

    if mode == "mine":
        run_miner_once()
        return

    if mode == "api":
        import uvicorn
        # Uvicorn needs module:app reference for reload to work reliably
        uvicorn.run("see1right_v1_allinone:app", host=HOST, port=PORT, reload=True)
        return

    print("Unknown mode. Use: api | mine | env")
    raise SystemExit(1)

if __name__ == "__main__":
    main()
