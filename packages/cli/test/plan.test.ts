import { describe, expect, it } from "vitest";
import { hostResolverRules } from "@ckb-lifeline/probe";
import { planFor } from "../src/commands/test.js";
import { csvLine } from "../src/csv.js";
import type { NetworkProfile } from "../src/networks.js";

const profile: NetworkProfile = {
  network: "mainnet",
  reference: ["r1", "r2"],
  referencePattern: "*.ckb.guide",
  independent: ["i1", "i2", "i3"],
  referenceRpc: "https://example.invalid/rpc",
};

describe("conditions", () => {
  it("A and B start from the same list; only B blocks it", () => {
    expect(planFor("A", profile)).toMatchObject({ bootnodes: ["r1", "r2"], block: [] });
    expect(planFor("B", profile)).toMatchObject({ bootnodes: ["r1", "r2"], block: ["*.ckb.guide"], stopWhenSynced: false });
  });

  it("C adds the independent nodes, E drops one of them, F sends", () => {
    expect(planFor("C", profile).bootnodes).toEqual(["r1", "r2", "i1", "i2", "i3"]);
    expect(planFor("E", profile).bootnodes).toEqual(["r1", "r2", "i1", "i2"]);
    expect(planFor("F", profile)).toMatchObject({ send: true, block: ["*.ckb.guide"] });
  });
});

describe("hostResolverRules", () => {
  it("blocks a domain", () => {
    expect(hostResolverRules({ block: ["*.ckb.guide"] })).toBe("MAP *.ckb.guide ~NOTFOUND");
  });

  it("maps local names before blocking, and 'only' leaves the page reachable", () => {
    expect(hostResolverRules({ map: { "a.lifeline.test": "127.0.0.1" }, only: ["a.lifeline.test"] })).toBe(
      "MAP a.lifeline.test 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE a.lifeline.test, EXCLUDE localhost, EXCLUDE 127.0.0.1",
    );
  });
});

describe("csvLine", () => {
  it("quotes what needs quoting and leaves gaps for missing values", () => {
    expect(csvLine(["a", 1, 2n, true, undefined, 'say "hi", twice'])).toBe('a,1,2,true,,"say ""hi"", twice"');
  });
});
