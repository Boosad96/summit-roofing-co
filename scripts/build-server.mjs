/**
 * Bundle the server entry (`src/server/index.ts`) into a single
 * self-contained ES module at `dist/server/index.js` — the Cloudflare
 * Worker entry point Whop Websites deploys (see `wrangler.jsonc`).
 *
 * ESM output is deliberate: the Workers runtime loads the entry as a
 * module and calls its exported `fetch` handler. A `package.json` pinning
 * `{"type":"module"}` is written next to it so the bundle is also loaded
 * as an ES module when run under Node for local development.
 *
 * The bundle has no Node-only top-level imports: Node APIs (`node:http`,
 * `node:fs`, ...) are only imported dynamically inside the local
 * development adapter, which never runs in the Workers runtime.
 *
 * Run: `node scripts/build-server.mjs` (also part of `npm run build`).
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
    entryPoints: [path.join(root, "src/server/index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: path.join(root, "dist/server/index.js"),
    logLevel: "info",
});

// The project root is `"type": "module"`, so pin the server directory to
// ESM or Node would parse the bundle as CommonJS.
writeFileSync(
    path.join(root, "dist/server/package.json"),
    JSON.stringify({ type: "module" }, null, 2) + "\n",
);
