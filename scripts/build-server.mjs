/**
 * Bundle the server entry (`src/server/index.ts`) — including Express — into
 * a single self-contained file at `dist/server/index.js`, so the deployed
 * site only needs `node dist/server/index.js` to run.
 *
 * CJS output is deliberate: Express's dependency tree uses dynamic
 * `require()` calls that esbuild's ESM output cannot represent. The bundle
 * is written as `dist/server/index.js` with a local `package.json` pinning
 * `{"type":"commonjs"}` next to it, because the project root is
 * `"type": "module"` and Whop hosting runs `dist/server/index.js`.
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
  format: "cjs",
  outfile: path.join(root, "dist/server/index.js"),
  logLevel: "info",
});

// The project root is `"type": "module"`, so pin the server directory to
// CommonJS or Node would parse the CJS bundle as ESM.
writeFileSync(
  path.join(root, "dist/server/package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
);
