import { getAddress, keccak256, parseAbi, type Address, type Hex } from "viem";
import { publicClient, CORE_ADDRESS, CHAIN_ID } from "./config";
import { coreAbi } from "./core-abi";
import deployment from "./sepolia-deployment.json";
import type { ChainSnapshot, Round, TownSave } from "../game/types";

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const identityAbi = parseAbi([
  "function implementationCodeAddress() view returns (address)",
  "function implementationCodeVersion() view returns (uint64)",
  "function implementationStorageLayoutDigest() view returns (bytes32)",
  "function owner() view returns (address)",
]);
const linksAbi = parseAbi([
  "function core() view returns (address)",
  "function mining() view returns (address)",
  "function collectionPolicy(uint8 collection) view returns ((address nft, uint16 maxSupply, uint8 maximumLevel, (uint64 weight, uint64 cooldownBlocks)[] levels))",
]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
function slotAddress(word: Hex | undefined) {
  if (!word || word.length !== 66)
    throw new Error("The deployment identity could not be read.");
  return getAddress(`0x${word.slice(-40)}`);
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
async function verifyProxy(
  name: "SqueekCore" | "SqueekMining",
  blockNumber: bigint,
  client: Reader,
) {
  const expected = deployment.contracts[name];
  const address = getAddress(expected.address);
  const [implementationWord, adminWord, reported, version, layout] =
    await Promise.all([
      client.getStorageAt({ address, slot: IMPLEMENTATION_SLOT, blockNumber }),
      client.getStorageAt({ address, slot: ADMIN_SLOT, blockNumber }),
      client.readContract({
        address,
        abi: identityAbi,
        functionName: "implementationCodeAddress",
        blockNumber,
      }),
      client.readContract({
        address,
        abi: identityAbi,
        functionName: "implementationCodeVersion",
        blockNumber,
      }),
      client.readContract({
        address,
        abi: identityAbi,
        functionName: "implementationStorageLayoutDigest",
        blockNumber,
      }),
    ]);
  const implementation = slotAddress(implementationWord);
  const admin = slotAddress(adminWord);
  const [code, owner] = await Promise.all([
    client.getCode({ address: implementation, blockNumber }),
    client.readContract({
      address: admin,
      abi: identityAbi,
      functionName: "owner",
      blockNumber,
    }),
  ]);
  if (
    !same(implementation, expected.implementation) ||
    !same(reported, implementation) ||
    !same(admin, expected.proxyAdmin) ||
    !code ||
    !same(keccak256(code), expected.implementationRuntimeHash) ||
    version !== BigInt(expected.implementationVersion) ||
    !same(layout, expected.storageLayoutDigest) ||
    !same(owner, deployment.operational.governanceTimelock.address)
  ) {
    throw new Error(
      "The published Squeekchain deployment has changed. Connected mode is unavailable until its identity is reviewed.",
    );
  }
  return address;
}
export async function fetchSnapshot(
  save: TownSave,
  client: Reader = publicClient,
): Promise<ChainSnapshot> {
  const [chainId, block] = await Promise.all([
    client.getChainId(),
    client.getBlock({ blockTag: "finalized" }),
  ]);
  if (
    chainId !== CHAIN_ID ||
    block.number === null ||
    !block.hash ||
    block.number < BigInt(deployment.deploymentBlock)
  ) {
    throw new Error(
      "A finalized Sepolia snapshot is unavailable. Progress is preserved.",
    );
  }
  const blockNumber = block.number;
  if (save.anchor) {
    if (blockNumber < BigInt(save.anchor.number))
      throw new Error("The RPC is behind the saved snapshot.");
    const previous = await client.getBlock({
      blockNumber: BigInt(save.anchor.number),
    });
    if (previous.hash !== save.anchor.hash)
      throw new Error(
        "The saved finalized block changed. Accrual is paused to protect your progress.",
      );
  }
  const [core, mining] = await Promise.all([
    verifyProxy("SqueekCore", blockNumber, client),
    verifyProxy("SqueekMining", blockNumber, client),
  ]);
  if (!same(core, CORE_ADDRESS))
    throw new Error("The core address does not match the published record.");
  const read = { address: core, abi: coreAbi, blockNumber } as const;
  const [config, state, miningCore, tokenMining, policy] = await Promise.all([
    client.readContract({ ...read, functionName: "configuration" }),
    client.readContract({ ...read, functionName: "state" }),
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
  if (
    !same(miningCore, core) ||
    !same(tokenMining, mining) ||
    !same(policy.nft, deployment.contracts.SqueekNFT.address) ||
    !same(config.streamId, expected.streamId) ||
    !same(config.guardian, expected.guardian) ||
    !same(config.reporter, expected.reporter) ||
    numericKeys.some((key) => BigInt(config[key]) !== BigInt(expected[key]))
  ) {
    throw new Error(
      "The Squeekchain configuration no longer matches the published release. Connected mode is unavailable.",
    );
  }
  if (
    state.blockHeight !==
      state.cumulativeBlockUnits / config.blockUnitsPerBlock ||
    state.blockProgress !==
      state.cumulativeBlockUnits % config.blockUnitsPerBlock
  ) {
    throw new Error("The work ledger has inconsistent Squeek block totals.");
  }
  const frontier = state.settledThroughRound;
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
  ) {
    throw new Error(
      "The certified frontier does not agree with the work ledger.",
    );
  }
  let cursor = save.checkpoint === null ? frontier : BigInt(save.checkpoint);
  if (cursor > frontier)
    throw new Error(
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
      throw new Error(
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
      rounds.push(
        ...expandPage(cursor, through, work, page, config.maxWorkPerRound),
      );
      cursor = page.certifiedThroughRound;
      work = page.end.cumulativeWork;
    }
  }
  const finalBlock = await client.getBlock({ blockNumber });
  if (finalBlock.hash !== block.hash)
    throw new Error(
      "Sepolia reorganized during the refresh. Nothing was credited.",
    );
  return {
    from: save.checkpoint,
    through: cursor.toString(),
    frontier: frontier.toString(),
    cumulativeWork: work.toString(),
    rounds,
    anchor: { number: blockNumber.toString(), hash: block.hash },
    blockHeight: state.blockHeight.toString(),
    paused: state.paused,
    more: cursor < frontier,
  };
}
