import React from "react";
import { TyreCompound } from "@/lib/f1/schemas";

const COMPOUND_STYLES: Record<
  TyreCompound,
  { letter: string; name: string; ringColor: string; textColor: string; bg: string }
> = {
  SOFT: {
    letter: "S",
    name: "Soft",
    ringColor: "border-red-500",
    textColor: "text-red-500",
    bg: "bg-red-500/10",
  },
  MEDIUM: {
    letter: "M",
    name: "Medium",
    ringColor: "border-amber-400",
    textColor: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-400/10",
  },
  HARD: {
    letter: "H",
    name: "Hard",
    ringColor: "border-slate-300 dark:border-white",
    textColor: "text-slate-700 dark:text-white",
    bg: "bg-slate-200/50 dark:bg-white/10",
  },
  INTERMEDIATE: {
    letter: "I",
    name: "Intermediate",
    ringColor: "border-emerald-500",
    textColor: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  WET: {
    letter: "W",
    name: "Wet",
    ringColor: "border-blue-500",
    textColor: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  UNKNOWN: {
    letter: "?",
    name: "Unknown",
    ringColor: "border-slate-500",
    textColor: "text-slate-400",
    bg: "bg-slate-500/10",
  },
};

export interface TyreIconProps {
  compound?: TyreCompound;
  age?: number;
  size?: "sm" | "md";
  showAge?: boolean;
}

export function TyreIcon({
  compound = "UNKNOWN",
  age,
  size = "md",
  showAge = true,
}: TyreIconProps) {
  const cfg = COMPOUND_STYLES[compound] || COMPOUND_STYLES.UNKNOWN;

  const circleDimensions =
    size === "sm" ? "h-5 w-5 text-[10px] border" : "h-6 w-6 text-xs border-2";

  return (
    <div
      className="inline-flex items-center gap-1.5"
      title={`${cfg.name}${age !== undefined ? ` • ${age} lap` : ""}`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full font-mono font-black ${circleDimensions} ${cfg.ringColor} ${cfg.textColor} ${cfg.bg}`}
      >
        {cfg.letter}
      </span>
      {showAge && age !== undefined && (
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {age}L
        </span>
      )}
    </div>
  );
}

// For backwards-compatibility with previous tyre-badge usage
export const TyreBadge = TyreIcon;

