"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAccount } from "@starknet-react/core";
import { useScaffoldReadContract } from "~~/hooks/scaffold-stark/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-stark/useScaffoldWriteContract";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-stark/useScaffoldEventHistory";
import {
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useTransactor } from "~~/hooks/scaffold-stark";
import { TOKENS, getTokenAddress } from "~~/utils/starkwill/tokens";
import { TONGO_SUPPORTED_TOKENS } from "~~/utils/starkwill/tongo-constants";

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

const Dashboard = () => {
  const { address, status } = useAccount();
  const shouldReduceMotion = useReducedMotion();
  const [depositToken, setDepositToken] = useState("STRK");
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  // Tongo private deposit state
  const [privateMode, setPrivateMode] = useState(false);
  const [tongoKey, setTongoKey] = useState("");
  const [tongoStep, setTongoStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=funding, 2=withdrawing
  const [tongoStatus, setTongoStatus] = useState("");

  const { data: isClaimable } = useScaffoldReadContract({
    contractName: "vault",
    functionName: "is_claimable",
    args: [],
  });

  const { data: heirMerkleRoot } = useScaffoldReadContract({
    contractName: "vault",
    functionName: "get_heir_merkle_root",
    args: [],
  });

  const { data: verifierAddress } = useScaffoldReadContract({
    contractName: "vault",
    functionName: "get_verifier_address",
    args: [],
  });

  const { sendAsync: checkIn, isPending: isCheckingIn } = useScaffoldWriteContract({
    contractName: "vault",
    functionName: "check_in",
    args: [],
  });

  const { sendAsync: deposit, isPending: isDepositing } = useScaffoldWriteContract({
    contractName: "vault",
    functionName: "deposit",
    args: [undefined, undefined],
  });

  const { writeTransaction } = useTransactor();

  const VAULT_ADDRESS = "0x656c5beb9d880efeb4a1f25a2fb030737c85b410c5fd83e55b9ff370c0c8673";

  const { data: claimEvents, isLoading: eventsLoading } = useScaffoldEventHistory({
    contractName: "vault",
    eventName: "ZKClaim",
    fromBlock: 0n,
    blockData: true,
    watch: false,
  });

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

  const handleCheckIn = async () => {
    try {
      await checkIn();
    } catch (e) {
      console.error("Check-in failed:", e);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    try {
      const tokenAddr = getTokenAddress(depositToken);
      const token = TOKENS[depositToken];
      const amountWei = BigInt(Math.floor(parseFloat(depositAmount) * 10 ** token.decimals));
      await deposit({ args: [tokenAddr, amountWei] });
      setDepositAmount("");
      setShowDeposit(false);
    } catch (e) {
      console.error("Deposit failed:", e);
    }
  };

  const handleTongoDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !tongoKey || !address) return;
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
      const withdrawCalls = await buildWithdrawCalls(tongoKey, depositToken, amountWei, VAULT_ADDRESS, address);
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

  const hasVerifier = verifierAddress && verifierAddress.toString() !== "0";
  const hasRoot = heirMerkleRoot && heirMerkleRoot.toString() !== "0";

  return (
    <div className="flex flex-col items-center min-h-screen px-6 pt-10 pb-24">
      {/* Header */}
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
          {address?.slice(0, 12)}...{address?.slice(-8)}
        </p>
      </motion.div>

      <motion.div
        variants={mv(staggerContainer)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="w-full max-w-3xl space-y-5"
      >
        {/* ── Proof of Life Card ── */}
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
        </motion.div>

        {/* ── Status Grid ── */}
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

        {/* ── Deposit Section ── */}
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
                {/* Mode Toggle */}
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
                      // Switch to a Tongo-supported token if current isn't
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

                {/* Token Selector */}
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

                {/* Tongo Private Key (only in private mode) */}
                {privateMode && (
                  <input
                    type="password"
                    value={tongoKey}
                    onChange={(e) => setTongoKey(e.target.value)}
                    placeholder="Tongo private key"
                    className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-purple-500/40 transition-colors font-mono-code"
                  />
                )}

                {/* Amount Input + Action */}
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

                {/* Tongo Step Progress */}
                {privateMode && tongoStep > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${tongoStep >= 1 ? "bg-purple-400" : "bg-[var(--sw-border)]"}`} />
                      <span className={`text-xs font-medium ${tongoStep === 1 ? "text-purple-400" : tongoStep > 1 ? "text-emerald-400" : "text-[var(--sw-text-tertiary)]"}`}>
                        Step 1: Fund Tongo {tongoStep > 1 && "✓"}
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

                {/* Status Message */}
                {privateMode && tongoStatus && (
                  <p className={`text-[11px] ${tongoStatus.startsWith("Failed") ? "text-red-400" : tongoStatus.includes("complete") ? "text-emerald-400" : "text-purple-400"}`}>
                    {tongoStatus}
                  </p>
                )}

                <p className="text-[11px] text-[var(--sw-text-placeholder)]">
                  {privateMode
                    ? "Private deposits route through Tongo for confidential on-chain transfers. Your Tongo key is never stored."
                    : "You must first approve the vault contract to spend your tokens (ERC20 approve)."}
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

        {/* ── Quick Actions ── */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <h3 className="font-semibold text-base mb-5 tracking-tight text-[var(--sw-text)]">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Set Heir Merkle Root", href: "/create", icon: "M12 2L2 7l10 5 10-5-10-5z" },
              { label: "Set Verifier Address", href: null, icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
              { label: "Deposit Assets", href: null, onClick: () => setShowDeposit(true), icon: "M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
              { label: "Whitelist Token", href: null, icon: "M9 12l2 2 4-4M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" },
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

        {/* ── Recent Claim Activity ── */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Recent Activity</h3>
          </div>

          {eventsLoading ? (
            <div className="flex items-center gap-2 py-4">
              <ArrowPathIcon className="h-4 w-4 animate-spin text-[var(--sw-text-tertiary)]" />
              <span className="text-sm text-[var(--sw-text-tertiary)]">Loading events...</span>
            </div>
          ) : !claimEvents || claimEvents.length === 0 ? (
            <p className="text-sm text-[var(--sw-text-tertiary)] py-2">
              No claims yet. Heir claims will appear here after successful ZK proof verification.
            </p>
          ) : (
            <div className="space-y-3">
              {claimEvents.slice(0, 10).map((event: any, i: number) => {
                const args = event.parsedArgs || event.args || {};
                const tokenAddr = String(args.token || "");
                const tokenInfo = resolveToken(tokenAddr);
                const amount = args.amount != null ? formatAmount(args.amount, tokenInfo.decimals) : "?";
                const weightBps = args.weight_bps != null ? Number(args.weight_bps) / 100 : null;
                const nullifier = String(args.nullifier_hash || "");
                const txHash = event.log?.transaction_hash || "";
                const blockTs = event.block?.timestamp;
                const timeStr = blockTs ? new Date(Number(blockTs) * 1000).toLocaleString() : "—";

                return (
                  <div
                    key={txHash + i}
                    className="flex items-center justify-between gap-4 px-4 py-3 border border-[var(--sw-border-light)] bg-[var(--sw-bg-faint)]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-[var(--sw-text)]">
                          {amount} {tokenInfo.symbol}
                        </span>
                        {weightBps != null && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 font-medium">
                            {weightBps}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1 font-mono-code truncate">
                        Nullifier: {nullifier.slice(0, 12)}...{nullifier.slice(-6)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">{timeStr}</p>
                      {txHash && (
                        <a
                          href={`https://sepolia.starkscan.co/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-400 hover:underline font-mono-code"
                        >
                          {txHash.slice(0, 8)}...{txHash.slice(-4)}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
