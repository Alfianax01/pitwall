"use client";

import React from "react";
import Link from "next/link";
import { useUI } from "./providers";

export function Footer() {
  const { locale, t } = useUI();

  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          {/* Brand & Mission */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-pitwall-red font-display text-xs font-bold text-white">
                PW
              </span>
              <span className="font-display text-lg font-black tracking-tight text-text-primary">
                Pit<span className="text-pitwall-red">Wall</span>
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {locale === "id"
                ? "Platform media & analisis telemetri Formula 1 independen."
                : "Independent Formula 1 telemetry analysis and motorsport media."}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap justify-center gap-6 text-xs font-medium text-text-secondary">
            <Link
              href="/live"
              className="transition-colors hover:text-text-primary"
            >
              {locale === "id" ? "Live Timing" : "Live Timing"}
            </Link>
            <Link
              href="/analysis"
              className="transition-colors hover:text-text-primary"
            >
              {locale === "id" ? "Analisis Lap" : "Lap Analysis"}
            </Link>
            <Link
              href="/standings"
              className="transition-colors hover:text-text-primary"
            >
              {locale === "id" ? "Klasemen" : "Standings"}
            </Link>
            <Link
              href="/calendar"
              className="transition-colors hover:text-text-primary"
            >
              {locale === "id" ? "Kalender" : "Calendar"}
            </Link>
          </div>

          {/* Attribution */}
          <div className="text-xs text-text-muted">
            <span>Powered by </span>
            <a
              href="https://openf1.org"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-text-secondary hover:text-pitwall-red transition-colors"
            >
              OpenF1
            </a>
            <span> & </span>
            <a
              href="https://jolpi.ca"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-text-secondary hover:text-pitwall-red transition-colors"
            >
              Jolpica-Ergast
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 border-t border-border-subtle pt-4 text-center text-[11px] text-text-muted">
          <p>{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
