"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { Contract as StarknetContract } from "starknet";
import { VAULT_ABI } from "~~/contracts/vaultAbi";

const LOCALSTORAGE_KEY = "starkwill_vault_address";

function getCachedVault(walletAddress: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cache = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "{}");
    return cache[walletAddress.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function setCachedVault(walletAddress: string, vaultAddress: string) {
  if (typeof window === "undefined") return;
  try {
    const cache = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "{}");
    cache[walletAddress.toLowerCase()] = vaultAddress;
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

interface VaultContextValue {
  vaultAddress: string | null;
  setVaultAddress: (addr: string) => void;
  isLoading: boolean;
  hasVault: boolean;
  factoryAddress: string | null;
}

const VaultContext = createContext<VaultContextValue>({
  vaultAddress: null,
  setVaultAddress: () => {},
  isLoading: false,
  hasVault: false,
  factoryAddress: null,
});

export function useVault() {
  return useContext(VaultContext);
}

// Factory ABI — only the view function we need for lookup
const FACTORY_GET_VAULT_ABI = [
  {
    type: "interface",
    name: "starkwill::vault_factory::IVaultFactory",
    items: [
      {
        type: "function",
        name: "get_vault_for_owner",
        inputs: [{ name: "owner", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ],
  },
] as const;

interface VaultProviderProps {
  children: ReactNode;
  factoryAddress?: string;
}

export function VaultProvider({ children, factoryAddress }: VaultProviderProps) {
  const { address, status } = useAccount();
  const { provider } = useProvider();
  const [vaultAddress, setVaultAddressInternal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setVaultAddress = useCallback(
    (addr: string) => {
      setVaultAddressInternal(addr);
      if (address) setCachedVault(address, addr);
    },
    [address],
  );

  useEffect(() => {
    if (status !== "connected" || !address) {
      setVaultAddressInternal(null);
      return;
    }

    const cached = getCachedVault(address);
    if (cached) {
      setVaultAddressInternal(cached);
    }

    if (!factoryAddress || !provider) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const factory = new StarknetContract({ abi: FACTORY_GET_VAULT_ABI as any, address: factoryAddress, providerOrAccount: provider });
        const result = await factory.call("get_vault_for_owner", [address]);
        const addr = typeof result === "bigint" ? "0x" + result.toString(16) : String(result);
        const isZero = /^0x0*$/.test(addr);

        if (!cancelled && !isZero) {
          setVaultAddressInternal(addr);
          setCachedVault(address, addr);
        }
      } catch (e) {
        console.error("Factory vault lookup failed:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, status, factoryAddress, provider]);

  return (
    <VaultContext.Provider
      value={{
        vaultAddress,
        setVaultAddress,
        isLoading,
        hasVault: !!vaultAddress,
        factoryAddress: factoryAddress ?? null,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export { VAULT_ABI };
