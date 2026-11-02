# Squeekville validation

Date: 2026-11-02. This is the builder’s check record, not independent certification.

## Scope and assumptions

Reviewed the one-page React/TypeScript app and the production `dist/` export, including all three town events, disconnected and connected states, signature refusal, waiting/pending, wrong network, connection failure/retry, account changes, saved progress, concurrent tabs and separate Practice. The site is static and uses a public Sepolia JSON-RPC endpoint. No hosting or onchain deployment is part of this delivery.

The one visual idea is a miniature neighborhood whose wheel-powered evening comes alive for one local mayor decision. Every building exists at first render. Practice is an explicit independent mode, never an outage fallback.

## Requirement coverage

| Area | Result | Evidence / limit |
| --- | --- | --- |
| Original illustrated town and three locations | Met | Original SVG/CSS, trees, paths, expressive residents, wheel station, bakery, fountain and lit square; inspected rendered idle and event states |
| Local energy: cap 12, cost 3, one pending order | Met | Engine tests, rendered waiting state, atomic spending and replay tests |
| Official address, ABI, `state()` and `roundPage()` | Met | Official published files pinned; actual public deployment identity/ledger check passed |
| Certified work and bounded recovery | Met | Cumulative-work deltas, certified zero gaps, frontier reconciliation, four bounded pages; no credit beyond the returned frontier |
| First initialization and later sessions | Met | Zero initial energy, no history credit, persisted checkpoint; tested recovery, repeated reads and reload |
| Confirmation policy and failures | Met | Explicit finalized Ethereum snapshots, hash rechecks; failures preserve energy/checkpoint and do not become zero work |
| EIP-712 and wallet handling | Met for implemented scope | Real cryptographic signatures from a controlled test provider; explicit connect/switch/sign, refusals and account changes tested; physical wallets and actual passkeys untested |
| Local instruction explanation | Met | Required pre-sign disclosure; local orders and chain events have separate journal kinds; no transaction hash or asset request |
| Storage / cross-tab behavior | Met | IndexedDB serialized transactions, atomic deduction/completed ID before animation; race test and refresh replay test passed |
| Separate Practice | Met | Persistent simulated-data banner, unsigned demo orders, positive/zero simulator and independent save |
| All three 8–12 second events | Met | All three 10-second events rendered and exercised in Practice and signed-order test paths, returning to idle |
| English, metadata, static paths | Met | English copy review and `Intl` locale; PNG share card, title, description, favicon, OG fields; nested `/town/` serving passed |
| First screen at 390px | Met | Town, meter, all choices and signing action visible at 390×844; checked screenshot and action bounding box |
| Source, lockfile and export budget | Met | Complete source and local assets, lockfile and `dist/`; final byte inventory below the 8 MiB ceiling |

## Six-domain interface review

| Domain | Coverage | Observations and evidence |
| --- | --- | --- |
| Accessibility | Checked, with limits | Native buttons, checkboxes, dialog and details; descriptive art label; redundant selection/check state; visible 3px focus outline. Keyboard opening, dialog focus containment, Escape/restore and reduced-motion emulation checked. No native screen-reader, physical-device, forced-colors or native zoom session was performed. |
| Layout | Checked | Screenshots at 390 and 1440; measurements at 320, 390, 760 and 1440; expanded rules/journal, pending and event states tested. No horizontal overflow at the measured widths. Small-screen action was moved into the first screen. |
| Writing | Checked | All authored user text is English. Buttons name the action, errors offer retry, and pending text distinguishes a local signature from settlement. Exact browser-only/no-value explanations are in How it works. No fake transaction hashes or monetary/reward claims. |
| Typography | Checked | Local Nunito and Fraunces loaded in Chromium. Six-size source scale, two families and three weights. The probe found no tracking/casing issues. Addresses wrap and dynamic numeric values use tabular figures. Native 200% zoom was not measured. |
| Colors | Checked, with limits | Semantic role tokens, explicit selected/error states and readable disabled action. The probe passed resolved solid text/background pairs at 4.5:1 (3:1 for large text). SVG paints, shadows and transparent artwork are outside that measured contrast claim. |
| UI | Checked | State changes and all three events inspected. Modal is a bottom sheet on phones; interface surfaces avoid nested cards and border-plus-shadow combinations. No `transition: all`; no endless motion remains under reduced motion. No sound. Slow-motion developer-tools playback was not performed. |

## Findings corrected

Source locations refer to the formatted final source.

