# testnet, dom

Usual peers: 12 addresses matching `*.ckb.guide`. Independent peers: 0.

| Condition | What | Trials | Synced | Cut off |
|---|---|---|---|---|
| A | usual peers reachable | 3 | 3 | 0 |
| B | usual peers blocked | 3 | 0 | 3 |

- **H1 PASS**: Blocking the usual peers cuts the light client off. 3/3 trials ended with fewer than 2 peers.

Raw data: `trials.csv` (one row per trial) and `samples.jsonl` (what the light client reported every 2 s).
