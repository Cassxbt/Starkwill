"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";

const HeightMask = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const shouldReduceMotion = useReducedMotion();

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        initial={shouldReduceMotion ? undefined : { y: "100%" }}
        animate={isInView ? { y: "0%" } : {}}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 0.75, delay, ease: [0.79, 0.01, 0.58, 0.97] }
        }
      >
        {children}
      </motion.div>
    </div>
  );
};

const S = "var(--sw-diagram-stroke)";
const F = "var(--sw-diagram-fill)";

const IsoCube = ({ x, y, w, h, d, strokeW = 0.8, opacity = 0.6 }: { x: number; y: number; w: number; h: number; d: number; strokeW?: number; opacity?: number }) => {
  const hw = w / 2;
  const top = `${x},${y - d} ${x + hw},${y - d - h * 0.5} ${x + w},${y - d} ${x + hw},${y - d + h * 0.5}`;
  const left = `${x},${y - d} ${x + hw},${y - d + h * 0.5} ${x + hw},${y + h * 0.5} ${x},${y}`;
  const right = `${x + w},${y - d} ${x + hw},${y - d + h * 0.5} ${x + hw},${y + h * 0.5} ${x + w},${y}`;
  return (
    <g opacity={opacity}>
      <polygon points={left} stroke={S} strokeWidth={strokeW} fill={F} fillOpacity="0.25" />
      <polygon points={right} stroke={S} strokeWidth={strokeW} fill={F} fillOpacity="0.1" />
      <polygon points={top} stroke={S} strokeWidth={strokeW} fill={F} fillOpacity="0.4" />
    </g>
  );
};

const IsoCylinder = ({ cx, cy, rx, ry, h, strokeW = 1, opacity = 0.7, accent = false }: { cx: number; cy: number; rx: number; ry: number; h: number; strokeW?: number; opacity?: number; accent?: boolean }) => {
  const col = accent ? "#10b981" : S;
  const fillOp = accent ? 0.06 : 0.15;
  return (
    <g opacity={opacity}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={col} strokeWidth={strokeW * 0.6} fill={F} fillOpacity={fillOp * 0.4} />
      <line x1={cx - rx} y1={cy} x2={cx - rx} y2={cy - h} stroke={col} strokeWidth={strokeW} />
      <line x1={cx + rx} y1={cy} x2={cx + rx} y2={cy - h} stroke={col} strokeWidth={strokeW} />
      <ellipse cx={cx} cy={cy - h} rx={rx} ry={ry} stroke={col} strokeWidth={strokeW} fill={F} fillOpacity={fillOp} />
    </g>
  );
};

