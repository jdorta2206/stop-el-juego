import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

interface Props {
  onDone: () => void;
  lang?: string;
}

const RING_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TAGLINES: Record<string, string> = {
  es: "El juego que nadie supera",
  en: "The game no one beats",
  pt: "O jogo que ninguém vence",
  fr: "Le jeu que personne ne bat",
};

function RingLetter({
  letter,
  index,
  total,
  radius,
  rotate,
}: {
  letter: string;
  index: number;
  total: number;
  radius: number;
  rotate: number;
}) {
  const angle = (index / total) * 360 + rotate;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  const colors = [
    "#f59e0b", "#ef4444", "#10b981", "#3b82f6",
    "#8b5cf6", "#ec4899", "#f97316", "#06b6d4",
  ];
  const color = colors[index % colors.length];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + index * 0.03, type: "spring", stiffness: 300, damping: 20 }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
        color,
        fontWeight: 900,
        fontSize: "clamp(10px, 2.2vw, 15px)",
        textShadow: `0 0 8px ${color}99`,
        fontFamily: "'Fredoka One', sans-serif",
        letterSpacing: 0,
        userSelect: "none",
      }}
    >
      {letter}
    </motion.span>
  );
}

export function SplashScreen({ onDone, lang = "es" }: Props) {
  const [ringAngle, setRingAngle] = useState(0);
  const [logoPhase, setLogoPhase] = useState<"in" | "pulse">("in");
  const [exit, setExit] = useState(false);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const tagline = TAGLINES[lang] ?? TAGLINES.es;

  useEffect(() => {
    const el = document.getElementById("html-splash");
    if (el) {
      el.classList.add("fade-out");
      setTimeout(() => el.remove(), 400);
    }
  }, []);

  useEffect(() => {
    let running = true;
    function tick(now: number) {
      if (!lastRef.current) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      setRingAngle((a) => (a + dt * 0.035) % 360);
      if (running) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoPhase("pulse"), 600);
    const t2 = setTimeout(() => setExit(true), 2600);
    const t3 = setTimeout(onDone, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const ringRadius = Math.min(window.innerWidth, window.innerHeight) * 0.29;

  return (
    <AnimatePresence>
      {!exit && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background:
              "radial-gradient(ellipse at 50% 45%, #5a1208 0%, #1a063a 55%, #060318 100%)",
          }}
        >
          {/* Ambient glow orbs */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.18, 0.35, 0.18] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: "60vmax",
              height: "60vmax",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(181,48,26,0.55) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <motion.div
            animate={{ scale: [1.2, 0.9, 1.2], opacity: [0.12, 0.22, 0.12] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{
              position: "absolute",
              width: "40vmax",
              height: "40vmax",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(99,20,200,0.35) 0%, transparent 70%)",
              pointerEvents: "none",
              top: "60%",
              left: "60%",
              transform: "translate(-50%,-50%)",
            }}
          />

          {/* Rotating letter ring */}
          <div
            style={{
              position: "absolute",
              width: ringRadius * 2 + 60,
              height: ringRadius * 2 + 60,
              pointerEvents: "none",
            }}
          >
            {RING_LETTERS.split("").map((letter, i) => (
              <RingLetter
                key={letter}
                letter={letter}
                index={i}
                total={26}
                radius={ringRadius}
                rotate={ringAngle}
              />
            ))}
          </div>

          {/* Glowing ring border */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6, type: "spring", stiffness: 180 }}
            style={{
              position: "absolute",
              width: ringRadius * 2 + 24,
              height: ringRadius * 2 + 24,
              borderRadius: "50%",
              border: "2px solid rgba(181,48,26,0.25)",
              boxShadow:
                "0 0 40px rgba(181,48,26,0.3), inset 0 0 40px rgba(181,48,26,0.1)",
              pointerEvents: "none",
            }}
          />

          {/* Logo container */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -15 }}
            animate={
              logoPhase === "in"
                ? { scale: 1, opacity: 1, rotate: 0 }
                : { scale: [1, 1.04, 1], opacity: 1, rotate: 0 }
            }
            transition={
              logoPhase === "in"
                ? { type: "spring", stiffness: 220, damping: 14, duration: 0.7 }
                : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ position: "relative", zIndex: 2 }}
          >
            {/* Logo glow halo */}
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: "-20%",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(181,48,26,0.7) 0%, transparent 70%)",
                filter: "blur(18px)",
                zIndex: 0,
              }}
            />
            <img
              src="/images/stop-logo.png"
              alt="STOP"
              style={{
                width: "clamp(130px, 32vw, 200px)",
                height: "clamp(130px, 32vw, 200px)",
                objectFit: "contain",
                position: "relative",
                zIndex: 1,
                filter: "drop-shadow(0 0 24px rgba(181,48,26,0.9)) drop-shadow(0 4px 20px rgba(0,0,0,0.8))",
                borderRadius: "50%",
              }}
            />
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.6, ease: "easeOut" }}
            style={{
              marginTop: 28,
              fontSize: "clamp(13px, 3.5vw, 18px)",
              fontWeight: 700,
              color: "rgba(255,255,255,0.88)",
              fontFamily: "'Fredoka One', sans-serif",
              letterSpacing: "0.06em",
              textAlign: "center",
              textShadow: "0 0 20px rgba(181,48,26,0.6)",
              zIndex: 2,
              position: "relative",
              maxWidth: "80vw",
            }}
          >
            {tagline}
          </motion.p>

          {/* Pulsing loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            style={{
              display: "flex",
              gap: 8,
              marginTop: 32,
              zIndex: 2,
              position: "relative",
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.7, 1], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.22,
                  ease: "easeInOut",
                }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#b5301a",
                  boxShadow: "0 0 8px rgba(181,48,26,0.8)",
                }}
              />
            ))}
          </motion.div>

          {/* Sweep shimmer line */}
          <motion.div
            initial={{ x: "-120%", opacity: 0 }}
            animate={{ x: "220%", opacity: [0, 0.6, 0] }}
            transition={{ delay: 0.5, duration: 1.1, ease: "easeIn" }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "45%",
              height: "100%",
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)",
              pointerEvents: "none",
              zIndex: 5,
              transform: "skewX(-20deg)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
