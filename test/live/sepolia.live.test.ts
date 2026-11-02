// Real network. Not part of `npm test`. Run with:
//   npx vitest run --config test/live/vitest.config.ts --root .
// RECORD_FIXTURE=1 also rewrites test/fixtures/sepolia-identity.json from these public reads.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createPublicClient, custom } from "viem";
import { sepolia } from "viem/chains";
import {
  expandPage,
  fetchSnapshot,
  type Reader,
} from "../../src/chain/adapter";
import { CORE_ADDRESS, RPC_URL } from "../../src/chain/config";
import { coreAbi } from "../../src/chain/core-abi";
import coreOfficial from "../../src/chain/SqueekCore.json";
import localDeployment from "../../src/chain/sepolia-deployment.json";
import { applySnapshot } from "../../src/game/engine";
import { readSave } from "../../src/game/store";
import { emptySave, type TownSave } from "../../src/game/types";
import miningPinned from "../fixtures/SqueekMining.abi.json";
import tokenPinned from "../fixtures/SqueekToken.abi.json";

const DOCS = "https://docs.squeekchain.com";
const official = async (path: string) => (await fetch(DOCS + path)).json();
type Request = { method: string; params?: unknown[] };
const rawLog: { method: string; params: unknown[]; result: unknown }[] = [];
let finalized: unknown;
// A logging client that holds one finalized block, so every read below shares it.
const client = createPublicClient({
  chain: sepolia,
  transport: custom(
    {
      async request({ method, params = [] }: Request) {
        if (
          method === "eth_getBlockByNumber" &&
          params[0] === "finalized" &&
          finalized
        ) {
          rawLog.push({ method, params, result: finalized });
          return finalized;
        }
        const response = await fetch(RPC_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const body = await response.json();
        if (body.error)
          throw Object.assign(new Error(body.error.message), body.error);
        if (method === "eth_getBlockByNumber" && params[0] === "finalized")
          finalized = body.result;
        rawLog.push({ method, params, result: body.result });
        return body.result;
      },
    },
    { retryCount: 2 },
  ),
}) as unknown as Reader;
const coreRead = { address: CORE_ADDRESS, abi: coreAbi } as const;
const key = "connected:11155111:0x000000000000000000000000000000000000live";

beforeAll(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage = null;
      postMessage() {}
      close() {}
    },
  );
});

describe("official records", () => {
  it("local deployment metadata equals the published record", async () => {
    expect(await official("/assets/deployments/sepolia.json")).toEqual(
      localDeployment,
    );
  });
  it("pinned ABIs equal the published ABIs", async () => {
    expect(await official("/assets/abi/SqueekCore.json")).toEqual(coreOfficial);
    expect(await official("/assets/abi/SqueekMining.json")).toEqual(
      miningPinned,
    );
    expect(await official("/assets/abi/SqueekToken.json")).toEqual(tokenPinned);
  });
  it("the developer page publishes the same identity values", async () => {
    const page = await (await fetch(`${DOCS}/developers/`)).text();
    const text = page.replace(/<[^>]+>/g, "");
    const value = (name: string) =>
      new RegExp(`${name}\\s*=\\s*(\\S+)`).exec(text)?.[1]?.toLowerCase();
    const { SqueekCore: core, SqueekMining: mining } =
      localDeployment.contracts;
    const expected: Record<string, string> = {
      CORE_ADDRESS: core.address,
      EXPECTED_CORE_IMPLEMENTATION: core.implementation,
      EXPECTED_CORE_RUNTIME_HASH: core.implementationRuntimeHash,
      EXPECTED_CORE_LAYOUT_DIGEST: core.storageLayoutDigest,
      EXPECTED_CORE_PROXY_ADMIN: core.proxyAdmin,
      MINING_ADDRESS: mining.address,
      EXPECTED_MINING_IMPLEMENTATION: mining.implementation,
      EXPECTED_MINING_RUNTIME_HASH: mining.implementationRuntimeHash,
      EXPECTED_MINING_LAYOUT_DIGEST: mining.storageLayoutDigest,
      EXPECTED_MINING_PROXY_ADMIN: mining.proxyAdmin,
      EXPECTED_TIMELOCK: localDeployment.operational.governanceTimelock.address,
    };
    for (const [name, address] of Object.entries(expected))
      expect(value(name), name).toBe(address.toLowerCase());
  });
});

