CREATE TABLE IF NOT EXISTS plates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  era TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('man-made', 'natural')),
  place TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  tone TEXT NOT NULL DEFAULT '#b56a45',
  image_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plates_year ON plates(year);
CREATE INDEX IF NOT EXISTS idx_plates_kind ON plates(kind);
CREATE INDEX IF NOT EXISTS idx_plates_era ON plates(era);
