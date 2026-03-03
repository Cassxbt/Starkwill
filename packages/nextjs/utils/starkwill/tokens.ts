export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  sepolia: string;
  mainnet: string;
}

export const TOKENS: Record<string, TokenInfo> = {
  ETH: {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    sepolia: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    mainnet: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
  STRK: {
    symbol: "STRK",
    name: "Starknet Token",
    decimals: 18,
    sepolia: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    mainnet: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  },
  WBTC: {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    sepolia: "0x12d537dc323c439dc65c976fad242d5610d27cfb5f31689a0a319b8be7f3d56",
    mainnet: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

export function getTokenAddress(symbol: string, network: "sepolia" | "mainnet" = "sepolia"): string {
  const token = TOKENS[symbol];
  if (!token) throw new Error(`Unknown token: ${symbol}`);
  return token[network];
}
