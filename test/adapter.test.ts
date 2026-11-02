import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeFunctionData,
  HttpRequestError,
  toFunctionSignature,
  type Abi,
  type AbiFunction,
  type Hex,
} from "viem";
import {
  expandPage,
  fetchSnapshot,
  identityAbi,
  linksAbi,
  type Position,
  type Reader,
  type RoundPage,
} from "../src/chain/adapter";
import { RPC_URL } from "../src/chain/config";
import { coreAbi } from "../src/chain/core-abi";
import coreOfficial from "../src/chain/SqueekCore.json";
import deployment from "../src/chain/sepolia-deployment.json";
import {
  describeFailure,
  failureNote,
  sanitizeDetail,
  SnapshotError,
  type FailureKind,
  type FailureStage,
} from "../src/chain/diagnostics";
import { emptySave, type TownSave } from "../src/game/types";
import fixture from "./fixtures/sepolia-identity.json";
import miningOfficial from "./fixtures/SqueekMining.abi.json";
import tokenOfficial from "./fixtures/SqueekToken.abi.json";
import { replayClient, type RecordedCall, type Request } from "./replay";
const position = (work: bigint): Position => ({
  cumulativeWork: work,
  cumulativeBlockUnits: work * 1000n,
  workPerThousandBlocks: 10875,
});
const hash = `0x${"ab".repeat(32)}` as const;
const page = (): RoundPage => ({
  certifiedThroughRound: 15n,
  start: position(100n),
  end: position(113n),
  rounds: [
    { ...position(105n), roundId: 12n, dataHash: hash },
    { ...position(113n), roundId: 14n, dataHash: hash },
  ],
});
describe("official SqueekCore V3 round semantics", () => {
  it("derives active work from cumulativeWork and zero work only in certified gaps", () => {
    expect(expandPage(10n, 20n, 100n, page())).toEqual([
      { id: 11n, work: 0n },
      { id: 12n, work: 5n },
      { id: 13n, work: 0n },
      { id: 14n, work: 8n },
      { id: 15n, work: 0n },
    ]);
  });
  it("uses the returned frontier when the page ends before the requested round", () => {
    const result = expandPage(10n, 128n, 100n, page());
    expect(result.at(-1)?.id).toBe(15n);
    expect(result.some((round) => round.id > 15n)).toBe(false);
  });
  it("certifies a completely zero-work span without making up active records", () => {
    const result = expandPage(10n, 12n, 100n, {
      ...page(),
      certifiedThroughRound: 12n,
      end: position(100n),
      rounds: [],
    });
    expect(result).toEqual([
      { id: 11n, work: 0n },
      { id: 12n, work: 0n },
    ]);
  });
  it("keeps uint64 cumulative work exact above JavaScript’s safe integer range", () => {
    const start = 9007199254740999n;
    expect(
      expandPage(10n, 11n, start, {
        certifiedThroughRound: 11n,
        start: position(start),
        end: position(start + 3n),
        rounds: [{ ...position(start + 3n), roundId: 11n, dataHash: hash }],
      }),
    ).toEqual([{ id: 11n, work: 3n }]);
  });
  it.each([
    "out-of-order",
    "negative-work",
    "work-cap",
    "wrong-start",
    "wrong-end",
    "unknown-frontier",
    "no-progress",
  ])("rejects %s pages", (problem) => {
    const p = structuredClone(page());
    if (problem === "out-of-order") p.rounds = [...p.rounds].reverse();
    if (problem === "negative-work")
      p.rounds = [{ ...position(90n), roundId: 12n, dataHash: hash }];
    if (problem === "work-cap")
      p.rounds = [{ ...position(10101n), roundId: 12n, dataHash: hash }];
    if (problem === "wrong-start") p.start.cumulativeWork = 99n;
    if (problem === "wrong-end") p.end.cumulativeWork = 114n;
    if (problem === "unknown-frontier") p.certifiedThroughRound = 21n;
    if (problem === "no-progress") p.certifiedThroughRound = 10n;
    expect(() => expandPage(10n, 20n, 100n, p)).toThrow();
  });
  it("fails closed on an unreachable RPC, without mutating the source save", async () => {
    const save = emptySave("connected:11155111:test");
    save.energy = 7;
    save.checkpoint = "100";
    const before = structuredClone(save);
    const client = {
      getChainId: async () => {
        throw new Error("RPC unreachable");
      },
      getBlock: async () => {
        throw new Error("RPC unreachable");
      },
    } as unknown as Reader;
    await expect(fetchSnapshot(save, client)).rejects.toThrow(
      "RPC unreachable",
    );
    expect(save).toEqual(before);
  });
});

