import { emptySave, LOCATIONS, type TownSave } from "./types";
let dbPromise: Promise<IDBDatabase> | undefined;
let channel: BroadcastChannel | undefined;
const EVENT = "squeekville-save";
function database(): Promise<IDBDatabase> {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("squeekville-v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("towns", { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = undefined;
        reject(
          new Error(
            "Browser storage is unavailable. Enable site storage to play.",
          ),
        );
      };
    });
  return dbPromise;
}
function checkSave(value: TownSave, key: string): TownSave {
  if (
    value.version !== 1 ||
    value.key !== key ||
    !Number.isInteger(value.energy) ||
    value.energy < 0 ||
    value.energy > 12 ||
    !Array.isArray(value.completed) ||
    !Array.isArray(value.usedNonces) ||
    !Array.isArray(value.journal) ||
    (value.checkpoint !== null && !/^\d+$/.test(value.checkpoint)) ||
    !value.settings ||
    !Object.hasOwn(LOCATIONS, value.settings.selected) ||
    typeof value.settings.reducedMotion !== "boolean" ||
    (value.checkpointWork !== null && !/^\d+$/.test(value.checkpointWork)) ||
    (value.pending !== null &&
      (!value.pending ||
        !Object.hasOwn(LOCATIONS, value.pending.location) ||
        !/^0x[0-9a-fA-F]{64}$/.test(value.pending.id) ||
        !/^0x[0-9a-fA-F]{64}$/.test(value.pending.nonce) ||
        !["signed", "demo"].includes(value.pending.kind) ||
        typeof value.pending.origin !== "string" ||
        typeof value.pending.mayor !== "string" ||
        !Number.isSafeInteger(value.pending.issuedAt) ||
        !Number.isSafeInteger(value.pending.expiresAt) ||
        value.pending.energyCost !== 3))
  ) {
    throw new Error(
      "This browser save could not be read. Progress is preserved; no orders will run.",
    );
  }
  return value;
}
export async function readSave(key: string): Promise<TownSave> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("towns", "readonly")
      .objectStore("towns")
      .get(key);
    request.onsuccess = () => {
      try {
        resolve(checkSave(request.result ?? emptySave(key), key));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () =>
      reject(
        new Error(
          "Could not read town progress. Please allow browser storage.",
        ),
      );
  });
}
function broadcast(key: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  if (typeof BroadcastChannel !== "undefined") {
    channel ??= new BroadcastChannel(EVENT);
    channel.postMessage(key);
  }
}
// The read, decision and write happen in ONE serialized IndexedDB readwrite transaction.
// The promise resolves only after durability, so animations can never precede the deduction.
export async function changeSave<T>(
  key: string,
  change: (save: TownSave) => T,
): Promise<{ save: TownSave; result: T }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("towns", "readwrite");
    const store = tx.objectStore("towns");
    const request = store.get(key);
    let next: TownSave;
    let result: T;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        next = checkSave(request.result ?? emptySave(key), key);
        result = change(next);
        store.put(next);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      broadcast(key);
      resolve({ save: next!, result: result! });
    };
    tx.onabort = () =>
      reject(
        failure ??
          new Error("Town progress could not be saved. No energy was spent."),
      );
    tx.onerror = () => {
      failure ??= new Error(
        "Town progress could not be saved. No energy was spent.",
      );
    };
  });
}
export function subscribeSaves(listener: (key: string) => void) {
  const local = (event: Event) =>
    listener((event as CustomEvent<string>).detail);
  window.addEventListener(EVENT, local);
  const remote =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(EVENT)
      : null;
  if (remote)
    remote.onmessage = (event) => {
      if (typeof event.data === "string") listener(event.data);
    };
  return () => {
    window.removeEventListener(EVENT, local);
    remote?.close();
  };
}
