import react from '@vitejs/plugin-react'
import { whop } from '@whop/cli/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Whop Websites layout: static assets in `dist/client`, the server bundle in
// `dist/server` (see `scripts/build-server.mjs`). The `whop()` plugin packs
// `dist/` into the archive `whop apps deploy` uploads. `whop apps init`
// (run at deploy time) links this directory to the app via `whop.app.json`.
export default defineConfig({
  plugins: [react(), whop()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    // Local dev: the Vite dev server serves the client; /api goes to the
    // bundled server running on :3000 (`npm run dev:server`).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