describe(`live adapter through ${RPC_URL}`, () => {
  let frontier: bigint;
  it("initializes at one finalized block with no credit", async () => {
    const snapshot = await fetchSnapshot(emptySave(key), client);
    frontier = BigInt(snapshot.frontier);
    expect(snapshot.rounds).toEqual([]);
    expect(snapshot.through).toBe(snapshot.frontier);
    const applied = await applySnapshot(key, snapshot);
    expect(applied.save.energy).toBe(0);
    expect(applied.save.checkpoint).toBe(snapshot.frontier);
    const block = `0x${BigInt(snapshot.anchor.number).toString(16)}`;
    const blockOf = ({ method, params }: (typeof rawLog)[number]) =>
      method === "eth_call"
        ? params[1]
        : method === "eth_getStorageAt"
          ? params[2]
          : method === "eth_getCode"
            ? params[1]
            : method === "eth_getBlockByNumber" && params[0] !== "finalized"
              ? params[0]
              : block;
    expect(rawLog.length).toBeGreaterThan(20);
    for (const call of rawLog) expect(blockOf(call), call.method).toBe(block);
    expect(JSON.stringify(rawLog.map((c) => c.params))).not.toContain("latest");
  });
  it("every settled round in history passes the round parser and reconciles", async () => {
    const blockNumber = BigInt((finalized as { number: string }).number);
    const read = { ...coreRead, blockNumber };
    const state = await client.readContract({ ...read, functionName: "state" });
    const zero = await client.readContract({
      ...read,
      functionName: "roundPage",
      args: [0n, 0n, 0n],
    });
    let cursor = 0n;
    let work = zero.end.cumulativeWork;
    let active = 0;
    while (cursor < state.settledThroughRound) {
      const through =
        cursor + 128n < state.settledThroughRound
          ? cursor + 128n
          : state.settledThroughRound;
      const page = await client.readContract({
        ...read,
        functionName: "roundPage",
        args: [cursor, through, 16n],
      });
      const rounds = expandPage(cursor, through, work, page);
      active += rounds.filter((round) => round.work > 0n).length;
      cursor = page.certifiedThroughRound;
      work = page.end.cumulativeWork;
    }
    expect(work).toBe(state.cumulativeWork);
    expect(active).toBeGreaterThan(0);
  });
  it("a returning save reads real settled rounds, and repeats add nothing", async () => {
    const blockNumber = BigInt((finalized as { number: string }).number);
    const read = { ...coreRead, blockNumber };
    // Find the newest real active round, then start just before it.
    let activeRound: bigint | undefined;
    for (let top = frontier; top > 0n && !activeRound; top -= 128n) {
      const after = top > 128n ? top - 128n : 0n;
      const page = await client.readContract({
        ...read,
        functionName: "roundPage",
        args: [after, top, 16n],
      });
      activeRound = page.rounds.at(-1)?.roundId;
    }
    expect(activeRound).toBeDefined();
    const checkpoint = activeRound! - 2n;
    const start = await client.readContract({
      ...read,
      functionName: "roundPage",
      args: [checkpoint, checkpoint, 0n],
    });
    const returningKey = `${key}:returning`;
    const seed: TownSave = {
      ...emptySave(returningKey),
      checkpoint: checkpoint.toString(),
      checkpointWork: start.end.cumulativeWork.toString(),
    };
    const anchorNumber = blockNumber - 10n;
    const anchorBlock = await client.getBlock({ blockNumber: anchorNumber });
    seed.anchor = { number: anchorNumber.toString(), hash: anchorBlock.hash! };
    const { changeSave } = await import("../../src/game/store");
    await changeSave(returningKey, (save) => void Object.assign(save, seed));
    let current = await readSave(returningKey);
    const first = await fetchSnapshot(current, client);
    expect(first.rounds[0].id).toBe(checkpoint + 1n);
    expect(
      first.rounds.find((r) => r.id === activeRound)!.work,
    ).toBeGreaterThan(0n);
    const applied = await applySnapshot(returningKey, first);
    expect(applied.save.energy).toBeGreaterThan(0);
    const energy = applied.save.energy;
    const through = applied.save.checkpoint;
    const journal = applied.save.journal.length;
    // The same snapshot again (a second tab, or a reload racing a read): no credit.
    const replay = await applySnapshot(returningKey, first);
    expect(replay.save.energy).toBe(energy);
    expect(replay.save.checkpoint).toBe(through);
    expect(replay.save.journal.length).toBe(journal);
    // A fresh read from the saved cursor once caught up: no credit either.
    current = await readSave(returningKey);
    while (current.checkpoint !== frontier.toString()) {
      await applySnapshot(returningKey, await fetchSnapshot(current, client));
      current = await readSave(returningKey);
    }
    const caughtUp = current.energy;
    const again = await fetchSnapshot(current, client);
    expect(again.rounds).toEqual([]);
    expect((await applySnapshot(returningKey, again)).save.energy).toBe(
      caughtUp,
    );

    if (
      import.meta.env.RECORD_FIXTURE ||
      (globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.RECORD_FIXTURE
    ) {
      const unique = new Map<string, (typeof rawLog)[number]>();
      for (const call of rawLog) {
        const id = JSON.stringify([call.method, call.params]).toLowerCase();
        if (unique.has(id)) continue;
        const result = call.result as { transactions?: unknown };
        unique.set(id, {
          ...call,
          result: result?.transactions
            ? { ...result, transactions: [] }
            : call.result,
        });
      }
      const fs = "node:fs/promises";
      const { writeFile } = await import(/* @vite-ignore */ fs);
      await writeFile(
        "test/fixtures/sepolia-identity.json",
        JSON.stringify(
          {
            source: RPC_URL,
            recordedAt: new Date().toISOString(),
            returning: {
              checkpoint: checkpoint.toString(),
              checkpointWork: start.end.cumulativeWork.toString(),
              activeRound: activeRound!.toString(),
              anchor: seed.anchor,
            },
            calls: [...unique.values()],
          },
          null,
          2,
        ) + "\n",
      );
    }
  });
});
