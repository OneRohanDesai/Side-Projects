import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [
    // Self-signed cert so local Spotify redirect can use https://localhost:5173/...
    basicSsl({
      name: "aesthete",
      domains: ["localhost"],
    }),
    react(),
    cloudflare({
      // Avoid ECONNREFUSED when inspector ports clash with other local tooling
      inspectorPort: false,
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    https: true,
    host: "localhost",
  },
});
