import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { createPublicClient, http as viemHttp } from "viem";
import { sepolia } from "viem/chains";
import deployment from "./sepolia-deployment.json";

// Public, keyless browser RPC published in viem's Sepolia definition.
export const RPC_URL = "https://11155111.rpc.thirdweb.com";
export const CHAIN_ID = sepolia.id;
export const CORE_ADDRESS = deployment.contracts.SqueekCore
  .address as `0x${string}`;
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: viemHttp(RPC_URL, {
    timeout: 15_000,
    retryCount: 0,
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
