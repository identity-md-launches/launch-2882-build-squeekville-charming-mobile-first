// Test double: replays public Sepolia reads recorded by test/live/sepolia.live.test.ts.
import { createPublicClient, custom } from "viem";
import { sepolia } from "viem/chains";
import type { Reader } from "../src/chain/adapter";

export type RecordedCall = {
  method: string;
  params?: unknown[];
  result: unknown;
};
export type Request = { method: string; params?: unknown[] };
export const callKey = ({ method, params = [] }: Request) =>
  JSON.stringify([method, params]).toLowerCase();

// `intercept` may return a replacement result, or throw to fail that one request.
export function replayClient(
  calls: RecordedCall[],
  intercept?: (request: Request) => unknown,
) {
  const table = new Map(calls.map((call) => [callKey(call), call.result]));
  const log: Request[] = [];
  const client = createPublicClient({
    chain: sepolia,
    transport: custom(
      {
        async request(request: Request) {
          log.push(request);
          const replaced = intercept?.(request);
          if (replaced !== undefined) return replaced;
          const key = callKey(request);
          if (!table.has(key)) throw new Error(`Unrecorded read: ${key}`);
          return table.get(key);
        },
      },
      { retryCount: 0 },
    ),
  }) as unknown as Reader;
  return { client, log };
}
