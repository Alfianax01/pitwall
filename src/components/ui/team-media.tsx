"use client";

import React, { useState } from "react";
import Image from "next/image";
import { getTeamData } from "@/lib/f1/teams";

interface TeamLogoProps {
  teamName: string;
  size?: number; // width & height in px
  priority?: boolean;
  className?: string;
}

export function TeamLogo({
  teamName,
  size = 20,
  priority = false,
  className = "",
}: TeamLogoProps) {
  const team = getTeamData(teamName);
  const [hasError, setHasError] = useState(false);

  // Fallback: Badge monogram kotak berwarna tim + shortCode
  if (!team.logoSrc || hasError) {
    const fontSize = Math.max(9, Math.floor(size * 0.44));
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded font-display font-black text-white shadow-xs ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: team.color || "#71717A",
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          aspectRatio: "1/1",
        }}
        title={`Logo ${team.name}`}
        aria-label={`Logo ${team.name}`}
      >
        <span>{team.shortCode}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-surface-elevated/40 border border-border-subtle/50 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        aspectRatio: "1/1",
      }}
      title={`Logo ${team.name}`}
      aria-label={`Logo ${team.name}`}
    >
      <Image
        src={team.logoSrc}
        alt={`Logo ${team.name}`}
        width={size}
        height={size}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className="h-full w-full object-contain p-0.5"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

interface TeamCarBackgroundProps {
  teamName: string;
  priority?: boolean;
  className?: string;
}

export function TeamCarBackground({
  teamName,
  priority = false,
  className = "",
}: TeamCarBackgroundProps) {
  const team = getTeamData(teamName);
  const [hasError, setHasError] = useState(false);

  if (!team.carSrc || hasError) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute right-0 bottom-0 select-none overflow-hidden opacity-25 ${className}`}
      aria-hidden="true"
    >
      <Image
        src={team.carSrc}
        alt={`Mobil ${team.name}`}
        width={320}
        height={130}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className="h-auto w-auto max-w-[260px] sm:max-w-[320px] object-contain object-right-bottom"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

