import { useEffect, useRef, useState } from "react";
import {
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { getAddress } from "viem";
import { CHAIN_ID } from "../chain/config";
import { OPEN_IN, isMobileBrowser } from "./open-in";
import { Icon } from "./Icons";
export function userError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancelled|canceled|4001/i.test(message))
    return "Request declined in your wallet. Nothing was changed. You can try again.";
  if (/not found|not installed|not available|provider/i.test(message))
    return "No browser wallet was found. Open this page in a wallet app or choose Coinbase Wallet.";
  return fallback;
}
export function WalletSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [error, setError] = useState("");
  const mobile =
    isMobileBrowser() &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  useEffect(() => {
    if (open) {
      setError("");
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [open]);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK"
        ? mobile
          ? "Coinbase Smart Wallet"
          : "Coinbase Wallet"
        : c.name;
  const icon = (c: Connector) =>
    c.icon ??
    (c.id === "coinbaseWalletSDK" ? "./wallets/coinbase.svg" : undefined);
  return (
    <dialog
      ref={dialog}
      className="wallet-sheet"
      aria-labelledby="wallet-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="sheet-heading">
        <h2 id="wallet-title">
          {isConnected ? "Your mayor wallet" : "Connect a wallet"}
        </h2>
        <button
          className="icon-button"
          aria-label="Close wallet menu"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {isConnected && address ? (
        <>
          <p className="full-address">{getAddress(address)}</p>
          <p>
            {chainId === CHAIN_ID
              ? "Connected to Sepolia."
              : "Switch to Sepolia to use your connected town."}
          </p>
          {chainId !== CHAIN_ID && (
            <button
              className="primary"
              disabled={switchChain.isPending}
              onClick={() =>
                switchChain.mutate(
                  { chainId: CHAIN_ID },
                  {
                    onSuccess: onClose,
                    onError: (error) =>
                      setError(
                        userError(
                          error,
                          "Could not switch networks. Choose Sepolia in your wallet and try again.",
                        ),
                      ),
                  },
                )
              }
            >
              {switchChain.isPending
                ? "Switching to Sepolia…"
                : "Switch to Sepolia"}
            </button>
          )}
          <button
            className="wallet-row"
            onClick={() => {
              disconnect.mutate({});
              onClose();
            }}
          >
            Disconnect wallet <Icon name="arrow" />
          </button>
          <p className="small muted">
            Disconnecting keeps this browser’s town progress.
          </p>
        </>
      ) : (
        <>
          <p className="muted sheet-intro">
            A local mayor order needs a signature, never a transaction.
          </p>
          {mobile &&
            OPEN_IN.map((wallet) => (
              <a
                className="wallet-row"
                key={wallet.id}
                href={wallet.href(window.location.href)}
              >
                <img
                  src={`./wallets/${wallet.id}.svg`}
                  width="28"
                  height="28"
                  alt=""
                />
                <span>Open in {wallet.name}</span>
                <Icon name="arrow" size={18} />
              </a>
            ))}
          {listed.map((connector) => (
            <button
              className="wallet-row"
              key={connector.uid}
              disabled={connect.isPending}
              onClick={() => {
                setError("");
                connect.mutate(
                  { connector },
                  {
                    onSuccess: onClose,
                    onError: (error) =>
                      setError(
                        userError(
                          error,
                          "The wallet could not connect. Try again or choose another wallet.",
                        ),
                      ),
                  },
                );
              }}
            >
              {icon(connector) ? (
                <img src={icon(connector)} width="28" height="28" alt="" />
              ) : (
                <Icon name="wallet" size={28} />
              )}
              <span>
                {label(connector)}
                {connect.isPending && connect.variables?.connector === connector
                  ? " · opening…"
                  : ""}
              </span>
              <Icon name="arrow" size={18} />
            </button>
          ))}
          <p className="small muted">
            On a phone, open this page in your wallet’s browser. Coinbase also
            offers a passkey wallet.
          </p>
        </>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
