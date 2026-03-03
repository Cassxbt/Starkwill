"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useOutsideClick } from "~~/hooks/scaffold-stark";
import { CustomConnectButton } from "~~/components/scaffold-stark/CustomConnectButton";
import { useTargetNetwork } from "~~/hooks/scaffold-stark/useTargetNetwork";
import { devnet } from "@starknet-react/chains";
import { SwitchTheme } from "./SwitchTheme";
import { useAccount, useNetwork, useProvider } from "@starknet-react/core";
import { useScrollDirection } from "~~/hooks/useScrollDirection";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "Home", href: "/" },
  { label: "Create Vault", href: "/create" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Claim", href: "/claim" },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              className={`nav-link-grain relative px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "text-emerald-400"
                  : "text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)]"
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 bg-emerald-500/[0.08] border border-emerald-500/[0.15]" />
              )}
              <span className="relative z-10">{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

export const Header = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const burgerMenuRef = useRef<HTMLDivElement>(null);
  const scrollDirection = useScrollDirection();

  useOutsideClick(
    burgerMenuRef,
    useCallback(() => setIsDrawerOpen(false), []),
  );

  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.network === devnet.network;

  const { provider } = useProvider();
  const { address, status, chainId } = useAccount();
  const { chain } = useNetwork();
  const [isDeployed, setIsDeployed] = useState(true);

  useEffect(() => {
    if (
      status === "connected" &&
      address &&
      chainId === targetNetwork.id &&
      chain.network === targetNetwork.network
    ) {
      provider
        .getClassHashAt(address)
        .then((classHash) => {
          if (classHash) setIsDeployed(true);
          else setIsDeployed(false);
        })
        .catch((e) => {
          console.error("contract check", e);
          if (e.toString().includes("Contract not found")) {
            setIsDeployed(false);
          }
        });
    }
  }, [
    status,
    address,
    provider,
    chainId,
    targetNetwork.id,
    targetNetwork.network,
    chain.network,
  ]);

  return (
    <div
      className={`header-blur fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 border-b border-[var(--sw-border-light)] ${
        scrollDirection === "down" ? "nav-hidden" : "nav-visible"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <div className="lg:hidden" ref={burgerMenuRef}>
            <button
              className="p-2 text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)] hover:bg-[var(--sw-bg-subtle)] transition-all"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            {isDrawerOpen && (
              <ul
                className="absolute top-16 left-4 mt-1 p-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] space-y-1 min-w-[180px]"
                onClick={() => setIsDrawerOpen(false)}
              >
                <HeaderMenuLinks />
              </ul>
            )}
          </div>

          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="logo-3d" aria-hidden="true">
              <div className="logo-3d-cube">
                <div className="logo-3d-face logo-3d-front">
                  <Image alt="" width={28} height={28} src="/logo.svg" />
                </div>
                <div className="logo-3d-face logo-3d-top" />
                <div className="logo-3d-face logo-3d-right" />
              </div>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-sm leading-tight text-[var(--sw-text)] tracking-tight">StarkWill</span>
              <span className="text-[10px] text-[var(--sw-text-tertiary)] leading-tight">Private Inheritance</span>
            </div>
          </Link>

          <ul className="hidden lg:flex items-center gap-1">
            <HeaderMenuLinks />
          </ul>
        </div>

        <div className="flex items-center gap-3">
          {status === "connected" && !isDeployed && (
            <span className="hidden sm:inline-flex px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-400">
              Wallet Not Deployed
            </span>
          )}
          <CustomConnectButton />
          <SwitchTheme
            className={`pointer-events-auto ${isLocalNetwork ? "mb-1 lg:mb-0" : ""}`}
          />
        </div>
      </div>
    </div>
  );
};
