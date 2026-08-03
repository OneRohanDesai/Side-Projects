import { api } from "./api";
import type { SpotifyPlayer, SpotifyState } from "../types";

let sdkPromise: Promise<void> | null = null;

export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="spotify-player"]');
    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      if (window.Spotify) resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export type PlayerHandlers = {
  onReady: (deviceId: string) => void;
  onNotReady?: () => void;
  onState: (state: SpotifyState | null) => void;
  onError?: (message: string) => void;
};

export async function createPlayer(
  handlers: PlayerHandlers,
  volume = 0.7,
): Promise<SpotifyPlayer> {
  await loadSpotifySdk();

  const player = new window.Spotify.Player({
    name: "Aesthete",
    getOAuthToken: async (cb) => {
      try {
        const { access_token } = await api.token();
        cb(access_token);
      } catch {
        handlers.onError?.("Session expired — reconnect Spotify.");
      }
    },
    volume,
  });

  player.addListener("ready", (({ device_id }: { device_id: string }) => {
    handlers.onReady(device_id);
  }) as never);

  player.addListener("not_ready", (() => {
    handlers.onNotReady?.();
  }) as never);

  player.addListener("player_state_changed", ((state: SpotifyState | null) => {
    handlers.onState(state);
  }) as never);

  player.addListener("initialization_error", (({ message }: { message: string }) => {
    handlers.onError?.(message);
  }) as never);

  player.addListener("authentication_error", (({ message }: { message: string }) => {
    handlers.onError?.(message);
  }) as never);

  player.addListener("account_error", (({ message }: { message: string }) => {
    handlers.onError?.(message || "Premium required for browser playback.");
  }) as never);

  player.addListener("playback_error", (({ message }: { message: string }) => {
    handlers.onError?.(message);
  }) as never);

  const ok = await player.connect();
  if (!ok) throw new Error("Could not connect Aesthete player");
  return player;
}
