"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Globe } from "lucide-react";
import { useUI } from "./providers";

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme, locale, setLocale, t } = useUI();

  const navItems = [
    {
      href: "/live",
      label: locale === "id" ? "Live Timing" : "Live Timing",
    },
    {
      href: "/analysis",
      label: locale === "id" ? "Analisis Lap" : "Lap Telemetry",
    },
    {
      href: "/standings",
      label: locale === "id" ? "Klasemen" : "Standings",
    },
    {
      href: "/calendar",
      label: locale === "id" ? "Kalender" : "Calendar",
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand + Navigation */}
        <div className="flex items-center gap-8">
          <Link
            href="/live"
            className="group flex items-center gap-2 transition-transform hover:opacity-95"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-pitwall-red font-display text-lg font-black tracking-tighter text-white shadow-sm">
              PW
            </div>
            <div className="flex flex-col">
              <span className="font-display text-2xl font-black tracking-tight text-text-primary">
                Pit<span className="text-pitwall-red">Wall</span>
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active =
                pathname.startsWith(item.href) ||
                (item.href === "/standings" && pathname.startsWith("/drivers"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
                    active
                      ? "bg-surface-elevated text-text-primary shadow-xs"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-pitwall-red" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Controls (Mobile Menu + Language + Theme) */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={() => setLocale(locale === "id" ? "en" : "id")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-pitwall-red"
            title="Ganti Bahasa / Switch Language"
            aria-label="Ganti Bahasa"
          >
            <Globe className="h-3.5 w-3.5 text-text-muted" />
            <span className="font-bold">{locale.toUpperCase()}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-pitwall-red"
            title={
              theme === "dark"
                ? "Beralih ke Mode Terang"
                : "Beralih ke Mode Gelap"
            }
            aria-label="Beralih tema gelap atau terang"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav Sub-Bar */}
      <div className="flex border-t border-border-subtle bg-surface px-2 py-1.5 md:hidden overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const active =
            pathname.startsWith(item.href) ||
            (item.href === "/standings" && pathname.startsWith("/drivers"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "bg-surface-elevated text-pitwall-red font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