const VaultDiagram = () => {
  const CX = 500;
  const CY = 420;

  const innerRing = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: CX + 170 * Math.cos(r) - 16, y: CY + 96 * Math.sin(r), a };
  });

  const outerRing = [15, 55, 95, 135, 175, 215, 255, 295, 335].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: CX + 265 * Math.cos(r) - 12, y: CY + 150 * Math.sin(r), a };
  });

  const outerRing2 = [0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: CX + 340 * Math.cos(r) - 10, y: CY + 193 * Math.sin(r), a };
  });

  return (
    <svg
      viewBox="0 0 1000 720"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-4xl mx-auto select-none"
      aria-hidden="true"
    >
      {/* Outer concentric rings — 8 levels */}
      {[420, 380, 340, 300, 265, 230, 200, 170].map((rx, i) => (
        <ellipse key={`ring-${i}`} cx={CX} cy={CY} rx={rx} ry={rx * 0.568} stroke={S} strokeWidth={0.4 + i * 0.1} opacity={0.06 + i * 0.025} />
      ))}

      {/* Fine cross-hair grid lines through center */}
      <line x1={CX} y1={CY - 250} x2={CX} y2={CY + 250} stroke={S} strokeWidth="0.4" opacity="0.06" />
      <line x1={CX - 420} y1={CY} x2={CX + 420} y2={CY} stroke={S} strokeWidth="0.4" opacity="0.06" />
      <line x1={CX - 300} y1={CY - 170} x2={CX + 300} y2={CY + 170} stroke={S} strokeWidth="0.3" opacity="0.04" />
      <line x1={CX + 300} y1={CY - 170} x2={CX - 300} y2={CY + 170} stroke={S} strokeWidth="0.3" opacity="0.04" />

      {/* Tick marks along rings */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
        const r = (a * Math.PI) / 180;
        const innerR = 260, outerR = 275;
        return (
          <line key={`tick-${a}`} x1={CX + innerR * Math.cos(r)} y1={CY + innerR * 0.568 * Math.sin(r)} x2={CX + outerR * Math.cos(r)} y2={CY + outerR * 0.568 * Math.sin(r)} stroke={S} strokeWidth="0.6" opacity="0.15" />
        );
      })}

      {/* Small dots at ring intersections */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return [200, 340].map((radius) => (
          <circle key={`dot-${a}-${radius}`} cx={CX + radius * Math.cos(r)} cy={CY + radius * 0.568 * Math.sin(r)} r={2} fill={S} opacity="0.15" />
        ));
      })}

      {/* Radial spoke lines — 16 spokes */}
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={`spoke-${a}`} x1={CX + 75 * Math.cos(r)} y1={CY + 42 * Math.sin(r)} x2={CX + 165 * Math.cos(r)} y2={CY + 94 * Math.sin(r)} stroke={S} strokeWidth="0.5" opacity="0.08" />
        );
      })}

      {/* Accent spoke lines — 8 main spokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={`aspoke-${a}`} x1={CX + 65 * Math.cos(r)} y1={CY + 37 * Math.sin(r)} x2={CX + 168 * Math.cos(r)} y2={CY + 95 * Math.sin(r)} stroke="#10b981" strokeWidth="0.7" opacity="0.18" strokeDasharray="5 4" />
        );
      })}

      {/* Outermost cube ring — small, faint */}
      {outerRing2.map((p) => (
        <IsoCube key={`or2-${p.a}`} x={p.x} y={p.y} w={20} h={10} d={16} strokeW={0.5} opacity={0.2} />
      ))}

      {/* Middle cube ring */}
      {outerRing.map((p) => (
        <IsoCube key={`or-${p.a}`} x={p.x} y={p.y} w={24} h={12} d={20} strokeW={0.6} opacity={0.35} />
      ))}

      {/* Inner cube ring — 12 nodes (heir commitment slots) */}
      {innerRing.map((p) => (
        <IsoCube key={`ir-${p.a}`} x={p.x} y={p.y} w={32} h={16} d={26} strokeW={0.8} opacity={0.55} />
      ))}

      {/* Connection lines between inner blocks and center */}
      {innerRing.map((p) => {
        const r = (p.a * Math.PI) / 180;
        return (
          <line key={`conn-${p.a}`} x1={CX + 65 * Math.cos(r)} y1={CY + 37 * Math.sin(r)} x2={p.x + 16} y2={p.y - 13} stroke={S} strokeWidth="0.4" opacity="0.1" />
        );
      })}

      {/* Central platform — wide base disc */}
      <IsoCylinder cx={CX} cy={CY + 5} rx={72} ry={41} h={8} strokeW={1} opacity={0.4} />

      {/* Platform middle tier */}
      <IsoCylinder cx={CX} cy={CY - 5} rx={62} ry={35} h={10} strokeW={1} opacity={0.45} />

      {/* Main vault cylinder */}
      <IsoCylinder cx={CX} cy={CY - 18} rx={48} ry={27} h={50} strokeW={1.2} opacity={0.7} accent />

      {/* Vault mid-ring detail */}
      <ellipse cx={CX} cy={CY - 43} rx={48} ry={27} stroke="#10b981" strokeWidth="0.6" opacity="0.25" />

      {/* Inner vault core */}
      <IsoCylinder cx={CX} cy={CY - 70} rx={30} ry={17} h={14} strokeW={0.9} opacity={0.55} accent />

      {/* Stacked Merkle platforms above vault */}
      <IsoCylinder cx={CX} cy={CY - 92} rx={56} ry={32} h={7} strokeW={0.9} opacity={0.4} />
      <IsoCylinder cx={CX} cy={CY - 105} rx={46} ry={26} h={7} strokeW={0.8} opacity={0.35} />
      <IsoCylinder cx={CX} cy={CY - 118} rx={36} ry={20} h={7} strokeW={0.8} opacity={0.3} />
      <IsoCylinder cx={CX} cy={CY - 131} rx={26} ry={15} h={7} strokeW={0.7} opacity={0.28} />

      {/* Top spire */}
      <line x1={CX} y1={CY - 138} x2={CX} y2={CY - 168} stroke={S} strokeWidth="1" opacity="0.35" />
      <ellipse cx={CX} cy={CY - 168} rx={10} ry={5.5} stroke={S} strokeWidth="0.8" opacity="0.4" fill={F} fillOpacity="0.2" />
      <line x1={CX} y1={CY - 173} x2={CX} y2={CY - 192} stroke={S} strokeWidth="0.7" opacity="0.3" />
      <ellipse cx={CX} cy={CY - 192} rx={6} ry={3.5} stroke="#10b981" strokeWidth="0.8" opacity="0.5" fill={F} fillOpacity="0.15" />
      <line x1={CX} y1={CY - 196} x2={CX} y2={CY - 210} stroke={S} strokeWidth="0.5" opacity="0.2" />
      <circle cx={CX} cy={CY - 213} r={3.5} stroke="#10b981" strokeWidth="1" opacity="0.6" fill="none" />

      {/* Small decorative cubes on the platforms */}
      <IsoCube x={CX - 38} y={CY - 88} w={12} h={6} d={10} strokeW={0.5} opacity={0.25} />
      <IsoCube x={CX + 26} y={CY - 88} w={12} h={6} d={10} strokeW={0.5} opacity={0.25} />
      <IsoCube x={CX - 5} y={CY - 98} w={10} h={5} d={8} strokeW={0.4} opacity={0.2} />
      <IsoCube x={CX - 30} y={CY - 102} w={10} h={5} d={8} strokeW={0.4} opacity={0.2} />
      <IsoCube x={CX + 20} y={CY - 102} w={10} h={5} d={8} strokeW={0.4} opacity={0.2} />

      {/* Corner bracket decorations */}
      {/* Top-left bracket */}
      <line x1={40} y1={80} x2={40} y2={120} stroke={S} strokeWidth="0.8" opacity="0.15" />
      <line x1={40} y1={80} x2={80} y2={80} stroke={S} strokeWidth="0.8" opacity="0.15" />
      {/* Top-right bracket */}
      <line x1={960} y1={80} x2={960} y2={120} stroke={S} strokeWidth="0.8" opacity="0.15" />
      <line x1={960} y1={80} x2={920} y2={80} stroke={S} strokeWidth="0.8" opacity="0.15" />
      {/* Bottom-left bracket */}
      <line x1={40} y1={640} x2={40} y2={600} stroke={S} strokeWidth="0.8" opacity="0.15" />
      <line x1={40} y1={640} x2={80} y2={640} stroke={S} strokeWidth="0.8" opacity="0.15" />
      {/* Bottom-right bracket */}
      <line x1={960} y1={640} x2={960} y2={600} stroke={S} strokeWidth="0.8" opacity="0.15" />
      <line x1={960} y1={640} x2={920} y2={640} stroke={S} strokeWidth="0.8" opacity="0.15" />

      {/* Small corner dots */}
      <circle cx={40} cy={80} r={2} fill={S} opacity="0.2" />
      <circle cx={960} cy={80} r={2} fill={S} opacity="0.2" />
      <circle cx={40} cy={640} r={2} fill={S} opacity="0.2" />
      <circle cx={960} cy={640} r={2} fill={S} opacity="0.2" />

      {/* ——— Label connections ——— */}

      {/* MERKLE TREE — top left */}
      <line x1={CX - 40} y1={CY - 145} x2={200} y2={CY - 240} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <line x1={200} y1={CY - 240} x2={90} y2={CY - 240} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <circle cx={200} cy={CY - 240} r={2.5} fill={S} opacity="0.3" />
      <rect x="40" y={CY - 257} width="170" height="34" stroke={S} strokeWidth="0.8" opacity="0.45" fill={F} fillOpacity="0.5" />
      <text x="125" y={CY - 236} textAnchor="middle" fill={S} opacity="0.7" fontSize="12" fontFamily="monospace" letterSpacing="0.12em">MERKLE TREE</text>

      {/* GUARDIANS — top right */}
      <line x1={CX + 55} y1={CY - 120} x2={800} y2={CY - 220} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <line x1={800} y1={CY - 220} x2={910} y2={CY - 220} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <circle cx={800} cy={CY - 220} r={2.5} fill={S} opacity="0.3" />
      <rect x="790" y={CY - 237} width="160" height="34" stroke={S} strokeWidth="0.8" opacity="0.45" fill={F} fillOpacity="0.5" />
      <text x="870" y={CY - 216} textAnchor="middle" fill={S} opacity="0.7" fontSize="12" fontFamily="monospace" letterSpacing="0.12em">GUARDIANS</text>

      {/* ZK PROOFS — left */}
      <line x1={CX - 172} y1={CY - 5} x2={145} y2={CY - 30} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <line x1={145} y1={CY - 30} x2={55} y2={CY - 30} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <circle cx={145} cy={CY - 30} r={2.5} fill="#10b981" opacity="0.4" />
      <rect x="25" y={CY - 47} width="145" height="34" stroke="#10b981" strokeWidth="0.8" opacity="0.45" fill={F} fillOpacity="0.5" />
      <text x="97" y={CY - 26} textAnchor="middle" fill="#10b981" opacity="0.7" fontSize="12" fontFamily="monospace" letterSpacing="0.12em">ZK PROOFS</text>

      {/* HEIRS — right */}
      <line x1={CX + 172} y1={CY - 5} x2={855} y2={CY - 30} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <line x1={855} y1={CY - 30} x2={960} y2={CY - 30} stroke={S} strokeWidth="0.7" opacity="0.25" />
      <circle cx={855} cy={CY - 30} r={2.5} fill={S} opacity="0.3" />
      <rect x="835" y={CY - 47} width="120" height="34" stroke={S} strokeWidth="0.8" opacity="0.45" fill={F} fillOpacity="0.5" />
      <text x="895" y={CY - 26} textAnchor="middle" fill={S} opacity="0.7" fontSize="12" fontFamily="monospace" letterSpacing="0.12em">HEIRS</text>

      {/* VAULT label — below center */}
      <rect x={CX - 52} y={CY + 52} width="104" height="34" stroke="#10b981" strokeWidth="1" opacity="0.55" fill={F} fillOpacity="0.5" />
      <text x={CX} y={CY + 73} textAnchor="middle" fill="#10b981" opacity="0.85" fontSize="13" fontFamily="monospace" fontWeight="bold" letterSpacing="0.15em">VAULT</text>

      {/* DEAD-MAN'S SWITCH — bottom center */}
      <line x1={CX} y1={CY + 86} x2={CX} y2={CY + 118} stroke={S} strokeWidth="0.7" opacity="0.25" strokeDasharray="5 3" />
      <circle cx={CX} cy={CY + 118} r={2.5} fill={S} opacity="0.3" />
      <rect x={CX - 115} y={CY + 118} width="230" height="34" stroke={S} strokeWidth="0.8" opacity="0.45" fill={F} fillOpacity="0.5" />
      <text x={CX} y={CY + 139} textAnchor="middle" fill={S} opacity="0.7" fontSize="12" fontFamily="monospace" letterSpacing="0.1em">DEAD-MAN&apos;S SWITCH</text>

      {/* NULLIFIERS — bottom left */}
      <line x1={CX - 50} y1={CY + 42} x2={190} y2={CY + 90} stroke={S} strokeWidth="0.5" opacity="0.18" strokeDasharray="3 3" />
      <circle cx={190} cy={CY + 90} r={2} fill={S} opacity="0.2" />
      <rect x="70" y={CY + 78} width="145" height="30" stroke={S} strokeWidth="0.6" opacity="0.35" fill={F} fillOpacity="0.4" />
      <text x="142" y={CY + 97} textAnchor="middle" fill={S} opacity="0.5" fontSize="11" fontFamily="monospace" letterSpacing="0.08em">NULLIFIERS</text>

      {/* BLAKE3 — bottom right */}
      <line x1={CX + 50} y1={CY + 42} x2={810} y2={CY + 90} stroke={S} strokeWidth="0.5" opacity="0.18" strokeDasharray="3 3" />
      <circle cx={810} cy={CY + 90} r={2} fill={S} opacity="0.2" />
      <rect x="775" y={CY + 78} width="120" height="30" stroke={S} strokeWidth="0.6" opacity="0.35" fill={F} fillOpacity="0.4" />
      <text x="835" y={CY + 97} textAnchor="middle" fill={S} opacity="0.5" fontSize="11" fontFamily="monospace" letterSpacing="0.08em">BLAKE3</text>
    </svg>
  );
};

