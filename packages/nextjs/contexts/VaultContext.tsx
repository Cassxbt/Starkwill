"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { Contract as StarknetContract } from "starknet";
import scaffoldConfig from "~~/scaffold.config";
import { VAULT_ABI } from "~~/contracts/vaultAbi";

const LOCALSTORAGE_KEY = "starkwill_vault_address";
const CACHE_VERSION = 2;

function getCacheNamespace(factoryAddress?: string): string {
  return `${scaffoldConfig.targetNetworks[0].network}:${factoryAddress ?? "no-factory"}`;
}

function readVaultCache(): Record<string, Record<string, string>> {
  const parsed = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "{}");
  if (parsed && typeof parsed === "object" && parsed.version === CACHE_VERSION && parsed.entries) {
    return parsed.entries as Record<string, Record<string, string>>;
  }
  return {};
}

function writeVaultCache(entries: Record<string, Record<string, string>>) {
  localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }));
}

function getCachedVault(walletAddress: string, cacheNamespace: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cache = readVaultCache();
    return cache[cacheNamespace]?.[walletAddress.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function setCachedVault(walletAddress: string, vaultAddress: string, cacheNamespace: string) {
  if (typeof window === "undefined") return;
  try {
    const cache = readVaultCache();
    const namespaceEntries = cache[cacheNamespace] ?? {};
    namespaceEntries[walletAddress.toLowerCase()] = vaultAddress;
    cache[cacheNamespace] = namespaceEntries;
    writeVaultCache(cache);
  } catch {}
}

function clearCachedVault(walletAddress: string, cacheNamespace: string) {
  if (typeof window === "undefined") return;
  try {
    const cache = readVaultCache();
    if (!cache[cacheNamespace]) return;
    delete cache[cacheNamespace][walletAddress.toLowerCase()];
    if (Object.keys(cache[cacheNamespace]).length === 0) {
      delete cache[cacheNamespace];
    }
    writeVaultCache(cache);
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
  const cacheNamespace = getCacheNamespace(factoryAddress);

  const setVaultAddress = useCallback(
    (addr: string) => {
      setVaultAddressInternal(addr);
      if (address) setCachedVault(address, addr, cacheNamespace);
    },
    [address, cacheNamespace],
  );

  useEffect(() => {
    if (status !== "connected" || !address) {
      setVaultAddressInternal(null);
      return;
    }

    const cached = getCachedVault(address, cacheNamespace);
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

        if (cancelled) return;

        if (!isZero) {
          setVaultAddressInternal(addr);
          setCachedVault(address, addr, cacheNamespace);
        } else {
          setVaultAddressInternal(null);
          clearCachedVault(address, cacheNamespace);
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
  }, [address, status, factoryAddress, provider, cacheNamespace]);

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
