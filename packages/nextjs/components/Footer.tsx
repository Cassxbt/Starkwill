"use client";

import Link from "next/link";

const marqueeText = "StarkWill \u2014 Private Inheritance on Starknet \u2014 Zero-Knowledge Proofs \u2014 ";

const footerLinks = {
  Product: [
    { label: "Create Vault", href: "/create" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Claim", href: "/claim" },
  ],
  Protocol: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "ZK Pipeline", href: "/how-it-works#zk-pipeline" },
  ],
  Developers: [
    { label: "Documentation", href: "#" },
    { label: "GitHub", href: "https://github.com/cassxbt", external: true },
  ],
  Community: [
    { label: "X (Twitter)", href: "https://x.com/cassxbt", external: true },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-[var(--sw-border)] bg-[var(--sw-bg)]">
      <div className="overflow-hidden border-b border-[var(--sw-border-faint)] py-4">
        <div className="marquee-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="px-6 text-xs font-medium text-[var(--sw-text-tertiary)] whitespace-nowrap font-mono-code tracking-wide"
            >
              {marqueeText}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--sw-text)] mb-5">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--sw-border-faint)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-[var(--sw-text-secondary)] font-medium block mb-2">Newsletter</label>
                <div className="flex">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="px-4 py-2 bg-[var(--sw-bg-subtle)] border border-[var(--sw-border)] text-sm text-[var(--sw-text)] placeholder:text-[var(--sw-text-placeholder)] focus:outline-none focus:border-emerald-500/40 transition-colors w-56"
                  />
                  <button className="px-5 py-2 bg-emerald-500 text-[var(--sw-text-inverted)] text-sm font-medium border border-emerald-500 hover:bg-emerald-400 transition-colors">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="https://github.com/cassxbt" target="_blank" rel="noopener noreferrer" className="text-[var(--sw-text-tertiary)] hover:text-[var(--sw-text)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
              <a href="https://x.com/cassxbt" target="_blank" rel="noopener noreferrer" className="text-[var(--sw-text-tertiary)] hover:text-[var(--sw-text)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--sw-border-faint)]">
          <p className="text-xs text-[var(--sw-text-tertiary)]">
            &copy; {new Date().getFullYear()} StarkWill. Built on Starknet.
          </p>
        </div>
      </div>
    </footer>
  );
};
