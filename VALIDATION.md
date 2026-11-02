# Squeekville validation

Date: 2026-11-02. This is the builder’s check record, not independent certification.

## Connected-mode repair

**Root cause: the RPC and the error handling, not the deployment.** The app read through `https://11155111.rpc.thirdweb.com`, a keyless endpoint that rate-limits. It answered HTTP 429 with `retry-after: 180` and no CORS header, so a browser sees only `TypeError: Failed to fetch`. A refresh sends more than 20 reads every 30 seconds. viem turned the failure into `HttpRequestError`, and a regex in `useTown.ts` replaced every message matching `http|fetch|request|timeout|network` with “Sepolia could not be reached”. Reproduced here from a browser at the deployed hostname: `eth_getBlockByNumber` failed with that exact error, and in another run `eth_chainId` did too. This shows the endpoint failing from this machine’s IP. No failing session from a player’s own browser was available to inspect.

**A second defect sat behind it.** After a reload, wagmi restores the wallet as `reconnecting` with `isConnected` already true. The refresh effect ran, `active()` refused that state, and nothing scheduled another read, because the effect did not depend on `status`. The town then showed “Connected to Squeekchain” from its `idle` state, read nothing and kept signing disabled. The earlier browser suite passed because it trusted that label.

**The deployment did not change.** The local `sepolia-deployment.json` and `SqueekCore.json` are identical to the published files, and all identity values match the developer page. `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f` is still the verified proxy, and the code still reads it there. No metadata or ABI needed updating.

**Upstream limit, not a Squeekville defect.** `settledThroughRound` is 1973 at the finalized block and first appeared at block 11999145, on 2026-10-26 16:20 UTC. By the clock about 2,977 rounds had elapsed. `paused` is false. Until settlement resumes, a new player initializes at 0 energy and earns nothing. No new round settled during this work, so energy from a round settling live was not observed.

### RPC results from a browser at the deployed origin

`test/rpc-origin-check.mjs`. Chromium sent `Origin: https://squeekville-a-little-town-hamste.identitymd.eth.limo` and enforced CORS.

| Request | `rpc.sepolia.ethpandaops.io` | thirdweb (previous) | publicnode |
| --- | --- | --- | --- |
| `eth_chainId` | Passed, `0xaa36a7` | Intermittent: `Failed to fetch` | Passed |
| Finalized block | Passed | Intermittent: `Failed to fetch` | Passed |
| Individual storage and `eth_call` at finalized | Passed | Not reached: finalized read failed | Passed |
| Batched JSON-RPC, mixed methods | Passed, 4 of 4 | Not reached in the browser; 429 from curl | Passed, 4 of 4 |
| Storage and `eth_call` 100,000 blocks back | Passed | Not reached: finalized read failed | Failed: 4444, pruned |

The `/health` response was not used as evidence. `sepolia.drpc.org` answered 400, “chain is not available on free plan”. Decision: ethpandaops is the only RPC, with no backup, because no alternative passed every required request.

### `verifyProxy()` audit, both proxies

| Check | Before | Now |
| --- | --- | --- |
| Implementation and admin slots | Read at the block; accepted dirty high bytes | Read at the block; a slot that is not a clean address is rejected |
| Implementation identity | Called through the proxy before comparing | Slots compared first, so an unknown implementation stops before any call through it |
| `proxyAdmin()` against the admin slot | Not checked | Checked |
| Runtime hash, version, layout digest | Checked, one generic message | Checked, each named with actual and expected values |
| ProxyAdmin owner is the timelock | Checked | Checked |
| Same finalized block | Yes, with a final hash recheck | Yes. A test asserts one block across every read and no `latest` |
| ABI compatibility | Unverified | Tests compare `core-abi.ts`, identity and link reads with the official Core, Mining and Token ABIs |
| Mining, Token and NFT links | Checked, generic message | Checked, named |
| Mismatch against RPC failure | Not distinguished | `SnapshotError` carries stage and kind. viem reports every JSON-RPC -32603 as “reverted”, so classification reads the cause chain: a node failure stays an RPC failure |

No check was removed or weakened.

