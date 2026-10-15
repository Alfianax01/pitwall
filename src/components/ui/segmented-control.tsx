import React from "react";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  badge?: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  ariaLabel = "Pilihan tab",
}: SegmentedControlProps<T>) {
  const containerPadding = size === "sm" ? "p-1 gap-1" : "p-1.5 gap-1.5";
  const itemPadding =
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-lg bg-surface-elevated border border-border-subtle ${containerPadding} ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-pitwall-red ${itemPadding} ${
              isActive
                ? "bg-surface text-text-primary shadow-xs font-bold"
                : "text-text-secondary hover:text-text-primary hover:bg-surface/50"
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? "bg-pitwall-red text-white"
                    : "bg-surface text-text-muted"
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

