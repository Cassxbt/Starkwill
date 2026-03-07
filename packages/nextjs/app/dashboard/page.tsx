"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAccount, useProvider } from "@starknet-react/core";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useTransactor } from "~~/hooks/scaffold-stark";
import { Contract as StarknetContract, CallData, cairo, hash } from "starknet";
import { TOKENS, getTokenAddress } from "~~/utils/starkwill/tokens";
import { TONGO_SUPPORTED_TOKENS } from "~~/utils/starkwill/tongo-constants";
import { useVault, VAULT_ABI } from "~~/contexts/VaultContext";
import { useVaultContract } from "~~/hooks/useVaultContract";

const TOKEN_ADDR_TO_SYMBOL: Record<string, { symbol: string; decimals: number }> = {};
for (const [symbol, info] of Object.entries(TOKENS)) {
  TOKEN_ADDR_TO_SYMBOL[info.sepolia.toLowerCase()] = { symbol, decimals: info.decimals };
}

function resolveToken(addr: string): { symbol: string; decimals: number } {
  const normalized = addr.toLowerCase().replace(/^0x0*/, "0x");
  for (const [key, val] of Object.entries(TOKEN_ADDR_TO_SYMBOL)) {
    if (key.replace(/^0x0*/, "0x") === normalized) return val;
  }
  return { symbol: addr.slice(0, 8) + "...", decimals: 18 };
}

