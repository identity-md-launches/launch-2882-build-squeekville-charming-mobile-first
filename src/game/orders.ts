import {
  hashTypedData,
  recoverTypedDataAddress,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { publicClient, CHAIN_ID } from "../chain/config";
import {
  LOCATIONS,
  type Location,
  type Order,
  type SignedDraft,
} from "./types";
export const orderDomain = {
  name: "Squeekville",
  version: "1",
  chainId: CHAIN_ID,
} as const;
export const orderTypes = {
  MayorOrder: [
    { name: "mayor", type: "address" },
    { name: "location", type: "string" },
    { name: "energyCost", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "origin", type: "string" },
  ],
} as const;
export function typedOrder(
  order:
    Omit<SignedDraft, "id"> | SignedDraft | Extract<Order, { kind: "signed" }>,
) {
  return {
    domain: orderDomain,
    types: orderTypes,
    primaryType: "MayorOrder",
    message: {
      mayor: order.mayor,
      location: LOCATIONS[order.location].name,
      energyCost: 3n,
      nonce: order.nonce,
      issuedAt: BigInt(order.issuedAt),
      expiresAt: BigInt(order.expiresAt),
      origin: order.origin,
    },
  } as const;
}
function newNonce(): Hex {
  return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
export function createOrder(
  mayor: Address,
  location: Location,
  origin: string,
): SignedDraft {
  const issuedAt = Math.floor(Date.now() / 1000);
  const draft = {
    mayor,
    location,
    energyCost: 3 as const,
    nonce: newNonce(),
    issuedAt,
    expiresAt: issuedAt + 86400,
    origin,
    kind: "signed" as const,
  };
  const id = hashTypedData(typedOrder(draft));
  return { ...draft, id };
}
export function createDemoOrder(
  location: Location,
  origin: string,
): Extract<Order, { kind: "demo" }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = newNonce();
  return {
    id: nonce,
    mayor: "Practice mayor",
    location,
    energyCost: 3,
    nonce,
    issuedAt,
    expiresAt: issuedAt + 86400,
    origin,
    kind: "demo",
  };
}
export function validateOrderFields(
  order: Order,
  mayor: Address | undefined,
  origin: string,
  mode: "connected" | "practice",
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !order ||
    !Object.hasOwn(LOCATIONS, order.location) ||
    order.energyCost !== 3 ||
    !isHex(order.nonce) ||
    order.nonce.length !== 66 ||
    order.origin !== origin
  )
    throw new Error(
      "This mayor order has invalid details or a different site origin.",
    );
  if (
    !Number.isSafeInteger(order.issuedAt) ||
    !Number.isSafeInteger(order.expiresAt) ||
    order.expiresAt - order.issuedAt !== 86400 ||
    order.issuedAt > now + 60
  )
    throw new Error("This mayor order has invalid dates.");
  if (order.expiresAt <= now)
    throw new Error(
      "This mayor order expired. Cancel it and sign a new order.",
    );
  if (mode === "practice") {
    if (
      order.kind !== "demo" ||
      order.mayor !== "Practice mayor" ||
      order.id !== order.nonce
    )
      throw new Error(
        "Only unsigned demo orders can be used in Practice mode.",
      );
  } else {
    if (
      order.kind !== "signed" ||
      !mayor ||
      !isAddress(order.mayor) ||
      order.mayor.toLowerCase() !== mayor.toLowerCase()
    )
      throw new Error("This order belongs to a different mayor.");
    if (order.id !== hashTypedData(typedOrder(order)))
      throw new Error(
        "This mayor order has changed. Cancel it and sign a new order.",
      );
  }
}
export async function verifyOrder(
  order: Order,
  mayor: Address | undefined,
  origin: string,
  mode: "connected" | "practice",
) {
  validateOrderFields(order, mayor, origin, mode);
  if (order.kind === "demo") return;
  if (!mayor)
    throw new Error("Connect the mayor account to verify this order.");
  if (!isHex(order.signature) || order.signature.length < 4)
    throw new Error("This order has no valid signature.");
  const data = typedOrder(order);
  let recovered: Address | undefined;
  try {
    recovered = await recoverTypedDataAddress({
      ...data,
      signature: order.signature,
    });
  } catch {
    /* Contract-wallet signatures need ERC-1271/6492 validation. */
  }
  if (recovered?.toLowerCase() === mayor.toLowerCase()) return;
  // Read-only EIP-1271 / ERC-6492 verification also supports Coinbase Smart Wallet.
  if (
    !(await publicClient.verifyTypedData({
      ...data,
      address: mayor,
      signature: order.signature,
    }))
  ) {
    throw new Error(
      "The signature does not match this mayor. Please sign with the connected account.",
    );
  }
}
