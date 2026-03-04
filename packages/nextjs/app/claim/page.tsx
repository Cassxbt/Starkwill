"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useAccount } from "@starknet-react/core";
import { useScaffoldReadContract } from "~~/hooks/scaffold-stark/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-stark/useScaffoldWriteContract";
import { useDeployedContractInfo } from "~~/hooks/scaffold-stark";
import { computeCommitment, computeNullifier, toHex } from "~~/utils/starkwill/merkle";
import { TOKENS, getTokenAddress } from "~~/utils/starkwill/tokens";
import { generateClaimProof } from "~~/utils/starkwill/prover";

type ClaimStatus = "idle" | "computing" | "generating" | "submitting" | "success" | "error";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const statusCard: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.2 } },
};

const PulseRing = ({ color }: { color: string }) => (
  <div className="relative w-4 h-4 shrink-0">
    <motion.div
      className={`absolute inset-0 rounded-full ${color}`}
      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
    />
    <div className={`absolute inset-[3px] rounded-full ${color}`} />
  </div>
);

const Claim = () => {
  const { address, status } = useAccount();
  const shouldReduceMotion = useReducedMotion();
  const [heirSecret, setHeirSecret] = useState("");
  const [heirWeight, setHeirWeight] = useState("");
  const [heirCommitments, setHeirCommitments] = useState("");
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [selectedToken, setSelectedToken] = useState("STRK");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: deployedVault } = useDeployedContractInfo("vault");

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

  const { sendAsync: claimWithProof, isPending: isClaiming } = useScaffoldWriteContract({
    contractName: "vault",
    functionName: "claim_with_proof",
    args: [undefined, undefined],
  });

  const mv = (v: Variants | undefined) => (shouldReduceMotion ? undefined : v);
  const vaultAddr = deployedVault?.address ? BigInt(deployedVault.address) : 0n;

  const derivedValues = useMemo(() => {
    if (!heirSecret.trim() || !heirWeight.trim()) return null;
    try {
      const secret = BigInt(heirSecret.startsWith("0x") ? heirSecret : "0x" + heirSecret);
      const weightBps = BigInt(Math.round(parseFloat(heirWeight) * 100)); // % → bps
      const commitment = computeCommitment(secret, weightBps);
      const nullifier = computeNullifier(secret, vaultAddr);
      return { commitment: toHex(commitment), nullifier: toHex(nullifier), secret, weightBps };
    } catch {
      return null;
    }
  }, [heirSecret, heirWeight, vaultAddr]);

  const parsedCommitments = useMemo(() => {
    if (!heirCommitments.trim()) return null;
    try {
      return heirCommitments
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => BigInt(s.startsWith("0x") ? s : "0x" + s));
    } catch {
      return null;
    }
  }, [heirCommitments]);

  const handleClaim = async () => {
    if (!heirSecret || !derivedValues || !parsedCommitments?.length) return;
    setClaimStatus("computing");
    setErrorMsg("");
    setStatusDetail("");
    try {
      setClaimStatus("generating");
      const result = await generateClaimProof(
        derivedValues.secret, derivedValues.weightBps, parsedCommitments, vaultAddr,
        (detail) => setStatusDetail(detail),
      );
      setClaimStatus("submitting");
      setStatusDetail("Sending transaction...");
      const tokenAddr = getTokenAddress(selectedToken);
      await claimWithProof({ args: [result.calldata, tokenAddr] });
      setClaimStatus("success");
    } catch (e: any) {
      console.error("Claim failed:", e);
      setClaimStatus("error");
      setErrorMsg(e?.message?.slice(0, 160) || "Claim transaction failed");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 pt-10 pb-24">
      <motion.div
        variants={mv(fadeInUp)}
        initial={shouldReduceMotion ? undefined : "hidden"}
        animate="visible"
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-[var(--sw-text)]">
          Claim Inheritance
        </h1>
        <p className="text-[var(--sw-text-secondary)] max-w-md text-sm">
          Submit a zero-knowledge proof to claim your share anonymously.
        </p>
      </motion.div>

      <div className="w-full max-w-lg">
        {/* Status Banner */}
        <motion.div
          variants={mv(fadeInUp)}
          initial={shouldReduceMotion ? undefined : "hidden"}
          animate="visible"
          className={`p-4 bg-[var(--sw-surface)] border flex gap-3 mb-4 ${
            isClaimable
              ? "border-emerald-500/15"
              : "border-amber-500/15"
          }`}
        >
          <div className="flex gap-3 items-start">
            <span className={`inline-flex h-2 w-2 rounded-full mt-1 shrink-0 ${
              isClaimable ? "bg-emerald-400" : "bg-amber-400"
            }`} />
            <div>
              <p className="text-sm font-medium text-[var(--sw-text)]">
                Vault is {isClaimable ? "Claimable" : "Locked"}
              </p>
              <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-0.5">
                {isClaimable
                  ? "Owner has not checked in. Heirs can claim assets."
                  : "Owner is active. Claims are not available yet."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ZK Privacy Banner */}
        <motion.div
          variants={mv(fadeInUp)}
          initial={shouldReduceMotion ? undefined : "hidden"}
          animate="visible"
          className="p-4 bg-[var(--sw-surface)] border border-emerald-500/10 flex gap-3 mb-6"
        >
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--sw-text)]">Zero-Knowledge Privacy</p>
              <p className="text-[11px] text-[var(--sw-text-tertiary)] mt-1">
                Your proof demonstrates heir membership without revealing your identity.
                The nullifier prevents double-claiming while preserving anonymity.
              </p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {claimStatus === "success" ? (
            <motion.div
              key="success"
              initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={shouldReduceMotion ? undefined : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="p-10 bg-[var(--sw-surface)] border border-emerald-500/15 text-center"
            >
              <motion.div
                initial={shouldReduceMotion ? undefined : { scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={shouldReduceMotion ? undefined : { delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center mx-auto mb-6"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </motion.div>
              <h3 className="text-xl font-bold mb-2 tracking-tight text-[var(--sw-text)]">Claim Successful</h3>
              <p className="text-sm text-[var(--sw-text-secondary)] mb-5">
                Your inheritance share has been transferred anonymously.
              </p>
              {derivedValues && (
                <div className="text-left p-4 bg-[var(--sw-bg-faint)] border border-[var(--sw-border-light)] space-y-1.5 mb-6">
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">Nullifier (public)</p>
                  <p className="font-mono-code text-xs text-emerald-400/60 break-all">{derivedValues.nullifier}</p>
                </div>
              )}
              <button
                onClick={() => { setClaimStatus("idle"); setHeirSecret(""); setHeirWeight(""); }}
                className="px-6 py-2.5 text-sm font-medium border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/10 transition-all"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              variants={mv(staggerContainer)}
              initial={shouldReduceMotion ? undefined : "hidden"}
              animate="visible"
              className="space-y-5"
            >
              {/* Token Selection */}
              <motion.div variants={mv(staggerItem)} className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-4">
                  <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Token to Claim</h3>
                  <div className="flex gap-2">
                    {Object.keys(TOKENS).map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => setSelectedToken(symbol)}
                        disabled={claimStatus !== "idle"}
                        className={`px-4 py-2 text-xs font-medium border transition-all duration-200 disabled:opacity-40 ${
                          selectedToken === symbol
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:border-[var(--sw-border-hover)]"
                        }`}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Heir Commitments */}
              <motion.div variants={mv(staggerItem)} className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-4">
                  <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Heir Commitments</h3>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                    Paste all heir commitments (one per line or comma-separated). These build the Merkle tree for proof generation.
                  </p>
                  <textarea
                    value={heirCommitments}
                    onChange={(e) => setHeirCommitments(e.target.value)}
                    placeholder={"0xabc123...\n0xdef456...\n0x789abc..."}
                    rows={3}
                    className="w-full px-4 py-3 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-xs text-[var(--sw-text)] font-mono-code placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors resize-none"
                    disabled={claimStatus !== "idle"}
                  />
                  {parsedCommitments && (
                    <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                      {parsedCommitments.length} commitment{parsedCommitments.length !== 1 ? "s" : ""} parsed
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Secret Input */}
              <motion.div variants={mv(staggerItem)} className="p-6 bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-500/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                        <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-base tracking-tight text-[var(--sw-text)]">Your Secret</h3>
                  </div>
                  <p className="text-[11px] text-[var(--sw-text-tertiary)]">
                    This secret never leaves your device. It is used locally to generate the ZK proof.
                  </p>
                  <input
                    type="password"
                    value={heirSecret}
                    onChange={(e) => setHeirSecret(e.target.value)}
                    placeholder="0x... (your heir secret)"
                    className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] font-mono-code placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
                    disabled={claimStatus !== "idle"}
                  />
                  <div>
                    <label className="text-[11px] text-[var(--sw-text-secondary)] block mb-1.5 font-medium">Your Share Weight (%)</label>
                    <input
                      type="number"
                      value={heirWeight}
                      onChange={(e) => setHeirWeight(e.target.value)}
                      placeholder="e.g. 50"
                      min="0.01"
                      max="100"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors"
                      disabled={claimStatus !== "idle"}
                    />
                    <p className="text-[11px] text-[var(--sw-text-placeholder)] mt-1">
                      The weight assigned to you by the vault owner (cryptographically verified).
                    </p>
                  </div>

                  {derivedValues && claimStatus === "idle" && (
                    <div className="p-4 bg-emerald-500/[0.04] border border-emerald-500/10 space-y-3">
                      <div>
                        <p className="text-[11px] text-[var(--sw-text-tertiary)]">Your Commitment</p>
                        <p className="font-mono-code text-xs text-emerald-400/60 break-all">{derivedValues.commitment}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--sw-text-tertiary)]">Nullifier Hash</p>
                        <p className="font-mono-code text-xs text-emerald-400/60 break-all">{derivedValues.nullifier}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Status Cards */}
              <AnimatePresence mode="wait">
                {(claimStatus === "computing" || claimStatus === "generating") && (
                  <motion.div
                    key="generating"
                    variants={mv(statusCard)}
                    initial={shouldReduceMotion ? undefined : "initial"}
                    animate="animate"
                    exit={shouldReduceMotion ? undefined : "exit"}
                    className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-3"
                  >
                    <PulseRing color="bg-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-[var(--sw-text)]">Generating ZK Proof...</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">{statusDetail || "Computing Merkle path and nullifier"}</p>
                    </div>
                  </motion.div>
                )}

                {claimStatus === "submitting" && (
                  <motion.div
                    key="submitting"
                    variants={mv(statusCard)}
                    initial={shouldReduceMotion ? undefined : "initial"}
                    animate="animate"
                    exit={shouldReduceMotion ? undefined : "exit"}
                    className="p-4 bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-3"
                  >
                    <PulseRing color="bg-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-[var(--sw-text)]">Submitting to Starknet...</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">Verifying proof on-chain via Garaga</p>
                    </div>
                  </motion.div>
                )}

                {claimStatus === "error" && (
                  <motion.div
                    key="error"
                    variants={mv(statusCard)}
                    initial={shouldReduceMotion ? undefined : "initial"}
                    animate="animate"
                    exit={shouldReduceMotion ? undefined : "exit"}
                    className="p-4 bg-red-500/[0.06] border border-red-500/15 flex items-center gap-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-400">Claim Failed</p>
                      <p className="text-[11px] text-[var(--sw-text-tertiary)]">{errorMsg || "Invalid proof or already claimed"}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.div variants={mv(staggerItem)}>
                <button
                  onClick={handleClaim}
                  disabled={!heirSecret || !heirWeight || !derivedValues || !parsedCommitments?.length || claimStatus !== "idle" || !isClaimable}
                  className="w-full px-7 py-3.5 font-semibold text-sm bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  {status !== "connected" ? (
                    "Connect Wallet First"
                  ) : !isClaimable ? (
                    "Vault Not Claimable Yet"
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      Generate Proof &amp; Claim
                    </span>
                  )}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Claim;
