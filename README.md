# Lorva Agent

Lorva Agent is a builder and monitor for trading agents on Robinhood Chain. People who want to automate trading often run a bot without knowing how it decides or how much it can lose. Here you build an agent step by step (asset, rule, position size, limits), test it on real on-chain price history, and run it on paper with a monitor that shows its position, how much of each limit it has used, alerts near a limit, and a kill switch.

Trading Agents. Your Rules. Test the Strategy. Set the Limits.

## Read this before anything else

This repository is the working code behind https://lorvaagent.xyz.

- **What runs today:** the five-step builder; backtests on Chainlink round history read from Robinhood Chain (ETH and the NVDA, TSLA and GOOGL stock-token feeds), with fees and slippage as inputs and every decision explained; paper mode on live prices with limit meters, alerts, pause and a kill switch; the agent timeline; export and import. Agents are deterministic rules; no AI model makes decisions.
- **Live data:** Chainlink `latestRoundData` every 20 seconds and `getRoundData` over each feed's current phase (up to 1,000 rounds), plus the latest block and gas price, all read through the site's own relay.
- **The contract:** `LorvaAgentRegistry` records agents owned by a wallet, versioned limits, one bound operator key, Active / Paused / Killed status and per-day usage, and refuses recorded actions over the limits. It is live on Robinhood Chain at `0x10601674a388e26c8236ff67d531fbd9b1f86126` (verified on Blockscout). It holds no funds.
- **Planned, not built:** trading with real money through a vault you control (only after permissions and limits are proven on paper), and token features for $LORVA.
- **What nothing here claims:** a backtest result is not a future result, and paper results are not real fills. Nothing here is advice. $LORVA has no promised value. Not affiliated with Robinhood; stock tokens are tokens on Robinhood Chain, not the shares.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages (`/`, `/room`, `/build`, `/method`, `/token`) and API routes (`prices`, `prices/latest`, `registry`, `chain`, `rpc`). |
| `src/components/` | Interface components: the home chapters and pipeline diagram, the builder, the control room, the paper monitor, the chain tab, the wallet dialog. |
| `src/config/` | `brand.ts` (name, ticker, token address, links) and `contracts.ts` (deployed contract address). Every brand value is read from here. |
| `src/lib/agents/` | The engine (rules, limits, fills, stats, alerts), bars from Chainlink rounds, reason bits shared with the contract, the agent status machine. |
| `src/lib/server/` | Chainlink round history and live prices, registry log reader, chain snapshot, storage for rate limits. |
| `contracts/` | Solidity sources (`src/`) and Foundry tests (`test/`). |
| `examples/operator.mjs` | An operator key that checks `canAct` and records paper actions. |
| `scripts/` | `verify-deployment` and the contract artifact builder. |
| `public/` | Brand images and wallet icons. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
forge test --match-contract Fork --fork-url <Robinhood Chain RPC> --evm-version cancun
```

### What was checked for this snapshot

2026-11-26 (UTC), Node.js 25.8.2, forge 1.5.1: `npm run typecheck` exit 0; `npm test` 31 pass / 0 fail (engine decisions and limits, backtest equals paper replay, bars from rounds, status machine, reason-bit parity with the Solidity library, relay limits, verify-deployment); `next build` 20 routes; `forge test` 27 passed (22 unit and fuzz tests in `LorvaAgentRegistry.t.sol`, 5 invariants in `LorvaAgentRegistry.invariant.t.sol`) and 2 fork tests on Robinhood Chain. An end-to-end run on a local fork (chain id 4663) with injected test wallets and the example operator, and `verify-deployment` printing MATCH for the deployed test copy, needs a local chain and is not part of `npm test`.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6800. Everything works with no configuration: agents are stored in the browser, prices come from the public Robinhood Chain RPC. Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the WalletConnect row says "Not configured on this site yet"; without `KV_REST_API_URL` and `KV_REST_API_TOKEN` rate limits are kept per server instance.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| LorvaAgentRegistry (with internal library LorvaLimitMath) | `0x10601674a388e26c8236ff67d531fbd9b1f86126` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x10601674a388e26c8236ff67d531fbd9b1f86126) |

An agent belongs to the wallet that registers it and carries a rules hash, limits (max position, max daily loss, trades per UTC day, stop-loss, expiry), a limits version, one operator key and a status. The operator records each paper action; the registry counts trades and realised loss per UTC day and refuses new risk over the limits, while exits always pass. The operator can tighten limits but never raise them, and can pause but never resume. Kill is final in one transaction. `canAct` returns every reason as a bit before anything is sent. There is no global owner, no admin over anyone's agent, no fee, no upgrade, and it holds no funds.

## Verify a deployment

```
npm run verify-deployment -- --registry <address> --registry-tx <creation tx>
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference. `VERIFY_RPC_URL` points it at another RPC.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- Chainlink Data Feeds on Robinhood Chain: ETH / USD and the Robinhood NVDA, TSLA and GOOGL 24/7 feeds. History is the feed's current phase, at most 1,000 rounds (about 16 days for NVDA 24/7, longer for ETH / USD), cached 5 minutes; live prices are cached 10 seconds. A feed updates on a price move or a heartbeat, so quiet periods repeat the last answer.
- Bars are 15 minutes or 1 hour, forward-filled from rounds. A source that does not answer shows "—".
- The registry page data comes from the contract's own logs; unread blocks are reported.
- Every API route is rate limited per network.

## Token

$LORVA is the community token of Lorva Agent on Robinhood Chain. Contract address: announced on https://lorvaagent.xyz at launch. It has no promised value. Token features (longer backtests, more active agents, deeper reports) are a concept, not built; Lorva Agent works fully without the token.

## Deploy your own

1. Import the repository into a Next.js host (preset Next.js, root `./`).
2. Optional environment variables (names and formats only):

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Private Robinhood Chain RPC for server reads and log scans | `https://…` |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Public RPC override for the browser | `https://…` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL` | Shared store for rate limits | `https://…` |
| `KV_REST_API_TOKEN` | Token for that store | string |
| `STORE_KEY_PREFIX` | Key prefix in a shared store | e.g. `lorva:` |

3. Point your domain at it and check `/` (200), `/api/chain` (JSON with a block number), `/api/prices/latest` (four prices) and `/llms.txt`.
4. Contract: `LorvaAgentRegistry` takes no constructor arguments. Deploy it from your own wallet (one creation transaction), put the address, block and creation transaction into `src/config/contracts.ts`, then run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contract, the engine's limit checks and the API routes are in scope; wallets, RPC providers, price feeds, explorers and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). Fonts: Archivo and Geist Mono, self-hosted under the SIL Open Font License (`src/fonts/`). Wallet logos in `public/wallets/` belong to their projects and are used only to identify each wallet. The Lorva Agent name, logo and artwork belong to the project and are not licensed for reuse as a brand.