const calls = fixture.calls as RecordedCall[];
const coreProxy = deployment.contracts.SqueekCore.address.toLowerCase();
const miningProxy = deployment.contracts.SqueekMining.address.toLowerCase();
const coreAdmin = deployment.contracts.SqueekCore.proxyAdmin.toLowerCase();
const miningAdmin = deployment.contracts.SqueekMining.proxyAdmin.toLowerCase();
const token = deployment.contracts.SqueekToken.address.toLowerCase();
const IMPLEMENTATION =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const stranger = "0x1111111111111111111111111111111111111111";
const strangerWord = `0x000000000000000000000000${stranger.slice(2)}`;
const asAddress = (value: string) =>
  encodeAbiParameters([{ type: "address" }], [value as Hex]);
const selector = (
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
) => encodeFunctionData({ abi, functionName, args }).slice(0, 10);
const on = (request: Request, to: string, data: string) => {
  if (request.method !== "eth_call") return false;
  const call = request.params?.[0] as { to?: string; data?: string };
  return call.to?.toLowerCase() === to && !!call.data?.startsWith(data);
};
const slot = (request: Request, address: string, name: string) =>
  request.method === "eth_getStorageAt" &&
  String(request.params?.[0]).toLowerCase() === address &&
  request.params?.[1] === name;
const failure = async (
  intercept: (request: Request) => unknown,
  save: TownSave = emptySave("connected:11155111:test"),
) => {
  const { client } = replayClient(calls, intercept);
  const error = await fetchSnapshot(save, client).then(
    () => null,
    (caught) => caught,
  );
  expect(error).toBeInstanceOf(SnapshotError);
  return error as SnapshotError;
};
const returningSave = (): TownSave => ({
  ...emptySave("connected:11155111:test"),
  checkpoint: fixture.returning.checkpoint,
  checkpointWork: fixture.returning.checkpointWork,
  anchor: fixture.returning.anchor as TownSave["anchor"],
});
const version = selector(identityAbi, "implementationCodeVersion");
const layout = selector(identityAbi, "implementationStorageLayoutDigest");
const reported = selector(identityAbi, "implementationCodeAddress");
const proxyAdmin = selector(identityAbi, "proxyAdmin");
const owner = selector(identityAbi, "owner");
const state = selector(coreAbi as unknown as Abi, "state");
const configuration = selector(coreAbi as unknown as Abi, "configuration");
const roundPage = selector(coreAbi as unknown as Abi, "roundPage", [
  0n,
  0n,
  0n,
]);
const wrongWord = `0x${"00".repeat(31)}63`;

describe("recorded public Sepolia reads", () => {
  it("initializes from verified reads at one finalized block, with no credit", async () => {
    const { client, log } = replayClient(calls);
    const snapshot = await fetchSnapshot(
      emptySave("connected:11155111:test"),
      client,
    );
    expect(snapshot.rounds).toEqual([]);
    expect(snapshot.through).toBe(snapshot.frontier);
    const block = `0x${BigInt(snapshot.anchor.number).toString(16)}`;
    const blocksUsed = log.flatMap(({ method, params = [] }) =>
      method === "eth_call" || method === "eth_getCode"
        ? [params[1]]
        : method === "eth_getStorageAt"
          ? [params[2]]
          : method === "eth_getBlockByNumber" && params[0] !== "finalized"
            ? [params[0]]
            : [],
    );
    expect(blocksUsed.length).toBeGreaterThan(15);
    expect(new Set(blocksUsed)).toEqual(new Set([block]));
    expect(JSON.stringify(log)).not.toContain("latest");
  });
  it("reads every state, configuration and roundPage call through the Core proxy address", async () => {
    const { client, log } = replayClient(calls);
    await fetchSnapshot(returningSave(), client);
    const coreCalls = log.filter((request) =>
      [state, configuration, roundPage].some((data) =>
        (request.params?.[0] as { data?: string })?.data?.startsWith(data),
      ),
    );
    expect(coreCalls.length).toBeGreaterThan(3);
    for (const call of coreCalls)
      if ((call.params?.[0] as { to: string }).to.toLowerCase() !== miningProxy)
        expect((call.params?.[0] as { to: string }).to.toLowerCase()).toBe(
          coreProxy,
        );
    expect(JSON.stringify(log).toLowerCase()).not.toContain(
      `"to":"${deployment.contracts.SqueekCore.implementation.toLowerCase()}"`,
    );
  });
  it("reads real settled rounds for a returning save", async () => {
    const { client } = replayClient(calls);
    const snapshot = await fetchSnapshot(returningSave(), client);
    expect(snapshot.rounds[0].id).toBe(
      BigInt(fixture.returning.checkpoint) + 1n,
    );
    expect(
      snapshot.rounds.find(
        (round) => round.id === BigInt(fixture.returning.activeRound),
      )?.work,
    ).toBeGreaterThan(0n);
  });
  it("never falls back to another tag when the finalized tag fails", async () => {
    const seen: Request[] = [];
    const error = await failure((request) => {
      seen.push(request);
      if (request.method === "eth_getBlockByNumber")
        throw Object.assign(new Error("finalized block not found"), {
          code: -32000,
        });
      return undefined;
    });
    expect(error.stage).toBe("finalized block");
    expect(error.kind).toBe("rpc");
    expect(seen.map((request) => request.method)).toEqual([
      "eth_chainId",
      "eth_getBlockByNumber",
    ]);
  });
});

