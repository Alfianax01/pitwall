import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "sprint"
    | "outline";
  size?: "sm" | "md";
}

export function Badge({
  className = "",
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles = {
    default: "bg-surface-elevated text-text-secondary border border-border-subtle",
    primary: "bg-pitwall-red/10 text-pitwall-red font-bold border border-pitwall-red/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400 font-semibold border border-red-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20",
    sprint: "bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-300 font-bold border border-amber-500/30",
    outline: "border border-border-strong text-text-secondary",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export interface StatusPillProps {
  status: "GREEN" | "YELLOW" | "SC" | "VSC" | "RED" | "COMPLETED" | "NEXT" | "UPCOMING" | string;
  label?: string;
  pulse?: boolean;
}

export function StatusPill({ status, label, pulse = false }: StatusPillProps) {
  const normalized = status.toUpperCase();

  let styles = "bg-surface-elevated text-text-secondary border-border-subtle";
  let dotColor = "bg-text-muted";
  let displayLabel = label || status;

  if (normalized === "GREEN" || normalized === "CLEAR" || normalized === "COMPLETED") {
    styles = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    dotColor = "bg-emerald-500";
    if (!label) displayLabel = normalized === "COMPLETED" ? "Selesai" : "Track Clear";
  } else if (normalized === "YELLOW" || normalized === "SC" || normalized === "VSC") {
    styles = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
    dotColor = "bg-amber-500";
    if (!label) displayLabel = normalized === "SC" ? "Safety Car" : normalized === "VSC" ? "Virtual SC" : "Yellow Flag";
  } else if (normalized === "RED" || normalized === "NEXT") {
    styles = "bg-pitwall-red/10 text-pitwall-red border-pitwall-red/25";
    dotColor = "bg-pitwall-red";
    if (!label) displayLabel = normalized === "NEXT" ? "Balapan Berikutnya" : "Red Flag";
  } else if (normalized === "UPCOMING") {
    styles = "bg-surface-elevated text-text-secondary border-border-subtle";
    dotColor = "bg-text-muted";
    if (!label) displayLabel = "Akan Datang";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotColor} ${
          pulse || normalized === "NEXT" || normalized === "SC" || normalized === "RED"
            ? "animate-pulse"
            : ""
        }`}
      />
      <span>{displayLabel}</span>
    </span>
  );
}

