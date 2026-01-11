import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  };

  export function Button({ variant = "primary", className = "", ...props }: Props) {
    const base =
        "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyber-cyan/40";
          const primary =
              "bg-cyber-cyan/15 border border-cyber-cyan/35 shadow-glowCyan hover:bg-cyber-cyan/22";
                const ghost = "bg-transparent border border-white/10 hover:bg-white/5";

                  return (
                      <button
                            {...props}
                                  className={`${base} ${variant === "primary" ? primary : ghost} ${className}`}
                                      />
                                        );
                                        }