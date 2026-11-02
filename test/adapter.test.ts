import { describe, expect, it } from "vitest";
import {
  expandPage,
  fetchSnapshot,
  type Position,
  type Reader,
  type RoundPage,
} from "../src/chain/adapter";
import { emptySave } from "../src/game/types";
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