describe("deployment identity at the finalized block", () => {
  const proxies = [
    {
      name: "SqueekCore",
      stage: "Core proxy verification",
      proxy: coreProxy,
      admin: coreAdmin,
    },
    {
      name: "SqueekMining",
      stage: "Mining proxy verification",
      proxy: miningProxy,
      admin: miningAdmin,
    },
  ] as const;
  for (const { name, stage, proxy, admin } of proxies) {
    const expected = deployment.contracts[name];
    it.each<[string, (request: Request) => unknown, string]>([
      [
        "implementation slot",
        (r) => (slot(r, proxy, IMPLEMENTATION) ? strangerWord : undefined),
        "the implementation is",
      ],
      [
        "admin slot",
        (r) => (slot(r, proxy, ADMIN) ? strangerWord : undefined),
        "the proxy admin is",
      ],
      [
        "reported implementation",
        (r) => (on(r, proxy, reported) ? asAddress(stranger) : undefined),
        "implementationCodeAddress()",
      ],
      [
        "reported admin",
        (r) => (on(r, proxy, proxyAdmin) ? asAddress(stranger) : undefined),
        "proxyAdmin()",
      ],
      [
        "version",
        (r) => (on(r, proxy, version) ? wrongWord : undefined),
        "the implementation version is 99",
      ],
      [
        "layout digest",
        (r) => (on(r, proxy, layout) ? wrongWord : undefined),
        "the layout digest",
      ],
      [
        "runtime hash",
        (r) =>
          r.method === "eth_getCode" &&
          String(r.params?.[0]).toLowerCase() ===
            expected.implementation.toLowerCase()
            ? "0x60006000"
            : undefined,
        "the runtime hash",
      ],
      [
        "missing runtime code",
        (r) =>
          r.method === "eth_getCode" &&
          String(r.params?.[0]).toLowerCase() ===
            expected.implementation.toLowerCase()
            ? "0x"
            : undefined,
        "no runtime code",
      ],
      [
        "ProxyAdmin owner",
        (r) => (on(r, admin, owner) ? asAddress(stranger) : undefined),
        "the ProxyAdmin owner",
      ],
    ])(
      `${name}: names a changed %s as a mismatch`,
      async (_, intercept, text) => {
        const error = await failure(intercept);
        expect(error.stage).toBe(stage);
        expect(error.kind).toBe("deployment");
        expect(error.message).toContain(name);
        expect(error.message).toContain(text);
      },
    );
    it(`${name}: stops at an unknown implementation before calling through it`, async () => {
      const { client, log } = replayClient(calls, (r) =>
        slot(r, proxy, IMPLEMENTATION) ? strangerWord : undefined,
      );
      await expect(
        fetchSnapshot(emptySave("connected:11155111:test"), client),
      ).rejects.toThrow(stranger);
      expect(log.some((r) => on(r, proxy, reported))).toBe(false);
    });
    it(`${name}: reports an RPC failure as RPC, not as a mismatch`, async () => {
      const error = await failure((r) => {
        if (slot(r, proxy, IMPLEMENTATION))
          throw Object.assign(new Error("missing trie node"), { code: -32000 });
        return undefined;
      });
      expect(error.stage).toBe(stage);
      expect(error.kind).toBe("rpc");
    });
  }
  it("rejects a slot word that is not a clean address", async () => {
    const dirty = `0x01${"00".repeat(11)}${stranger.slice(2)}`;
    const error = await failure((r) =>
      slot(r, coreProxy, IMPLEMENTATION) ? dirty : undefined,
    );
    expect(error.kind).toBe("deployment");
    expect(error.message).toContain("does not hold an address");
  });
  it.each<[string, (request: Request) => unknown, string]>([
    [
      "Mining core() link",
      (r) =>
        on(r, miningProxy, selector(linksAbi, "core"))
          ? asAddress(stranger)
          : undefined,
      "SqueekMining core()",
    ],
    [
      "Token mining() link",
      (r) =>
        on(r, token, selector(linksAbi, "mining"))
          ? asAddress(stranger)
          : undefined,
      "SqueekToken mining()",
    ],
  ])("configuration/links names a changed %s", async (_, intercept, text) => {
    const error = await failure(intercept);
    expect(error.stage).toBe("configuration/links");
    expect(error.kind).toBe("deployment");
    expect(error.message).toContain(text);
  });
  it("configuration/links names a changed launch value", async () => {
    const recorded = calls.find((call) => on(call, coreProxy, configuration))!
      .result as string;
    const changed = recorded.replace("6acd6d78", "6acd6d79");
    const error = await failure((r) =>
      on(r, coreProxy, configuration) ? changed : undefined,
    );
    expect(error.stage).toBe("configuration/links");
    expect(error.message).toContain("genesisTimestamp");
  });
});

