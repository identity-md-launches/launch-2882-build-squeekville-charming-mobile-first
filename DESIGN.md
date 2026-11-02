# Squeekville design

## Overview

Squeekville is a small interactive hamster town for a visitor who wants to make one pleasant local decision. One original SVG neighborhood carries the page: a warm wheel station behind a terracotta bakery, a sage park and a cobbled square. The controls read as a mayor’s small desk beside the scene on wide screens and directly below it on phones. The implemented identity is cream, sage, terracotta and amber, with soft illustrated shadows and warm evening light.

The scene and its three available locations appear immediately. No construction progression or missing-building placeholders are used. The three lines requested for the introduction are distributed between the main heading, its supporting sentence and the location-choice heading.

## Colors

Canonical tokens live at the beginning of `src/style.css`. Components consume semantic roles; SVG artwork uses its own closely related paint values.

| Role | Token | Implemented value and use |
| --- | --- | --- |
| Page | `--color-page` | `--cream-100`, `#f6f1e5`; warm continuous background |
| Elevated surface | `--color-surface` | `--cream-50`, `#fffaf0`; wallet sheet and scene labels |
| Main text | `--color-text` | `--ink-900`, `#3e382b` |
| Secondary text | `--color-muted` | `--ink-600`, `#736650` |
| Structure | `--color-border` | `--cream-300`, `#d9cfba`; choices and disclosure separators |
| Main action | `--color-accent` | `--sage-800`, `#3e5038`; signing button and action links |
| Main action hover | `--color-accent-hover` | `#536548` |
| Chosen location | `--color-selected` | `--terra-700`, `#925037`; selected marker and related state text |
| Error | `--color-error` | `#8d3e2f`; recoverable connection/signing errors |
| Focus | `--color-focus` | `#70442c`; 3px outline with 4px offset |
| Energy | `--color-energy` | `--amber-500`, `#cf9c47`; filled meter segments |

Selections also have a check, a border and `aria-pressed`; status is never conveyed by color alone. The active location surface is `#f6e9da`. The disabled primary button uses `#ddd8c7` with `#5c5543` text. Borders communicate structure or selection; the modal uses shadow without a border. There is no dark theme.

The final probe measured all resolved interface text/background pairs above its WCAG thresholds. SVG art paint and complex shadow/gradient combinations are not included in that claim. See the validation record for scope.

## Typography

Two local WOFF2 faces are declared in `src/style.css`: Nunito Variable for controls/body (available weights 200–900, used at 400 and 700), and Fraunces 600 for the brand and headings. Fallbacks are rounded/system sans for body and Georgia/serif for headings. Font display is `swap`; no remote font request is needed. The source uses only weights 400, 600 and 700.

The six shared sizes are 13, 15, 16, 20, 32 and 44px (`--text-small` through `--text-display`). Body line-height is 1.5; disclosure reading text uses 1.6; short headings use 1.15–1.3. The display heading tracks at -0.035em; body tracking stays natural. Headings balance across lines. Text values and IDs remain selectable, and full addresses wrap. Energy values and recorded chain facts use tabular numerals. Small painted SVG signs are illustration detail and are repeated in accessible HTML controls.

## Layout

The content maximum is 1340px with 36px desktop side padding. The wide play area is a flexible town column plus a 330px control column, separated by 28px. The scene is a single vector composition, not a grid of building cards. At 1000px the desk becomes 300px, the gap reduces and outer padding becomes 24px.

At 760px and below, the page becomes one column, with 20px side padding and the illustration bleeding to the edges. The desk divider disappears. Location choices form three equal columns; each keeps an icon, the complete action name and a selected check. The brand becomes 20px and the headline 32px. In the order area the signing action comes first, followed by the local-signing disclosure and then the footnote. Source order still places the disclosure first, and the button names it with `aria-describedby`. At 380px, side padding becomes 16px and secondary journal copy is suppressed to preserve room. No critical amount, action or address is ellipsized.

