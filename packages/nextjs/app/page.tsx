"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useMagnetic } from "~~/hooks/useMagnetic";

const TypingText = ({ words }: { words: string[] }) => {
  const [current, setCurrent] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = words[current];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(word.slice(0, text.length + 1));
          if (text.length + 1 === word.length) {
            setTimeout(() => setIsDeleting(true), 2500);
          }
        } else {
          setText(word.slice(0, text.length - 1));
          if (text.length === 0) {
            setIsDeleting(false);
            setCurrent((c) => (c + 1) % words.length);
          }
        }
      },
      isDeleting ? 35 : 70,
    );
    return () => clearTimeout(timeout);
  }, [text, isDeleting, current, words]);

  return (
    <span>
      {text}
      <span className="typing-cursor" />
    </span>
  );
};

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
  const isInView = useInView(ref, { once: true, margin: "-80px" });
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

const features = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: "Zero-Knowledge Claims",
    description: "Heirs prove group membership through ZK proofs without revealing identity. No on-chain footprint, no metadata leaks.",
    terminal: [
      { text: "$ noir compile heir_proof.nr", style: "dim" },
      { text: "  Generating witness...", style: "dim" },
      { text: "  Proof verified", style: "accent" },
      { text: "  Identity: [HIDDEN]", style: "highlight" },
    ],
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Dead-Man\u2019s Switch",
    description: "Automatic unlock when owner stops checking in. No custodian required, no single point of failure in the system.",
    terminal: [
      { text: "last_checkin: 2025-01-15", style: "dim" },
      { text: "grace_period: 7 days", style: "dim" },
      { text: "status: COUNTDOWN_ACTIVE", style: "accent" },
      { text: "unlock_at: 2025-02-22", style: "highlight" },
    ],
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Guardian Recovery",
    description: "2-of-3 multisig for emergency vault unlock. Trusted contacts provide decentralized social recovery.",
    terminal: [
      { text: "guardians: 3 registered", style: "dim" },
      { text: "threshold: 2 of 3", style: "dim" },
      { text: "guardian_1: approved", style: "accent" },
      { text: "guardian_2: pending", style: "highlight" },
    ],
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Multi-Asset Vaults",
    description: "Secure ETH, STRK, and WBTC in a single vault. Full ERC-20 whitelist support with per-token controls.",
    terminal: [
      { text: "vault_balance:", style: "dim" },
      { text: "  ETH:  2.450000", style: "accent" },
      { text: "  STRK: 15000.00", style: "accent" },
      { text: "  WBTC: 0.085000", style: "highlight" },
    ],
  },
];

const steps = [
  { num: "01", title: "Create Your Vault", desc: "Set check-in periods, appoint guardians, register heir commitments as a Merkle root. Deploy in one transaction." },
  { num: "02", title: "Deposit & Stay Active", desc: "Fund with whitelisted tokens. Periodically check in to keep the vault sealed. Miss a check-in, the countdown begins." },
  { num: "03", title: "Anonymous Claim", desc: "After timeout, heirs generate a ZK proof in-browser and claim on-chain. Nobody knows which heir claimed." },
];

const techStack = ["Starknet", "Cairo", "Noir Circuits", "Garaga", "Barretenberg", "Scaffold-Stark 2", "Next.js", "TypeScript"];

const pipelineSteps = [
  { label: "Noir Circuit", sub: "Witness generation", code: "noir compile" },
  { label: "bb.js", sub: "UltraHonk proof", code: "bb prove" },
  { label: "Garaga", sub: "Starknet calldata", code: "garaga gen" },
  { label: "Cairo Vault", sub: "On-chain verify", code: "starkli invoke" },
];