const steps = [
  {
    num: "01",
    title: "Create Your Vault",
    desc: "Set check-in periods, appoint guardians, and register heir commitments as a Merkle root. The vault deploys in a single transaction — your heirs' identities never touch the chain.",
  },
  {
    num: "02",
    title: "Deposit & Stay Active",
    desc: "Fund the vault with whitelisted tokens (ETH, STRK, WBTC). Periodically check in to keep the vault sealed. Miss a check-in and the grace period countdown begins.",
  },
  {
    num: "03",
    title: "Anonymous Claim",
    desc: "After timeout, heirs generate a ZK proof entirely in-browser and submit it on-chain. The contract verifies the proof, transfers funds, and records a nullifier. Nobody knows which heir claimed.",
  },
];

const techBreakdown = [
  {
    title: "Noir Circuits",
    subtitle: "The constraint system",
    description:
      "The heir membership circuit is written in Noir, a Rust-like DSL for zero-knowledge proofs. It takes three private inputs — the heir's secret, Merkle path indices, and path siblings — and three public inputs: the Merkle root, a nullifier hash, and the vault address. The circuit proves that the prover knows a secret whose Blake3 commitment exists in the Merkle tree, without revealing the secret itself.",
    details: [
      "Hash function: blake3(a || b), first 31 bytes as a BN254 field element",
      "Tree depth: 8 levels, supporting up to 256 heirs per vault",
      "Commitment: hash2(secret, 0) — a one-way binding to the heir's secret",
      "Nullifier: hash2(secret, vault_address) — prevents double claims across vaults",
    ],
  },
  {
    title: "Barretenberg (bb.js)",
    subtitle: "In-browser proof generation",
    description:
      "Proofs are generated entirely in the user's browser using Aztec's Barretenberg library. The UltraKeccakZKHonk proving system operates over the BN254 and Grumpkin elliptic curves, producing succinct proofs that can be verified on-chain. No trusted setup required — UltraHonk is a transparent proof system.",
    details: [
      "Proving system: UltraKeccakZKHonk (transparent, no ceremony)",
      "Curves: BN254 (pairing-friendly) + Grumpkin (cycle curve)",
      "Execution: Web Workers with multi-threading for performance",
      "Proof size: ~2KB, verifiable in a single Starknet transaction",
    ],
  },
  {
    title: "Garaga",
    subtitle: "Proof-to-Starknet bridge",
    description:
      "Garaga serves two roles: at build time, it auto-generates a Cairo verifier contract that can verify UltraKeccakZKHonk proofs on Starknet. At runtime, the JavaScript SDK converts the raw proof bytes, public inputs, and verification key into a Span<felt252> calldata array that the Cairo verifier expects.",
    details: [
      "Cairo verifier: auto-generated, implements IUltraKeccakZKHonkVerifier",
      "Verification pipeline: Fiat-Shamir transcript → sumcheck → MSM (GLV) → KZG pairing",
      "Pairing: multi_pairing_check_bn254_2P_2F — efficient on-chain BN254 pairing",
      "Output: public inputs (merkle_root, nullifier_hash, vault_address) if proof is valid",
    ],
  },
  {
    title: "Blake3 Merkle Tree",
    subtitle: "Heir commitment scheme",
    description:
      "Each heir holds a random secret. Their commitment — hash2(secret, 0) using Blake3 — is added to a depth-8 Merkle tree. Only the root is stored on-chain. To claim, an heir proves they know a secret that hashes to a leaf in the tree, without revealing which leaf. The same hash function is mirrored exactly in TypeScript and Noir to ensure consistency.",
    details: [
      "256-leaf fixed-depth tree, padded with zero values",
      "Blake3 chosen for speed in both browser and ZK circuit contexts",
      "Only the 32-byte root is stored on-chain — no heir data exposed",
      "Proof of membership without revealing leaf index or secret",
    ],
  },
  {
    title: "Nullifier System",
    subtitle: "Double-spend prevention",
    description:
      "When an heir claims, the circuit computes a nullifier as hash2(secret, vault_address). This value is deterministic for each (heir, vault) pair but reveals nothing about the heir's identity. The vault contract stores all spent nullifiers in a Map<felt252, bool> — if the same nullifier appears twice, the transaction reverts.",
    details: [
      "Nullifier = hash2(secret, vault_address) — unique per heir per vault",
      "Stored on-chain in a felt252 → bool mapping",
      "Prevents the same heir from claiming twice without revealing who they are",
      "Vault-scoped: a proof for vault A cannot be replayed on vault B",
    ],
  },
  {
    title: "Cairo & Starknet",
    subtitle: "Execution layer",
    description:
      "The vault contract is written in Cairo and deployed on Starknet. It manages the full inheritance lifecycle: vault creation, token deposits, check-in periods, guardian recovery (2-of-3 multisig), and ZK proof-verified claims. Starknet's native support for cheap computation makes on-chain proof verification economically viable — something prohibitively expensive on L1.",
    details: [
      "Vault stores: heir Merkle root, check-in schedule, guardian set, token balances",
      "claim_with_proof: calls Garaga verifier → validates public inputs → transfers funds",
      "Guardian recovery: 2-of-3 threshold for emergency vault unlock",
      "ERC-20 whitelist: per-token deposit and withdrawal controls",
    ],
  },
];

