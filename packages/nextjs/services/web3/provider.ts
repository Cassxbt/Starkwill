import scaffoldConfig from "~~/scaffold.config";
import {
  jsonRpcProvider,
  publicProvider,
  starknetChainId,
} from "@starknet-react/core";
import * as chains from "@starknet-react/chains";
import { RpcProvider } from "starknet";

const DEFAULT_DEVNET_RPC_URL = "http://127.0.0.1:5050";
const DEFAULT_SEPOLIA_RPC_URL = "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
const DEFAULT_MAINNET_RPC_URL = "https://starknet-mainnet.public.blastapi.io/rpc/v0_7";

const containsDevnet = (networks: readonly chains.Chain[]) => {
  return (
    networks.filter((it) => it.network == chains.devnet.network).length > 0
  );
};

// Get the current target network (first one in the array)
const currentNetwork = scaffoldConfig.targetNetworks[0];
const currentNetworkName = currentNetwork.network;

export const getRpcUrl = (networkName: string): string => {
  const devnetRpcUrl = process.env.NEXT_PUBLIC_DEVNET_PROVIDER_URL;
  const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL;
  const mainnetRpcUrl = process.env.NEXT_PUBLIC_MAINNET_PROVIDER_URL;

  let rpcUrl = "";

  switch (networkName) {
    case "devnet":
      rpcUrl = devnetRpcUrl || DEFAULT_DEVNET_RPC_URL;
      break;
    case "sepolia":
      rpcUrl = sepoliaRpcUrl || DEFAULT_SEPOLIA_RPC_URL;
      break;
    case "mainnet":
      rpcUrl = mainnetRpcUrl || DEFAULT_MAINNET_RPC_URL;
      break;
    default:
      rpcUrl = DEFAULT_DEVNET_RPC_URL;
      break;
  }

  return rpcUrl;
};

// Get RPC URL for the current network
const rpcUrl = getRpcUrl(currentNetworkName);

// Important: if the rpcUrl is empty (not configured in .env), we use the publicProvider
// which randomly choose a provider from the chain list of public providers.
// Some public provider might have strict rate limits.
if (rpcUrl === "") {
  console.warn(
    `No RPC Provider URL configured for ${currentNetworkName}. Using public provider.`,
  );
}

const provider = () => new RpcProvider({ nodeUrl: rpcUrl });

export default provider;
