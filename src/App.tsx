import { useRef, useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { getAddress } from "viem";
import { CHAIN_ID, CORE_ADDRESS } from "./chain/config";
import { useTown } from "./game/useTown";
import { LOCATIONS, type Location } from "./game/types";
import { Icon, HamsterMark } from "./components/Icons";
import { TownScene } from "./components/TownScene";
import { WalletSheet, userError } from "./components/WalletSheet";
const locationIcons = {
  bakery: "oven",
  park: "water",
  square: "lights",
} as const;
const date = (time: number) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
function EnergyMeter({
  value,
  practice,
}: {
  value: number;
  practice: boolean;
}) {
  return (
    <div className="energy-block">
      <div className="energy-label">
        <span>
          <Icon name="bolt" size={19} /> Town Energy
        </span>
        <strong aria-live="polite">
          {value}
          <span className="muted"> / 12</span>
        </strong>
      </div>
      <div
        className="energy-meter"
        role="meter"
        aria-label={practice ? "Practice Town Energy" : "Town Energy"}
        aria-valuemin={0}
        aria-valuemax={12}
        aria-valuenow={value}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={i < value ? "filled" : ""} />
        ))}
      </div>
    </div>
  );
}
export default function App() {
  const town = useTown();
  const { address, isConnected, chainId, status } = useConnection();
  const switchChain = useSwitchChain();
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [positiveDemo, setPositiveDemo] = useState(true);
  const how = useRef<HTMLDetailsElement>(null);
  const practice = town.mode === "practice";
  const energy = town.save?.energy ?? 0;
  const pending = town.save?.pending;
  const wrongNetwork = !practice && isConnected && chainId !== CHAIN_ID;
  const signDisabled =
    !town.canRun || !town.save || !!pending || !!town.event || town.busy;
  const shortAddress = address
    ? `${getAddress(address).slice(0, 6)}…${getAddress(address).slice(-4)}`
    : "";
  const switchNetwork = () => {
    setWalletError("");
    switchChain.mutate(
      { chainId: CHAIN_ID },
      {
        onError: (error) =>
          setWalletError(
            userError(
              error,
              "Could not switch to Sepolia. Select Sepolia in your wallet and try again.",
            ),
          ),
      },
    );
  };
  const pendingText = pending
    ? `Waiting for ${Math.max(0, 3 - energy)} more energy. ${LOCATIONS[pending.location].title} will run once.`
    : "";
  return (
    <>
      <a className="skip-link" href="#mayor-controls">
        Skip to town controls
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Squeekville home">
          <HamsterMark />
          <span>
            Squeekville
            <span className="brand-note">A little town, hamster powered</span>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="icon-button help-button"
            aria-label="How Squeekville works"
            onClick={() => {
              if (how.current) {
                how.current.open = true;
                how.current.scrollIntoView({
                  behavior:
                    town.save?.settings.reducedMotion ||
                    matchMedia("(prefers-reduced-motion: reduce)").matches
                      ? "auto"
                      : "smooth",
                  block: "start",
                });
                how.current.querySelector("summary")?.focus();
              }
            }}
          >
            <Icon name="help" />
          </button>
          <button
            className="wallet-button"
            onClick={wrongNetwork ? switchNetwork : () => setWalletOpen(true)}
            disabled={switchChain.isPending}
          >
            <Icon name="wallet" size={18} />
            <span>
              {switchChain.isPending
                ? "Switching…"
                : wrongNetwork
                  ? "Switch to Sepolia"
                  : isConnected
                    ? shortAddress
                    : status === "reconnecting"
                      ? "Reconnecting…"
                      : "Connect wallet"}
            </span>
          </button>
        </div>
      </header>
      <main>
        <div className="intro">
          <h1>The hamster powers the town.</h1>
          <p>Watch your neighborhood come alive.</p>
        </div>
        <div className="play-layout">
          <section className="world" aria-label="Squeekville town">
            <div className="mode-row">
              <div className="mode-switch" role="group" aria-label="Game mode">
                <button
                  aria-pressed={!practice}
                  onClick={() => town.setMode("connected")}
                >
                  <span className="network-dot" /> Connected town
                </button>
                <button
                  aria-pressed={practice}
                  onClick={() => town.setMode("practice")}
                >
                  <Icon name="leaf" size={16} /> Practice
                </button>
              </div>
              <span className="world-note">A cozy corner of Sepolia</span>
            </div>
            {practice && (
              <p className="practice-banner">Practice mode - simulated data</p>
            )}
            <TownScene
              selected={town.selected}
              event={town.event}
              onSelect={town.select}
              reducedMotion={town.save?.settings.reducedMotion ?? false}
            />
          </section>
          <section
            className="mayor-desk"
            id="mayor-controls"
            aria-labelledby="choice-title"
          >
            <EnergyMeter value={energy} practice={practice} />
            <div className="choice-heading">
              <h2 id="choice-title">Choose where to send energy.</h2>
              <span>Each order uses 3 energy</span>
            </div>
            <div
              className="location-choices"
              role="group"
              aria-label="Choose a mayor order"
            >
              {(Object.keys(LOCATIONS) as Location[]).map((location) => (
                <button
                  key={location}
                  className={`location-choice ${town.selected === location ? "selected" : ""}`}
                  aria-pressed={town.selected === location}
                  onClick={() => town.select(location)}
                  disabled={!!pending || !!town.event}
                >
                  <span className={`location-symbol symbol-${location}`}>
                    <Icon name={locationIcons[location]} size={27} />
                  </span>
                  <span className="choice-copy">
                    <span className="location-name">
                      {LOCATIONS[location].name}
                    </span>
                    <span className="location-title">
                      {LOCATIONS[location].title}
                    </span>
                  </span>
                  <span className="choice-check" aria-hidden="true">
                    {town.selected === location && (
                      <Icon name="check" size={16} />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="order-area">
              <p className="location-description">
                {LOCATIONS[town.selected].description}
              </p>
              {pending ? (
                <div className="pending-order" role="status">
                  <div className="pending-title">
                    <span className="status-dot" />
                    <strong>
                      {pending.kind === "signed"
                        ? "Local order signed"
                        : "Unsigned demo order"}
                    </strong>
                  </div>
                  <p>
                    {!practice && town.chainStatus === "error"
                      ? "Chain connection is paused. Your local order stays saved."
                      : wrongNetwork
                        ? "Switch to Sepolia. Your local order stays saved."
                        : energy >= 3
                          ? "Signature verification in progress. Your order will run once."
                          : pendingText}
                  </p>
                  <p className="small muted">
                    Expires {date(pending.expiresAt * 1000)}.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => void town.cancel()}
                  >
                    Cancel pending order
                  </button>
                </div>
              ) : (
                <>
                  {town.canRun && !practice && (
                    <p className="sign-disclosure">
                      Sign a local mayor order. This does not send a
                      transaction, transfer assets or grant approvals. Your
                      order and town progress are saved in this browser.
                    </p>
                  )}
                  {practice && (
                    <p className="small muted">
                      An unsigned demo order. Your wallet is not involved.
                    </p>
                  )}
                  <button
                    className="primary sign-button"
                    onClick={() => void town.placeOrder()}
                    disabled={signDisabled}
                    aria-describedby={
                      !practice && town.canRun ? "local-order-note" : undefined
                    }
                  >
                    {town.busy ? (
                      <>
                        <span className="spinner" />{" "}
                        {practice ? "Saving demo order…" : "Check your wallet…"}
                      </>
                    ) : town.event ? (
                      <>
                        <Icon name="check" /> Town moment in progress
                      </>
                    ) : (
                      <>
                        <span>
                          {practice ? "Place demo order" : "Sign mayor order"}
                        </span>
                        <Icon name="arrow" size={19} />
                      </>
                    )}
                  </button>
                  <p className="small order-footnote" id="local-order-note">
                    {!practice && !isConnected
                      ? "Connect a wallet above, or explore in Practice."
                      : wrongNetwork
                        ? "Your town is saved. Switch to Sepolia to continue."
                        : !practice && town.chainStatus === "loading"
                          ? "Verifying the Squeekchain deployment…"
                          : !practice && town.chainStatus === "error"
                            ? "Connected mode unavailable. Your progress is saved."
                            : town.event
                              ? "A little moment of happiness. Then back to a quiet town."
                              : energy < 3
                                ? "Your order waits safely until 3 energy is available."
                                : "Ready to bring a little life to town."}
                  </p>
                </>
              )}
              {town.error && (
                <p className="error-note" role="alert">
                  {town.error}
                </p>
              )}
              {walletError && (
                <p className="error-note" role="alert">
                  {walletError}
                </p>
              )}
            </div>
            {practice ? (
              <div className="practice-controls">
                <button
                  className="secondary"
                  onClick={() => void town.simulate(positiveDemo)}
                >
                  <Icon name="refresh" size={17} /> Simulate a settled round
                </button>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={positiveDemo}
                    onChange={(event) => setPositiveDemo(event.target.checked)}
                  />{" "}
                  Positive work (+3 energy)
                </label>
                <p className="small muted">
                  Uncheck for zero work (+1). Practice saves stay separate.
                </p>
              </div>
            ) : (
              <div
                className={`chain-status ${town.chainStatus === "error" ? "unavailable" : ""}`}
                role="status"
              >
                <span className="status-dot" />
                <span>
                  {wrongNetwork
                    ? "Wrong network. Sepolia is required."
                    : !isConnected
                      ? "Real hamster work. Verified on Sepolia."
                      : town.chainStatus === "loading"
                        ? "Connecting to Squeekchain…"
                        : town.chainStatus === "error"
                          ? "Chain connection paused"
                          : town.refreshing
                            ? "Checking settled rounds…"
                            : town.more
                              ? "Catching up on settled rounds…"
                              : "Connected to Squeekchain"}
                </span>
                {isConnected && !wrongNetwork && (
                  <button
                    className="icon-button"
                    disabled={town.refreshing}
                    aria-label="Refresh verified rounds"
                    onClick={town.refresh}
                  >
                    <Icon name="refresh" size={16} />
                  </button>
                )}
              </div>
            )}
            {!practice && town.chainStatus === "error" && (
              <div className="connection-error">
                <p>{town.chainNote}</p>
                <button
                  className="text-button"
                  disabled={town.refreshing}
                  onClick={town.refresh}
                >
                  {town.refreshing ? "Retrying…" : "Retry connection"}
                </button>
              </div>
            )}
          </section>
        </div>
        <section className="town-records" aria-label="Town details">
          <details className="journal">
            <summary>
              <span>
                <Icon name="book" /> Town Journal
              </span>
              <span className="summary-detail">
                {town.save?.journal.length
                  ? `${town.save.journal.length} recent entries`
                  : "The little things, remembered"}
                <span className="disclosure-chevron">⌄</span>
              </span>
            </summary>
            <div className="details-body">
              <p className="small muted">
                Verified chain events and local town moments are recorded
                separately.
              </p>
              {town.save?.journal.length ? (
                <ol className="journal-list">
                  {town.save.journal.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <span className={`entry-kind kind-${entry.kind}`}>
                          {entry.kind === "chain"
                            ? "Verified chain"
                            : entry.kind === "practice"
                              ? "Practice"
                              : "Local town"}
                        </span>
                        <time dateTime={new Date(entry.time).toISOString()}>
                          {new Intl.DateTimeFormat("en", {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(entry.time)}
                        </time>
                      </div>
                      <p>{entry.text}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-journal">
                  <Icon name="leaf" size={28} />
                  <p>Your town’s story starts with a mayor order.</p>
                  <p className="small muted">
                    {practice
                      ? "Place a demo order, then simulate a settled round."
                      : "Connect a wallet, or try the separate Practice town."}
                  </p>
                </div>
              )}
            </div>
          </details>
          <details ref={how} className="how-it-works">
            <summary>
              <span>
                <Icon name="help" /> How it works
              </span>
              <span className="summary-detail">
                Small town, honest rules
                <span className="disclosure-chevron">⌄</span>
              </span>
            </summary>
            <div className="details-body">
              <h3>Real work. Local little moments.</h3>
              <p>
                Connect a wallet on Sepolia, choose a location and explicitly
                sign a local mayor order. Only one order can wait at a time.
                When your town has 3 energy, the verified order runs once.
              </p>
              <p>
                Signing confirms a local instruction. It does not validate a
                block, settle a round or send an onchain transaction.
              </p>
              <h3>Where energy comes from</h3>
              <p>
                Newly verified settled Squeekchain rounds supply Town Energy:
                zero work adds 1, positive work adds 3, up to 12. Your first
                connection starts at 0 and checkpoints the latest settled round.
                Earlier history earns nothing.
              </p>
              <p>
                We read SqueekCore’s certified frontier and round pages at one
                finalized Ethereum block. A pending or unknown round is never
                treated as zero work. Ethereum finality, Squeekchain round
                settlement and Squeek block completion are different events;
                only settled rounds supply game energy.
              </p>
              <p>
                The official docs leave the Ethereum confirmation policy to the
                app. Squeekville chooses the RPC’s <strong>finalized</strong>{" "}
                block tag, with no faster fallback. Refreshes run about every 30
                seconds while visible, with slower retries after errors.
                Settlement may be delayed; there is no guaranteed wait time.
              </p>
              <p>
                On connection failure, energy accrual pauses and your progress
                stays saved. Practice is always separate simulated data.
              </p>
              <dl className="chain-facts">
                <div>
                  <dt>Last verified round</dt>
                  <dd>
                    {practice
                      ? "Not applicable in Practice"
                      : (town.save?.latestVerifiedRound ?? "Not verified yet")}
                  </dd>
                </div>
                <div>
                  <dt>Saved round checkpoint</dt>
                  <dd>
                    {practice
                      ? "Separate Practice save"
                      : (town.save?.checkpoint ?? "Not initialized")}
                  </dd>
                </div>
                <div>
                  <dt>Last successful refresh</dt>
                  <dd>
                    {!practice && town.save?.lastSuccess
                      ? date(town.save.lastSuccess)
                      : "No connected refresh yet"}
                  </dd>
                </div>
                <div>
                  <dt>Finalized Ethereum block</dt>
                  <dd>
                    {!practice && town.save?.anchor
                      ? town.save.anchor.number
                      : "Not verified yet"}
                  </dd>
                </div>
              </dl>
              <p className="small muted contract-address">
                SqueekCore V3 · Sepolia
                <br />
                <a
                  href={`https://eth-sepolia.blockscout.com/address/${CORE_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {CORE_ADDRESS}
                </a>
              </p>
              <p>
                <a
                  href="https://docs.squeekchain.com/developers/core/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official SqueekCore documentation ↗
                </a>
              </p>
              <h3>A town that lives in this browser</h3>
              <p>
                Town progress is saved in this browser and does not sync across
                devices.
              </p>
              <p>
                Town Energy is a local game resource with no monetary value.
              </p>
              <p>
                Saved orders expire after 24 hours. The signature includes your
                account, the location, the 3-energy cost, a unique nonce, dates
                and this site’s actual origin. Wallets, chains and Practice each
                have separate saves. Changing your browser or site origin does
                not carry orders over.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  disabled={!town.save}
                  checked={town.save?.settings.reducedMotion ?? false}
                  onChange={(event) =>
                    void town.setReducedMotion(event.target.checked)
                  }
                />{" "}
                Reduce town motion
              </label>
              <p className="small muted">
                Your system’s reduced-motion setting is respected too. No sound
                is played.
              </p>
            </div>
          </details>
        </section>
      </main>
      <footer>
        <span>
          <Icon name="leaf" size={16} /> A small town. A softer kind of power.
        </span>
        <span>Saved in this browser · No monetary value</span>
      </footer>
      <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
}