### Findings and fixes

1. **High, UI:** every request error showed one generic message. `src/game/useTown.ts:149` now reports through `src/chain/diagnostics.ts`, and `src/App.tsx:57` renders the panel. Rechecked in Chromium at each stage.
2. **High, UI:** reload left connected mode dead while labelled connected. Fixed at `src/game/useTown.ts:106`, and `src/App.tsx:391` no longer shows “Connected” from `idle`. Rechecked live; the browser suite now also asserts signing unlocks after reload.
3. **High, layout:** once connected at 390×844, the disclosure pushed **Sign mayor order** below the first screen. The earlier check measured only the disconnected state. `src/style.css:1221` shows the action first on phones, with source order unchanged and `aria-describedby` at `src/App.tsx:307`. Both browser suites now assert it, and the screenshot was inspected.
4. **Medium, connector correctness:** `wallet_addEthereumChain` still offered the thirdweb RPC through viem’s chain definition. Overridden at `src/chain/config.ts:13`. The browser suite asserts the new URL. viem’s unused default string remains in the bundle; live traffic reached only the new host.
5. **Medium, writing:** sanitizing redacted published contract addresses, and viem’s `-1` placeholder hid real RPC codes. Both were caught by new tests and fixed in `src/chain/diagnostics.ts`.

### What passed

Saves, the IndexedDB schema, the EIP-712 domain and order fields, game rules and round deduplication were not changed.

- `npm run typecheck`: passed. `npm run build`: passed. It still prints the existing `node:worker_threads` externalization warning.
- `npm test`: **79 passed** in 2 files, offline. Replays public reads recorded from the new RPC. Covers one finalized block across all reads; proxy addressing; every identity field for both proxies; network failure at all seven stages; JSON-RPC codes; sanitizing; ABI comparison.
- `npx vitest run --config test/live/vitest.config.ts --root .`: **6 passed**, real network. Published record and ABIs equal the local copies; initialization at 0 with no credit; **all 1,973 settled rounds** (331 active, 1,642 zero) pass the round parser and their work sums to `state()`, at 148,986; a returning save reads real rounds; repeats add nothing.
- `node test/live-browser.mjs`: **9 checks passed**, on the production export with a real RPC, finalized block 12049205 and frontier 1973. 152 requests, all to `rpc.sepolia.ethpandaops.io`, all carrying the deployed Origin, and `finalized` the only block tag.
  - First connect verifies both proxies and initializes at round 1973 with 0 energy.
  - Real rounds 1971 to 1973 add exactly 3 energy.
  - **No duplicate energy:** energy, checkpoint and journal are unchanged after two reloads, a repeated read, and a wallet disconnect and reconnect. Two tabs reading the same rounds credit them once.
  - A real EIP-712 order at that origin runs once and does not replay on reload.
  - Real active rounds are credited (`Verified settled round 1871: 599 work`), catching up in bounded pages.
  - A blocked RPC shows staged diagnostics, changes nothing, and recovers from the live RPC.
- `node test/browser.mjs`: passed with no script errors, using a test wallet and test RPC. Covers the existing flows plus diagnostics at network, Core and Mining stages, HTTP status, RPC code, failed-fetch cause, a deployment mismatch, keyboard opening and no overflow at 320, 390 and 760.
- `taste.mjs --out test/scratch/taste`: **16 of 16 passed** at 320, 390 and 1440.

### Limits of these checks

- **The deployed site was not loaded.** The `.eth.limo` and `.eth.link` gateways failed TLS or connection from this machine, and IPFS gateways answered 429 or 403. So `dist/` was served at the real hostname by route interception. Origin, CORS and all RPC traffic were real; the gateway’s own response headers were not observed. Recheck on the published site.
- **Hosting is not part of this job.** Nothing was published from here. The committed `dist/` is published by the task workflow after completion, so redeployment has not been observed.
- **Test wallet:** a throwaway key behind a scripted provider, not a physical wallet. Saved checkpoints were moved back to replay rounds that had already settled; chain answers were not altered.
- **Positive-work credit in the live browser** was seen with energy at the 12 cap, because the journal keeps only 40 lines. The exact +3 arithmetic is covered by unit tests, and the live node suite confirms real positive work reaches the credit path.
- The browser MCP’s code tool was not granted and its preview was absent, so rendered checks used Playwright scripts and inspected screenshots.
- **Failures labelled mismatch:** a call that returns no data is reported as a deployment mismatch. A badly broken node could produce the same answer.