Spacing uses mostly 4, 8, 12, 16, 20, 24, 28, 36 and 40px. Dense controls are grouped more tightly than separate areas. The first 390×844 screen shows the illustrated town, energy meter, all three choices and the signing action, both disconnected and once connected. Rules and history remain accessible through native disclosures below play.

## Components

- **`TownScene` (`src/components/TownScene.tsx`)** owns the one illustrated map, original resident/tree/flower primitives, building labels and selected-location halo. `data-event` enables one 10-second local event at a time. The whole art has a descriptive accessible name. Native HTML location buttons repeat the illustrated landmarks.
- **`EnergyMeter` (`src/App.tsx`)** uses 12 fixed segments, a numerical value and native meter semantics. The number announces updates politely.
- **Location choices** use three matching buttons with `aria-pressed`. They lock while an order waits or an event runs. Distinct oven/water/lights icons retain the same stroke language and have redundant text.
- **Order area** places the local-signing disclosure before the signing action. Pending, rejection, wrong-network, verification, saved and error states have literal English explanations. The event state replaces the action label while disabled. The UI never invents transaction hashes.
- **`DiagnosticsPanel` (`src/App.tsx`)** sits inside the connection error, under **Retry connection**. It is a closed native `details` named “Connection diagnostics”, with a 44px summary, a top divider of `#e2cdbc` and a chevron hidden from assistive technology. Its `dl` stacks 13px labels at weight 700 over values in `--color-text` on the `#f4e4d9` error surface, with an 8px row gap and the same layout at every width. Long values wrap. It stays open across retries and disappears after a successful read. The error text above it says in plain words whether the failure was the RPC or the deployment.
- **`WalletSheet`** is a native modal `dialog` with a named heading, one close control, Escape/backdrop dismissal and browser focus management. It is a centered surface on desktop and a bottom sheet on phones. Rows are at least 52px high and include local/provider wallet marks. Full addresses remain available inside it.
- **Town Journal and How it works** use native `details`/`summary`. Journal kinds distinguish verified chain events, local orders/events and Practice. Finalized round/block facts and the last refresh live in the explanatory disclosure.
- **Practice controls** remain below the game action and are accompanied by the persistent “Practice mode - simulated data” banner. They never share a connected save.

Controls generally have 9–12px radii; the sheet has a 22px outer radius and smaller inner rows. The meter uses 3px corners. There are no nested card stacks, gradient text or ornamental status tickers.

## Motion and interaction

`src/style.css` names the animated properties explicitly. Buttons scale to 0.96 on press and use 150ms feedback. The station has a slow 24-second wheel rotation, a small running-hamster motion and soft fireflies. Baking adds fire, smoke and a loaf-carrying resident; the park adds water and gathering residents; the square adds warm bulbs and a cheerful gathering. All three return to idle after 10 seconds.

Both the system reduced-motion preference and the saved “Reduce town motion” setting stop scene animations. Event text and static visual changes still communicate the result. The help control also respects reduced motion when scrolling. There is no sound or countdown.

Native buttons, links, checkboxes, dialog and disclosures supply keyboard semantics. A clipped-until-focused skip link leads to the mayor controls, and a visible focus outline is shared across controls. Interactive labels have hover, pressed, selected, disabled and focus states. Errors use an alert region; pending/event states use status regions. English is the only interface language.

## Validation and maintenance

The six-domain review and actual commands are recorded in `VALIDATION.md`. Chromium inspection covered mobile and desktop, all event states, dialog keyboard behavior, expanded rules/history, connected first screen, expanded diagnostics and failure/retry states. The 16-check pinned probe passed at 320, 390 and 1440px, including the reduced-motion pass. Native Safari/WebKit, screen readers, physical devices and native 200% zoom remain unverified.

Reuse the existing tokens and components. Keep the town as the visual focus, keep the explicit signature disclosure, preserve clear Practice/connected boundaries and keep primary controls in the first phone screen. Do not use the illustrated energy as a financial balance or turn chain status into claims about block validation. Artwork and source credits are in `THIRD_PARTY.md`.
