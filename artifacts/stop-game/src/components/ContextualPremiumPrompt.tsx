import { motion } from "framer-motion";
import { Crown, Flame, Eye, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { usePaymentChannel } from "@/hooks/usePaymentChannel";

export interface PremiumPromptContext {
  isPremium: boolean;
  roundLost: boolean;
  margin: number;
  spyExhausted: boolean;
  streakDays: number;
}

interface ContextualPremiumPromptProps {
  context: PremiumPromptContext;
  onUpgrade: () => void;
  fallback?: ReactNode;
  className?: string;
}

interface PromptVariant {
  icon: ReactNode;
  headline: string;
  cta: string;
  bg: string;
  border: string;
  color: string;
}

function pickVariant(ctx: PremiumPromptContext): PromptVariant | null {
  if (ctx.isPremium) return null;

  if (ctx.roundLost && ctx.margin > 0 && ctx.margin <= 10) {
    return {
      icon: <Eye className="w-5 h-5" />,
      headline: `Perdiste por solo ${ctx.margin} puntos`,
      cta: "Con la espía 2x de Premium habrías ganado",
      bg: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(249,168,37,0.10))",
      border: "1.5px solid rgba(249,168,37,0.55)",
      color: "#f9a825",
    };
  }

  if (ctx.spyExhausted) {
    return {
      icon: <Eye className="w-5 h-5" />,
      headline: "¿Te quedaste sin espía?",
      cta: "Premium incluye 2 espías por partida",
      bg: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(124,58,237,0.10))",
      border: "1.5px solid rgba(34,211,238,0.45)",
      color: "#22d3ee",
    };
  }

  if (ctx.streakDays >= 7) {
    return {
      icon: <Flame className="w-5 h-5" />,
      headline: `${ctx.streakDays} días seguidos jugando`,
      cta: "Te has ganado el anillo dorado — pruébalo gratis",
      bg: "linear-gradient(135deg, rgba(249,168,37,0.20), rgba(220,38,38,0.12))",
      border: "1.5px solid rgba(249,168,37,0.55)",
      color: "#f9a825",
    };
  }

  if (ctx.roundLost) {
    return {
      icon: <Trophy className="w-5 h-5" />,
      headline: "¿Quieres jugar sin anuncios?",
      cta: "Premium quita publicidad y suma 20s extra al solo",
      bg: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(249,168,37,0.08))",
      border: "1.5px solid rgba(249,168,37,0.40)",
      color: "#f9a825",
    };
  }

  return null;
}

export function ContextualPremiumPrompt({
  context,
  onUpgrade,
  fallback,
  className,
}: ContextualPremiumPromptProps) {
  // Branch the CTA badge by payment channel so the user sees the same
  // brand they'll see on the next screen — "Google Play" inside the TWA,
  // "Probar" on the web. Doesn't change the click target (the parent
  // PremiumModal handles the actual purchase routing).
  const { channel } = usePaymentChannel();

  if (context.isPremium) return null;

  const variant = pickVariant(context);
  if (!variant) return <>{fallback}</>;
  const ctaLabel = channel === "play" ? "Google Play" : "Probar";

  return (
    <motion.button
      type="button"
      onClick={onUpgrade}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left ${className ?? ""}`}
      style={{ background: variant.bg, border: variant.border }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${variant.color}22`, color: variant.color }}
      >
        {variant.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm leading-tight" style={{ color: variant.color }}>
          {variant.headline}
        </p>
        <p className="text-white/85 text-xs font-semibold leading-tight mt-0.5">
          {variant.cta}
        </p>
      </div>
      <div
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-black flex-shrink-0"
        style={{ background: variant.color, color: "#0d1757" }}
      >
        <Crown className="w-3 h-3" />
        {ctaLabel}
      </div>
    </motion.button>
  );
}
