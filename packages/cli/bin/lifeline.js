#!/usr/bin/env node
// A fixed entry point, so that `npm ci` can link `lifeline` before the first
// build. The command itself is dist/cli.js (npm run build).
import { existsSync } from "node:fs";

const cli = new URL("../dist/cli.js", import.meta.url);
if (!existsSync(cli)) {
  console.error("lifeline is not built yet: run `npm run build` at the repository root.");
  process.exit(2);
}
await import(cli.href);
