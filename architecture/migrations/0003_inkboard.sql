-- Inkboard tables and the existing post, moved from inkboard-blogs.
CREATE TABLE IF NOT EXISTS posts (
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

CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  post_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT INTO posts (id, slug, topic, title, excerpt, cover_key, body_json, status, reading_minutes, created_at, updated_at, published_at)
VALUES ('c838d848-9cf3-44fc-acae-7fd5553e51d1', 'opening-the-ledger', 'poker', 'Opening the ledger', 'A first soft note.', NULL, '[{"id":"1","type":"paragraph","text":"Hello"}]', 'published', 1, '2026-08-04T16:32:08.278Z', '2026-08-05T07:17:13.637Z', '2026-08-04T16:32:08.278Z');
