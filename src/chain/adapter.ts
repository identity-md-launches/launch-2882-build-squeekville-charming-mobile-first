import { getAddress, keccak256, parseAbi, type Address, type Hex } from "viem";
import { publicClient, CORE_ADDRESS, CHAIN_ID } from "./config";
import { coreAbi } from "./core-abi";
import {
  classifyFailure,
  SnapshotError,
  type FailureStage,
} from "./diagnostics";
import deployment from "./sepolia-deployment.json";
import type { ChainSnapshot, Round, TownSave } from "../game/types";

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
export const identityAbi = parseAbi([
  "function implementationCodeAddress() view returns (address)",
  "function implementationCodeVersion() view returns (uint64)",
  "function implementationStorageLayoutDigest() view returns (bytes32)",
  "function proxyAdmin() view returns (address)",
  "function owner() view returns (address)",
]);
export const linksAbi = parseAbi([
  "function core() view returns (address)",
  "function mining() view returns (address)",
  "function collectionPolicy(uint8 collection) view returns ((address nft, uint16 maxSupply, uint8 maximumLevel, (uint64 weight, uint64 cooldownBlocks)[] levels))",
]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
// Runs one stage. Errors keep their stage; anything viem threw is classified here, so an RPC
// failure can never be reported as a deployment change, or the other way around.
async function atStage<T>(stage: FailureStage, read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError(
      stage,
      classifyFailure(error),
      (error as { shortMessage?: string }).shortMessage ??
        (error instanceof Error ? error.message : String(error)),
      error,
    );
  }
}
export type Position = {
  cumulativeWork: bigint;
  cumulativeBlockUnits: bigint;
  workPerThousandBlocks: number;
};
export type RoundPage = {
  certifiedThroughRound: bigint;
  start: Position;
  end: Position;
  rounds: readonly (Position & { roundId: bigint; dataHash: Hex })[];
};

// roundPage lists ACTIVE checkpoints only. Work is the difference of the official
// cumulativeWork field. Omitted rounds are zero ONLY inside certifiedThroughRound.
export function expandPage(
  after: bigint,
  requestedThrough: bigint,
  previousWork: bigint,
  page: RoundPage,
  maxWork = 10000n,
): Round[] {
  if (
    page.certifiedThroughRound <= after ||
    page.certifiedThroughRound > requestedThrough ||
    page.rounds.length > 16 ||
    page.start.cumulativeWork !== previousWork
  ) {
    throw new Error("The RPC returned an inconsistent certified round page.");
  }
  const active = new Map<bigint, bigint>();
  let work = previousWork;
  let last = after;
  for (const checkpoint of page.rounds) {
    const delta = checkpoint.cumulativeWork - work;
    if (
      checkpoint.roundId <= last ||
      checkpoint.roundId > page.certifiedThroughRound ||
      delta <= 0n ||
      delta > maxWork ||
      /^0x0+$/.test(checkpoint.dataHash)
    ) {
      throw new Error("The RPC returned an invalid work checkpoint.");
    }
    active.set(checkpoint.roundId, delta);
    work = checkpoint.cumulativeWork;
    last = checkpoint.roundId;
  }
  if (work !== page.end.cumulativeWork)
    throw new Error("The round page work totals do not agree.");
  const rounds: Round[] = [];
  for (let id = after + 1n; id <= page.certifiedThroughRound; id++)
    rounds.push({ id, work: active.get(id) ?? 0n });
  return rounds;
}
export type Reader = typeof publicClient;
function slotAddress(
  stage: FailureStage,
  slot: string,
  word: Hex | undefined,
): Address {
  if (!word || !/^0x[0-9a-fA-F]{64}$/.test(word))
    throw new SnapshotError(
      stage,
      "rpc",
      `The RPC returned an unreadable ERC-1967 ${slot} slot.`,
    );
  if (!/^0x0{24}/.test(word))
    throw new SnapshotError(
      stage,
      "deployment",
      `The ERC-1967 ${slot} slot does not hold an address: ${word}.`,
    );
  return getAddress(`0x${word.slice(-40)}`);
}
function stopOnMismatch(
  stage: FailureStage,
  subject: string,
  problems: (string | false)[],
) {
  const found = problems.filter(Boolean);
  if (found.length)
    throw new SnapshotError(
      stage,
      "deployment",
      `${subject}: ${found.join("; ")}.`,
    );
}
const differs = (label: string, actual: unknown, expected: unknown) =>
  `${label} is ${actual}, the official record says ${expected}`;
