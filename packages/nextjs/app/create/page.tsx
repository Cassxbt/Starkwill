"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAccount, useProvider } from "@starknet-react/core";
import { useTransactor } from "~~/hooks/scaffold-stark";
import { Contract as StarknetContract } from "starknet";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { computeCommitment, buildMerkleTree, toHex } from "~~/utils/starkwill/merkle";
import { type HeirPackage, buildHeirPackage, serializeHeirPackage } from "~~/utils/starkwill/heirPackage";
import { TOKENS, getTokenAddress } from "~~/utils/starkwill/tokens";
import { VERIFIER_ADDRESS } from "~~/utils/starkwill/constants";
import { useVault, VAULT_ABI } from "~~/contexts/VaultContext";
import { useVaultContract } from "~~/hooks/useVaultContract";

const FACTORY_ABI = [
  {
    type: "interface",
    name: "starkwill::vault_factory::IVaultFactory",
    items: [
      {
        type: "function",
        name: "create_vault",
        inputs: [
          { name: "checkin_period_secs", type: "core::integer::u64" },
          { name: "grace_period_secs", type: "core::integer::u64" },
          { name: "cancelable_until_ts", type: "core::integer::u64" },
          { name: "guardian_1", type: "core::starknet::contract_address::ContractAddress" },
          { name: "guardian_2", type: "core::starknet::contract_address::ContractAddress" },
          { name: "guardian_3", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_vault_for_owner",
        inputs: [{ name: "owner", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "event",
    name: "starkwill::vault_factory::vault_factory::VaultCreated",
    kind: "struct",
    members: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "vault_address", type: "core::starknet::contract_address::ContractAddress", kind: "data" },
      { name: "vault_index", type: "core::integer::u64", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "starkwill::vault_factory::vault_factory::Event",
    kind: "enum",
    variants: [
      { name: "VaultCreated", type: "starkwill::vault_factory::vault_factory::VaultCreated", kind: "nested" },
    ],
  },
] as const;

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const slideIn: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

type SetupStatus = "idle" | "deploying" | "credentials" | "configuring" | "success" | "error";

interface CredentialBundle {
  vaultAddress: string;
  merkleRoot: string;
  packages: HeirPackage[];
}

const CreateVault = () => {
  const { address, status } = useAccount();
  const { provider } = useProvider();
  const shouldReduceMotion = useReducedMotion();
  const { writeTransaction } = useTransactor();
  const { vaultAddress, setVaultAddress, hasVault, factoryAddress } = useVault();
  const vaultContract = useVaultContract();

  const [checkinDays, setCheckinDays] = useState("30");
  const [graceDays, setGraceDays] = useState("7");
  const [guardians, setGuardians] = useState(["", "", ""]);
  const [heirSecrets, setHeirSecrets] = useState<string[]>([""]);
  const [heirWeights, setHeirWeights] = useState<string[]>(["100"]);
  const [step, setStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [tokensToWhitelist, setTokensToWhitelist] = useState<string[]>(["ETH", "STRK"]);
  const [existingRoot, setExistingRoot] = useState<string | null>(null);
  const [credentialBundle, setCredentialBundle] = useState<CredentialBundle | null>(null);
  const [downloadedPackages, setDownloadedPackages] = useState<boolean[]>([]);

  useEffect(() => {
    if (!vaultContract) { setExistingRoot(null); return; }
    (async () => {
      try {
        const root = await vaultContract.call("get_heir_merkle_root");
        const rootStr = typeof root === "bigint" ? "0x" + root.toString(16) : String(root);
        setExistingRoot(/^0x0*$/.test(rootStr) ? null : rootStr);
      } catch {
        setExistingRoot(null);
      }
    })();
  }, [vaultContract]);

  useEffect(() => {
    if (!credentialBundle || downloadedPackages.every(Boolean)) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [credentialBundle, downloadedPackages]);

  const mv = (v: Variants | undefined) => (shouldReduceMotion ? undefined : v);

  const updateGuardian = (index: number, value: string) => {
    const updated = [...guardians];
    updated[index] = value;
    setGuardians(updated);
  };

  const addHeir = () => {
    setHeirSecrets([...heirSecrets, ""]);
    setHeirWeights([...heirWeights, ""]);
  };
  const removeHeir = (index: number) => {
    if (heirSecrets.length > 1) {
      setHeirSecrets(heirSecrets.filter((_, i) => i !== index));
      setHeirWeights(heirWeights.filter((_, i) => i !== index));
    }
  };
  const updateHeir = (index: number, value: string) => {
    const updated = [...heirSecrets];
    updated[index] = value;
    setHeirSecrets(updated);
  };
  const updateWeight = (index: number, value: string) => {
    const updated = [...heirWeights];
    updated[index] = value;
    setHeirWeights(updated);
  };

  const toggleToken = (symbol: string) => {
    setTokensToWhitelist((prev) =>
      prev.includes(symbol) ? prev.filter((t) => t !== symbol) : [...prev, symbol],
    );
  };

  const totalWeight = useMemo(() => {
    return heirWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
  }, [heirWeights]);

  const totalWeightBps = useMemo(() => {
    return heirWeights.reduce((sum, w) => sum + Math.round((parseFloat(w) || 0) * 100), 0);
  }, [heirWeights]);

  const merkleData = useMemo(() => {
    const validPairs = heirSecrets
      .map((s, i) => ({ secret: s.trim(), weight: heirWeights[i]?.trim() }))
      .filter((p) => p.secret.length > 0 && p.weight.length > 0 && parseFloat(p.weight) > 0);
    if (validPairs.length === 0) return null;
    try {
      const commitments = validPairs.map((p) => {
        const secret = BigInt(p.secret.startsWith("0x") ? p.secret : "0x" + p.secret);
        const weightBps = BigInt(Math.round(parseFloat(p.weight) * 100));
        return computeCommitment(secret, weightBps);
      });
      const tree = buildMerkleTree(commitments);
      return { root: tree.root, rootHex: toHex(tree.root), count: validPairs.length, commitmentHexes: commitments.map(toHex), validPairs };
    } catch {
      return null;
    }
  }, [heirSecrets, heirWeights]);

  const allHeirPackagesDownloaded = credentialBundle !== null
    && downloadedPackages.length === credentialBundle.packages.length
    && downloadedPackages.every(Boolean);
  const allGuardiansProvided = guardians.every((guardian) => guardian.trim().startsWith("0x") && guardian.trim().length > 10);
  const guardiansAreDistinct = new Set(guardians.map((guardian) => guardian.trim().toLowerCase())).size === guardians.length;
  const hasPartialHeirEntries = heirSecrets.some((secret, index) => {
    const normalizedSecret = secret.trim();
    const normalizedWeight = heirWeights[index]?.trim() ?? "";
    const hasSecret = normalizedSecret.length > 0;
    const hasWeight = normalizedWeight.length > 0 && parseFloat(normalizedWeight) > 0;
    return hasSecret !== hasWeight;
  });
  const hasValidHeirConfiguration = !!merkleData && !hasPartialHeirEntries && totalWeightBps === 10_000;
  const hasValidGuardianConfiguration = hasVault || (allGuardiansProvided && guardiansAreDistinct);
  const canSubmitVaultConfiguration = hasValidHeirConfiguration && hasValidGuardianConfiguration;

  const createCredentialBundle = (targetVaultAddress: string): CredentialBundle | null => {
    if (!merkleData) return null;

    return {
      vaultAddress: targetVaultAddress,
      merkleRoot: merkleData.rootHex,
      packages: merkleData.validPairs.map((pair) => {
        const weightBps = Math.round(parseFloat(pair.weight) * 100);
        return buildHeirPackage({
          vault: targetVaultAddress,
          secret: pair.secret.startsWith("0x") ? pair.secret : `0x${pair.secret}`,
          weightBps,
          commitments: merkleData.commitmentHexes,
          merkleRoot: merkleData.rootHex,
        });
      }),
    };
  };

  const handleDownloadHeirPackage = (index: number) => {
    if (!credentialBundle) return;

    const pkg = credentialBundle.packages[index];
    const blob = new Blob([serializeHeirPackage(pkg)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `starkwill-heir-${index + 1}.json`;
    a.rel = "noopener";
    a.click();
    setDownloadedPackages((current) => current.map((downloaded, currentIndex) =>
      currentIndex === index ? true : downloaded,
    ));
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleSetupVault = async () => {
    if (!merkleData) return;
    setErrorMsg("");

    try {
      if (!hasValidHeirConfiguration) {
        throw new Error("Heir weights must sum to exactly 100% with no incomplete entries.");
      }
      if (!hasValidGuardianConfiguration) {
        throw new Error("Provide 3 distinct guardian addresses before configuring the vault.");
      }
      let targetVaultAddress = credentialBundle?.vaultAddress ?? vaultAddress;

      // Tx 1: Deploy via factory (skip if vault already exists)
      if (!hasVault && !targetVaultAddress) {
        setSetupStatus("deploying");
        if (!factoryAddress || !provider) {
          throw new Error("Factory not available. Deploy the factory contract first.");
        }

        const factory = new StarknetContract({ abi: FACTORY_ABI as any, address: factoryAddress, providerOrAccount: provider });
        const checkinSecs = Math.floor(parseFloat(checkinDays) * 86400);
        const graceSecs = Math.floor(parseFloat(graceDays) * 86400);
        const cancelableUntil = Math.floor(Date.now() / 1000) + 365 * 86400;

        const deployCall = factory.populate("create_vault", [
          checkinSecs, graceSecs, cancelableUntil,
          guardians[0], guardians[1], guardians[2],
        ]);

        const txHash = await writeTransaction([deployCall]);
        if (!txHash) throw new Error("Deploy transaction failed");

        const receipt = await provider.waitForTransaction(txHash);
        const factoryAddrBig = BigInt(factoryAddress);
        const vaultEvent = (receipt as any).events?.find(
          (e: any) => BigInt(e.from_address) === factoryAddrBig,
        );

        if (!vaultEvent?.data?.[0]) {
          throw new Error("Could not find VaultCreated event in receipt");
        }

        targetVaultAddress = "0x" + BigInt(vaultEvent.data[0]).toString(16);
        setVaultAddress(targetVaultAddress);
      }

      if (!targetVaultAddress) throw new Error("No vault address available");

      const bundleNeedsRefresh = !credentialBundle
        || credentialBundle.vaultAddress !== targetVaultAddress
        || credentialBundle.merkleRoot !== merkleData.rootHex
        || credentialBundle.packages.length !== merkleData.validPairs.length;

      if (bundleNeedsRefresh) {
        const nextBundle = createCredentialBundle(targetVaultAddress);
        if (!nextBundle) throw new Error("Failed to prepare heir packages.");
        setCredentialBundle(nextBundle);
        setDownloadedPackages(new Array(nextBundle.packages.length).fill(false));
        setSetupStatus("credentials");
        return;
      }

      if (!allHeirPackagesDownloaded) {
        setSetupStatus("credentials");
        setErrorMsg("Download every heir package before configuring the vault.");
        return;
      }

      // Tx 2: Configure vault (set verifier + merkle root + whitelist tokens)
      setSetupStatus("configuring");
      const vault = new StarknetContract({ abi: VAULT_ABI as any, address: targetVaultAddress });
      const configCalls = [
        vault.populate("set_verifier_address", [VERIFIER_ADDRESS]),
        vault.populate("set_heir_merkle_root", [credentialBundle.merkleRoot]),
        ...tokensToWhitelist.map((sym) =>
          vault.populate("whitelist_token", [getTokenAddress(sym), true]),
        ),
      ];

      await writeTransaction(configCalls);
      setSetupStatus("success");
    } catch (e: any) {
      console.error("Vault setup failed:", e);
      setSetupStatus("error");
      setErrorMsg(e?.message?.slice(0, 120) || "Transaction failed");
    }
  };

  const steps = ["Configure", "Guardians", "Heirs", "Review"];

  if (status !== "connected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <motion.div
          variants={mv(fadeInUp)}
          initial={shouldReduceMotion ? undefined : "hidden"}
          animate="visible"
          className="text-center"
        >
          <div className="w-16 h-16 bg-[var(--sw-surface)] border border-[var(--sw-border)] flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-tight text-[var(--sw-text)]">Connect Your Wallet</h2>
          <p className="text-[var(--sw-text-secondary)] text-sm">Please connect your Starknet wallet to create a vault.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-6 pt-10 pb-24">
      <motion.div
        variants={mv(fadeInUp)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="text-center mb-4"
      >
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-[var(--sw-text)]">
          {hasVault ? "Update Heir Configuration" : "Create Inheritance Vault"}
        </h1>
        <p className="text-[var(--sw-text-secondary)] text-sm">
          {hasVault
            ? "Replace the heir root and whitelist on your existing vault"
            : "Deploy and configure your dead-man\u2019s switch vault"}
        </p>
      </motion.div>

      {hasVault && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 px-4 py-2 bg-emerald-500/[0.08] border border-emerald-500/15 text-xs text-emerald-400 font-medium font-mono-code"
        >
          Vault: {vaultAddress?.slice(0, 12)}...{vaultAddress?.slice(-8)}
        </motion.div>
      )}

      {hasVault && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 max-w-lg px-4 py-3 bg-amber-500/[0.06] border border-amber-500/15 text-xs text-[var(--sw-text-secondary)]"
        >
          Existing guardian addresses and timer settings are not loaded into this form. Saving here updates the
          verifier, replaces the heir Merkle root, and re-applies the selected token whitelist entries only.
        </motion.div>
      )}

      {existingRoot && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 px-4 py-2 bg-emerald-500/[0.08] border border-emerald-500/15 text-xs text-emerald-400 font-medium"
        >
          Heir fingerprint already set on vault
        </motion.div>
      )}

      <div className="flex gap-1.5 mb-10">
        {steps.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`relative px-5 py-2 text-xs font-medium transition-all duration-300 ${
              step === i
                ? "text-[var(--sw-text-inverted)] bg-emerald-500"
                : step > i
                  ? "text-emerald-400/70 bg-emerald-500/[0.08] border border-emerald-500/15"
                  : "text-[var(--sw-text-tertiary)] bg-[var(--sw-bg-faint)] border border-[var(--sw-border-faint)]"
            }`}
          >
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              variants={mv(slideIn)}
              initial={shouldReduceMotion ? undefined : "hidden"}
              animate="visible"
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -30 }}
              className="space-y-5"
            >
              <div className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-5">
                  <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Vault Timing</h3>
                  {hasVault && (
                    <p className="text-xs text-[var(--sw-text-tertiary)]">
                      Timing parameters are fixed at deployment. These are for reference only.
                    </p>
                  )}
                  <div>
                    <label className="text-xs text-[var(--sw-text-secondary)] block mb-1.5 font-medium">Check-in Period (days)</label>
                    <input
                      type="number"
                      value={checkinDays}
                      onChange={(e) => setCheckinDays(e.target.value)}
                      disabled={hasVault}
                      className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors disabled:opacity-50"
                      min="1"
                    />
                    <p className="text-[11px] text-[var(--sw-text-placeholder)] mt-1.5">
                      How often you must check in to keep the vault locked.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--sw-text-secondary)] block mb-1.5 font-medium">Grace Period (days)</label>
                    <input
                      type="number"
                      value={graceDays}
                      onChange={(e) => setGraceDays(e.target.value)}
                      disabled={hasVault}
                      className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors disabled:opacity-50"
                      min="1"
                    />
                    <p className="text-[11px] text-[var(--sw-text-placeholder)] mt-1.5">
                      Extra time after check-in expires before heirs can claim.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-4">
                  <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Token Whitelist</h3>
                  <p className="text-xs text-[var(--sw-text-tertiary)]">Select which tokens the vault accepts for deposits.</p>
                  <div className="flex gap-2">
                    {Object.keys(TOKENS).map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => toggleToken(symbol)}
                        className={`px-4 py-2 text-xs font-medium border transition-all duration-200 ${
                          tokensToWhitelist.includes(symbol)
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-[var(--sw-border-hover)]"
                        }`}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(1)}
                className="w-full px-6 py-3 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-colors"
              >
                Next: {hasVault ? "Review Guardians" : "Add Guardians"}
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              variants={mv(slideIn)}
              initial={shouldReduceMotion ? undefined : "hidden"}
              animate="visible"
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -30 }}
              className="space-y-5"
            >
              <div className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Guardians (2-of-3)</h3>
                    <p className="text-xs text-[var(--sw-text-tertiary)] mt-1">
                      Trusted addresses that can emergency-unlock the vault.
                    </p>
                  </div>
                  {guardians.map((g, i) => (
                    <div key={i}>
                      <label className="text-xs text-[var(--sw-text-secondary)] block mb-1.5 font-medium">Guardian {i + 1}</label>
                      <input
                        type="text"
                        value={g}
                        onChange={(e) => updateGuardian(i, e.target.value)}
                        disabled={hasVault}
                        placeholder="0x..."
                        className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] font-mono-code placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors disabled:opacity-50"
                      />
                    </div>
                  ))}
                  {hasVault && (
                    <p className="text-[11px] text-[var(--sw-text-placeholder)]">
                      Guardians are fixed at deployment and cannot be changed.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 px-6 py-3 text-sm font-medium border border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:text-[var(--sw-text-dim)] hover:border-[var(--sw-border-hover)] transition-all">
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-3 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-colors"
                >
                  Next: Add Heirs
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              variants={mv(slideIn)}
              initial={shouldReduceMotion ? undefined : "hidden"}
              animate="visible"
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -30 }}
              className="space-y-5"
            >
              <div className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Heir Secrets</h3>
                    <button onClick={addHeir} className="px-3 py-1 text-xs font-medium border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all">
                      + Add Heir
                    </button>
                  </div>
                  <p className="text-xs text-[var(--sw-text-tertiary)]">
                    Enter each heir&apos;s secret (hex) and their share weight (%). Weights are cryptographically bound in the ZK proof.
                  </p>
                  {heirSecrets.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={h}
                        onChange={(e) => updateHeir(i, e.target.value)}
                        placeholder="0x... (heir secret)"
                        className="flex-1 px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] font-mono-code placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
                      />
                      <input
                        type="number"
                        value={heirWeights[i] || ""}
                        onChange={(e) => updateWeight(i, e.target.value)}
                        placeholder="%"
                        min="0.01"
                        max="100"
                        step="0.01"
                        className="w-20 px-3 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] text-center placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
                      />
                      {heirSecrets.length > 1 && (
                        <button onClick={() => removeHeir(i)} className="px-3 border border-[var(--sw-border)] text-[var(--sw-text-tertiary)] hover:text-red-400 hover:border-red-500/20 transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  <div className={`text-xs font-medium ${
                    totalWeightBps === 10_000
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}>
                    Total weight: {totalWeight.toFixed(2)}%
                    {totalWeightBps !== 10_000 && " (should equal 100%)"}
                  </div>
                  {hasPartialHeirEntries && (
                    <p className="text-[11px] text-amber-400">
                      Every heir row must include both a secret and a positive weight.
                    </p>
                  )}

                  {merkleData && (
                    <div className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 space-y-1.5">
                      <p className="text-[11px] text-[var(--sw-text-secondary)] font-medium">Heir Fingerprint ({merkleData.count} heir{merkleData.count !== 1 ? "s" : ""})</p>
                      <p className="font-mono-code text-xs text-emerald-400/80 break-all">{merkleData.rootHex}</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">
                        This fingerprint uniquely identifies your heirs. Stored on-chain but reveals nothing about individual identities.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 px-6 py-3 text-sm font-medium border border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:text-[var(--sw-text-dim)] hover:border-[var(--sw-border-hover)] transition-all">
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!hasValidHeirConfiguration}
                  className="flex-1 px-6 py-3 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-40 transition-colors"
                >
                  Review
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              variants={mv(slideIn)}
              initial={shouldReduceMotion ? undefined : "hidden"}
              animate="visible"
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -30 }}
              className="space-y-5"
            >
              <div className="p-7 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-5">
                  <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Vault Summary</h3>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Owner", value: `${address?.slice(0, 12)}...${address?.slice(-8)}`, mono: true },
                      { label: "Check-in Period", value: `${checkinDays} days` },
                      { label: "Grace Period", value: `${graceDays} days` },
                      { label: "Guardians", value: `${guardians.filter((g) => g.length > 0).length} / 3` },
                      { label: "Heirs", value: `${merkleData?.count ?? 0} (weighted shares)` },
                      { label: "Tokens", value: tokensToWhitelist.join(", ") },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-1 border-b border-[var(--sw-border-faint)] last:border-0">
                        <span className="text-[var(--sw-text-secondary)] text-xs">{row.label}</span>
                        <span className={`text-[var(--sw-text-dim)] text-xs ${row.mono ? "font-mono-code" : ""}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {merkleData && (
                    <div className="pt-3 border-t border-[var(--sw-border-faint)]">
                      <p className="text-[11px] text-[var(--sw-text-tertiary)] mb-1.5">Heir Fingerprint (Merkle Root)</p>
                      <p className="font-mono-code text-xs text-emerald-400/70 break-all">{merkleData.rootHex}</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">
                        Uniquely identifies your heirs on-chain without revealing their identities.
                      </p>
                    </div>
                  )}

                  {!hasVault && (
                    <p className="text-[11px] text-[var(--sw-text-placeholder)] pt-2">
                      This will require 2 wallet signatures: one to deploy the vault, one to configure it.
                    </p>
                  )}
                  {!hasValidGuardianConfiguration && (
                    <p className="text-[11px] text-amber-400 pt-2">
                      Vault setup requires 3 distinct guardian addresses.
                    </p>
                  )}
                  {!hasValidHeirConfiguration && (
                    <p className="text-[11px] text-amber-400">
                      Heir weights must sum to exactly 100%, and every active row must be complete.
                    </p>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {setupStatus === "deploying" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-3"
                  >
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Deploying vault...</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">Creating vault via factory (sign tx 1/2)</p>
                    </div>
                  </motion.div>
                )}

                {setupStatus === "configuring" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-3"
                  >
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Configuring vault...</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">Setting verifier, merkle root, and token whitelist{!hasVault && " (sign tx 2/2)"}</p>
                    </div>
                  </motion.div>
                )}

                {setupStatus === "credentials" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-amber-500/[0.06] border border-amber-500/15 flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                      <path d="M12 9v4M12 17h.01" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Download heir packages before continuing</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                        These files are the claim credentials. Leaving now before downloading them can strand the vault.
                      </p>
                    </div>
                  </motion.div>
                )}

                {setupStatus === "success" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-emerald-400">Vault ready</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                        {vaultAddress && `Deployed at ${vaultAddress.slice(0, 12)}...${vaultAddress.slice(-8)}`}
                      </p>
                    </div>
                  </motion.div>
                )}

                {setupStatus === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/[0.06] border border-red-500/15 flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-400">Setup failed</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">{errorMsg}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {credentialBundle && (setupStatus === "credentials" || setupStatus === "success") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-[var(--sw-surface)] border border-emerald-500/15 space-y-3"
                >
                  <p className="text-xs font-medium text-[var(--sw-text-secondary)]">Heir Credentials</p>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                    Download each heir&apos;s package and deliver it to them securely. Each file contains their secret, weight, vault address, and the full commitment list needed to claim.
                  </p>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                    Vault: <span className="font-mono-code text-[var(--sw-text-secondary)]">{credentialBundle.vaultAddress}</span>
                  </p>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                    Root: <span className="font-mono-code text-[var(--sw-text-secondary)]">{credentialBundle.merkleRoot}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {credentialBundle.packages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handleDownloadHeirPackage(i)}
                        className="px-4 py-2 text-xs font-medium border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7,10 12,15 17,10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Heir {i + 1}{downloadedPackages[i] ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 px-6 py-3 text-sm font-medium border border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:text-[var(--sw-text-dim)] hover:border-[var(--sw-border-hover)] transition-all">
                  Back
                </button>
                <button
                  onClick={handleSetupVault}
                  disabled={
                    !canSubmitVaultConfiguration
                    || setupStatus === "deploying"
                    || setupStatus === "configuring"
                    || setupStatus === "success"
                    || (setupStatus === "credentials" && !allHeirPackagesDownloaded)
                  }
                  className="flex-1 px-6 py-3 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-40 transition-colors"
                >
                  {setupStatus === "deploying" || setupStatus === "configuring" ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin mx-auto" />
                  ) : setupStatus === "credentials" ? (
                    allHeirPackagesDownloaded ? "Configure Vault" : "Download All Packages First"
                  ) : setupStatus === "success" ? (
                    "Done"
                  ) : hasVault ? (
                    "Configure Vault"
                  ) : (
                    "Deploy & Configure"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CreateVault;
