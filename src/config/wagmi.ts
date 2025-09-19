import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { createStorage } from "wagmi";

// Get RPC URLs from environment variables
const baseRpcUrl = process.env.NEXT_PUBLIC_RPC_BASE || "https://mainnet.base.org";
const baseSepoliaRpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEP || "https://sepolia.base.org";

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    }),
  ],
  transports: {
    [base.id]: http(baseRpcUrl),
    [baseSepolia.id]: http(baseSepoliaRpcUrl),
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }),
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
