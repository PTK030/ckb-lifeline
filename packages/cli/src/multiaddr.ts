// The addresses a browser light client can use: /dns4|dns6/<host>/tcp/<port>/wss/p2p/<peer id>.
// An address without a domain, or without wss, cannot be reached from a page
// served over HTTPS, so it is rejected here rather than failing quietly later.

export interface WssAddress {
  host: string;
  port: number;
  peerId: string;
  family: "dns4" | "dns6";
}

const PEER_ID = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/i;

export function parseWssAddress(input: string): WssAddress {
  const parts = input.trim().split("/");
  const [empty, family, host, tcp, port, wss, p2p, peerId, ...rest] = parts;
  const fail = (why: string): never => {
    throw new Error(`${input}: ${why} (expected /dns4/<domain>/tcp/<port>/wss/p2p/<peer id>)`);
  };
  if (empty !== "" || rest.length) fail("not a multiaddr of the expected shape");
  if (family !== "dns4" && family !== "dns6") fail("a browser needs a domain name, so /dns4 or /dns6");
  if (!host || !HOST.test(host)) fail("not a valid domain name");
  if (tcp !== "tcp") fail("missing /tcp");
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) fail("not a valid port");
  if (wss !== "wss") fail("a page served over HTTPS can only open /wss");
  if (p2p !== "p2p" || !peerId || !PEER_ID.test(peerId)) fail("missing or malformed /p2p/<peer id>");
  return { host: host!.toLowerCase(), port: portNumber, peerId: peerId!, family: family as "dns4" | "dns6" };
}

export function formatWssAddress(a: WssAddress): string {
  return `/${a.family}/${a.host}/tcp/${a.port}/wss/p2p/${a.peerId}`;
}

/** True when the host matches a pattern such as "*.ckb.guide" or "a.example.org". */
export function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) return h.endsWith(p.slice(1));
  return h === p;
}