## Scope and assumptions

Reviewed the one-page React/TypeScript app and the production `dist/` export, including all three town events, disconnected and connected states, signature refusal, waiting/pending, wrong network, connection failure/retry, account changes, saved progress, concurrent tabs and separate Practice. The site is static and uses one public Sepolia JSON-RPC endpoint. No hosting or onchain deployment is part of this delivery.

The one visual idea is a miniature neighborhood whose wheel-powered evening comes alive for one local mayor decision. Every building exists at first render. Practice is an explicit independent mode, never an outage fallback.

## Requirement coverage

| Area | Result | Evidence / limit |
| --- | --- | --- |
| Original illustrated town and three locations | Met | Original SVG/CSS, trees, paths, expressive residents, wheel station, bakery, fountain and lit square; inspected rendered idle and event states |
| Local energy: cap 12, cost 3, one pending order | Met | Engine tests, rendered waiting state, atomic spending and replay tests |
| Official address, ABI, `configuration()`, `state()` and `roundPage()` | Met | Official published files pinned and compared live; identity and ledger checks passed through the proxy addresses |
| Certified work and bounded recovery | Met | Cumulative-work deltas, certified zero gaps, frontier reconciliation, four bounded pages; no credit beyond the returned frontier |
| First initialization and later sessions | Met | Zero initial energy, no history credit, persisted checkpoint; tested recovery, repeated reads and reload |
| Confirmation policy and failures | Met | Explicit finalized Ethereum snapshots, hash rechecks; failures preserve energy/checkpoint and do not become zero work |
| EIP-712 and wallet handling | Met for implemented scope | Real cryptographic signatures from a controlled test provider; explicit connect/switch/sign, refusals and account changes tested; physical wallets and actual passkeys untested |
| Local instruction explanation | Met | Required pre-sign disclosure; local orders and chain events have separate journal kinds; no transaction hash or asset request |
| Storage / cross-tab behavior | Met | IndexedDB serialized transactions, atomic deduction/completed ID before animation; race test and refresh replay test passed |
| Separate Practice | Met | Persistent simulated-data banner, unsigned demo orders, positive/zero simulator and independent save |
| All three 8–12 second events | Met | All three 10-second events rendered and exercised in Practice and signed-order test paths, returning to idle |
| English, metadata, static paths | Met | English copy review and `Intl` locale; PNG share card, title, description, favicon, OG fields; nested `/town/` serving passed |
| First screen at 390px | Met | Town, meter, all choices and signing action visible at 390×844, disconnected and connected; checked screenshots and action bounding box |
| Source, lockfile and export budget | Met | Complete source and local assets, lockfile and `dist/`; final byte inventory below the 8 MiB ceiling |

## Six-domain interface review

