-- Allow geography topic (SQLite: rebuild posts table to widen CHECK)
PRAGMA foreign_keys = OFF;

CREATE TABLE posts_new (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL CHECK (topic IN ('game-theory', 'poker', 'geopolitics', 'geography')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  cover_key TEXT,
  body_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  reading_minutes INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

INSERT INTO posts_new
  (id, slug, topic, title, excerpt, cover_key, body_json, status, reading_minutes, created_at, updated_at, published_at)
SELECT
  id, slug, topic, title, excerpt, cover_key, body_json, status, reading_minutes, created_at, updated_at, published_at
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);

PRAGMA foreign_keys = ON;
