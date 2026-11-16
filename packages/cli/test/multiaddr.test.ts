import { describe, expect, it } from "vitest";
import reference from "../src/data/reference-peers.json" with { type: "json" };
import { formatWssAddress, hostMatches, parseWssAddress } from "../src/multiaddr.js";

const ID = "QmaZMemLXSsxKUrYNucjEbPxVX3rBKsGhWW2muWtWxUWyh";

describe("parseWssAddress", () => {
  it("reads a browser-reachable address", () => {
    expect(parseWssAddress(`/dns4/ckb1.example.org/tcp/443/wss/p2p/${ID}`)).toEqual({
      family: "dns4",
      host: "ckb1.example.org",
      port: 443,
      peerId: ID,
    });
  });

  it("round-trips", () => {
    const a = `/dns6/node.lifeline.test/tcp/4431/wss/p2p/${ID}`;
    expect(formatWssAddress(parseWssAddress(a))).toBe(a);
  });

  it.each([
    [`/ip4/1.2.3.4/tcp/443/wss/p2p/${ID}`, "domain"],
    [`/dns4/ckb1.example.org/tcp/8115/p2p/${ID}`, "wss"],
    [`/dns4/ckb1.example.org/tcp/443/ws/p2p/${ID}`, "wss"],
    [`/dns4/ckb1.example.org/tcp/443/wss/p2p/notapeerid`, "peer id"],
    [`/dns4/ckb1.example.org/tcp/0/wss/p2p/${ID}`, "port"],
    [`/dns4/localhost/tcp/443/wss/p2p/${ID}`, "domain"],
  ])("rejects %s", (input, why) => {
    expect(() => parseWssAddress(input)).toThrow(why);
  });

  it("accepts every address in the reference lists", () => {
    for (const a of [...reference.mainnet, ...reference.testnet]) expect(() => parseWssAddress(a)).not.toThrow();
  });
});

describe("hostMatches", () => {
  it("matches subdomains of a wildcard, not the bare name", () => {
    expect(hostMatches("reaver.ckb.guide", "*.ckb.guide")).toBe(true);
    expect(hostMatches("ckb.guide", "*.ckb.guide")).toBe(false);
    expect(hostMatches("notckb.guide", "*.ckb.guide")).toBe(false);
  });

  it("every reference peer is behind the one domain the tests block", () => {
    for (const a of [...reference.mainnet, ...reference.testnet]) {
      expect(hostMatches(parseWssAddress(a).host, "*.ckb.guide")).toBe(true);
    }
  });
});
