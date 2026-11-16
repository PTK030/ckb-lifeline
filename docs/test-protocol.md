# Test protocol

What `lifeline test` measures, what counts as a pass, and what the raw data
looks like. The thresholds below were written down before the first full
run; `git log docs/test-protocol.md` shows when.

## The question

A browser light client (`@nervosnetwork/ckb-light-client-js` 0.5.5) can only
open WebSocket connections over TLS to peers with a domain name:
`/dns4/<domain>/tcp/443/wss/p2p/<peer id>`. It needs two connected peers before
it syncs (`max_outbound_peers / 2`, with the default of 4). The addresses apps
ship with today all come from the package README: 26 on mainnet and 12 on
testnet, all under `*.ckb.guide`.

So: what happens to an app when that one domain stops answering, and does a
second, independent set of nodes bring it back?

## Conditions

Every trial starts a fresh Chromium (no stored peers), runs the official light
client in a page, and samples its peers and tip every 2 seconds. "Blocked"
means Chromium's own resolver answers NXDOMAIN for `*.ckb.guide`
(`--host-resolver-rules`); nothing on the computer or the network changes.

| | Start list | Blocked | Expected |
|---|---|---|---|
| **A** | the usual peers | nothing | synced |
| **B** | the usual peers | `*.ckb.guide` | cut off |
| **C** | the usual peers + independent nodes | `*.ckb.guide` | synced |
| **E** | as C, one independent node fewer | `*.ckb.guide` | recorded, no threshold |
| **F** | as C, and a transfer sent through the light client | `*.ckb.guide` | committed (testnet and devnet only) |

A trial runs at most 300 seconds. A, C, E and F stop as soon as the client is
synced; B always runs the full 300 seconds.

E has no threshold on purpose. With two independent nodes, taking one away
leaves one, and one is not enough to sync; that is the reason to want a third
operator, not a failure of the test.

## Definitions

- **Synced**: at least 2 peers, and the client's tip at most 3 blocks behind a
  full node's tip read at the end of the trial.
- **Cut off**: fewer than 2 peers at the end of the trial.
- **Reference**: a full node's JSON-RPC (`https://mainnet.ckb.dev/rpc`,
  `https://testnet.ckb.dev/rpc`, or the devnet's own node).

## Hypotheses and thresholds

| | Hypothesis | Passes when |
|---|---|---|
| **H1** | Blocking `*.ckb.guide` cuts off a light client that uses the README list | ≥ 9 of 10 B trials cut off at 300 s, in each of two locations |
| **H2** | Independent nodes restore sync | ≥ 9 of 10 C trials synced, and the median time to 2 peers ≤ 120 s |
| **H3** | What the light client reads is correct | 10 of 10 balances of a known address equal the reference |
| **H4** | Transactions still go through | ≥ 9 of 10 transfers sent in F are committed within 10 minutes |
| **H5** | The node recipe works for someone else | at least one operator outside this project passes `lifeline check` within 60 minutes of starting from [node-recipe.md](node-recipe.md) |
| **H6** | Listed nodes stay up | each node passes ≥ 95% of its hourly checks in `data/uptime/` |

If H1 does not hold (a light client survives the block), the rest of this
project is moot in its current form, and the result is published as such.

## Running it

```bash
npx lifeline test --network mainnet --conditions A,B --trials 10 --location <name>
npx lifeline test --network mainnet --conditions C,E --trials 10 --location <name>
npx lifeline test --network testnet --conditions F --trials 10    # LIFELINE_TX_KEY: a funded testnet key
npx lifeline test --network devnet --conditions A,B,C,E,F --trials 3
```

`--watch <address> --from-block <n>` adds the balance check (H3) to every
trial: the client follows that address from block `n` (pick a block before the
address's first cell) and its total is compared with the reference.

## Raw data

Each run writes to `data/results/<date>-<network>-<location>/`:

- `trials.csv`: one row per trial. Times are seconds from the start of the
  light client (`s_first_peer`, `s_two_peers`, `s_synced`), tips are block
  numbers, `connected` and `cut_off` apply the definitions above.
- `samples.jsonl`: every sample of every trial: peers (id, address,
  protocols, proved tip) and the client's tip.
- `summary.md` and `summary.json`: the counts and the H1 to H4 lines.

Nothing in the data identifies the machine it ran on beyond the `--location`
name you give it.