const Home = () => {
  const shouldReduceMotion = useReducedMotion();

  const heroCta1 = useMagnetic<HTMLAnchorElement>();
  const heroCta2 = useMagnetic<HTMLAnchorElement>();
  const finalCta = useMagnetic<HTMLAnchorElement>();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <section className="relative z-10 pt-20 sm:pt-28 pb-6 px-6">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.3 }}
            className="inline-flex items-center gap-2.5 px-5 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border-light)] mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--sw-text-secondary)] font-medium font-mono-code">
              Starknet Re&#123;define&#125; Hackathon
            </span>
          </motion.div>

          <HeightMask>
            <motion.h1
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.5 }}
              className="text-[3rem] sm:text-[4.5rem] md:text-[6rem] lg:text-[7.5rem] font-extrabold tracking-[-0.04em] leading-[0.92] mb-6"
            >
              <span className="block text-[var(--sw-text)]">Your Legacy,</span>
              <span className="block text-emerald-400 mt-1">
                <TypingText words={["Fully Private", "No Custodians", "Lives On"]} />
              </span>
            </motion.h1>
          </HeightMask>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap gap-4 justify-center mt-4"
          >
            <Link
              href="/create"
              ref={heroCta1.ref}
              onMouseMove={heroCta1.onMouseMove}
              onMouseLeave={heroCta1.onMouseLeave}
              className="inline-flex items-center gap-2.5 px-10 py-4 font-semibold text-[15px] bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-all duration-300 hover:shadow-[0_0_50px_rgba(16,185,129,0.25)]"
            >
              Create Vault
            </Link>
            <Link
              href="/claim"
              ref={heroCta2.ref}
              onMouseMove={heroCta2.onMouseMove}
              onMouseLeave={heroCta2.onMouseLeave}
              className="inline-flex items-center gap-2.5 px-10 py-4 font-semibold text-[15px] border border-[var(--sw-border)] text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)] hover:border-[var(--sw-border-hover)] hover:bg-[var(--sw-bg-subtle)] transition-all duration-300"
            >
              Claim Inheritance
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-20 max-w-5xl mx-auto">
        <HeightMask>
          <div className="manifesto-card">
            <p className="text-[1.5rem] sm:text-[2rem] md:text-[2.5rem] lg:text-[2.8rem] leading-[1.35] font-medium text-[var(--sw-text-secondary)] tracking-[-0.02em]">
              Current crypto inheritance solutions require trusting custodians, revealing heir identities, or both. StarkWill uses{" "}
              <span className="text-[var(--sw-text)]">zero-knowledge proofs</span> and a{" "}
              <span className="text-[var(--sw-text)]">dead-man&apos;s switch</span>{" "}
              to create vaults where heirs can claim assets{" "}
              <span className="text-emerald-400">without revealing who they are</span>.
              <span className="typing-cursor" />
            </p>
          </div>
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-24 max-w-6xl mx-auto">
        <HeightMask className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-emerald-500/50 font-medium font-mono-code block mb-6">
            Protocol Features
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-[-0.04em] text-[var(--sw-text)]">
            Privacy-First Inheritance
          </h2>
        </HeightMask>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((f, i) => (
            <HeightMask key={f.title} delay={i * 0.1}>
              <div className="card-invert p-8 sm:p-10 min-h-[380px] flex flex-col">
                <div className="card-invert-content flex-1 flex flex-col">
                  <div className="card-icon inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 text-emerald-400 mb-7 transition-all duration-[450ms]">
                    {f.icon}
                  </div>
                  <h3 className="card-title text-xl sm:text-2xl font-bold mb-3 tracking-[-0.04em] text-[var(--sw-text)] transition-colors duration-[450ms]">
                    {f.title}
                  </h3>
                  <p className="card-desc text-[15px] text-[var(--sw-text-secondary)] leading-relaxed mb-8 transition-colors duration-[450ms]">
                    {f.description}
                  </p>

                  <div className="card-terminal mt-auto bg-[var(--sw-terminal)] border border-[var(--sw-border-faint)] p-4 font-mono-code text-[11px] leading-relaxed space-y-0.5 transition-all duration-[450ms]">
                    {f.terminal.map((line, j) => (
                      <div
                        key={j}
                        className={
                          line.style === "accent"
                            ? "line-accent text-emerald-400"
                            : line.style === "highlight"
                              ? "line-highlight text-[var(--sw-text)]"
                              : "line-dim text-[var(--sw-text-tertiary)]"
                        }
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </HeightMask>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-24 max-w-5xl mx-auto">
        <HeightMask className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-emerald-500/50 font-medium font-mono-code block mb-6">
            Three Steps
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-[-0.04em] text-[var(--sw-text)]">
            How It Works
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
                    <div className="w-px flex-1 min-h-[64px] bg-gradient-to-b from-emerald-500/20 to-transparent my-3" />
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

      <section className="relative z-10 px-6 py-16 sm:py-24 max-w-6xl mx-auto">
        <HeightMask>
          <div className="p-10 sm:p-16 bg-[var(--sw-surface)] border border-[var(--sw-border-light)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/[0.02] blur-[120px] rounded-full" />

            <div className="relative z-10">
              <span className="text-xs tracking-[0.3em] uppercase text-[var(--sw-text-tertiary)] font-medium font-mono-code block mb-4">
                ZK Pipeline
              </span>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-10 tracking-[-0.04em] text-[var(--sw-text)]">
                Built for Privacy
              </h3>

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

              <div className="overflow-hidden border border-[var(--sw-border-faint)] py-5">
                <div className="marquee-track">
                  {[...techStack, ...techStack].map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="px-8 text-[13px] font-medium text-[var(--sw-text-tertiary)] whitespace-nowrap font-mono-code"
                    >
                      {t}
                      <span className="mx-6 text-[var(--sw-marquee-sep)]">/</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-24 max-w-4xl mx-auto">
        <HeightMask>
          <div className="terminal-block">
            <div className="terminal-header">
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <span className="ml-3 text-[11px] text-[var(--sw-text-tertiary)] font-mono-code">starkwill — vault lifecycle</span>
            </div>
            <div className="terminal-body">
              <div className="line-dim">{"// Initialize inheritance vault on Starknet"}</div>
              <div className="line-highlight mt-3">$ starkli invoke vault create_vault \</div>
              <div className="line-accent">{"    --checkin-period 30d \\"}</div>
              <div className="line-accent">{"    --grace-period 7d \\"}</div>
              <div className="line-accent">{"    --guardians 3 \\"}</div>
              <div className="line-accent">{"    --heir-merkle-root 0x7a9f..."}</div>
              <div className="line-dim mt-4">{"// Vault deployed. Owner must check in every 30 days."}</div>
              <div className="line-dim">{"// If owner goes silent, heirs claim after 37 days."}</div>
              <div className="mt-4 line-highlight">$ noir prove heir_claim.nr --secret [REDACTED]</div>
              <div className="line-accent">{"  ZK proof generated (UltraHonk)"}</div>
              <div className="line-accent">{"  Garaga calldata ready"}</div>
              <div className="line-dim mt-3">{"  nullifier: 0x3c8b...f291"}</div>
              <div className="line-dim">{"  identity:  [ZERO KNOWLEDGE]"}</div>
              <div className="mt-4 line-highlight">$ starkli invoke vault claim_with_proof</div>
              <div className="line-accent">{"  Proof verified on-chain"}</div>
              <div className="line-accent">{"  2.45 ETH transferred to heir"}</div>
              <div className="mt-3 line-dim">{"  No identity revealed. No trace left."}</div>
            </div>
          </div>
        </HeightMask>
      </section>

      <div className="section-divider" />

      <section className="relative z-10 px-6 py-16 sm:py-24 max-w-3xl mx-auto text-center">
        <HeightMask>
          <h2 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-[-0.04em] mb-7 text-[var(--sw-text)]">
            Protect What Matters
          </h2>
          <p className="text-lg text-[var(--sw-text-secondary)] mb-16 max-w-lg mx-auto leading-relaxed">
            Set up your inheritance vault in minutes. No lawyers, no custodians,
            no identity exposure. Just math.
          </p>
          <Link
            href="/create"
            ref={finalCta.ref}
            onMouseMove={finalCta.onMouseMove}
            onMouseLeave={finalCta.onMouseLeave}
            className="inline-flex items-center gap-3 px-14 py-5 font-semibold text-base bg-emerald-500 text-[var(--sw-text-inverted)] hover:bg-emerald-400 transition-all duration-300 hover:shadow-[0_0_60px_rgba(16,185,129,0.2)]"
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="w-px h-16 bg-gradient-to-b from-[var(--sw-text-tertiary)]/30 to-transparent" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--sw-text-tertiary)] font-mono-code">
              Built on Starknet
            </span>
          </div>
        </HeightMask>
      </section>
    </div>
  );
};

export default Home;
