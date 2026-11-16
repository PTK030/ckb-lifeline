// Stops the devnet. `--wipe` also deletes its chain, so the next start begins
// again from the genesis block.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wipe = process.argv.includes("--wipe");
execFileSync("docker", ["compose", "down", ...(wipe ? ["--volumes"] : [])], { cwd: here, stdio: "inherit" });
rmSync(join(here, "data"), { recursive: true, force: true });
console.log(wipe ? "devnet stopped and wiped" : "devnet stopped (chain kept; --wipe to start over)");