async function verifyProxy(
  name: "SqueekCore" | "SqueekMining",
  stage: FailureStage,
  blockNumber: bigint,
  client: Reader,
) {
  const expected = deployment.contracts[name];
  const address = getAddress(expected.address);
  const timelock = deployment.operational.governanceTimelock.address;
  const [implementationWord, adminWord] = await Promise.all([
    client.getStorageAt({ address, slot: IMPLEMENTATION_SLOT, blockNumber }),
    client.getStorageAt({ address, slot: ADMIN_SLOT, blockNumber }),
  ]);
  const implementation = slotAddress(
    stage,
    "implementation",
    implementationWord,
  );
  const admin = slotAddress(stage, "admin", adminWord);
  // An unknown implementation stops here. Its ABI is unknown too, so calling through it could
  // only produce a misleading decoding failure instead of naming the upgrade.
  stopOnMismatch(stage, name, [
    !same(implementation, expected.implementation) &&
      differs("the implementation", implementation, expected.implementation),
    !same(admin, expected.proxyAdmin) &&
      differs("the proxy admin", admin, expected.proxyAdmin),
  ]);
  const read = { address, abi: identityAbi, blockNumber } as const;
  const [reported, reportedAdmin, version, layout, code, owner] =
    await Promise.all([
      client.readContract({
        ...read,
        functionName: "implementationCodeAddress",
      }),
      client.readContract({ ...read, functionName: "proxyAdmin" }),
      client.readContract({
        ...read,
        functionName: "implementationCodeVersion",
      }),
      client.readContract({
        ...read,
        functionName: "implementationStorageLayoutDigest",
      }),
      client.getCode({ address: implementation, blockNumber }),
      client.readContract({
        address: admin,
        abi: identityAbi,
        functionName: "owner",
        blockNumber,
      }),
    ]);
  const runtimeHash = code ? keccak256(code) : null;
  stopOnMismatch(stage, name, [
    !same(reported, implementation) &&
      differs("implementationCodeAddress()", reported, implementation),
    !same(reportedAdmin, admin) &&
      differs("proxyAdmin()", reportedAdmin, admin),
    !runtimeHash && `the implementation has no runtime code at this block`,
    !!runtimeHash &&
      !same(runtimeHash, expected.implementationRuntimeHash) &&
      differs(
        "the runtime hash",
        runtimeHash,
        expected.implementationRuntimeHash,
      ),
    version !== BigInt(expected.implementationVersion) &&
      differs(
        "the implementation version",
        version,
        expected.implementationVersion,
      ),
    !same(layout, expected.storageLayoutDigest) &&
      differs("the layout digest", layout, expected.storageLayoutDigest),
    !same(owner, timelock) && differs("the ProxyAdmin owner", owner, timelock),
  ]);
  return address;
}
export async function fetchSnapshot(
  save: TownSave,
  client: Reader = publicClient,
): Promise<ChainSnapshot> {
  await atStage("network", async () => {
    const chainId = await client.getChainId();
    if (chainId !== CHAIN_ID)
      throw new SnapshotError(
        "network",
        "rpc",
        `The RPC answered for chain ${chainId}, not Sepolia (${CHAIN_ID}).`,
      );
  });
  // Every later read uses this one block. There is no fallback to any other tag.
  const { blockNumber, blockHash } = await atStage(
    "finalized block",
    async () => {
      const block = await client.getBlock({ blockTag: "finalized" });
      if (
        block.number === null ||
        !block.hash ||
        block.number < BigInt(deployment.deploymentBlock)
      )
        throw new SnapshotError(
          "finalized block",
          "rpc",
          "A finalized Sepolia snapshot is unavailable. Progress is preserved.",
        );
      if (save.anchor) {
        if (block.number < BigInt(save.anchor.number))
          throw new SnapshotError(
            "finalized block",
            "rpc",
            "The RPC is behind the saved snapshot.",
          );
        const previous = await client.getBlock({
          blockNumber: BigInt(save.anchor.number),
        });
        if (previous.hash !== save.anchor.hash)
          throw new SnapshotError(
            "finalized block",
            "consistency",
            "The saved finalized block changed. Accrual is paused to protect your progress.",
          );
      }
      return { blockNumber: block.number, blockHash: block.hash };
    },
  );
  const core = await atStage("Core proxy verification", () =>
    verifyProxy("SqueekCore", "Core proxy verification", blockNumber, client),
  );
  const mining = await atStage("Mining proxy verification", () =>
    verifyProxy(
      "SqueekMining",
      "Mining proxy verification",
      blockNumber,
      client,
    ),
  );
  const read = { address: core, abi: coreAbi, blockNumber } as const;
  const config = await atStage("configuration/links", async () => {
    const [config, miningCore, tokenMining, policy] = await Promise.all([
      client.readContract({ ...read, functionName: "configuration" }),
      client.readContract({
        address: mining,
        abi: linksAbi,
        functionName: "core",
        blockNumber,
      }),
      client.readContract({
        address: deployment.contracts.SqueekToken.address as Address,
        abi: linksAbi,
        functionName: "mining",
        blockNumber,
      }),
      client.readContract({
        address: mining,
        abi: linksAbi,
        functionName: "collectionPolicy",
        args: [0],
        blockNumber,
      }),
    ]);
    const expected = deployment.coreConfiguration;
    const numericKeys = [
      "genesisTimestamp",
      "roundDuration",
      "maxWorkPerRound",
      "maxRoundsPerBatch",
      "initialWorkPerThousandBlocks",
      "targetBlocksPerActiveRound",
      "difficultySmoothingRounds",
      "blockUnitsPerBlock",
    ] as const;
    const nft = deployment.contracts.SqueekNFT.address;
    stopOnMismatch("configuration/links", "Published release", [
      !same(core, CORE_ADDRESS) &&
        differs("the Core proxy", core, CORE_ADDRESS),
      !same(miningCore, core) &&
        differs("SqueekMining core()", miningCore, core),
      !same(tokenMining, mining) &&
        differs("SqueekToken mining()", tokenMining, mining),
      !same(policy.nft, nft) &&
        differs("collectionPolicy(0) nft", policy.nft, nft),
      !same(config.streamId, expected.streamId) &&
        differs("streamId", config.streamId, expected.streamId),
      !same(config.guardian, expected.guardian) &&
        differs("guardian", config.guardian, expected.guardian),
      !same(config.reporter, expected.reporter) &&
        differs("reporter", config.reporter, expected.reporter),
      ...numericKeys.map(
        (key) =>
          BigInt(config[key]) !== BigInt(expected[key]) &&
          differs(key, config[key], expected[key]),
      ),
    ]);
    return config;
  });
  const state = await atStage("state", async () => {
    const state = await client.readContract({ ...read, functionName: "state" });
    if (
      state.blockHeight !==
        state.cumulativeBlockUnits / config.blockUnitsPerBlock ||
      state.blockProgress !==
        state.cumulativeBlockUnits % config.blockUnitsPerBlock
    )
      throw new SnapshotError(
        "state",
        "consistency",
        "The work ledger has inconsistent Squeek block totals.",
      );
    return state;
  });
  const frontier = state.settledThroughRound;
  const { cursor, work, rounds } = await atStage("roundPage", async () => {
    const inconsistent = (message: string) =>
      new SnapshotError("roundPage", "consistency", message);
    const point = await client.readContract({
      ...read,
      functionName: "roundPage",
      args: [frontier, frontier, 0n],
    });
    if (
      point.certifiedThroughRound !== frontier ||
      point.end.cumulativeWork !== state.cumulativeWork ||
      point.end.cumulativeBlockUnits !== state.cumulativeBlockUnits ||
      point.end.workPerThousandBlocks !== state.workPerThousandBlocks
    )
      throw inconsistent(
        "The certified frontier does not agree with the work ledger.",
      );
    let cursor = save.checkpoint === null ? frontier : BigInt(save.checkpoint);
    if (cursor > frontier)
      throw inconsistent(
        "The settled frontier moved behind your saved checkpoint. Accrual is paused.",
      );
    let work = state.cumulativeWork;
    const rounds: Round[] = [];
    if (save.checkpoint !== null) {
      const start = await client.readContract({
        ...read,
        functionName: "roundPage",
        args: [cursor, cursor, 0n],
      });
      work = start.end.cumulativeWork;
      if (save.checkpointWork === null || work !== BigInt(save.checkpointWork))
        throw inconsistent(
          "The saved round checkpoint no longer agrees with Sepolia. Accrual is paused.",
        );
      // Bounded recovery: at most four pages, each requesting at most 128 round IDs
      // and 16 active records. Continue from the returned frontier on the next poll.
      for (let count = 0; count < 4 && cursor < frontier; count++) {
        const through = cursor + 128n < frontier ? cursor + 128n : frontier;
        const page = await client.readContract({
          ...read,
          functionName: "roundPage",
          args: [cursor, through, 16n],
        });
        try {
          rounds.push(
            ...expandPage(cursor, through, work, page, config.maxWorkPerRound),
          );
        } catch (error) {
          throw inconsistent((error as Error).message);
        }
        cursor = page.certifiedThroughRound;
        work = page.end.cumulativeWork;
      }
    }
    return { cursor, work, rounds };
  });
  await atStage("finalized block", async () => {
    const finalBlock = await client.getBlock({ blockNumber });
    if (finalBlock.hash !== blockHash)
      throw new SnapshotError(
        "finalized block",
        "consistency",
        "Sepolia reorganized during the refresh. Nothing was credited.",
      );
  });
  return {
    from: save.checkpoint,
    through: cursor.toString(),
    frontier: frontier.toString(),
    cumulativeWork: work.toString(),
    rounds,
    anchor: { number: blockNumber.toString(), hash: blockHash },
    blockHeight: state.blockHeight.toString(),
    paused: state.paused,
    more: cursor < frontier,
  };
}
