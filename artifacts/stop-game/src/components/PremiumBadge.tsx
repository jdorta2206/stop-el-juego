interface PremiumBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function PremiumBadge({ size = "sm", className = "" }: PremiumBadgeProps) {
  const sizeClass = size === "xs" ? "text-[10px]" : size === "md" ? "text-base" : "text-xs";
  return (
    <span
      title="Jugador Premium"
      className={`premium-badge inline-flex items-center justify-center ${sizeClass} ${className}`}
      style={{
        background: "linear-gradient(135deg, #fde047 0%, #facc15 50%, #ca8a04 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 4px rgba(250,204,21,0.6))",
        animation: "premiumPulse 2.4s ease-in-out infinite",
      }}
    >
      ⭐
    </span>
  );
}
