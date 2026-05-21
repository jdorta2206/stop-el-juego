import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  durationMs?: number;
  delayMs?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

// Animates from 0 to `to` over `durationMs` using requestAnimationFrame.
// Uses easeOutCubic so it lands softly on the final number.
export function CountUp({
  to,
  durationMs = 1200,
  delayMs = 0,
  className,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const target = Math.round(to || 0);

  useEffect(() => {
    setVal(0);
    startRef.current = null;
    const start = performance.now() + delayMs;

    const tick = (now: number) => {
      if (now < start) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, delayMs]);

  return (
    <span className={className}>{prefix}{val.toLocaleString()}{suffix}</span>
  );
}
