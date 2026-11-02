import type { Address, Hex } from "viem";
export const LOCATIONS = {
  bakery: {
    name: "Bakery",
    title: "Fire Up the Oven",
    description: "A warm loaf for the neighborhood.",
    event: "The oven is glowing. Fresh bread for everyone!",
    idle: "The oven is resting.",
  },
  park: {
    name: "Park",
    title: "Start the Fountain",
    description: "A little splash. A lovely afternoon.",
    event: "The fountain is flowing. The neighbors are gathering!",
    idle: "The fountain is still.",
  },
  square: {
    name: "Town Square",
    title: "Light Up the Square",
    description: "Make a little room for celebration.",
    event: "The square is sparkling. Everyone is invited!",
    idle: "The lights are resting.",
  },
} as const;
export type Location = keyof typeof LOCATIONS;
export type Mode = "connected" | "practice";
export type Order = {
  id: Hex;
  location: Location;
  energyCost: 3;
  nonce: Hex;
  issuedAt: number;
  expiresAt: number;
  origin: string;
} & (
  | { kind: "signed"; mayor: Address; signature: Hex }
  | { kind: "demo"; mayor: "Practice mayor"; signature?: never }
);
export type SignedDraft = Omit<Extract<Order, { kind: "signed" }>, "signature">;
export type JournalEntry = {
  id: string;
  time: number;
  kind: "chain" | "local" | "practice";
  text: string;
};
export type Anchor = { number: string; hash: Hex };
export type TownSave = {
  version: 1;
  key: string;
  energy: number;
  checkpoint: string | null;
  checkpointWork: string | null;
  latestVerifiedRound: string | null;
  anchor: Anchor | null;
  lastSuccess: number | null;
  pending: Order | null;
  completed: string[];
  usedNonces: string[];
  settings: { reducedMotion: boolean; selected: Location };
  journal: JournalEntry[];
};
export type Round = { id: bigint; work: bigint };
export type ChainSnapshot = {
  from: string | null;
  through: string;
  frontier: string;
  cumulativeWork: string;
  rounds: Round[];
  anchor: Anchor;
  blockHeight: string;
  paused: boolean;
  more: boolean;
};
export function saveKey(mode: Mode, address?: string): string {
  if (mode === "practice") return "practice:v1";
  if (!address) throw new Error("Connect a wallet to open this town.");
  return `connected:11155111:${address.toLowerCase()}`;
}
export function emptySave(key: string): TownSave {
  return {
    version: 1,
    key,
    energy: 0,
    checkpoint: null,
    checkpointWork: null,
    latestVerifiedRound: null,
    anchor: null,
    lastSuccess: null,
    pending: null,
    completed: [],
    usedNonces: [],
    settings: { reducedMotion: false, selected: "bakery" },
    journal: [],
  };
}
export function addJournal(
  save: TownSave,
  kind: JournalEntry["kind"],
  text: string,
) {
  save.journal = [
    { id: crypto.randomUUID(), time: Date.now(), kind, text },
    ...save.journal,
  ].slice(0, 40);
}
