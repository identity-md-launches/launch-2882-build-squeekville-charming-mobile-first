# Squeekville

An original illustrated hamster town at dusk. Connect on Sepolia, choose one of three locations, and explicitly sign a local mayor order. Verified newly settled hamster work supplies local Town Energy. The bakery, fountain and square each have a 10-second event. All buildings are present from the start.

**Try without a wallet:** select **Practice**, place a demo order and choose **Simulate a settled round**. The permanent Practice banner identifies simulated data. Practice has an independent save and never feeds connected progress.

## Install, preview and rebuild

Requires Node 22 or later and npm. No environment file, API key or backend is needed.

```sh
npm ci
npm run dev
```

For the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Serve the included `dist/` directory with any static HTTP/IPFS host. Vite uses `base: './'`; scripts, styles, fonts, wallet marks, favicon and the 1200×630 PNG share card use relative local paths. No rewrite rules are required. Use HTTPS or localhost for wallet and browser cryptography support. The app was also tested under a nested `/town/` path.

## Official integration

- Sepolia chain ID: **11155111**.
- Official SqueekCore V3 proxy: **`0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`**.
- Sources read before implementation: [Developers / deployments](https://docs.squeekchain.com/developers/), [SqueekCore reference](https://docs.squeekchain.com/developers/core/), [deployment verification quickstart](https://docs.squeekchain.com/developers/quickstart/) and [reorg guidance](https://docs.squeekchain.com/developers/index-events/).
- The complete [published ABI](https://docs.squeekchain.com/assets/abi/SqueekCore.json) and [deployment record](https://docs.squeekchain.com/assets/deployments/sepolia.json) are pinned in `src/chain/`. `core-abi.ts` contains exact read-only entries from that ABI.
- Public browser RPC: `https://11155111.rpc.thirdweb.com`, published in [viem’s Sepolia chain definition](https://github.com/wevm/viem/blob/main/src/chains/definitions/sepolia.ts). Both live JSON-RPC reads and browser cross-origin access were checked. The REST API is not used.

`src/chain/adapter.ts` verifies chain ID, implementation/admin slots, implementation runtime hashes, versions, layout digests, governance owners, contract links and launch configuration. It reads `configuration()`, `state()` and `roundPage()` at one Ethereum block, reconciles the frontier’s ledger position, then rechecks the block hash. Unknown upgrades or inconsistent results stop accrual.

The official quickstart leaves confirmation policy to the integrator. **Squeekville chooses Ethereum’s `finalized` block tag with no faster fallback.** Ethereum finality, Squeekchain round settlement and completion of a Squeek block are separate. Game energy comes only from certified settled rounds, never from elapsed wall time or block completion.

`roundPage()` returns active checkpoints, not a `work` field for every round. The adapter derives active round work by subtracting successive official `cumulativeWork` values, starting from the page’s `start` position. Only omitted IDs within `certifiedThroughRound` count as certified zero-work rounds. Positive work adds 3 energy; zero adds 1; the cap is 12. The first successful initialization starts at 0 and checkpoints the latest frontier without historical credit. Recovery advances the saved cursor in order, at most four pages per refresh, each covering at most 128 IDs and 16 active records. The returned frontier is always the next cursor.

Polling normally runs every 30 seconds while visible; recovery uses 5 seconds and failures back off to 5 minutes. Errors preserve progress, pause accrual and offer retry. There is no simulation fallback in connected mode.

## Signing and browser saves

wagmi/viem provide injected EIP-1193 and EIP-6963 connections, explicit Sepolia switching/addition, phone wallet-app links and Coinbase Wallet / Smart Wallet. Connection requests, network changes and signatures require explicit user actions; passive reads restore previously authorized connections.

EIP-712 domain: `Squeekville`, version `1`, Sepolia; no `verifyingContract`. Orders include mayor, readable location, cost 3, random bytes32 nonce, issue/expiry timestamps (24 hours) and actual site origin. The full local-signing disclosure appears before signing. EOA signatures are recovered locally; contract/counterfactual wallet signatures use viem’s read-only ERC-1271/ERC-6492 verification. Restored orders are verified again before use.

IndexedDB `squeekville-v1`, store `towns`, persists energy, checkpoint/work, finalized anchor, refresh time, pending order/signature, completed IDs, consumed nonces, selected location, reduced-motion preference and the latest 40 journal entries. Wallet/chain keys and `practice:v1` are independent. A single serialized read/write transaction commits the 3-energy deduction and completed ID before animation. BroadcastChannel updates other tabs; stale cursors and competing executions cannot double-credit or double-spend. Canceled nonces stay consumed. Wallet private keys never enter the app.

Town progress is saved in this browser and does not sync across devices. Town Energy is a local game resource with no monetary value. Clearing site data removes progress. A different site origin has a separate save and cannot reuse old orders.

## Checks and limits

Production build, TypeScript checking and **28 unit tests passed**. Chromium production-export tests cover all three real-signature paths using a controlled EIP-1193/RPC test harness, all Practice events, rejected connection/signature requests, Sepolia switching, account changes, reload, competing tabs, deduplication, outage/recovery, keyboard dialog behavior and responsive layouts. Test doubles are confined to `test/`; production has no hidden simulation control. `test/fixtures/sepolia-identity.json` contains public deployment reads recorded on 2026-11-02 for repeatable identity checks.

Run the browser suite with an installed Playwright module and its Chromium runtime:

```sh
node test/browser.mjs /path/to/playwright/index.mjs
```

The pinned interface probe passed **16/16 checks**. See [DESIGN.md](DESIGN.md) and [the validation record](VALIDATION.md) for measured coverage and fixes. A live browser read also decoded settled round 1973 at finalized Ethereum block 12048695 on 2026-11-02; that is a recorded observation, not a promised current frontier.

Physical wallet apps, actual Coinbase passkey signing, native Safari/WebKit, screen readers and native browser zoom were not tested. A public RPC can be unavailable; settlement can lag with no promised duration. A changed finalized anchor halts the town rather than attempting an automatic rollback of already played local moments. Browser storage is local game state, not a tamper-proof financial ledger. No transactions, approvals, transfers, minting, badges or protocol rewards are requested or promised. No sound is played.

`src/assets/share.svg` is the editable share artwork; `scripts/render-share.mjs` optionally regenerates the committed PNG using Playwright. Font and wallet-mark licenses are included; see [THIRD_PARTY.md](THIRD_PARTY.md).
