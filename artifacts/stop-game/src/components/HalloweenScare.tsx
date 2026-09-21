import { motion } from "framer-motion";

export type HalloweenScareId = "ghost" | "spider" | "skull" | "pumpkin" | "vampire";

export interface HalloweenScare {
  id: HalloweenScareId;
  emoji: string;
  title: string;
  text: string;
}

const SCARES: Record<string, HalloweenScare[]> = {
  es: [
    { id: "ghost", emoji: "👻", title: "¡BU!", text: "Algo te está mirando..." },
    { id: "spider", emoji: "🕷️", title: "¡CUIDADO!", text: "Hay algo en la pantalla..." },
    { id: "skull", emoji: "💀", title: "¡TE HE VISTO!", text: "No todas las palabras dan miedo." },
    { id: "pumpkin", emoji: "🎃", title: "LA CALABAZA TE OBSERVA", text: "Sigue jugando si te atreves." },
    { id: "vampire", emoji: "🧛", title: "¡EL VAMPIRO HA LLEGADO!", text: "Esta partida acaba de ponerse rara..." },
  ],
  en: [
    { id: "ghost", emoji: "👻", title: "BOO!", text: "Something is watching you..." },
    { id: "spider", emoji: "🕷️", title: "WATCH OUT!", text: "Something is on the screen..." },
    { id: "skull", emoji: "💀", title: "I SAW YOU!", text: "Not every word is scary." },
    { id: "pumpkin", emoji: "🎃", title: "THE PUMPKIN IS WATCHING", text: "Keep playing if you dare." },
    { id: "vampire", emoji: "🧛", title: "THE VAMPIRE ARRIVED!", text: "This game just got weird..." },
  ],
  pt: [
    { id: "ghost", emoji: "👻", title: "BUU!", text: "Alguém está a observar-te..." },
    { id: "spider", emoji: "🕷️", title: "CUIDADO!", text: "Há algo no ecrã..." },
    { id: "skull", emoji: "💀", title: "EU VI-TE!", text: "Nem todas as palavras assustam." },
    { id: "pumpkin", emoji: "🎃", title: "A ABÓBORA OBSERVA-TE", text: "Continua se tiveres coragem." },
    { id: "vampire", emoji: "🧛", title: "O VAMPIRO CHEGOU!", text: "Esta partida ficou estranha..." },
  ],
  fr: [
    { id: "ghost", emoji: "👻", title: "BOUH !", text: "Quelqu'un te regarde..." },
    { id: "spider", emoji: "🕷️", title: "ATTENTION !", text: "Il y a quelque chose à l'écran..." },
    { id: "skull", emoji: "💀", title: "JE T'AI VU !", text: "Tous les mots ne font pas peur." },
    { id: "pumpkin", emoji: "🎃", title: "LA CITROUILLE TE REGARDE", text: "Continue si tu l'oses." },
    { id: "vampire", emoji: "🧛", title: "LE VAMPIRE EST ARRIVÉ !", text: "Cette partie devient étrange..." },
  ],
};

export function getHalloweenScare(lang: string, seed = Math.random()): HalloweenScare {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = SCARES[key];
  return list[Math.floor(Math.max(0, Math.min(0.999999, seed)) * list.length)];
}

export function HalloweenScareOverlay({ scare, onDone }: { scare: HalloweenScare; onDone?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.72, rotate: -4 }}
      animate={{ opacity: 1, scale: [1, 1.04, 1], rotate: [0, 2, -1, 0] }}
      exit={{ opacity: 0, scale: 1.12 }}
      transition={{ duration: 0.45 }}
      onClick={onDone}
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: "rgba(0,0,0,0.76)", backdropFilter: "blur(3px)" }}
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center select-none">
        <motion.div
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.7, repeat: 2 }}
          className="text-[7rem] sm:text-[10rem] leading-none drop-shadow-[0_0_35px_rgba(168,85,247,0.7)]"
        >
          {scare.emoji}
        </motion.div>
        <p className="mt-5 text-3xl sm:text-5xl font-black text-white tracking-tight">{scare.title}</p>
        <p className="mt-2 text-sm sm:text-lg font-bold text-white/70">{scare.text}</p>
        <p className="mt-6 text-[10px] uppercase tracking-[0.25em] text-white/35">Halloween 2026</p>
      </div>
    </motion.div>
  );
}