const pipelineSteps = [
  { label: "Noir Circuit", sub: "Witness generation", code: "noir compile" },
  { label: "bb.js", sub: "UltraHonk proof", code: "bb prove" },
  { label: "Garaga", sub: "Starknet calldata", code: "garaga gen" },
  { label: "Cairo Vault", sub: "On-chain verify", code: "starkli invoke" },
];

export default function HowItWorksPage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <section className="relative z-10 pt-20 sm:pt-28 pb-6 px-6 text-center">
        <HeightMask>
          <span className="text-xs tracking-[0.3em] uppercase text-emerald-500/50 font-medium font-mono-code block mb-6">
            Protocol Architecture
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-[4rem] font-bold tracking-[-0.04em] text-[var(--sw-text)] mb-6">
            How StarkWill Works
          </h1>
          <p className="text-lg text-[var(--sw-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Private inheritance through zero-knowledge proofs, on-chain verification,
            and a trustless dead-man&apos;s switch. Here&apos;s what happens under the hood.
          </p>
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-20 max-w-5xl mx-auto">
        <HeightMask>
          <VaultDiagram />
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-20 max-w-5xl mx-auto">
        <HeightMask className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-emerald-500/50 font-medium font-mono-code block mb-6">
            Three Steps
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-[3rem] font-bold tracking-[-0.04em] text-[var(--sw-text)]">
            Vault Lifecycle
          </h2>
        </HeightMask>

        <div className="space-y-0">
          {steps.map((s, i) => (
            <HeightMask key={s.num} delay={i * 0.12}>
              <div className="flex gap-8 sm:gap-12">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-20 h-20 bg-[var(--sw-surface)] border border-emerald-500/20 flex items-center justify-center font-mono-code text-lg font-bold text-emerald-400">
                    {s.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 min-h-[48px] bg-gradient-to-b from-emerald-500/20 to-transparent my-3" />
                  )}
                </div>
                <div className="pb-10 pt-3">
                  <h3 className="text-2xl font-bold mb-3 tracking-[-0.04em] text-[var(--sw-text)]">{s.title}</h3>
                  <p className="text-[15px] text-[var(--sw-text-secondary)] leading-relaxed max-w-lg">{s.desc}</p>
                </div>
              </div>
            </HeightMask>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      <section id="zk-pipeline" className="relative z-10 px-6 py-16 sm:py-20 max-w-6xl mx-auto">
        <HeightMask>
          <div className="p-10 sm:p-14 bg-[var(--sw-surface)] border border-[var(--sw-border-light)] relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-xs tracking-[0.3em] uppercase text-[var(--sw-text-tertiary)] font-medium font-mono-code block mb-4">
                ZK Pipeline
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-10 tracking-[-0.04em] text-[var(--sw-text)]">
                From Secret to Proof
              </h2>

              <div className="flex flex-col sm:flex-row items-stretch gap-4 mb-10">
                {pipelineSteps.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-4 flex-1">
                    <div className="flex-1 p-6 bg-[var(--sw-terminal)] border border-[var(--sw-border-faint)] hover:border-emerald-500/20 transition-all duration-300 group">
                      <div className="font-mono-code text-[10px] text-emerald-500/50 mb-2 group-hover:text-emerald-400 transition-colors">
                        {step.code}
                      </div>
                      <div className="text-[15px] font-semibold text-[var(--sw-text)] mb-1">{step.label}</div>
                      <div className="text-xs text-[var(--sw-text-tertiary)]">{step.sub}</div>
                    </div>
                    {i < pipelineSteps.length - 1 && (
                      <div className="hidden sm:block flow-connector shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-20 max-w-5xl mx-auto">
        <HeightMask className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-emerald-500/50 font-medium font-mono-code block mb-6">
            Under the Hood
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-[3rem] font-bold tracking-[-0.04em] text-[var(--sw-text)]">
            The Math That Makes It Work
          </h2>
        </HeightMask>

        <div className="space-y-6">
          {techBreakdown.map((tech, i) => (
            <HeightMask key={tech.title} delay={i * 0.08}>
              <div className="p-8 sm:p-10 bg-[var(--sw-surface)] border border-[var(--sw-border-light)] hover:border-[var(--sw-border-hover)] transition-colors">
                <div className="flex items-start gap-6 mb-6">
                  <div className="shrink-0 w-12 h-12 bg-emerald-500/10 flex items-center justify-center font-mono-code text-sm font-bold text-emerald-400">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-[-0.04em] text-[var(--sw-text)]">
                      {tech.title}
                    </h3>
                    <span className="text-xs text-emerald-500/60 font-mono-code tracking-wide uppercase">
                      {tech.subtitle}
                    </span>
                  </div>
                </div>

                <p className="text-[15px] text-[var(--sw-text-secondary)] leading-relaxed mb-6">
                  {tech.description}
                </p>

                <div className="bg-[var(--sw-terminal)] border border-[var(--sw-border-faint)] p-5 font-mono-code text-[12px] leading-relaxed space-y-1.5">
                  {tech.details.map((detail, j) => (
                    <div key={j} className="text-[var(--sw-text-tertiary)]">
                      <span className="text-emerald-500/60 mr-2">&gt;</span>
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            </HeightMask>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-20 max-w-3xl mx-auto text-center">
        <HeightMask>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.04em] mb-5 text-[var(--sw-text)]">
            Ready to Create a Vault?
          </h2>
          <p className="text-base text-[var(--sw-text-secondary)] mb-10 max-w-lg mx-auto leading-relaxed">
            No lawyers. No custodians. No identity exposure. Just math.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-3 px-12 py-4 font-semibold text-[15px] bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-all duration-300 hover:shadow-[0_0_50px_rgba(16,185,129,0.2)]"
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </HeightMask>
      </section>
    </div>
  );
}
