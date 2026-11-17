# devnet, local-devnet

Usual peers: 2 addresses matching `*.guide.test`. Independent peers: 2.

| Condition | What | Trials | Synced | Cut off |
|---|---|---|---|---|
| A | usual peers reachable | 3 | 3 | 0 |
| B | usual peers blocked | 3 | 0 | 3 |
| C | usual peers blocked, independent peers listed | 3 | 3 | 0 |
| E | usual peers blocked, one independent peer fewer | 3 | 0 | 3 |
| F | as C, and a transaction sent through the light client | 3 | 3 | 0 |

- **H1 PASS**: Blocking the usual peers cuts the light client off. 3/3 trials ended with fewer than 2 peers.
- **H2 PASS**: Independent peers restore sync. 3/3 trials synced to within 3 blocks; median time to 2 peers 60.9 s (limit 120 s).
- **H4 PASS**: Transactions go through without the usual peers. 3/3 transactions committed within 10 minutes.

Raw data: `trials.csv` (one row per trial) and `samples.jsonl` (what the light client reported every 2 s).