function formatAmount(raw: bigint | string | number, decimals: number): string {
  const val = typeof raw === "bigint" ? raw : BigInt(String(raw));
  const divisor = 10n ** BigInt(decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const STORAGE_KEY_LAST_CHECKIN = hash.getSelectorFromName("last_checkin_ts");
const STORAGE_KEY_CHECKIN_PERIOD = hash.getSelectorFromName("checkin_period_secs");
const STORAGE_KEY_GRACE_PERIOD = hash.getSelectorFromName("grace_period_secs");

function formatCountdown(totalSecs: number): string {
  if (totalSecs <= 0) return "0m";
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

type CountdownPhase = "active" | "grace" | "claimable" | null;

const Dashboard = () => {
  const { address, status } = useAccount();
  const shouldReduceMotion = useReducedMotion();
  const { writeTransaction } = useTransactor();
  const { vaultAddress, hasVault } = useVault();
  const vaultContract = useVaultContract();

  const [depositToken, setDepositToken] = useState("STRK");
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [privateMode, setPrivateMode] = useState(false);
  const [tongoKey, setTongoKey] = useState("");
  const [tongoStep, setTongoStep] = useState<0 | 1 | 2>(0);
  const [tongoStatus, setTongoStatus] = useState("");

  const { provider } = useProvider();

  const [isClaimable, setIsClaimable] = useState<boolean | null>(null);
  const [heirMerkleRoot, setHeirMerkleRoot] = useState<string | null>(null);
  const [verifierAddress, setVerifierAddress] = useState<string | null>(null);

  const [lastCheckinTs, setLastCheckinTs] = useState<number | null>(null);
  const [checkinPeriodSecs, setCheckinPeriodSecs] = useState<number | null>(null);
  const [gracePeriodSecs, setGracePeriodSecs] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [countdownPhase, setCountdownPhase] = useState<CountdownPhase>(null);

  useEffect(() => {
    if (!vaultContract) return;
    let cancelled = false;
    (async () => {
      try {
        const [claimable, root, verifier] = await Promise.all([
          vaultContract.call("is_claimable"),
          vaultContract.call("get_heir_merkle_root"),
          vaultContract.call("get_verifier_address"),
        ]);
        if (cancelled) return;
        setIsClaimable(!!claimable);
        const rootStr = typeof root === "bigint" ? root.toString() : String(root);
        setHeirMerkleRoot(rootStr === "0" ? null : rootStr);
        const verStr = typeof verifier === "bigint" ? verifier.toString() : String(verifier);
        setVerifierAddress(verStr === "0" ? null : verStr);
      } catch (e) {
        console.error("Failed to read vault state:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [vaultContract]);

  useEffect(() => {
    if (!vaultAddress || !provider) return;
    let cancelled = false;
    (async () => {
      try {
        const [lastRaw, periodRaw, graceRaw] = await Promise.all([
          (provider as any).getStorageAt(vaultAddress, STORAGE_KEY_LAST_CHECKIN),
          (provider as any).getStorageAt(vaultAddress, STORAGE_KEY_CHECKIN_PERIOD),
          (provider as any).getStorageAt(vaultAddress, STORAGE_KEY_GRACE_PERIOD),
        ]);
        if (cancelled) return;
        setLastCheckinTs(Number(BigInt(lastRaw)));
        setCheckinPeriodSecs(Number(BigInt(periodRaw)));
        setGracePeriodSecs(Number(BigInt(graceRaw)));
      } catch (e) {
        console.error("Failed to read vault timing:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [vaultAddress, provider]);

  useEffect(() => {
    if (lastCheckinTs == null || checkinPeriodSecs == null || gracePeriodSecs == null) return;
    if (isClaimable) {
      setCountdownLabel("Vault is claimable");
      setCountdownPhase("claimable");
      return;
    }

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = lastCheckinTs + checkinPeriodSecs;
      const graceEnd = deadline + gracePeriodSecs;

      if (now < deadline) {
        setCountdownLabel(`Check-in due in ${formatCountdown(deadline - now)}`);
        setCountdownPhase("active");
      } else if (now < graceEnd) {
        setCountdownLabel(`Grace period: ${formatCountdown(graceEnd - now)} remaining`);
        setCountdownPhase("grace");
      } else {
        setCountdownLabel("Vault is claimable");
        setCountdownPhase("claimable");
      }
    };

    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [lastCheckinTs, checkinPeriodSecs, gracePeriodSecs, isClaimable]);

  const mv = (v: Variants | undefined) => (shouldReduceMotion ? undefined : v);

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
          <p className="text-[var(--sw-text-secondary)] text-sm">Connect to view your vault dashboard.</p>
        </motion.div>
      </div>
    );
  }

  if (!hasVault) {
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
          <h2 className="text-2xl font-bold mb-3 tracking-tight text-[var(--sw-text)]">No Vault Found</h2>
          <p className="text-[var(--sw-text-secondary)] text-sm mb-6">Create an inheritance vault to get started.</p>
          <a
            href="/create"
            className="inline-flex px-6 py-2.5 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-colors"
          >
            Create Vault
          </a>
        </motion.div>
      </div>
    );
  }

  const handleCheckIn = async () => {
    if (!vaultContract) return;
    setIsCheckingIn(true);
    try {
      const call = new StarknetContract({ abi: VAULT_ABI as any, address: vaultAddress! }).populate("check_in", []);
      await writeTransaction([call]);
    } catch (e) {
      console.error("Check-in failed:", e);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !vaultAddress) return;
    setIsDepositing(true);
    try {
      const tokenAddr = getTokenAddress(depositToken);
      const token = TOKENS[depositToken];
      const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 10 ** token.decimals));

      const vault = new StarknetContract({ abi: VAULT_ABI as any, address: vaultAddress });
      const approveCall = {
        contractAddress: tokenAddr,
        entrypoint: "approve",
        calldata: CallData.compile({
          spender: vaultAddress,
          amount: cairo.uint256(amountWei),
        }),
      };
      const depositCall = vault.populate("deposit", [tokenAddr, amountWei]);

      await writeTransaction([approveCall, depositCall]);
      setDepositAmount("");
      setShowDeposit(false);
    } catch (e) {
      console.error("Deposit failed:", e);
    } finally {
      setIsDepositing(false);
    }
  };

  const handleTongoDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !tongoKey || !address || !vaultAddress) return;
    try {
      const { buildFundCalls, buildWithdrawCalls } = await import("~~/utils/starkwill/tongo");
      const token = TOKENS[depositToken];
      const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 10 ** token.decimals));

      setTongoStep(1);
      setTongoStatus("Funding Tongo account...");
      const fundCalls = await buildFundCalls(tongoKey, depositToken, amountWei, address);
      await writeTransaction(fundCalls);

      setTongoStep(2);
      setTongoStatus("Withdrawing to vault...");
      const withdrawCalls = await buildWithdrawCalls(tongoKey, depositToken, amountWei, vaultAddress, address);
      await writeTransaction(withdrawCalls);

      setTongoStatus("Private deposit complete!");
      setDepositAmount("");
      setTimeout(() => {
        setTongoStep(0);
        setTongoStatus("");
        setShowDeposit(false);
      }, 2000);
    } catch (e: any) {
      console.error("Tongo deposit failed:", e);
      setTongoStatus(`Failed: ${e.message?.slice(0, 80) || "Unknown error"}`);
      setTongoStep(0);
    }
  };

  const hasVerifier = !!verifierAddress;
  const hasRoot = !!heirMerkleRoot;

  return (
    <div className="flex flex-col items-center min-h-screen px-6 pt-10 pb-24">
      <motion.div
        variants={mv(fadeInUp)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-[var(--sw-text)]">
          Vault Dashboard
        </h1>
        <p className="text-[var(--sw-text-tertiary)] font-mono-code text-xs">
          {vaultAddress?.slice(0, 12)}...{vaultAddress?.slice(-8)}
        </p>
      </motion.div>

      <motion.div
        variants={mv(staggerContainer)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="w-full max-w-3xl space-y-5"
      >
        {/* Proof of Life */}
        <motion.div
          variants={mv(staggerItem)}
          className={`p-6 bg-[var(--sw-surface)] border ${
            isClaimable
              ? "border-amber-500/20"
              : "border-emerald-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 flex items-center justify-center ${
                isClaimable ? "bg-amber-500/10" : "bg-emerald-500/10"
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={isClaimable ? "text-amber-400" : "text-emerald-400"}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Proof of Life</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isClaimable ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <span className={`text-xs font-medium ${isClaimable ? "text-amber-400" : "text-emerald-400"}`}>
                    {isClaimable ? "Vault Unlocked" : "Vault Active"}
                  </span>
                </div>
                {countdownLabel && (
                  <p className={`text-[11px] mt-1.5 ${
                    countdownPhase === "grace" ? "text-amber-400" :
                    countdownPhase === "claimable" ? "text-red-400" :
                    "text-[var(--sw-text-tertiary)]"
                  }`}>
                    {countdownLabel}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="inline-flex items-center gap-2 px-6 py-2.5 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-50 transition-colors"
            >
              {isCheckingIn ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              )}
              Check In
            </button>
          </div>
          <p className="text-[11px] text-[var(--sw-text-placeholder)] mt-3">
            Your wallet may prompt twice (estimate + confirm). This is normal.
          </p>
        </motion.div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ),
              label: "Vault Status",
              value: isClaimable ? "Claimable" : "Active",
              sub: "Dead-man\u2019s switch",
              color: isClaimable ? "text-amber-400" : "text-emerald-400",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              ),
              label: "ZK Verifier",
              value: hasVerifier ? "Deployed" : "Not Set",
              sub: "Garaga on-chain",
              color: hasVerifier ? "text-emerald-400" : "text-[var(--sw-text-tertiary)]",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              ),
              label: "Merkle Root",
              value: hasRoot ? "Set" : "Not Set",
              sub: "Heir commitment tree",
              color: hasRoot ? "text-emerald-400" : "text-[var(--sw-text-tertiary)]",
            },
          ].map((card) => (
            <motion.div
              key={card.label}
              variants={mv(staggerItem)}
              className="p-5 bg-[var(--sw-surface)] border border-[var(--sw-border)] hover:border-[var(--sw-border-hover)] transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400">{card.icon}</span>
                <span className="text-xs text-[var(--sw-text-secondary)] font-medium">{card.label}</span>
              </div>
              <p className={`text-xl font-bold tracking-tight ${card.color}`}>{card.value}</p>
              <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Deposit Section */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                  <path d="M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Deposit Assets</h3>
            </div>
            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className={`px-4 py-1.5 text-xs font-medium border transition-all duration-300 ${
                showDeposit
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-emerald-500/20 hover:text-emerald-400"
              }`}
            >
              {showDeposit ? "Close" : "Deposit"}
            </button>
          </div>

          <AnimatePresence>
            {showDeposit && (
              <motion.div
                initial={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4 overflow-hidden"
              >
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrivateMode(false)}
                    className={`px-4 py-2 text-xs font-medium border transition-all duration-200 ${
                      !privateMode
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-[var(--sw-border-hover)]"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => {
                      setPrivateMode(true);
                      if (!TONGO_SUPPORTED_TOKENS.includes(depositToken)) {
                        setDepositToken("STRK");
                      }
                    }}
                    className={`px-4 py-2 text-xs font-medium border transition-all duration-200 ${
                      privateMode
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                        : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-[var(--sw-border-hover)]"
                    }`}
                  >
                    Private (Tongo)
                  </button>
                </div>

                <div className="flex gap-2">
                  {(privateMode ? TONGO_SUPPORTED_TOKENS : Object.keys(TOKENS)).map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setDepositToken(symbol)}
                      className={`px-4 py-2 text-xs font-medium border transition-all duration-200 ${
                        depositToken === symbol
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-[var(--sw-border-hover)]"
                      }`}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>

                {privateMode && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tongoKey}
                        onChange={(e) => setTongoKey(e.target.value)}
                        placeholder="Tongo private key"
                        className="flex-1 px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-purple-500/40 transition-colors font-mono-code"
                      />
                      <button
                        onClick={() => {
                          const rand = crypto.getRandomValues(new Uint8Array(31));
                          const hex = "0x" + Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");
                          setTongoKey(hex);
                        }}
                        className="px-3 py-2.5 text-xs font-medium border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 transition-all whitespace-nowrap"
                      >
                        Generate
                      </button>
                    </div>
                    {tongoKey && tongoKey.startsWith("0x") && tongoKey.length > 20 && (
                      <p className="text-[11px] text-amber-400">
                        Save this key securely. It cannot be recovered.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder={`Amount in ${depositToken}`}
                    className="flex-1 px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
                    min="0"
                    step="0.01"
                  />
                  {privateMode ? (
                    <button
                      onClick={handleTongoDeposit}
                      disabled={tongoStep > 0 || !depositAmount || parseFloat(depositAmount) <= 0 || !tongoKey}
                      className="px-6 py-2.5 font-medium text-sm bg-purple-500 text-white hover:bg-purple-400 disabled:opacity-40 transition-colors"
                    >
                      {tongoStep > 0 ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        "Private Deposit"
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleDeposit}
                      disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                      className="px-6 py-2.5 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-40 transition-colors"
                    >
                      {isDepositing ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        "Deposit"
                      )}
                    </button>
                  )}
                </div>

                {privateMode && tongoStep > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${tongoStep >= 1 ? "bg-purple-400" : "bg-[var(--sw-border)]"}`} />
                      <span className={`text-xs font-medium ${tongoStep === 1 ? "text-purple-400" : tongoStep > 1 ? "text-emerald-400" : "text-[var(--sw-text-tertiary)]"}`}>
                        Step 1: Fund Tongo {tongoStep > 1 && "\u2713"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${tongoStep >= 2 ? "bg-purple-400" : "bg-[var(--sw-border)]"}`} />
                      <span className={`text-xs font-medium ${tongoStep === 2 ? "text-purple-400" : "text-[var(--sw-text-tertiary)]"}`}>
                        Step 2: Withdraw to Vault
                      </span>
                    </div>
                  </div>
                )}

                {privateMode && tongoStatus && (
                  <p className={`text-[11px] ${tongoStatus.startsWith("Failed") ? "text-red-400" : tongoStatus.includes("complete") ? "text-emerald-400" : "text-purple-400"}`}>
                    {tongoStatus}
                  </p>
                )}

                <p className="text-[11px] text-[var(--sw-text-placeholder)]">
                  {privateMode
                    ? "Private deposits route through Tongo for confidential on-chain transfers."
                    : "Approve and deposit are batched into a single transaction."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!showDeposit && (
            <p className="text-sm text-[var(--sw-text-secondary)]">
              Fund your vault with ETH, STRK, or WBTC for heir inheritance.
            </p>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <h3 className="font-semibold text-base mb-5 tracking-tight text-[var(--sw-text)]">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Configure Vault", href: "/create", icon: "M12 2L2 7l10 5 10-5-10-5z" },
              { label: "Deposit Assets", href: null, onClick: () => setShowDeposit(true), icon: "M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
            ].map((action) => {
              const Wrapper = action.href ? "a" : "button";
              return (
                <Wrapper
                  key={action.label}
                  {...(action.href ? { href: action.href } : {})}
                  onClick={action.onClick}
                  className="group flex items-center gap-3 px-4 py-3 border border-[var(--sw-border-light)] bg-[var(--sw-bg-faint)] text-sm text-[var(--sw-text-secondary)] hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] transition-all duration-300 text-left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--sw-text-tertiary)] group-hover:text-emerald-400 transition-colors shrink-0">
                    <path d={action.icon} />
                  </svg>
                  {action.label}
                </Wrapper>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
