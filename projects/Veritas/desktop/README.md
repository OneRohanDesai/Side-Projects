# VERITAS Desktop (Tauri)

Phase 7 desktop shell. Rose Petal UI from `../ui` wrapped as a local first appliance.

## Prerequisites

- Rust toolchain
- Node 20+
- System deps for Tauri 2 on Linux (webkitgtk, etc.)

```bash
# install Tauri CLI if needed
cargo install tauri-cli --version "^2"
```

## Dev

```bash
# terminal 1 · control plane
cd ~/Veritas && cargo run -p veritas-api

# terminal 2 · desktop
cd ~/Veritas/desktop
npm install
npm run tauri dev
```

## Build

```bash
cd ~/Veritas/desktop
npm run tauri build
```

Artifacts land under `src-tauri/target/release/bundle/`.

## Notes

- UI is the frozen Rose Petal console (`../ui`)
- API expected at `http://127.0.0.1:7420` (or set `VITE_API_URL`)
- Air gap installs ship offline license files via Enterprise → License
