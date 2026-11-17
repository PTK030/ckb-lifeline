// Starts the local devnet and tells the tools where its nodes are.
//
//   npm run devnet:up      (node devnet/up.mjs)
//
// 1. Makes a self-signed certificate for the four node names (once).
// 2. docker compose up -d.
// 3. Waits until every node has written its address and blocks are coming.
// 4. Writes devnet/data/lifeline.json, which `lifeline --network devnet` reads.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const NODES = {
  "guide-a": { host: "a.guide.test", role: "guide" },
  "guide-b": { host: "b.guide.test", role: "guide" },
  "lifeline-a": { host: "a.lifeline.test", role: "independent" },
  "lifeline-b": { host: "b.lifeline.test", role: "independent" },
};
const RPC = "http://127.0.0.1:8114";

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const compose = (...args) => sh("docker", ["compose", ...args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Certificate: openssl from the PATH, or the one Git for Windows ships.
function openssl() {
  const candidates = ["openssl"];
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      candidates.push(join(base, "Git", "usr", "bin", "openssl.exe"), join(base, "Git", "mingw64", "bin", "openssl.exe"));
    }
  }
  for (const c of candidates) {
    try {
      execFileSync(c, ["version"], { stdio: "ignore" });
      return c;
    } catch {
      // try the next one
    }
  }
  throw new Error("devnet:up needs openssl (on Windows it comes with Git for Windows)");
}

const certs = join(here, "certs");
if (!existsSync(join(certs, "fullchain.pem"))) {
  mkdirSync(certs, { recursive: true });
  const san = Object.values(NODES).map((n) => `DNS:${n.host}`).join(",");
  sh(openssl(), [
    "req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "825",
    "-subj", "/CN=ckb-lifeline devnet", "-addext", `subjectAltName=${san}`,
    "-keyout", join(certs, "privkey.pem"), "-out", join(certs, "fullchain.pem"),
  ], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  console.log("made devnet/certs (self-signed, for the four .test names)");
}

// 2. Up
console.log("starting the devnet...");
compose("up", "-d");

// 3. Addresses and blocks
const addresses = {};
for (const [service] of Object.entries(NODES)) {
  for (let i = 0; ; i++) {
    try {
      addresses[service] = compose("exec", "-T", service, "cat", "/var/lib/ckb/lifeline-address.txt").trim();
      break;
    } catch {
      if (i > 120) throw new Error(`${service} did not start; see: docker compose -f devnet/compose.yaml logs ${service}`);
      await sleep(1000);
    }
  }
}

async function tip() {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "get_tip_block_number", params: [] }),
  });
  return BigInt((await res.json()).result);
}
for (let i = 0; ; i++) {
  try {
    if ((await tip()) >= 20n) break;
  } catch {
    // the RPC is not up yet
  }
  if (i > 360) throw new Error("not 20 blocks after 6 minutes; see: docker compose -f devnet/compose.yaml logs miner");
  await sleep(1000);
}

// 4. Description for the tools
const pick = (role) => Object.entries(NODES).filter(([, n]) => n.role === role).map(([s]) => addresses[s]);
const description = {
  spec: "specs/dev.toml",
  rpc: RPC,
  guide: pick("guide"),
  independent: pick("independent"),
  map: Object.fromEntries(Object.values(NODES).map((n) => [n.host, "127.0.0.1"])),
  referencePattern: "*.guide.test",
};
mkdirSync(join(here, "data"), { recursive: true });
writeFileSync(join(here, "data", "lifeline.json"), JSON.stringify(description, null, 2) + "\n");

console.log(`devnet is up at block ${await tip()}`);
for (const [service, address] of Object.entries(addresses)) console.log(`  ${service.padEnd(11)} ${address}`);
console.log("try: npx lifeline check --network devnet " + addresses["lifeline-a"]);
