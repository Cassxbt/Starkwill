// Tongo contract addresses on Sepolia
export const TONGO_CONTRACTS: Record<string, string> = {
  STRK: "0x408163bfcfc2d76f34b444cb55e09dace5905cf84c0884e4637c2c0f06ab6ed",
  ETH: "0x2cf0dc1d9e8c7731353dd15e6f2f22140120ef2d27116b982fa4fed87f6fef5",
};

// Supported tokens for Tongo private deposits
export const TONGO_SUPPORTED_TOKENS = Object.keys(TONGO_CONTRACTS);
