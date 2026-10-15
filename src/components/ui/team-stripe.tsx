import React from "react";

export interface TeamStripeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  size?: "sm" | "md" | "lg";
}

export function TeamStripe({
  color = "#E10600",
  size = "md",
  className = "",
  ...props
}: TeamStripeProps) {
  const sizeStyles = {
    sm: "w-1 h-3.5",
    md: "w-1.25 h-5",
    lg: "w-1.5 h-7",
  };

  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sizeStyles[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
      {...props}
    />
  );
}