describe("failure stages", () => {
  const down = (status: number) =>
    new HttpRequestError({
      url: `${RPC_URL}/secret-path?key=abc`,
      status,
      details: "Failed to fetch",
      body: { method: "eth_call" },
    });
  const stages: [FailureStage, (request: Request) => boolean][] = [
    ["network", (r) => r.method === "eth_chainId"],
    ["finalized block", (r) => r.method === "eth_getBlockByNumber"],
    ["Core proxy verification", (r) => slot(r, coreProxy, IMPLEMENTATION)],
    ["Mining proxy verification", (r) => slot(r, miningProxy, IMPLEMENTATION)],
    ["configuration/links", (r) => on(r, coreProxy, configuration)],
    ["state", (r) => on(r, coreProxy, state)],
    ["roundPage", (r) => on(r, coreProxy, roundPage)],
  ];
  it.each(stages)("labels a network failure at %s", async (stage, match) => {
    const error = await failure((request) => {
      if (match(request)) throw down(503);
      return undefined;
    });
    expect(error.stage).toBe(stage);
    expect(error.kind).toBe("rpc");
    const report = describeFailure(error, "rpc.sepolia.ethpandaops.io");
    expect(report.errorName).not.toBe("SnapshotError");
    expect(report.httpStatus).toBe(503);
    expect(failureNote(report, error.message)).toContain("not a deployment");
    expect(JSON.stringify(report)).not.toContain("secret-path");
    expect(JSON.stringify(report)).not.toContain("key=abc");
  });
  it.each<[string, Record<string, unknown>, FailureKind, number]>([
    ["execution reverted", { code: 3 }, "deployment", 3],
    ["missing trie node", { code: -32000 }, "rpc", -32000],
    // viem calls every -32603 a revert. A node failure must still read as RPC.
    ["internal node failure", { code: -32603 }, "rpc", -32603],
    ["rate limit exceeded", { code: -32005 }, "rpc", -32005],
  ])("classifies a JSON-RPC %s", async (message, fields, kind, code) => {
    const error = await failure((request) => {
      if (on(request, coreProxy, state))
        throw Object.assign(new Error(message), fields);
      return undefined;
    });
    expect(error.stage).toBe("state");
    expect(error.kind).toBe(kind);
    expect(describeFailure(error, "host").rpcCode).toBe(code);
  });
  it("treats a call that returns no data as a contract-side mismatch", async () => {
    const error = await failure((request) =>
      on(request, coreProxy, state) ? "0x" : undefined,
    );
    expect(error.stage).toBe("state");
    expect(error.kind).toBe("deployment");
  });
  it("reports a changed saved anchor as inconsistent data, not a network failure", async () => {
    const save = returningSave();
    save.anchor = { number: save.anchor!.number, hash: `0x${"cd".repeat(32)}` };
    const error = await failure(() => undefined, save);
    expect(error.stage).toBe("finalized block");
    expect(error.kind).toBe("consistency");
  });
  it("labels a broken saved cursor at roundPage", async () => {
    const save = returningSave();
    save.checkpointWork = "1";
    const error = await failure(() => undefined, save);
    expect(error.stage).toBe("roundPage");
    expect(error.kind).toBe("consistency");
  });
});

