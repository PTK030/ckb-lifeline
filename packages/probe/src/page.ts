// The probe page: the official CKB light client (WASM), started with exactly
// the peers it is given, sampled every few seconds. The driver injects a
// request and reads events from the console; opened by hand, the page shows a
// form and the same readings.

import { LightClient, randomSecretKey } from "@nervosnetwork/ckb-light-client-js";
import { EVENT_PREFIX, type Network, type PeerSample, type ProbeEvent, type ProbeRequest } from "./protocol.js";

declare global {
  interface Window {
    __LIFELINE_REQUEST__?: ProbeRequest;
    __LIFELINE_EVENTS__: ProbeEvent[];
  }
}

const startedAt = performance.now();
const elapsed = () => Math.round(performance.now() - startedAt);
window.__LIFELINE_EVENTS__ = [];

function emit(event: ProbeEvent) {
  window.__LIFELINE_EVENTS__.push(event);
  console.log(EVENT_PREFIX + JSON.stringify(event));
  render(event);
}

window.addEventListener("error", (e) => emit({ kind: "error", t: elapsed(), message: String(e.message) }));
window.addEventListener("unhandledrejection", (e) => emit({ kind: "error", t: elapsed(), message: String(e.reason) }));

function config(request: ProbeRequest): string {
  const chain = request.network === "devnet" ? "dev" : request.network;
  const bootnodes = request.bootnodes.map((b) => `  "${b}"`).join(",\n");
  return `chain = "${chain}"

[store]
path = "data/store"

[network]
path = "data/network"
listen_addresses = ["/ip4/0.0.0.0/tcp/8110"]
bootnodes = [
${bootnodes}
]
max_peers = 125
max_outbound_peers = ${request.maxOutboundPeers}
ping_interval_secs = 120
ping_timeout_secs = 1200
connect_outbound_interval_secs = 15
upnp = false
discovery_local_address = false
bootnode_mode = false

# Required by the config format; a light client in a browser serves no RPC.
[rpc]
listen_address = "127.0.0.1:9000"
`;
}

function setting(request: ProbeRequest) {
  const cfg = config(request);
  switch (request.network) {
    case "mainnet":
      return { type: "MainNet" as const, config: cfg };
    case "testnet":
      return { type: "TestNet" as const, config: cfg };
    case "devnet":
      if (!request.devnetSpec) throw new Error("a devnet needs its chain spec");
      return { type: "DevNet" as const, spec: request.devnetSpec, config: cfg };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(request: ProbeRequest) {
  const client = new LightClient();
  emit({ kind: "started", t: elapsed() });
  await client.start(setting(request), randomSecretKey(), "info", "wss");

  const watch = request.watch;
  if (watch) {
    await client.setScripts([
      {
        script: { codeHash: watch.script.code_hash, hashType: watch.script.hash_type, args: watch.script.args },
        scriptType: "lock",
        blockNumber: BigInt(watch.fromBlock),
      },
    ]);
  }

  let capacityReported = false;
  let sent = false;
  for (;;) {
    let tip: bigint | undefined;
    try {
      tip = (await client.getTipHeader()).number;
    } catch {
      tip = undefined;
    }
    const peers: PeerSample[] = (await client.getPeers()).map((p) => ({
      nodeId: p.nodeId,
      addresses: p.addresses.map((a) => a.address),
      protocols: p.protocols.map((x) => Number(x.id)),
      provedTip: p.syncState?.provedBestKnownHeader?.number.toString(),
    }));
    emit({ kind: "sample", sample: { t: elapsed(), peers, tip: tip?.toString() } });

    if (watch && !capacityReported && tip !== undefined && tip > 0n) {
      const [status] = await client.getScripts();
      if (status && BigInt(status.blockNumber) >= tip) {
        const capacity = await client.getCellsCapacity({
          script: { codeHash: watch.script.code_hash, hashType: watch.script.hash_type, args: watch.script.args },
          scriptType: "lock",
          scriptSearchMode: "exact",
        });
        emit({ kind: "capacity", t: elapsed(), capacity: capacity.toString(), tip: tip.toString() });
        capacityReported = true;
      }
    }

    // The light client checks a transaction against cells it knows, so it
    // sends only once it has caught up with the sender's lock.
    if (request.sendTransaction && !sent && peers.length > 0 && tip !== undefined && tip > 0n && (!watch || capacityReported)) {
      sent = true;
      try {
        // The driver passes the transaction in the light client's own form.
        const txHash = await client.sendTransaction(request.sendTransaction as Parameters<LightClient["sendTransaction"]>[0]);
        emit({ kind: "sent", t: elapsed(), txHash });
      } catch (e) {
        emit({ kind: "error", t: elapsed(), message: `sending failed: ${String(e)}` });
      }
    }

    await sleep(request.sampleEveryMs);
  }
}

// ---- By hand: a form and a plain readout -----------------------------------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function render(event: ProbeEvent) {
  const status = $("status");
  if (!status) return;
  if (event.kind === "sample") {
    const { peers, tip, t } = event.sample;
    $("peers")!.textContent = String(peers.length);
    $("tip")!.textContent = tip ?? "–";
    status.textContent = `${Math.round(t / 1000)} s`;
    $("list")!.textContent = peers.map((p) => p.addresses[0] ?? p.nodeId).join("\n");
  } else if (event.kind === "error") {
    status.textContent = event.message;
  }
}

function fromForm(): ProbeRequest {
  const network = ($("network") as HTMLSelectElement).value as Network;
  const bootnodes = ($("bootnodes") as HTMLTextAreaElement).value
    .split(/\s+/)
    .map((s) => s.trim().replace(/^"|",?$/g, ""))
    .filter(Boolean);
  return { network, bootnodes, maxOutboundPeers: 4, sampleEveryMs: 2000 };
}

if (window.__LIFELINE_REQUEST__) {
  document.body.dataset.mode = "driven";
  void run(window.__LIFELINE_REQUEST__).catch((e) => emit({ kind: "error", t: elapsed(), message: String(e) }));
} else {
  $("start")?.addEventListener("click", () => {
    document.body.dataset.mode = "running";
    void run(fromForm()).catch((e) => emit({ kind: "error", t: elapsed(), message: String(e) }));
  });
}
