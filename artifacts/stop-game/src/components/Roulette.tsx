import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { ALPHABET_ES } from "@/lib/utils";

interface RouletteProps {
  onSpinComplete: (letter: string) => void;
  isSpinning: boolean;
  targetLetter?: string;
}

// Vibrant color palette for wheel sectors - STOP brand colors
const SECTOR_COLORS = [
  "#e63012", // red
  "#1a237e", // dark blue
  "#f9a825", // yellow
  "#2e7d32", // green
  "#e63012",
  "#1a237e",
  "#f9a825",
  "#2e7d32",
  "#e63012",
  "#c62828", // darker red
  "#283593", // indigo
  "#f57f17", // amber
  "#1b5e20", // dark green
  "#b71c1c",
  "#1a237e",
  "#f9a825",
  "#2e7d32",
  "#e63012",
  "#1a237e",
  "#f9a825",
  "#2e7d32",
  "#e63012",
  "#1a237e",
  "#f9a825",
  "#2e7d32",
  "#e63012",
  "#1a237e",
];

function playTickSound(audioCtx: AudioContext, volume = 0.2) {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.05);
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.1);
}

function playWinSound(audioCtx: AudioContext) {
  const notes = [523, 659, 784, 1047]; // C, E, G, C5
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.3);
    osc.start(audioCtx.currentTime + i * 0.15);
    osc.stop(audioCtx.currentTime + i * 0.15 + 0.4);
  });
}

// Build SVG path for a pie slice
function buildSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
}

export function Roulette({ onSpinComplete, isSpinning, targetLetter }: RouletteProps) {
  const controls = useAnimationControls();
  const [displayLetter, setDisplayLetter] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rotationRef = useRef(0);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    if (!isSpinning || !targetLetter || isAnimating) return;
    setIsAnimating(true);

    const letters = ALPHABET_ES;
    const totalLetters = letters.length;
    const sliceAngle = 360 / totalLetters;
    const targetIndex = letters.indexOf(targetLetter);

    // 7 full spins + offset to land on target letter
    const currentRot = rotationRef.current % 360;
    const targetAngle = 360 - (targetIndex * sliceAngle + sliceAngle / 2);
    const normalizedTarget = ((targetAngle - currentRot) % 360 + 360) % 360;
    const totalRotation = rotationRef.current + 7 * 360 + normalizedTarget;
    rotationRef.current = totalRotation % 360;

    // Play tick sounds as wheel spins
    let tickCount = 0;
    const audioCtx = getAudioCtx();
    let lastTickTime = 0;

    const startTime = Date.now();
    const duration = 4500;

    const doTick = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Slow tick rate near end, fast at beginning
      const tickInterval = Math.max(30, 50 + progress * 400);
      if (Date.now() - lastTickTime > tickInterval) {
        const volume = Math.max(0.05, 0.25 * (1 - progress));
        playTickSound(audioCtx, volume);
        lastTickTime = Date.now();
        tickCount++;
      }

      if (elapsed < duration - 500) {
        tickIntervalRef.current = setTimeout(doTick, 16);
      }
    };
    tickIntervalRef.current = setTimeout(doTick, 16);

    controls.start({
      rotate: totalRotation,
      transition: {
        duration: 4.5,
        ease: [0.05, 0.4, 0.2, 1.0],
      }
    }).then(() => {
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
      playWinSound(audioCtx);
      setDisplayLetter(targetLetter);
      setTimeout(() => {
        setIsAnimating(false);
        onSpinComplete(targetLetter);
      }, 900);
    });

    return () => {
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
    };
  }, [isSpinning, targetLetter]);

  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = SIZE / 2 - 6;
  const letters = ALPHABET_ES;
  const sliceAngle = 360 / letters.length;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pointer */}
      <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-[#f9a825] drop-shadow-lg z-10" />

      {/* Wheel container */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, transparent 60%, rgba(249,168,37,0.3) 100%)",
            boxShadow: "0 0 30px rgba(249,168,37,0.4), 0 0 60px rgba(230,48,18,0.3)",
          }}
        />

        {/* The spinning SVG wheel */}
        <motion.svg
          animate={controls}
          initial={{ rotate: 0 }}
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}
        >
          {/* Border circle */}
          <circle cx={CX} cy={CY} r={R + 5} fill="#1a237e" />

          {/* Pie slices */}
          {letters.map((letter, i) => {
            const startAngle = i * sliceAngle - 90;
            const endAngle = (i + 1) * sliceAngle - 90;
            const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
            const textR = R * 0.72;
            const textX = CX + textR * Math.cos(midAngle);
            const textY = CY + textR * Math.sin(midAngle);
            const color = SECTOR_COLORS[i % SECTOR_COLORS.length];

            return (
              <g key={letter}>
                <path
                  d={buildSlicePath(CX, CY, R, startAngle, endAngle)}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontWeight="bold"
                  fontSize={sliceAngle > 12 ? "11" : "9"}
                  fontFamily="'Baloo 2', 'Nunito', sans-serif"
                  transform={`rotate(${(startAngle + endAngle) / 2 + 90}, ${textX}, ${textY})`}
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                >
                  {letter}
                </text>
              </g>
            );
          })}

          {/* Center decorative circles */}
          <circle cx={CX} cy={CY} r={36} fill="#1a237e" stroke="white" strokeWidth="3" />
          <circle cx={CX} cy={CY} r={28} fill="white" />
        </motion.svg>

        {/* Center STOP / letter display */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
          {displayLetter ? (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="w-14 h-14 rounded-full bg-[#1a237e] border-4 border-[#f9a825] flex items-center justify-center shadow-xl"
            >
              <span className="text-2xl font-black text-white leading-none">{displayLetter}</span>
            </motion.div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-white border-4 border-[#1a237e] flex items-center justify-center shadow-inner">
              <span
                className="text-xs font-black leading-none"
                style={{ color: "#e63012", fontFamily: "'Baloo 2', sans-serif" }}
              >
                STOP
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status text */}
      <motion.p
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-white/90 font-bold text-lg tracking-wide"
      >
        {isAnimating ? "¡Girando...!" : "¡Preparado!"}
      </motion.p>
    </div>
  );
}
