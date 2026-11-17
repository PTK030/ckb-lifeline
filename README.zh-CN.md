<p align="center">
  <img src="docs/images/icon.png" width="80" height="80" alt="ckb-lifeline">
</p>

<h1 align="center">ckb-lifeline</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="README.pl.md">Polski</a>
</p>

<p align="center">
  <b>不止一个入口。</b><br>
  为浏览器中的 CKB 轻客户端提供独立节点，一个下午就能搭好节点的部署方案，以及一项展示没有这些节点时会发生什么的测试。
</p>

<p align="center">
  <a href="docs/node-recipe.md"><b>运行节点</b></a> ·
  <a href="docs/verify.md"><b>自行验证</b></a> ·
  <a href="docs/test-protocol.md"><b>测试协议</b></a> ·
  <a href="docs/rpc.md"><b>公共 RPC</b></a> ·
  <a href="CHANGELOG.md"><b>更新日志</b></a> ·
  <a href="CONTRIBUTING.md"><b>参与贡献</b></a>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.1.0-3cc68a?style=for-the-badge&labelColor=0d1117" alt="版本 0.1.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3cc68a?style=for-the-badge&labelColor=0d1117" alt="许可证：MIT"></a>
  <a href="https://github.com/nervosnetwork/ckb/releases/tag/v0.210.0"><img src="https://img.shields.io/badge/ckb-v0.210.0-3cc68a?style=for-the-badge&labelColor=0d1117" alt="CKB v0.210.0"></a>
</p>

<p align="center">
  <img src="docs/images/demo.webp" alt="浏览器钱包连接着许多节点，但它们都在同一个域名之后；域名消失，钱包随之熄灭；独立节点从其他方向出现，钱包重新亮起" width="100%">
</p>

在浏览器中运行 CKB 轻客户端的钱包，无法像全节点那样直接接入网络。网页只能通过 TLS 打开 WebSocket 连接，而且只能连接域名：`/dns4/<域名>/tcp/443/wss/p2p/<peer id>`。轻客户端要等到连上两个这样的节点才会开始同步。

如今，为此公开的所有地址（主网 26 个，测试网 12 个）都位于同一个域名之下：`*.ckb.guide`。应用直接复制这份列表。一旦这个域名停止响应，无论是一小时还是永久，所有这些应用都会同时与网络断开。

ckb-lifeline 补上另一半：由更多人运行、浏览器能够连接的更多节点。

- **节点部署方案。** 在一台小服务器上执行一次 `docker compose up -d`：官方 CKB 镜像，443 端口上的 Nginx（为浏览器提供 WSS，为其他节点提供普通 P2P），以及自动续期的证书。[从一台空服务器开始](docs/node-recipe.md)，大约一小时。
- **用真实客户端检查。** `lifeline check` 在 Chromium 中启动官方轻客户端，只把你的节点作为唯一对等节点，告诉你钱包能否使用它。
- **任何人都能重复的测试。** `lifeline test` 只在浏览器内部屏蔽 `*.ckb.guide`，测量轻客户端在有无独立节点时的表现。每一次试验的原始数据都会保留。
- **供应用使用的列表。** `nodes/` 收录通过检查的节点，供应用在构建时与常用列表一并内置。运行时不会下载任何内容。
- **可选的公共 RPC。** 同一个节点也可以为只读方法和 `send_transaction` 提供 JSON-RPC，[带有过滤和限流](docs/rpc.md)。默认关闭，除非你主动开启。

## 现状

2026 年 11 月 16 日的测量：官方轻客户端（`@nervosnetwork/ckb-light-client-js` 0.5.5）运行在 Chromium 中，从应用现在内置的 26 个主网地址出发，每种条件各 10 次试验。原始数据：[data/results/2026-11-16-mainnet-eu-1](data/results/2026-11-16-mainnet-eu-1)。

| | `*.ckb.guide` | 完成同步 | 对等节点 | 同步耗时（中位数） |
|---|---|---|---|---|
| **A** | 可访问 | 10 / 10 | 2.7 秒后 2 个 | 10.7 秒 |
| **B** | 不可访问 | 0 / 10 | 整整 300 秒内为 0 | 从未同步 |

失去这一个域名后，浏览器中的轻客户端连一个对等节点都得不到。测试只改动了浏览器自身的域名解析，其他一切保持不变。

