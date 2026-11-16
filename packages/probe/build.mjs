// Bundles the probe page: dist/page/index.html + probe.js for the driver, and
// dist/page/probe-standalone.html, the same page in one file to open by hand
// (it still needs the COOP/COEP headers, see docs/verify.md).
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const out = new URL("./dist/page/", import.meta.url);
await mkdir(out, { recursive: true });

const result = await build({
  entryPoints: [new URL("./src/page.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  logLevel: "warning",
});
const js = result.outputFiles[0].text;
const html = await readFile(new URL("./src/page.html", import.meta.url), "utf8");

await writeFile(new URL("probe.js", out), js);
await writeFile(new URL("index.html", out), html);
await writeFile(
  new URL("probe-standalone.html", out),
  html.replace('<script type="module" src="./probe.js"></script>', () => `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`),
);
console.log(`probe page: ${(js.length / 1e6).toFixed(1)} MB`);