describe("diagnostics sanitizing", () => {
  const wallet = "0x9f2E3bB5b4d1F8A1a7E2C6d0dC1234567890aBcD";
  it("reduces URLs to hostnames and removes credentials and wallet data", () => {
    const clean = sanitizeDetail(
      `Failed https://rpc.example.com/v3/abcd?apikey=hunter2 from ${wallet} ` +
        `sig 0x${"ab".repeat(65)} Bearer tok.en api_key=hunter3 ` +
        `eyJhbGciOiJI.eyJzdWIiOiIx.abc123 Request body: {"from":"${wallet}"}`,
    );
    expect(clean).toContain("rpc.example.com");
    for (const secret of [
      "/v3/",
      "abcd",
      "hunter",
      wallet,
      "abab",
      "tok.en",
      "eyJ",
      "Request body",
    ])
      expect(clean).not.toContain(secret);
  });
  it("keeps published contract addresses and bounds the length", () => {
    expect(
      sanitizeDetail(`call to ${deployment.contracts.SqueekCore.address}`),
    ).toContain(deployment.contracts.SqueekCore.address);
    expect(sanitizeDetail("word ".repeat(200)).length).toBeLessThanOrEqual(240);
  });
  it("keeps exact values in this app's own mismatch report", () => {
    const report = describeFailure(
      new SnapshotError(
        "Core proxy verification",
        "deployment",
        `SqueekCore: the implementation is ${stranger}.`,
      ),
      "host",
    );
    expect(report.errorName).toBe("DeploymentMismatchError");
    expect(report.shortMessage).toContain(stranger);
    expect(report.cause).toBeNull();
    expect(failureNote(report, "")).toContain("does not match the official");
  });
  it("shows the real browser error behind a blocked 429", () => {
    const report = describeFailure(
      new SnapshotError(
        "network",
        "rpc",
        "HTTP request failed.",
        new HttpRequestError({
          url: RPC_URL,
          details: "Failed to fetch",
          body: { method: "eth_chainId", params: [wallet] },
        }),
      ),
      "rpc.sepolia.ethpandaops.io",
    );
    expect(report).toMatchObject({
      stage: "network",
      kind: "rpc",
      rpcHost: "rpc.sepolia.ethpandaops.io",
      errorName: "HttpRequestError",
      shortMessage: "HTTP request failed.",
    });
    expect(report.cause).toContain("Failed to fetch");
    expect(JSON.stringify(report)).not.toContain(wallet);
  });
});

describe("ABI compatibility with the official records", () => {
  const functions = (abi: unknown) =>
    new Map(
      (abi as AbiFunction[])
        .filter((item) => item.type === "function")
        .map((item) => [item.name, item]),
    );
  const core = functions(coreOfficial);
  const mining = functions(miningOfficial);
  const erc20 = functions(tokenOfficial);
  it("core-abi.ts holds exact official SqueekCore entries", () => {
    for (const entry of coreAbi) expect(core.get(entry.name)).toEqual(entry);
  });
  it("identity reads exist with the same signature and outputs on both proxies", () => {
    for (const entry of identityAbi.filter((item) => item.name !== "owner"))
      for (const official of [core, mining]) {
        const match = official.get(entry.name)!;
        expect(toFunctionSignature(match)).toBe(toFunctionSignature(entry));
        expect(match.outputs.map((o) => o.type)).toEqual(
          entry.outputs.map((o) => o.type),
        );
      }
  });
  it("link reads match the official Mining and Token ABIs", () => {
    const check = (official: AbiFunction, local: AbiFunction) => {
      expect(toFunctionSignature(official)).toBe(toFunctionSignature(local));
      expect(JSON.stringify(official.outputs.map((o) => o.type))).toBe(
        JSON.stringify(local.outputs.map((o) => o.type)),
      );
    };
    const local = functions(linksAbi);
    check(mining.get("core")!, local.get("core")!);
    check(erc20.get("mining")!, local.get("mining")!);
    check(mining.get("collectionPolicy")!, local.get("collectionPolicy")!);
    const shape = (fn: AbiFunction) =>
      JSON.stringify(fn.outputs, (key, value) =>
        key === "internalType" || key === "name" ? undefined : value,
      );
    expect(shape(mining.get("collectionPolicy")!)).toBe(
      shape(local.get("collectionPolicy")!),
    );
  });
});