在测试网上，同样的屏蔽也会让客户端断开：3 次试验全部如此，整整 300 秒内 0 个对等节点（[数据](data/results/2026-11-17-testnet-dom)）。

在本地 devnet 上（两个节点扮演常用节点，两个扮演独立节点，出块间隔约 8 秒，与主网相同，[数据](data/results/2026-11-17-devnet-local-devnet)），独立节点能让客户端恢复：3 次试验全部同步成功，通过它发送的转账在 21 到 26 秒内上链。不过它大约 60 秒后才连上第二个对等节点，因为最初的尝试都耗在了已经失效的地址上。更早的一次运行还把它读取的余额与全节点作了比较，两者一致（[数据](data/results/2026-11-16-devnet-local-devnet)）。带有独立节点的主网测试以及第二个地点的测试，将在节点上线后补充。

## 为什么做这件事

轻客户端的意义，在于无需信任别人的服务器就能使用一条链。可在浏览器里，它仍然要从某人提供的服务器列表出发，而今天这份列表上只有一个名字。

这里没有人做错什么。总得有人运行第一批 WSS 节点，他们也确实做了，而且是免费的。缺少的是第二个、第三个运营者。这只需要一台小服务器和一个下午。所以我在运行节点，写下做法，并公开检验这是否真的有所改变。

## 工作原理

| | 没有独立节点 | 有独立节点 |
|---|---|---|
| **初始列表** | `*.ckb.guide` 下的 26 个地址 | 同样的 26 个，加上 `nodes/mainnet.json` 中的节点 |
| **`*.ckb.guide` 可访问** | 轻客户端正常同步 | 正常同步，且连接更多运营者 |
| **`*.ckb.guide` 不可访问** | 没有对等节点，什么都加载不出来 | 通过独立节点同步 |

列表在应用构建时被复制进去。列表中的节点无法把任何人引向别处：轻客户端会自行验证区块头和证明，节点最多只能扣留数据，而节点越多，越能防范这一点。

## 快速开始

### 运行节点

```bash
git clone https://github.com/PTK030/ckb-lifeline
cd ckb-lifeline
sudo sh node/scripts/setup-vps.sh
cp node/.env.example node/.env     # 你的域名，mainnet 或 testnet
cd node && docker compose up -d
sh scripts/certificate.sh
```

完整的步骤说明，以及每一步之后该检查什么：[docs/node-recipe.md](docs/node-recipe.md)。

### 在本地试用全部功能

需要 Node.js 22+（npm 11）、Docker，以及 Playwright 使用的 Chromium。

```bash
npm ci && npx playwright install chromium && npm run build
npm run devnet:up                 # 本地链的四个节点和一个矿工
npx lifeline test --network devnet --conditions A,B,C,F --trials 2 --seconds 120
npm run devnet:down
```

devnet 使用与服务器相同的入口脚本和 Nginx 配置；其中两个节点扮演常用节点，两个扮演独立节点。迁移到测试网和主网的清单见 [docs/deploy-mainnet.md](docs/deploy-mainnet.md)。

### 检查节点，或测试网络

```bash
npx lifeline check /dns4/ckb1.example.org/tcp/443/wss/p2p/Qm...
npx lifeline verify --network mainnet        # B 和 C 各一次试验，约 5 分钟
npx lifeline test --network mainnet --conditions A,B --trials 10 --location <你所在的位置>
```

或者不安装 Node.js：`docker run --rm ghcr.io/ptk030/lifeline-test verify --network mainnet`。

## 独立节点

| 网络 | 地址 | 运营者 |
|---|---|---|
| | *暂无。* [运行一个](docs/node-recipe.md)并提交 pull request。 | |

## 仓库结构

| 路径 | |
|---|---|
| `node/` | 部署方案：compose 文件、CKB 入口脚本、Nginx、RPC 过滤器、服务器脚本 |
| `devnet/` | 本地的四节点链 |
| `packages/probe` | 浏览器页面中的轻客户端，以及驱动它的程序 |
| `packages/cli` | `lifeline`：check、test、verify、uptime |
| `nodes/` | 各网络的独立节点 |
| `data/results/` | 每次测试运行的原始结果 |
| `docs/` | 部署方案、测试协议、验证、开发说明 |

[docs/development.md](docs/development.md) 说明各部分如何配合，以及哪些地方容易出错。`docs/` 中的文档为英文。

## 许可证

[MIT](LICENSE)。
