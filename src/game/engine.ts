import { type Address } from "viem";
import { changeSave, readSave } from "./store";
import { verifyOrder, validateOrderFields } from "./orders";
import {
  addJournal,
  LOCATIONS,
  type ChainSnapshot,
  type Location,
  type Mode,
  type Order,
} from "./types";

export async function applySnapshot(key: string, snapshot: ChainSnapshot) {
  return changeSave(key, (save) => {
    if (!key.startsWith("connected:11155111:"))
      throw new Error("Chain data cannot enter a Practice save.");
    if (save.checkpoint !== snapshot.from) return false; // Another tab already advanced this cursor.
    if (
      save.anchor &&
      BigInt(snapshot.anchor.number) < BigInt(save.anchor.number)
    )
      throw new Error(
        "The RPC returned an older snapshot. Progress is preserved.",
      );
    if (save.checkpoint === null) {
      save.energy = 0;
      addJournal(
        save,
        "chain",
        `Town initialized at settled round ${snapshot.through}. Earlier history was not credited.`,
      );
    } else {
      let next = BigInt(save.checkpoint) + 1n;
      for (const round of snapshot.rounds) {
        if (round.id !== next || round.work < 0n)
          throw new Error(
            "Round history is incomplete. Energy accrual is paused.",
          );
        const credit = round.work === 0n ? 1 : 3;
        const actual = Math.min(credit, 12 - save.energy);
        save.energy += actual;
        addJournal(
          save,
          "chain",
          `Verified settled round ${round.id}: ${round.work} work. +${actual} Town Energy${actual < credit ? " (12-energy cap)" : ""}.`,
        );
        next++;
      }
      if (next - 1n !== BigInt(snapshot.through))
        throw new Error("The verified round page is incomplete.");
    }
    save.checkpoint = snapshot.through;
    save.checkpointWork = snapshot.cumulativeWork;
    save.latestVerifiedRound = snapshot.frontier;
    save.anchor = snapshot.anchor;
    save.lastSuccess = Date.now();
    return true;
  });
}
export async function simulateRound(key: string, positive: boolean) {
  return changeSave(key, (save) => {
    if (key !== "practice:v1")
      throw new Error("Simulation is available only in Practice mode.");
    const round = BigInt(save.checkpoint ?? "0") + 1n;
    const credit = positive ? 3 : 1;
    const actual = Math.min(credit, 12 - save.energy);
    save.energy += actual;
    save.checkpoint = round.toString();
    addJournal(
      save,
      "practice",
      `Simulated settled round ${round}: ${positive ? "positive" : "zero"} work. +${actual} Town Energy${actual < credit ? " (12-energy cap)" : ""}.`,
    );
  });
}
export async function queueOrder(
  key: string,
  order: Order,
  mayor: Address | undefined,
  origin: string,
  mode: Mode,
  active: () => boolean,
) {
  await verifyOrder(order, mayor, origin, mode);
  return changeSave(key, (save) => {
    if (!active())
      throw new Error("The wallet or mode changed. This order was not saved.");
    validateOrderFields(order, mayor, origin, mode);
    if (
      mode === "connected" &&
      key !== `connected:11155111:${mayor?.toLowerCase()}`
    )
      throw new Error("This town belongs to another account.");
    if (mode === "practice" && key !== "practice:v1")
      throw new Error("Practice progress must stay separate.");
    if (save.pending)
      throw new Error(
        "One mayor order is already waiting. Cancel it before choosing another.",
      );
    if (
      save.usedNonces.includes(order.nonce) ||
      save.completed.includes(order.id)
    )
      throw new Error("This mayor order has already been used.");
    if (mode === "connected" && save.checkpoint === null)
      throw new Error(
        "Wait for the first successful chain refresh before signing.",
      );
    save.pending = order;
    save.usedNonces.push(order.nonce);
    addJournal(
      save,
      mode === "practice" ? "practice" : "local",
      `${order.kind === "demo" ? "Unsigned demo" : "Signature verified; local"} order: ${LOCATIONS[order.location].title}. Cost: 3 energy.`,
    );
  });
}
export async function executeOrder(
  key: string,
  mayor: Address | undefined,
  origin: string,
  mode: Mode,
  active: () => boolean,
): Promise<{ location: Location; id: string } | null> {
  const current = await readSave(key);
  const order = current.pending;
  if (!order) return null;
  // Verify restored signatures as well as newly signed orders, before they can spend anything.
  await verifyOrder(order, mayor, origin, mode);
  const { result } = await changeSave(key, (save) => {
    if (!active()) return null;
    if (
      mode === "connected" &&
      key !== `connected:11155111:${mayor?.toLowerCase()}`
    )
      return null;
    if (mode === "practice" && key !== "practice:v1") return null;
    if (
      save.pending?.id !== order.id ||
      save.completed.includes(order.id) ||
      save.energy < 3
    )
      return null;
    validateOrderFields(order, mayor, origin, mode);
    // Atomic: commit the deduction and replay protection before the caller starts an animation.
    save.energy -= 3;
    save.completed.push(order.id);
    save.pending = null;
    addJournal(
      save,
      mode === "practice" ? "practice" : "local",
      `Local event: ${LOCATIONS[order.location].title}. 3 energy spent. A 10-second town animation was started.`,
    );
    return { location: order.location, id: order.id };
  });
  return result;
}
export async function cancelOrder(key: string) {
  return changeSave(key, (save) => {
    if (!save.pending) return;
    addJournal(
      save,
      key === "practice:v1" ? "practice" : "local",
      "Pending mayor order canceled. No energy spent. Its nonce stays used.",
    );
    save.pending = null;
  });
}
