import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  applySnapshot,
  cancelOrder,
  executeOrder,
  queueOrder,
  simulateRound,
} from "../src/game/engine";
import {
  createDemoOrder,
  createOrder,
  typedOrder,
  verifyOrder,
} from "../src/game/orders";
import { changeSave, readSave } from "../src/game/store";
import {
  emptySave,
  saveKey,
  type ChainSnapshot,
  type Location,
  type Order,
} from "../src/game/types";
import { publicClient } from "../src/chain/config";
const origin = "https://squeekville.test";
const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
let key: string;
function snapshot(
  from: string | null,
  through: string,
  rounds: { id: bigint; work: bigint }[] = [],
): ChainSnapshot {
  return {
    from,
    through,
    rounds,
    frontier: through,
    cumulativeWork: rounds.reduce((n, r) => n + r.work, 0n).toString(),
    anchor: { number: "12048506", hash: `0x${"ab".repeat(32)}` },
    blockHeight: "12",
    paused: false,
    more: false,
  };
}
async function signed(location: Location = "bakery") {
  const draft = createOrder(account.address, location, origin);
  return {
    ...draft,
    signature: await account.signTypedData(typedOrder(draft)),
  } as Order;
}
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
  vi.spyOn(publicClient, "verifyTypedData").mockResolvedValue(false);
});
beforeEach(async () => {
  key = saveKey("connected", account.address) + ":" + crypto.randomUUID();
  await changeSave("practice:v1", (save) =>
    Object.assign(save, emptySave("practice:v1")),
  );
});
describe("local game resource", () => {
  it("initializes at zero without crediting earlier settled history", async () => {
    const result = await applySnapshot(key, snapshot(null, "500"));
    expect(result.save.energy).toBe(0);
    expect(result.save.checkpoint).toBe("500");
    expect(result.save.lastSuccess).not.toBeNull();
  });
  it("credits ordered zero and positive work, caps at 12 and deduplicates a repeated poll", async () => {
    await applySnapshot(key, snapshot(null, "500"));
    const rounds = Array.from({ length: 7 }, (_, i) => ({
      id: BigInt(501 + i),
      work: i === 0 ? 0n : 7n,
    }));
    const first = await applySnapshot(key, snapshot("500", "507", rounds));
    expect(first.save.energy).toBe(12);
    const again = await applySnapshot(key, snapshot("500", "507", rounds));
    expect(again.result).toBe(false);
    expect(again.save.energy).toBe(12);
    expect(again.save.journal).toHaveLength(8);
  });
  it("aborts incomplete pages without changing the saved energy or checkpoint", async () => {
    await applySnapshot(key, snapshot(null, "500"));
    await expect(
      applySnapshot(key, snapshot("500", "502", [{ id: 502n, work: 1n }])),
    ).rejects.toThrow("incomplete");
    expect((await readSave(key)).energy).toBe(0);
    expect((await readSave(key)).checkpoint).toBe("500");
  });
  it("cannot inject simulated rounds into connected saves or chain data into practice", async () => {
    await expect(simulateRound(key, true)).rejects.toThrow("Practice");
    await expect(
      applySnapshot("practice:v1", snapshot(null, "2")),
    ).rejects.toThrow("Practice");
    expect((await readSave(key)).energy).toBe(0);
  });
  it("stores independent wallet and chain progress", async () => {
    expect(saveKey("connected", account.address)).not.toBe(
      saveKey("connected", other.address),
    );
    expect(saveKey("connected", account.address)).toContain("11155111");
    await simulateRound("practice:v1", true);
    expect((await readSave(saveKey("connected", account.address))).energy).toBe(
      0,
    );
    expect((await readSave("practice:v1")).energy).toBe(3);
  });
});
describe("signed mayor orders", () => {
  let connectedKey: string;
  beforeEach(async () => {
    connectedKey = saveKey("connected", account.address);
    await changeSave(connectedKey, (save) =>
      Object.assign(save, emptySave(connectedKey)),
    );
    await applySnapshot(connectedKey, snapshot(null, "50"));
  });
  it("recovers an EIP-712 signer with the requested fields and no verifying contract", async () => {
    const order = await signed();
    if (order.kind !== "signed") throw new Error();
    const data = typedOrder(order);
    expect(data.domain).toEqual({
      name: "Squeekville",
      version: "1",
      chainId: 11155111,
    });
    expect(data.message.location).toBe("Bakery");
    expect(data.message.energyCost).toBe(3n);
    expect(order.expiresAt - order.issuedAt).toBe(86400);
    await expect(
      verifyOrder(order, account.address, origin, "connected"),
    ).resolves.toBeUndefined();
  });
  it("rejects another account, site origin, changed fields, expired dates and wrong signatures", async () => {
    const order = await signed();
    await expect(
      verifyOrder(order, other.address, origin, "connected"),
    ).rejects.toThrow("different mayor");
    await expect(
      verifyOrder(order, account.address, "https://other.test", "connected"),
    ).rejects.toThrow("origin");
    await expect(
      verifyOrder(
        { ...order, location: "park" },
        account.address,
        origin,
        "connected",
      ),
    ).rejects.toThrow("changed");
    await expect(
      verifyOrder(
        { ...order, issuedAt: 1, expiresAt: 86401 },
        account.address,
        origin,
        "connected",
      ),
    ).rejects.toThrow("expired");
    const draft = createOrder(account.address, "park", origin);
    const bad = {
      ...draft,
      signature: await other.signTypedData(typedOrder(draft)),
    };
    await expect(
      verifyOrder(bad, account.address, origin, "connected"),
    ).rejects.toThrow("does not match");
  });
  it("waits for enough energy and persists a deduction before returning the animation", async () => {
    const order = await signed();
    await queueOrder(
      connectedKey,
      order,
      account.address,
      origin,
      "connected",
      () => true,
    );
    expect(
      await executeOrder(
        connectedKey,
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).toBeNull();
    await applySnapshot(
      connectedKey,
      snapshot("50", "51", [{ id: 51n, work: 6n }]),
    );
    const result = await executeOrder(
      connectedKey,
      account.address,
      origin,
      "connected",
      () => true,
    );
    expect(result?.location).toBe("bakery");
    const stored = await readSave(connectedKey);
    expect(stored.energy).toBe(0);
    expect(stored.pending).toBeNull();
    expect(stored.completed).toEqual([order.id]);
  });
  it("executes once when competing tabs and repeat calls race", async () => {
    await applySnapshot(
      connectedKey,
      snapshot("50", "51", [{ id: 51n, work: 9n }]),
    );
    const order = await signed("square");
    await queueOrder(
      connectedKey,
      order,
      account.address,
      origin,
      "connected",
      () => true,
    );
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        executeOrder(
          connectedKey,
          account.address,
          origin,
          "connected",
          () => true,
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await readSave(connectedKey)).energy).toBe(0);
    await expect(
      queueOrder(
        connectedKey,
        order,
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).rejects.toThrow("already been used");
  });
  it("allows only one pending order and keeps canceled nonces used", async () => {
    const order = await signed();
    await queueOrder(
      connectedKey,
      order,
      account.address,
      origin,
      "connected",
      () => true,
    );
    await expect(
      queueOrder(
        connectedKey,
        await signed("park"),
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).rejects.toThrow("already waiting");
    await cancelOrder(connectedKey);
    await expect(
      queueOrder(
        connectedKey,
        order,
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).rejects.toThrow("already been used");
    expect((await readSave(connectedKey)).energy).toBe(0);
  });
  it("prevents account changes during verification from saving or executing an order", async () => {
    const order = await signed();
    await expect(
      queueOrder(
        connectedKey,
        order,
        account.address,
        origin,
        "connected",
        () => false,
      ),
    ).rejects.toThrow("changed");
    await queueOrder(
      connectedKey,
      order,
      account.address,
      origin,
      "connected",
      () => true,
    );
    await applySnapshot(
      connectedKey,
      snapshot("50", "51", [{ id: 51n, work: 10n }]),
    );
    expect(
      await executeOrder(
        connectedKey,
        account.address,
        origin,
        "connected",
        () => false,
      ),
    ).toBeNull();
    expect((await readSave(connectedKey)).energy).toBe(3);
    expect((await readSave(connectedKey)).pending?.id).toBe(order.id);
  });
  it("verifies restored signatures before spending any saved energy", async () => {
    await applySnapshot(
      connectedKey,
      snapshot("50", "51", [{ id: 51n, work: 1n }]),
    );
    const order = await signed();
    await queueOrder(
      connectedKey,
      order,
      account.address,
      origin,
      "connected",
      () => true,
    );
    await changeSave(connectedKey, (save) => {
      if (save.pending?.kind === "signed") save.pending.signature = "0x1234";
    });
    await expect(
      executeOrder(
        connectedKey,
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).rejects.toThrow();
    const stored = await readSave(connectedKey);
    expect(stored.energy).toBe(3);
    expect(stored.completed).toHaveLength(0);
    expect(stored.pending).not.toBeNull();
  });
  it("never uses an unsigned Practice order in a connected town", async () => {
    await expect(
      queueOrder(
        connectedKey,
        createDemoOrder("park", origin),
        account.address,
        origin,
        "connected",
        () => true,
      ),
    ).rejects.toThrow();
  });
});
describe("Practice town", () => {
  it.each<Location>(["bakery", "park", "square"])(
    "runs the %s event once with an unsigned order and its own save",
    async (location) => {
      await simulateRound("practice:v1", false);
      await simulateRound("practice:v1", true);
      const order = createDemoOrder(location, origin);
      await queueOrder(
        "practice:v1",
        order,
        undefined,
        origin,
        "practice",
        () => true,
      );
      expect(
        await executeOrder(
          "practice:v1",
          undefined,
          origin,
          "practice",
          () => true,
        ),
      ).toEqual({ id: order.id, location });
      expect((await readSave("practice:v1")).energy).toBe(1);
      expect(
        await executeOrder(
          "practice:v1",
          undefined,
          origin,
          "practice",
          () => true,
        ),
      ).toBeNull();
    },
  );
});
