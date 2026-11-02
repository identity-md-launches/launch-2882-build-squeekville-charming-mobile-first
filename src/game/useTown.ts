import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useSignTypedData } from "wagmi";
import { walletConfig, CHAIN_ID } from "../chain/config";
import { fetchSnapshot } from "../chain/adapter";
import { changeSave, readSave, subscribeSaves } from "./store";
import {
  applySnapshot,
  cancelOrder,
  executeOrder,
  queueOrder,
  simulateRound,
} from "./engine";
import { createDemoOrder, createOrder, typedOrder } from "./orders";
import { saveKey, type Location, type Mode, type TownSave } from "./types";
import { userError } from "../components/WalletSheet";

export function useTown() {
  const { address, chainId, isConnected } = useConnection();
  const signTypedData = useSignTypedData();
  const [mode, setMode] = useState<Mode>("connected");
  const [save, setSave] = useState<TownSave | null>(null);
  const [selected, setSelected] = useState<Location>("bakery");
  const [chainStatus, setChainStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [chainNote, setChainNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<Location | null>(null);
  const [more, setMore] = useState(false);
  const key =
    mode === "practice"
      ? saveKey(mode)
      : address && isConnected
        ? saveKey(mode, address)
        : null;
  const latest = useRef({ key, mode });
  latest.current = { key, mode };
  const refreshRef = useRef<() => void>(() => {});
  const active = useCallback((expectedKey: string) => {
    if (latest.current.key !== expectedKey) return false;
    if (latest.current.mode === "practice")
      return expectedKey === "practice:v1";
    const state = walletConfig.state;
    const connection = state.current
      ? state.connections.get(state.current)
      : undefined;
    return (
      state.status === "connected" &&
      connection?.chainId === CHAIN_ID &&
      expectedKey ===
        `connected:11155111:${connection.accounts[0]?.toLowerCase()}`
    );
  }, []);
  useEffect(() => {
    let live = true;
    setSave(null);
    setError("");
    setEvent(null);
    setBusy(false);
    if (!key) return;
    const load = () =>
      readSave(key)
        .then((value) => {
          if (live) {
            setSave(value);
            setSelected(value.settings.selected);
          }
        })
        .catch((error) => {
          if (live) setError(error.message);
        });
    void load();
    const unsubscribe = subscribeSaves((changed) => {
      if (changed === key) void load();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [key]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    let failures = 0;
    setChainStatus("idle");
    setChainNote("");
    setRefreshing(false);
    setMore(false);
    if (!key || mode !== "connected" || !isConnected || chainId !== CHAIN_ID) {
      refreshRef.current = () => {};
      return;
    }
    const refresh = async () => {
      if (stopped || inFlight || !active(key)) return;
      if (document.visibilityState === "hidden") {
        timer = setTimeout(() => void refresh(), 30_000);
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      setRefreshing(true);
      if (!failures)
        setChainStatus((current) =>
          current === "ready" ? current : "loading",
        );
      let delay = 30_000;
      try {
        const current = await readSave(key);
        const snapshot = await fetchSnapshot(current);
        if (stopped || !active(key)) return;
        const next = await applySnapshot(key, snapshot);
        if (stopped) return;
        setSave(next.save);
        setChainStatus("ready");
        failures = 0;
        setMore(snapshot.more);
        setChainNote(
          snapshot.paused
            ? "Squeekchain settlement is paused. Previously settled rounds remain verified."
            : snapshot.more
              ? "Catching up on settled rounds in order."
              : "Reading finalized Sepolia settlements.",
        );
        if (snapshot.more) delay = 5_000;
      } catch (error) {
        if (stopped) return;
        failures++;
        setChainStatus("error");
        setChainNote(
          error instanceof Error &&
            !/http|fetch|request|timeout|network/i.test(error.message)
            ? error.message
            : "Sepolia could not be reached. Connected mode is unavailable. Progress is saved; energy accrual is paused.",
        );
        delay = Math.min(300_000, 30_000 * 2 ** Math.min(failures - 1, 4));
      } finally {
        inFlight = false;
        if (!stopped) {
          setRefreshing(false);
          timer = setTimeout(() => {
            if (document.visibilityState === "visible") void refresh();
            else timer = setTimeout(() => void refresh(), 30_000);
          }, delay);
        }
      }
    };
    refreshRef.current = () => void refresh();
    const online = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", online);
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", online);
    };
  }, [key, mode, isConnected, chainId, active]);
  const canRun =
    mode === "practice" ||
    (chainStatus === "ready" && chainId === CHAIN_ID && isConnected);
  useEffect(() => {
    if (!key || !save?.pending || !canRun || event) return;
    executeOrder(key, address, window.location.origin, mode, () => active(key))
      .then((result) => {
        if (result && active(key)) {
          setEvent(result.location);
          setError("");
        }
      })
      .catch((error) => {
        if (active(key)) setError(error.message);
      });
  }, [
    key,
    address,
    mode,
    save?.pending?.id,
    save?.energy,
    canRun,
    event,
    active,
  ]);
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setEvent(null), 10_000);
    return () => clearTimeout(timer);
  }, [event]);
  const select = (location: Location) => {
    if (save?.pending || event) return;
    setSelected(location);
    if (key)
      void changeSave(key, (save) => {
        save.settings.selected = location;
      }).catch((error) => setError(error.message));
  };
  const placeOrder = async () => {
    if (!key || !canRun || busy || event) return;
    setBusy(true);
    setError("");
    try {
      if (!active(key))
        throw new Error("Connect the correct account on Sepolia to sign.");
      let order;
      if (mode === "practice")
        order = createDemoOrder(selected, window.location.origin);
      else {
        if (!address) throw new Error("Connect a wallet first.");
        const draft = createOrder(address, selected, window.location.origin);
        const signature = await signTypedData.mutateAsync({
          ...typedOrder(draft),
          account: address,
        });
        order = { ...draft, signature };
      }
      if (!active(key))
        throw new Error(
          "The account, network or mode changed. This order was not saved.",
        );
      await queueOrder(key, order, address, window.location.origin, mode, () =>
        active(key),
      );
    } catch (error) {
      if (latest.current.key === key)
        setError(
          /reject|denied|4001/i.test(
            error instanceof Error ? error.message : "",
          )
            ? "Signature declined. No order was saved and no energy was spent. You can sign again."
            : error instanceof Error &&
                !/version:|request arguments|details:/i.test(error.message)
              ? error.message
              : userError(
                  error,
                  "Could not verify this signature. No energy was spent. Please try again.",
                ),
        );
    } finally {
      if (latest.current.key === key) setBusy(false);
    }
  };
  const simulate = async (positive: boolean) => {
    if (mode !== "practice" || !key) return;
    setError("");
    try {
      await simulateRound(key, positive);
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const cancel = async () => {
    if (key)
      try {
        await cancelOrder(key);
        setError("");
      } catch (error) {
        setError((error as Error).message);
      }
  };
  const setReducedMotion = async (value: boolean) => {
    if (!key) return;
    setSave((current) =>
      current
        ? {
            ...current,
            settings: { ...current.settings, reducedMotion: value },
          }
        : current,
    );
    try {
      await changeSave(key, (save) => {
        save.settings.reducedMotion = value;
      });
    } catch (error) {
      setError((error as Error).message);
      void readSave(key)
        .then(setSave)
        .catch(() => {});
    }
  };
  return {
    mode,
    setMode,
    save,
    selected,
    select,
    chainStatus,
    chainNote,
    refreshing,
    more,
    error,
    busy,
    event,
    canRun,
    placeOrder,
    simulate,
    cancel,
    setReducedMotion,
    refresh: () => refreshRef.current(),
  };
}
