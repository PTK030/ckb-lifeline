# mainnet, eu-1

Usual peers: 26 addresses matching `*.ckb.guide`. Independent peers: 0.

| Condition | What | Trials | Synced | Cut off |
|---|---|---|---|---|
| A | usual peers reachable | 10 | 10 | 0 |
| B | usual peers blocked | 10 | 0 | 10 |

- **H1 PASS**: Blocking the usual peers cuts the light client off. 10/10 trials ended with fewer than 2 peers.

Raw data: `trials.csv` (one row per trial) and `samples.jsonl` (what the light client reported every 2 s).
