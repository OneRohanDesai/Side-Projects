export type Topic = "game-theory" | "poker" | "geopolitics";
export type PostStatus = "draft" | "published";

export type BlockType =
  | "paragraph"
  | "heading"
  | "quote"
  | "callout"
  | "symbol"
  | "image"
  | "gif"
  | "video"
  | "divider"
  | "code"
  | "list";

export interface Block {
  id: string;
  type: BlockType;
  /** Main text or caption */
  text?: string;
  /** heading level 1-3 */
  level?: 1 | 2 | 3;
  /** callout / symbol accent */
  tone?: "gold" | "ink" | "felt" | "map" | "alert";
  /** media R2 key or external URL */
  src?: string;
  alt?: string;
  /** symbol character(s) */
  glyph?: string;
  /** list items */
  items?: string[];
  /** code language */
  lang?: string;
}

export interface PostRow {
  id: string;
  slug: string;
  topic: Topic;
  title: string;
  excerpt: string;
  cover_key: string | null;
  body_json: string;
  status: PostStatus;
  reading_minutes: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostDTO {
  id: string;
  slug: string;
  topic: Topic;
  title: string;
  excerpt: string;
  coverKey: string | null;
  coverUrl: string | null;
  body: Block[];
  status: PostStatus;
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  PUBLIC_SITE_ORIGIN: string;
}

export const TOPICS: Record<
  Topic,
  { id: Topic; label: string; blurb: string; glyph: string }
> = {
  "game-theory": {
    id: "game-theory",
    label: "Game Theory",
    blurb: "Incentives, equilibrium, and the quiet math of choice.",
    glyph: "◇",
  },
  poker: {
    id: "poker",
    label: "Poker",
    blurb: "Ranges, pressure, and the honest theater of uncertainty.",
    glyph: "♠",
  },
  geopolitics: {
    id: "geopolitics",
    label: "Geopolitics",
    blurb: "Borders, power, and the long weather of nations.",
    glyph: "⌖",
  },
};
