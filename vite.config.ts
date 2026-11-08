import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { whop } from '@whop/cli/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Whop Websites layout: static assets in `dist/client`, the server bundle in
// `dist/server` (see `scripts/build-server.mjs`). The `whop()` plugin packs
// `dist/` into the archive `whop apps deploy` uploads. `whop apps init`
// (run at deploy time) links this directory to the app via `whop.app.json`.
export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), react(), whop()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  environments: {
    // Pin the environment output directories so `vite build` emits the
    // layout the `whop()` plugin packs: the client straight into
    // `dist/client`, and the worker bundle into `dist/ssr` (a scratch
    // directory -- the deployed server entry is built by
    // `scripts/build-server.mjs` into `dist/server`). Without these the
    // Cloudflare plugin nests both under `dist/client/client` and
    // `dist/client/ssr`, and the packed archive ends up without a server.
    client: { build: { outDir: 'dist/client' } },
    ssr: { build: { outDir: 'dist/ssr' } },
  },
  server: {
    // Local dev: the Vite dev server serves the client; /api goes to the
    // bundled server running on :3000 (`npm run dev:server`).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
