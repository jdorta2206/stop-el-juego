import { useState, useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { ALPHABET_ES, cn } from "@/lib/utils";

interface RouletteProps {
  onSpinComplete: (letter: string) => void;
  isSpinning: boolean;
  targetLetter?: string;
}

export function Roulette({ onSpinComplete, isSpinning, targetLetter }: RouletteProps) {
  const controls = useAnimationControls();
  const [currentLetter, setCurrentLetter] = useState("?");
  const [hasSpun, setHasSpun] = useState(false);

  useEffect(() => {
    if (isSpinning && targetLetter) {
      setHasSpun(true);
      const targetIndex = ALPHABET_ES.indexOf(targetLetter);
      const sliceAngle = 360 / ALPHABET_ES.length;
      
      // Calculate target rotation:
      // 5 full spins + rotate to specific index (offset by 90deg so it points up)
      const baseRotation = 360 * 5; 
      const targetRotation = baseRotation - (targetIndex * sliceAngle);

      // Fast updating letter in the middle
      const interval = setInterval(() => {
        setCurrentLetter(ALPHABET_ES[Math.floor(Math.random() * ALPHABET_ES.length)]);
      }, 50);

      controls.start({
        rotate: targetRotation,
        transition: { duration: 4, ease: [0.2, 0.8, 0.2, 1] } // Custom easing for spin effect
      }).then(() => {
        clearInterval(interval);
        setCurrentLetter(targetLetter);
        setTimeout(() => onSpinComplete(targetLetter), 800);
      });

      return () => clearInterval(interval);
    }
  }, [isSpinning, targetLetter, controls, onSpinComplete]);

  return (
    <div className="relative w-64 h-64 mx-auto my-8">
      {/* Pointer Triangle */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 drop-shadow-md">
        <div className="w-0 h-0 border-l-[16px] border-r-[16px] border-t-[24px] border-l-transparent border-r-transparent border-t-secondary" />
      </div>

      {/* The Wheel */}
      <motion.div 
        animate={controls}
        initial={{ rotate: 0 }}
        className="w-full h-full rounded-full border-8 border-primary shadow-2xl relative overflow-hidden bg-white"
      >
        {ALPHABET_ES.map((letter, i) => {
          const sliceAngle = 360 / ALPHABET_ES.length;
          const rotation = i * sliceAngle;
          const isEven = i % 2 === 0;
          
          return (
            <div
              key={letter}
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1/2 origin-bottom flex justify-center pt-2 font-display font-bold text-sm",
                isEven ? "bg-primary text-white" : "bg-card text-white"
              )}
              style={{ 
                transform: `translateX(-50%) rotate(${rotation}deg)`,
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                width: `${Math.tan((sliceAngle / 2) * (Math.PI / 180)) * 100 * 2}%`
              }}
            >
              <span className="-rotate-90 origin-center translate-y-2 inline-block">{letter}</span>
            </div>
          );
        })}
      </motion.div>

      {/* Center Circle showing current letter */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-full border-4 border-primary z-10 flex items-center justify-center shadow-inner">
        <span className="text-4xl font-display font-bold text-primary">
          {hasSpun ? currentLetter : "STOP"}
        </span>
      </div>
    </div>
  );
}
