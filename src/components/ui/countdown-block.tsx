import React from "react";

export interface CountdownBlockProps {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  className?: string;
}

export function CountdownBlock({
  days,
  hours,
  minutes,
  seconds,
  className = "",
}: CountdownBlockProps) {
  const units = [
    { value: days, label: "HARI" },
    { value: hours, label: "JAM" },
    { value: minutes, label: "MENIT" },
    { value: seconds, label: "DETIK" },
  ];

  return (
    <div className={`grid grid-cols-4 gap-2 sm:gap-3 ${className}`}>
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex flex-col items-center justify-center rounded-lg bg-surface border border-border-subtle p-2 sm:p-3 shadow-xs"
        >
          <span className="font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold tabular-nums text-text-primary">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="mt-0.5 text-[10px] sm:text-xs font-bold tracking-wider text-text-muted">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

