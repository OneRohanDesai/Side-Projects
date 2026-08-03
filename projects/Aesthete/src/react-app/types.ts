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
  empty?: boolean;
  playlists: PlaylistSummary[];
  ownerName?: string;
  ownerId?: string;
  syncedAt?: string;
  totalTracks?: number;
  message?: string;
};

export type AuthUser = {
  id: string;
  displayName: string;
  product: string;
  isPremium: boolean;
};

export type AuthState = {
  authenticated: boolean;
  user?: AuthUser;
};

export type QueueItem = TrackItem & {
  playlistId: string;
  playlistName: string;
};

export type PlayerSnapshot = {
  paused: boolean;
  position: number;
  duration: number;
  track: TrackItem | null;
  playlistId: string | null;
};

export type FocusConfig = {
  minutes: number;
  endsAt: number | null;
  active: boolean;
};

export type View =
  | { kind: "gallery" }
  | { kind: "room"; playlistId: string }
  | { kind: "cinema" }
  | { kind: "studio" };

export type CuratedResponse = {
  playlistIds: string[];
  playlists: PlaylistSummary[];
  ownerId?: string;
  ownerName?: string;
  updatedAt?: string;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

export type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: never) => void) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<SpotifyState | null>;
  setVolume: (v: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  activateElement: () => Promise<void>;
};

export type SpotifyWebTrack = {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
};

export type SpotifyState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyWebTrack;
    previous_tracks?: SpotifyWebTrack[];
    next_tracks?: SpotifyWebTrack[];
  };
};
