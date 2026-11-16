# Contributing

Thank you for helping. For anything bigger than a small fix, open an issue
first, so we can agree on the approach before you spend time on it.

Running a node is the most useful contribution of all: follow
[docs/node-recipe.md](docs/node-recipe.md), and once `lifeline check` passes,
add your node to `nodes/<network>.json` in a pull request.

## Setup

```bash
npm ci                   # Node.js from .nvmrc, npm 11+; also installs the git hooks
npx playwright install chromium
npm run build
npm test
```

[docs/development.md](docs/development.md) explains the layout, the devnet
and the pitfalls.

## Before a pull request

`npm run check` runs the build, the unit tests and the commit subject check.
A change to `node/` or `devnet/` should also be tried on the devnet
(`npm run devnet:up`, then `lifeline check` and a short `lifeline test`);
CI does the same.

## Commits

Subjects follow [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): what changed`, lowercase after the colon.

- Types: `feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `test`,
  `build`, `ci`, `chore`, `revert`.
- Scopes are the part touched: `node`, `rpc`, `devnet`, `probe`, `cli`,
  `nodes`, `uptime`, …

CI checks every subject in a pull request. Changes operators or app
developers will notice also go into `CHANGELOG.md`, in plain words.

## Rules that keep the list trustworthy

- A node goes into `nodes/` only after `lifeline check` passes on it, and
  with an operator who can be reached.
- The list is built into apps; nothing in this repository makes an app fetch
  it, or anything else, at run time.
- Test results are committed raw. A run that went badly is still data.

Security issues go to [SECURITY.md](SECURITY.md), not to public issues.
