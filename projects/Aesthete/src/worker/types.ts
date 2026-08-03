export type Env = {
  CACHE: KVNamespace;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  SPOTIFY_OWNER_REFRESH?: string;
  APP_URL: string;
  SPOTIFY_REDIRECT_URI: string;
};

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  displayName: string;
  product: string;
};

export type TrackItem = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  durationMs: number;
  explicit: boolean;
};

export type PlaylistSummary = {
  id: string;
  uri: string;
  name: string;
  description: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
  color: string | null;
};

export type PlaylistDetail = PlaylistSummary & {
  tracks: TrackItem[];
  syncedAt: string;
};

export type Catalog = {
  playlists: PlaylistSummary[];
  ownerName: string;
  ownerId: string;
  syncedAt: string;
  totalTracks: number;
};
