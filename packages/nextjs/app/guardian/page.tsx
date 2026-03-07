"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAccount } from "@starknet-react/core";
import { useTransactor } from "~~/hooks/scaffold-stark";
import { Contract as StarknetContract } from "starknet";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useVault, VAULT_ABI } from "~~/contexts/VaultContext";
import { useVaultContract } from "~~/hooks/useVaultContract";

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

type ApprovalStatus = "idle" | "submitting" | "success" | "error";

const GuardianPage = () => {
  const { address, status } = useAccount();
  const shouldReduceMotion = useReducedMotion();
  const { writeTransaction } = useTransactor();
  const { vaultAddress, hasVault } = useVault();
  const vaultContract = useVaultContract();

  const [manualVaultAddr, setManualVaultAddr] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isClaimable, setIsClaimable] = useState<boolean | null>(null);

  const targetVaultAddr = hasVault ? vaultAddress : (manualVaultAddr.startsWith("0x") && manualVaultAddr.length > 10 ? manualVaultAddr : null);

  useEffect(() => {
    if (!targetVaultAddr) { setIsClaimable(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { RpcProvider } = await import("starknet");
        const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL || "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/_hKu4IgnPgrF8O82GLuYU" });
        const contract = new StarknetContract({ abi: VAULT_ABI as any, address: targetVaultAddr, providerOrAccount: provider });
        const result = await contract.call("is_claimable");
        if (!cancelled) setIsClaimable(!!result);
      } catch {
        if (!cancelled) setIsClaimable(null);
      }
    })();
    return () => { cancelled = true; };
  }, [targetVaultAddr]);

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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-tight text-[var(--sw-text)]">Guardian Access</h2>
          <p className="text-[var(--sw-text-secondary)] text-sm">Connect your guardian wallet to approve an emergency unlock.</p>
        </motion.div>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!targetVaultAddr) return;
    setApprovalStatus("submitting");
    setErrorMessage("");
    try {
      const vault = new StarknetContract({ abi: VAULT_ABI as any, address: targetVaultAddr });
      const call = vault.populate("guardian_approve_unlock", []);
      await writeTransaction([call]);
      setApprovalStatus("success");
    } catch (e: any) {
      console.error("Guardian approval failed:", e);
      const msg = e?.message || String(e);
      if (msg.includes("ONLY_GUARDIAN")) {
        setErrorMessage("Connected wallet is not a guardian for this vault.");
      } else {
        setErrorMessage(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
      }
      setApprovalStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 pt-10 pb-24">
      <motion.div
        variants={mv(fadeInUp)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-[var(--sw-text)]">
          Guardian Unlock
        </h1>
        <p className="text-[var(--sw-text-secondary)] text-sm max-w-md mx-auto">
          Emergency 2-of-3 multisig unlock. Two guardians must approve to unlock the vault for heir claims.
        </p>
      </motion.div>

      <motion.div
        variants={mv(staggerContainer)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="w-full max-w-xl space-y-5"
      >
        {/* Vault Address (manual entry for guardians) */}
        {!hasVault && (
          <motion.div
            variants={mv(staggerItem)}
            className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
          >
            <label className="text-xs text-[var(--sw-text-secondary)] block mb-1.5 font-medium">Vault Address</label>
            <input
              type="text"
              value={manualVaultAddr}
              onChange={(e) => setManualVaultAddr(e.target.value)}
              placeholder="0x... (vault to unlock)"
              className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] font-mono-code placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
            <p className="text-[11px] text-[var(--sw-text-placeholder)] mt-1.5">
              Enter the address of the vault you are a guardian for.
            </p>
          </motion.div>
        )}

        {/* Vault Status */}
        {targetVaultAddr && (
          <motion.div
            variants={mv(staggerItem)}
            className={`p-6 bg-[var(--sw-surface)] border ${
              isClaimable ? "border-emerald-500/20" : "border-[var(--sw-border)]"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 flex items-center justify-center ${
                isClaimable ? "bg-emerald-500/10" : "bg-amber-500/10"
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={isClaimable ? "text-emerald-400" : "text-amber-400"}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  {isClaimable ? (
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  ) : (
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Vault Status</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isClaimable ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span className={`text-xs font-medium ${isClaimable ? "text-emerald-400" : "text-amber-400"}`}>
                    {isClaimable ? "Unlocked \u2014 Heirs Can Claim" : "Locked"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <h3 className="font-semibold text-base mb-4 tracking-tight text-[var(--sw-text)]">How It Works</h3>
          <div className="space-y-3">
            {[
              { step: "1", text: "The vault owner becomes unresponsive (missed check-ins)" },
              { step: "2", text: "Any 2 of 3 designated guardians approve an emergency unlock" },
              { step: "3", text: "Once 2 approvals are recorded, the vault unlocks for heir claims" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <p className="text-sm text-[var(--sw-text-secondary)]">{item.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Connected Wallet */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[var(--sw-text-tertiary)] font-medium">Connected Wallet</span>
          </div>
          <p className="font-mono-code text-xs text-[var(--sw-text-secondary)] break-all">
            {address}
          </p>
        </motion.div>

        {/* Approve Button */}
        <motion.div
          variants={mv(staggerItem)}
          className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]"
        >
          {approvalStatus === "success" ? (
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-emerald-400">Approval Submitted</p>
                <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">
                  Your guardian approval has been recorded on-chain. If this is the 2nd approval, the vault is now unlocked.
                </p>
              </div>
            </div>
          ) : approvalStatus === "error" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-red-400">Approval Failed</p>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={() => { setApprovalStatus("idle"); setErrorMessage(""); }}
                className="px-4 py-2 text-xs font-medium border border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-emerald-500/20 hover:text-emerald-400 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Approve Emergency Unlock</h3>
                <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">
                  This action is irreversible. Only proceed if the vault owner is truly unresponsive.
                </p>
              </div>
              <button
                onClick={handleApprove}
                disabled={approvalStatus === "submitting" || !!isClaimable || !targetVaultAddr}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 font-medium text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                {approvalStatus === "submitting" ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : !targetVaultAddr ? (
                  "Enter Vault Address"
                ) : isClaimable ? (
                  "Vault Already Unlocked"
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Approve Unlock
                  </>
                )}
              </button>
              {isClaimable && (
                <p className="text-[11px] text-emerald-400 text-center">
                  The vault is already unlocked. No further guardian approvals are needed.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default GuardianPage;
