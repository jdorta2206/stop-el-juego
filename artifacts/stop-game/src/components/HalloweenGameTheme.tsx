import { motion } from "framer-motion";

interface HalloweenGameThemeProps {
  active: boolean;
}

/**
 * Decorative Halloween layer for the live game only.
 * Preview trigger: visual theme validation.
 *
 * It never captures pointer events and never changes the game layout.
 * The underlying STOP controls remain untouched.
 */
export function HalloweenGameTheme({ active }: HalloweenGameThemeProps) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[5] pointer-events-none overflow-hidden select-none"
    >
      {/* Dark vignette / fog. It sits behind controls and answer cards. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 28%, rgba(8,3,8,.08) 58%, rgba(5,0,4,.34) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Thin blood-red edge glow — atmospheric, not a blocking overlay. */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 80px rgba(100,0,0,.22), inset 0 -18px 45px rgba(110,0,0,.16)",
        }}
      />

      {/* Spider web in the upper-left corner. */}
      <svg
        className="absolute left-0 top-0 w-44 h-44 opacity-70"
        viewBox="0 0 180 180"
        fill="none"
      >
        <path d="M0 0H180M0 0V180M0 0L180 180M0 0L120 180M0 0L180 120" stroke="rgba(230,230,230,.24)" strokeWidth="1" />
        <path d="M0 30C40 42 42 42 30 0M0 62C72 78 78 78 62 0M0 96C104 112 112 104 96 0M0 132C138 144 144 138 132 0" stroke="rgba(230,230,230,.20)" strokeWidth="1" />
      </svg>

      {/* Hanging spider: a real drawn SVG, slowly swaying on its web thread. */}
      <motion.div
        className="absolute left-2 top-2 origin-top"
        initial={{ rotate: -3 }}
        animate={{ rotate: [-7, 6, -5, 4, -7] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 82, height: 160 }}
      >
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: 1,
            height: 66,
            background: "linear-gradient(to bottom, rgba(235,235,235,.5), rgba(235,235,235,.08))",
          }}
        />
        <svg
          className="absolute left-1/2 top-[54px] -translate-x-1/2"
          width="74"
          height="82"
          viewBox="0 0 74 82"
          fill="none"
        >
          <g stroke="#130b0b" strokeWidth="4" strokeLinecap="round">
            <path d="M31 30L7 15M29 38L4 31M30 46L7 49M33 52L15 66" />
            <path d="M43 30L67 15M45 38L70 31M44 46L67 49M41 52L59 66" />
          </g>
          <g stroke="#b91c1c" strokeWidth="1.4" strokeLinecap="round" opacity=".8">
            <path d="M31 30L7 15M29 38L4 31M30 46L7 49M33 52L15 66" />
            <path d="M43 30L67 15M45 38L70 31M44 46L67 49M41 52L59 66" />
          </g>
          <ellipse cx="37" cy="38" rx="16" ry="21" fill="#080607" stroke="#7f1d1d" strokeWidth="2" />
          <circle cx="37" cy="20" r="11" fill="#050405" stroke="#991b1b" strokeWidth="2" />
          <circle cx="33" cy="18" r="2" fill="#ef4444" />
          <circle cx="41" cy="18" r="2" fill="#ef4444" />
        </svg>
      </motion.div>

      {/* Occasional slow blood drops along the lower edge. */}
      <div className="absolute inset-x-0 bottom-0 h-10">
        {[12, 29, 54, 76, 91].map((left, i) => (
          <motion.span
            key={left}
            className="absolute bottom-0 rounded-b-full"
            style={{
              left: `${left}%`,
              width: i % 2 ? 3 : 4,
              height: i % 2 ? 12 : 8,
              background: "linear-gradient(to bottom, #991b1b, #450a0a)",
              boxShadow: "0 0 8px rgba(153,27,27,.25)",
            }}
            animate={{ scaleY: [0.75, 1, 0.8], opacity: [0.5, 0.9, 0.55] }}
            transition={{ duration: 2.8 + i * 0.35, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
          />
        ))}
      </div>
    </div>
  );
}