| Domain | Coverage | Observations and evidence |
| --- | --- | --- |
| Accessibility | Checked, with limits | Diagnostics use native `details`, `dl` and a 44px summary; Enter opens them from the keyboard, and the focus ring measured 6.64:1 on the error surface. Native buttons, checkboxes, dialog and details; descriptive art label; redundant selection/check state; visible 3px focus outline. Keyboard opening, dialog focus containment, Escape/restore and reduced-motion emulation checked. No native screen-reader, physical-device, forced-colors or native zoom session was performed. |
| Layout | Checked | Diagnostics inspected open at 390 and 1440 and measured at 320, 390 and 760 with long addresses wrapping. Screenshots at 390 and 1440; measurements at 320, 390, 760 and 1440; expanded rules/journal, pending and event states tested. No horizontal overflow at the measured widths. Small-screen action was moved into the first screen. |
| Writing | Checked | Failure copy says what failed, whether it was the RPC or the deployment, and that progress is saved. All authored user text is English. Buttons name the action, errors offer retry, and pending text distinguishes a local signature from settlement. Exact browser-only/no-value explanations are in How it works. No fake transaction hashes or monetary/reward claims. |
| Typography | Checked | Local Nunito and Fraunces loaded in Chromium. Six-size source scale, two families and three weights. The probe found no tracking/casing issues. Addresses wrap and dynamic numeric values use tabular figures. Native 200% zoom was not measured. |
| Colors | Checked, with limits | On the `#f4e4d9` error surface, measured in the rendered state: error text 5.92:1, retry link 7.03:1, diagnostics text 9.39:1. Semantic role tokens, explicit selected/error states and readable disabled action. The probe passed resolved solid text/background pairs at 4.5:1 (3:1 for large text). SVG paints, shadows and transparent artwork are outside that measured contrast claim. |
| UI | Checked | State changes and all three events inspected. Modal is a bottom sheet on phones; interface surfaces avoid nested cards and border-plus-shadow combinations. No `transition: all`; no endless motion remains under reduced motion. No sound. Slow-motion developer-tools playback was not performed. |

## Findings corrected in the first build

These come from the first build’s review. Line numbers refer to that build. Findings from this repair are listed above.

1. **High, layout:** the initial mobile layout placed the signing button below 844px. At `src/style.css:1038`, compact header/intro spacing, a tighter SVG viewBox and shorter mobile choice presentation now put the complete action in the first 390px screen. The production browser suite asserts its bounding box and the final screenshot was inspected.
2. **High, layout:** the square’s overlay label crossed the idle caption at both 390 and 1440. `TownScene` now separates the artwork/labels into `.scene-canvas`, and the message has its own flow space. See `src/components/TownScene.tsx` and `src/style.css:277`. The final probe reports zero text overlap at all three widths.
3. **Medium, color:** disabled signing text measured 4.46:1. `src/style.css:583` now uses `#5c5543` on `#ddd8c7`. The resolved pair passed the final contrast probe.
4. **Medium, UI:** the reduced-motion checkbox briefly reverted while its asynchronous save completed. `src/game/useTown.ts:265` now updates its visible state immediately, persists it and recovers the saved state if writing fails. The browser checkbox/persistence interaction passed.
5. **Medium, writing:** the introduction sentence was repeated under the scene. The scene now uses a distinct idle message. The repetition probe passes.
6. **Low, accessibility/visual capture:** an off-viewport translated skip link appeared in full-page captures taken after scrolling. `src/style.css:913` now clips it until keyboard focus instead. It remains keyboard reachable and is hidden in ordinary screenshots.
7. **Medium, connector correctness:** the Rabby URL parameter was checked against its current public universal-link handler. `src/components/open-in.ts` uses `_cmd=open-dapp&dapp=…`, preserving the full actual site URL. The phone-sheet browser test checks those parameters.

No known unresolved high or medium implementation finding remains within the inspected scope. Untested environments below are limitations, not claimed passes.

## Earlier live observation

The first build recorded settled round 1973 and cumulative work 148986 at finalized block 12048695 on 2026-11-02, through the previous RPC. The current checks are listed under “What passed”.

## Limitations and completion

WebKit could not launch from the available browser runtime, so native Safari/WebKit remains unverified. Physical extensions/apps, app-to-wallet deep-link launches, actual Coinbase passkey signing, screen readers, native 200% zoom and forced-colors rendering were not tested. Contract-wallet verification is implemented with viem but was not exercised against a real smart-wallet account. No wallet transaction was sent.

A changed finalized anchor or unknown contract upgrade halts accrual and preserves the save; no automatic rollback/replay of already played local moments is attempted. Settlement and public-RPC availability are external dependencies, so live waiting has no guaranteed duration. IndexedDB is local game state and can be cleared or edited by its browser owner. It is not a shared or financially authoritative ledger.

Complete for the stated scope, with the limits listed here and under “Limits of these checks”. Dist is about 0.83 MiB, and the whole submission is well below the 8 MiB limit. The export, source, lockfile, README, design record and licenses are included for review and static publication by the task workflow.
