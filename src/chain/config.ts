import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { createPublicClient, defineChain, http as viemHttp } from "viem";
import { sepolia as viemSepolia } from "viem/chains";
import deployment from "./sepolia-deployment.json";

// Public, keyless Sepolia RPC. Verified from a browser at the deployed origin: eth_chainId,
// finalized blocks, single and batched requests, historical storage and contract calls.
// See VALIDATION.md. The previous endpoint answered 429 with no CORS header.
export const RPC_URL = "https://rpc.sepolia.ethpandaops.io";
export const RPC_HOST = new URL(RPC_URL).hostname;
// Also the RPC a wallet is offered if it has to add Sepolia.
const sepolia = defineChain({
  ...viemSepolia,
  rpcUrls: { default: { http: [RPC_URL] } },
});
export const CHAIN_ID = sepolia.id;
export const CORE_ADDRESS = deployment.contracts.SqueekCore
  .address as `0x${string}`;
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: viemHttp(RPC_URL, {
    timeout: 15_000,
    // One quick retry for a dropped request. Polling handles anything longer.
    retryCount: 1,
    retryDelay: 500,
    batch: { batchSize: 20, wait: 15 },
  }),
});
export const walletConfig = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Squeekville", preference: { options: "all" } }),
  ],
  transports: { [sepolia.id]: http(RPC_URL) },
});
