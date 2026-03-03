"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export const SwitchTheme = ({ className }: { className?: string }) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDarkMode = resolvedTheme === "dark";

  const handleToggle = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  return (
    <div
      className={`flex space-x-2 h-5 items-center justify-center text-sm border-l border-[var(--sw-border-light)] px-4 ${className}`}
    >
      <button
        onClick={handleToggle}
        className="p-1.5 text-[var(--sw-text-secondary)] hover:text-[var(--sw-text)] hover:bg-[var(--sw-bg-subtle-hover)] transition-all cursor-pointer"
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? (
          <MoonIcon className="h-5 w-5" />
        ) : (
          <SunIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};