1. **High, layout:** the initial mobile layout placed the signing button below 844px. At `src/style.css:1038`, compact header/intro spacing, a tighter SVG viewBox and shorter mobile choice presentation now put the complete action in the first 390px screen. The production browser suite asserts its bounding box and the final screenshot was inspected.
2. **High, layout:** the square’s overlay label crossed the idle caption at both 390 and 1440. `TownScene` now separates the artwork/labels into `.scene-canvas`, and the message has its own flow space. See `src/components/TownScene.tsx` and `src/style.css:277`. The final probe reports zero text overlap at all three widths.
3. **Medium, color:** disabled signing text measured 4.46:1. `src/style.css:583` now uses `#5c5543` on `#ddd8c7`. The resolved pair passed the final contrast probe.
4. **Medium, UI:** the reduced-motion checkbox briefly reverted while its asynchronous save completed. `src/game/useTown.ts:265` now updates its visible state immediately, persists it and recovers the saved state if writing fails. The browser checkbox/persistence interaction passed.
5. **Medium, writing:** the introduction sentence was repeated under the scene. The scene now uses a distinct idle message. The repetition probe passes.
6. **Low, accessibility/visual capture:** an off-viewport translated skip link appeared in full-page captures taken after scrolling. `src/style.css:913` now clips it until keyboard focus instead. It remains keyboard reachable and is hidden in ordinary screenshots.
7. **Medium, connector correctness:** the Rabby URL parameter was checked against its current public universal-link handler. `src/components/open-in.ts` uses `_cmd=open-dapp&dapp=…`, preserving the full actual site URL. The phone-sheet browser test checks those parameters.

No known unresolved high or medium implementation finding remains within the inspected scope. Untested environments below are limitations, not claimed passes.

## Actual verification

- `npm run build`: passed, including TypeScript checking and Vite’s production export. Only Latin WOFF2 fonts needed by the English app are bundled. A dependency emitted a browser-externalization warning for `node:worker_threads`; the exercised production paths had no runtime error.
- `npm run typecheck`: passed.
- `npm test`: 2 files, **28 passing tests**. Covers real EIP-712 signer recovery; wrong account/origin, expiry, altered fields and invalid restored signatures; one pending order; consumed nonce replay; cancel; all three demo actions; capped credits; stale cursor deduplication; incomplete/invalid page rejection; exact bigint arithmetic; isolated saves; concurrent spending and account-change guards.
- `node test/browser.mjs <provided-Playwright-module>` with the provided Chromium runtime: production export under `/town/`, all three Practice events and signed EIP-712 event paths; connection/signature refusals; wrong-network switch/add; no prompt to sign on connection; saved-energy immediate execution; account changes during signing; reload; two-tab execution race; RPC failure/retry; phone wallet rows/deep-link URL; dialog keyboard/focus; expanded facts; no overflow at 320, 390, 760 and 1440. The controlled test provider and RPC fixtures are **test doubles**, not observations of new real hamster rounds.
- Pinned `taste.mjs --out test/scratch/taste`, using the provided Playwright/Chromium runtime: **16/16 checks passed**. Checks: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes, type faces, glyphs, slogans, repetition, copy budget, chrome, motion, share. All 13 measured initial controls satisfy the 24px/spacing baseline; three compact controls are below the preferred 44px height. No script errors or missing local files. SVG painted lettering is excluded from its text analysis.
- Live public adapter read: the official deployment graph, identities and ledger reconciliation passed; 23 public RPC requests were captured in `test/fixtures/sepolia-identity.json` at finalized Ethereum block **12048632**. First initialization returned no credited rounds.
- Separate **live Chromium cross-origin** JSON-RPC check: chain **11155111**, finalized Ethereum block **12048695**, Squeekchain frontier **1973**, cumulative physical work **148986**, completed Squeek block height **13095**, not paused. Published `state()` ABI decoding succeeded. These are dated observations, not current-state promises. No REST API, private/keyed endpoint or simulated result was used for these live checks.

Screenshots were generated and inspected in `test/scratch/taste/shots/` and `test/scratch/browser-check/` for the mobile first screen, desktop, all three events and the phone wallet sheet. These temporary captures are deliberately outside the submitted source bundle. The shipped `public/share.png` was also rendered and visually inspected.

## Limitations and completion

WebKit could not launch from the available browser runtime, so native Safari/WebKit remains unverified. Physical extensions/apps, app-to-wallet deep-link launches, actual Coinbase passkey signing, screen readers, native 200% zoom and forced-colors rendering were not tested. Contract-wallet verification is implemented with viem but was not exercised against a real smart-wallet account. No wallet transaction was sent.

A changed finalized anchor or unknown contract upgrade halts accrual and preserves the save; no automatic rollback/replay of already played local moments is attempted. Settlement and public-RPC availability are external dependencies, so live waiting has no guaranteed duration. IndexedDB is local game state and can be cleared or edited by its browser owner. It is not a shared or financially authoritative ledger.

Complete for the stated build scope, with the explicit environment and device coverage limits above. The final inventory is about 1.3 MiB including the source and 0.83 MiB static export, below the 8 MiB limit. The export, source, lockfile, README, design record and licenses are included for review and static publication by the task workflow.
