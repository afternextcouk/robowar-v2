import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { metaMask, walletConnect } from "wagmi/connectors";

const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || "1");
const chains = chainId === 11155111 ? [sepolia] : [mainnet];

export const wagmiConfig = createConfig({
  chains: chains as [typeof mainnet],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: import.meta.env.VITE_WC_PROJECT_ID || "robowar_dev",
    }),
  ],
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_WEB3_RPC_URL),
    [sepolia.id]: http(import.meta.env.VITE_WEB3_RPC_URL),
  },
});

/** ELDR ERC-20 contract ABI (minimal) */
export const ELDR_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "Transfer", type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ] },
] as const;

export const ELDR_CONTRACT = import.meta.env.VITE_ELDR_CONTRACT as `0x${string}`;
