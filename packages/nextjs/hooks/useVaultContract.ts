import { useMemo } from "react";
import { useProvider } from "@starknet-react/core";
import { Contract as StarknetContract } from "starknet";
import { useVault, VAULT_ABI } from "~~/contexts/VaultContext";

/**
 * Returns a starknet.js Contract instance pointing at the user's dynamic vault address.
 * Returns null when no vault address is available.
 */
export function useVaultContract(): StarknetContract | null {
  const { vaultAddress } = useVault();
  const { provider } = useProvider();

  return useMemo(() => {
    if (!vaultAddress || !provider) return null;
    return new StarknetContract({ abi: VAULT_ABI as any, address: vaultAddress, providerOrAccount: provider });
  }, [vaultAddress, provider]);
}
