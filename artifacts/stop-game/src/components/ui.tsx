import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg shadow-secondary/30",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/30",
      ghost: "bg-transparent text-white hover:bg-white/10",
      outline: "bg-transparent border-2 border-white/20 text-white hover:bg-white/10",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-xl",
      xl: "px-10 py-5 text-2xl font-bold uppercase tracking-wide",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, translateY: -2 }}
        whileTap={{ scale: 0.98, translateY: 0 }}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-display font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

// --- CARD ---
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-card rounded-2xl overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

// --- INPUT ---
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex w-full rounded-xl border-2 border-white/20 bg-black/20 px-4 py-3 text-lg text-white font-body",
          "placeholder:text-white/50 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/50",
          "transition-all duration-200 disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// --- PROGRESS ---
export function Progress({ value, className, indicatorClass }: { value: number; className?: string, indicatorClass?: string }) {
  return (
    <div className={cn("h-4 w-full overflow-hidden rounded-full bg-black/30", className)}>
      <div
        className={cn("h-full bg-secondary transition-all duration-500 ease-out", indicatorClass)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
