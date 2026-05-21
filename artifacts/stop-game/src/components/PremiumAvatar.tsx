import { motion, useReducedMotion } from "framer-motion";

interface PremiumAvatarProps {
  name: string;
  color: string;
  isPremium?: boolean;
  isBot?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 32, font: 14, crown: 14, ring: 2.5 },
  md: { box: 44, font: 18, crown: 18, ring: 3 },
  lg: { box: 64, font: 26, crown: 24, ring: 3.5 },
};

export function PremiumAvatar({
  name,
  color,
  isPremium = false,
  isBot = false,
  size = "sm",
  className = "",
}: PremiumAvatarProps) {
  const s = SIZE_MAP[size];
  const initial = isBot ? "🤖" : (name?.charAt(0).toUpperCase() || "?");
  const prefersReducedMotion = useReducedMotion();

  if (!isPremium) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-white ${className}`}
        style={{
          width: s.box,
          height: s.box,
          fontSize: s.font,
          backgroundColor: color || "#555",
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: s.box, height: s.box }}
    >
      {/* Rotating golden ring */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "conic-gradient(from 0deg, #fde047, #facc15, #ca8a04, #fde047, #fff7c2, #facc15, #fde047)",
          padding: s.ring,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          filter: "drop-shadow(0 0 6px rgba(250,204,21,0.7))",
        }}
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
      />

      {/* Avatar circle */}
      <div
        className="absolute rounded-full flex items-center justify-center font-bold text-white"
        style={{
          inset: s.ring + 1,
          fontSize: s.font,
          backgroundColor: color || "#555",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        {initial}
      </div>

      {/* Floating crown */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: -s.crown * 0.55,
          left: "50%",
          fontSize: s.crown,
          transform: "translateX(-50%)",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))",
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { y: [0, -2, 0], rotate: [-8, 8, -8] }
        }
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
      >
        👑
      </motion.div>

      {/* Sparkle */}
      <motion.div
        className="absolute pointer-events-none text-yellow-200"
        style={{
          top: "10%",
          right: "-8%",
          fontSize: s.crown * 0.55,
          filter: "drop-shadow(0 0 4px rgba(253,224,71,0.9))",
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { opacity: [0, 1, 0], scale: [0.6, 1.1, 0.6] }
        }
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0.3 }}
      >
        ✨
      </motion.div>
    </div>
  );
}
