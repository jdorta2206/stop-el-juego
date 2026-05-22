import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2, Share2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CLIP GENERATOR  v2 — viral output
// 9:16 vertical canvas (720x1280) rendered to PNG or short MP4/webm via
// MediaRecorder.  Designed as raw material for TikTok / Reels / Shorts: meme
// headline hook, dramatic zoom punches, confetti on score reveal, final
// "¿PUEDES GANARME?" CTA card.  All client-side, no server, no audio (TikTok
// users mute scroll-by previews and remix with trending sounds anyway).
// ─────────────────────────────────────────────────────────────────────────────

export interface ClipEntry {
  category: string;
  word: string;
  score: number;
}

export interface ClipContext {
  /** "solo" (player vs AI/practice), "multi" (room vs friends), "impossible"
   *  (daily challenge).  Controls headline tone. */
  mode?: "solo" | "multi" | "impossible";
  /** For impossible mode: did the player solve it? */
  impossibleWin?: boolean;
  /** For multi: 1-indexed final position. */
  rank?: number;
  totalPlayers?: number;
  /** Best opponent score (multi or solo-vs-AI) for "humiliated by …" copy. */
  opponentBestScore?: number;
}

export interface ClipGeneratorProps {
  open: boolean;
  onClose: () => void;
  playerName: string;
  letter: string;
  entries: ClipEntry[];
  totalScore: number;
  language?: string;
  context?: ClipContext;
  onShared?: () => void;
}

const W = 720;
const H = 1280;
// 10.5 s timeline + 0.5 s hold on final frame.
const DURATION_MS = 10500;
const FPS = 30;

const PALETTE = {
  bgTop:    "#1a0f2e",
  bgBottom: "#2d1b4e",
  accent:   "#fbbf24",
  accent2:  "#f59e0b",
  good:     "#22c55e",
  bad:      "#ef4444",
  text:     "#ffffff",
  muted:    "rgba(255,255,255,0.65)",
  cta:      "#ec4899",
};

// ── Headlines + copy (per language, per outcome) ────────────────────────────
type Lang = "es" | "en" | "pt" | "fr";

interface Copy {
  brand: string;
  letterLabel: string;
  pts: string;
  cta: string;            // big final card text
  ctaSub: string;         // small URL sub-line
  tagline: string;        // bottom watermark during clip
  subtitleHook: string;
  subtitleLetter: string;
  subtitleCats: string;
  subtitleScore: string;
  subtitleCta: string;
  // share button labels
  shareTitle: string; downloadImg: string; generateVideo: string;
  rendering: string; share: string; close: string;
  recordingHint: string; notSupported: string;
}

const STRINGS: Record<Lang, Copy> = {
  es: {
    brand: "STOP", letterLabel: "LETRA", pts: "pts",
    cta: "¿PUEDES\nGANARME?", ctaSub: "stopjuegodepalabras.com",
    tagline: "stopjuegodepalabras.com",
    subtitleHook: "Esto pasó en mi partida 👇",
    subtitleLetter: "Con esta letra…",
    subtitleCats: "Estas fueron mis respuestas",
    subtitleScore: "PUNTUACIÓN FINAL",
    subtitleCta: "Te reto a superarme 👆",
    shareTitle: "¡Mira mi partida en STOP!",
    downloadImg: "Descargar imagen", generateVideo: "Compartir vídeo en TikTok / Reels",
    rendering: "Generando vídeo…", share: "Compartir", close: "Cerrar",
    recordingHint: "Tarda ~12 s · luego elige TikTok, Reels, Instagram…",
    notSupported: "Tu navegador no permite grabar vídeo · usa la imagen",
  },
  en: {
    brand: "STOP", letterLabel: "LETTER", pts: "pts",
    cta: "CAN YOU\nBEAT ME?", ctaSub: "stopjuegodepalabras.com",
    tagline: "stopjuegodepalabras.com",
    subtitleHook: "This is what happened 👇",
    subtitleLetter: "With this letter…",
    subtitleCats: "These were my answers",
    subtitleScore: "FINAL SCORE",
    subtitleCta: "Bet you can't beat me 👆",
    shareTitle: "Look at my STOP game!",
    downloadImg: "Download image", generateVideo: "Share video to TikTok / Reels",
    rendering: "Generating video…", share: "Share", close: "Close",
    recordingHint: "Takes ~12 s · then pick TikTok, Reels, Instagram…",
    notSupported: "Your browser can't record video · use the image",
  },
  pt: {
    brand: "STOP", letterLabel: "LETRA", pts: "pts",
    cta: "CONSEGUES\nGANHAR-ME?", ctaSub: "stopjuegodepalabras.com",
    tagline: "stopjuegodepalabras.com",
    subtitleHook: "Olha o que aconteceu 👇",
    subtitleLetter: "Com esta letra…",
    subtitleCats: "Estas foram as minhas respostas",
    subtitleScore: "PONTUAÇÃO FINAL",
    subtitleCta: "Tenta superar-me 👆",
    shareTitle: "Vê a minha partida no STOP!",
    downloadImg: "Descarregar imagem", generateVideo: "Partilhar vídeo no TikTok / Reels",
    rendering: "A gerar vídeo…", share: "Partilhar", close: "Fechar",
    recordingHint: "Demora ~12 s · depois escolhe TikTok, Reels, Instagram…",
    notSupported: "O teu browser não grava vídeo · usa a imagem",
  },
  fr: {
    brand: "STOP", letterLabel: "LETTRE", pts: "pts",
    cta: "TU PEUX\nME BATTRE ?", ctaSub: "stopjuegodepalabras.com",
    tagline: "stopjuegodepalabras.com",
    subtitleHook: "Voici ce qui s'est passé 👇",
    subtitleLetter: "Avec cette lettre…",
    subtitleCats: "Voici mes réponses",
    subtitleScore: "SCORE FINAL",
    subtitleCta: "Essaie de me battre 👆",
    shareTitle: "Regarde ma partie STOP !",
    downloadImg: "Télécharger l'image", generateVideo: "Partager la vidéo sur TikTok / Reels",
    rendering: "Génération de la vidéo…", share: "Partager", close: "Fermer",
    recordingHint: "~12 s · ensuite choisis TikTok, Reels, Instagram…",
    notSupported: "Ton navigateur ne grave pas la vidéo · utilise l'image",
  },
};

// Headline picker — punchy meme-style copy based on result.  Returns an
// array because some outcomes look better with a two-line stack
// (hook + emoji punchline).
function pickHeadline(
  lang: Lang,
  totalScore: number,
  entries: ClipEntry[],
  ctx?: ClipContext,
): { lines: string[]; tone: "win" | "loss" | "neutral" | "wow" } {
  const validCount = entries.filter(e => e.score > 0).length;
  const has100 = totalScore >= 100;
  const has50 = totalScore >= 50;
  const has0 = totalScore <= 5;

  const L = {
    es: {
      impWin:   ["YO RESOLVÍ", "LA PALABRA\nIMPOSIBLE 💀"],
      impLoss:  ["NO PUDE CON", "LA PALABRA\nIMPOSIBLE 😭"],
      multiW:   ["LOS DESTROCÉ", `${totalScore} pts 👑`],
      multiL:   ["ME HUMILLARON", `con ${totalScore} pts 💀`],
      perfect:  ["PARTIDA", "PERFECTA 🔥"],
      high:     [`${totalScore} PUNTOS`, "en una sola letra 🤯"],
      mid:      ["MI PARTIDA", "EN STOP"],
      low:      ["HICE", `${totalScore} pts 😂`],
      zero:     ["ME QUEDÉ EN", "BLANCO 💀"],
    },
    en: {
      impWin:   ["I SOLVED THE", "IMPOSSIBLE\nWORD 💀"],
      impLoss:  ["I COULDN'T DO", "THE IMPOSSIBLE\nWORD 😭"],
      multiW:   ["I CRUSHED", `THEM · ${totalScore} pts 👑`],
      multiL:   ["I GOT", `HUMILIATED · ${totalScore} 💀`],
      perfect:  ["PERFECT", "GAME 🔥"],
      high:     [`${totalScore} POINTS`, "in one letter 🤯"],
      mid:      ["MY STOP", "GAME"],
      low:      ["I SCORED", `${totalScore} pts 😂`],
      zero:     ["I CHOKED", "HARD 💀"],
    },
    pt: {
      impWin:   ["EU RESOLVI A", "PALAVRA\nIMPOSSÍVEL 💀"],
      impLoss:  ["NÃO CONSEGUI", "A PALAVRA\nIMPOSSÍVEL 😭"],
      multiW:   ["DESTRUÍ TODOS", `${totalScore} pts 👑`],
      multiL:   ["FUI HUMILHADO", `com ${totalScore} pts 💀`],
      perfect:  ["PARTIDA", "PERFEITA 🔥"],
      high:     [`${totalScore} PONTOS`, "numa letra só 🤯"],
      mid:      ["A MINHA", "PARTIDA"],
      low:      ["FIZ", `${totalScore} pts 😂`],
      zero:     ["FIQUEI EM", "BRANCO 💀"],
    },
    fr: {
      impWin:   ["J'AI RÉSOLU LE", "MOT\nIMPOSSIBLE 💀"],
      impLoss:  ["JE N'AI PAS PU", "AVEC LE MOT\nIMPOSSIBLE 😭"],
      multiW:   ["JE LES AI", `ÉCRASÉS · ${totalScore} 👑`],
      multiL:   ["ILS M'ONT", `HUMILIÉ · ${totalScore} 💀`],
      perfect:  ["PARTIE", "PARFAITE 🔥"],
      high:     [`${totalScore} POINTS`, "en une lettre 🤯"],
      mid:      ["MA PARTIE", "STOP"],
      low:      ["J'AI FAIT", `${totalScore} pts 😂`],
      zero:     ["J'AI FAIT", "ZÉRO 💀"],
    },
  } as const;
  const dict = L[lang] ?? L.es;

  if (ctx?.mode === "impossible") {
    return ctx.impossibleWin
      ? { lines: [...dict.impWin], tone: "wow" }
      : { lines: [...dict.impLoss], tone: "loss" };
  }
  if (ctx?.mode === "multi" && ctx?.rank != null) {
    if (ctx.rank === 1) return { lines: [...dict.multiW], tone: "win" };
    if (ctx.totalPlayers && ctx.rank === ctx.totalPlayers) return { lines: [...dict.multiL], tone: "loss" };
  }
  if (validCount >= 8 && has100) return { lines: [...dict.perfect], tone: "wow" };
  if (has100) return { lines: [...dict.high], tone: "win" };
  if (has0)   return { lines: [...dict.zero], tone: "loss" };
  if (has50)  return { lines: [...dict.mid], tone: "neutral" };
  return { lines: [...dict.low], tone: "loss" };
}

// ── Easing / math ───────────────────────────────────────────────────────────
function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── Timeline acts ───────────────────────────────────────────────────────────
const ACTS = {
  hook:    { start: 0,    end: 2200 },   // headline punch-in
  letter:  { start: 2200, end: 3700 },   // letter zoom
  cats:    { start: 3700, end: 7700 },   // categories cascade
  score:   { start: 7700, end: 9200 },   // final score + confetti
  cta:     { start: 9200, end: 10500 },  // call-to-action card
};
function actProgress(tMs: number, act: { start: number; end: number }) {
  return clamp01((tMs - act.start) / (act.end - act.start));
}
// Visibility for an act with a short fade-out tail so frames don't pile up
// when the next act begins.  Returns 0 before start, 1 during the act, then
// linearly fades to 0 within `fadeMs` after `act.end`.
function actAlpha(tMs: number, act: { start: number; end: number }, fadeMs = 350): number {
  if (tMs < act.start) return 0;
  if (tMs <= act.end) return 1;
  return clamp01(1 - (tMs - act.end) / fadeMs);
}

// ── Particles (confetti) ────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; size: number }
function makeConfetti(seed = 0): Particle[] {
  const colors = ["#fbbf24", "#f59e0b", "#ef4444", "#22c55e", "#a855f7", "#ec4899", "#3b82f6"];
  const arr: Particle[] = [];
  // Pseudo-random so we get the same confetti every render (preview <> recording).
  let s = seed || 9301;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 60; i++) {
    arr.push({
      x: rng() * W,
      y: -50 - rng() * 200,
      vx: (rng() - 0.5) * 180,
      vy: 220 + rng() * 220,
      rot: rng() * Math.PI * 2,
      vr: (rng() - 0.5) * 8,
      color: colors[Math.floor(rng() * colors.length)],
      size: 6 + rng() * 10,
    });
  }
  return arr;
}

function drawConfetti(ctx: CanvasRenderingContext2D, particles: Particle[], localMs: number) {
  const t = localMs / 1000;
  ctx.save();
  for (const p of particles) {
    const x = p.x + p.vx * t;
    const y = p.y + p.vy * t + 0.5 * 600 * t * t * 0.5; // mild gravity
    const rot = p.rot + p.vr * t;
    if (y > H + 40) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  ctx.restore();
}

// ── Drawing primitives ──────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Auto-fit large text to a max width by shrinking the font size.
function fitText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number,
  baseFont: string, baseSize: number, minSize = 28,
): number {
  let size = baseSize;
  ctx.font = `${baseFont.replace("{px}", String(size))}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = `${baseFont.replace("{px}", String(size))}`;
  }
  return size;
}

function drawBackground(ctx: CanvasRenderingContext2D, tMs: number) {
  const drift = (Math.sin(tMs / 1500) + 1) * 0.5;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(0.5 + drift * 0.1, "#3b1e6e");
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft floating blobs.
  for (let i = 0; i < 12; i++) {
    const x = (i * 137 + tMs * 0.03) % (W + 200) - 100;
    const y = (i * 211 + tMs * 0.05) % (H + 200) - 100;
    const r = 50 + ((i * 17) % 40);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,193,7,${0.06 + (i % 3) * 0.02})`);
    grad.addColorStop(1, "rgba(255,193,7,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Bottom subtitle bar — dynamic copy per act, persistent presence.
function drawSubtitle(ctx: CanvasRenderingContext2D, text: string, tMs: number) {
  if (!text) return;
  const pulse = 0.85 + 0.15 * Math.sin(tMs / 220);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 60, H - 220, W - 120, 70, 35);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 30px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = pulse;
  ctx.fillText(text, W / 2, H - 185);
  ctx.restore();
}

// Persistent watermark / handle at very bottom.
function drawTagline(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  roundRect(ctx, 100, H - 90, W - 200, 56, 28);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 26px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎮 " + text, W / 2, H - 62);
  ctx.restore();
}

// ACT 1 — Hook: meme headline punching in with zoom + shake.
function drawHook(
  ctx: CanvasRenderingContext2D, tMs: number,
  headline: { lines: string[]; tone: string }, copy: Copy,
) {
  const p = actProgress(tMs, ACTS.hook);
  if (p <= 0) return;
  const fade = actAlpha(tMs, ACTS.hook);
  if (fade <= 0) return;

  // Punch-in: scale from 0.3 to 1.05 then settle to 1.0.
  let scale: number;
  if (p < 0.25) scale = lerp(0.3, 1.15, easeOutBack(p / 0.25));
  else if (p < 0.45) scale = lerp(1.15, 1.0, (p - 0.25) / 0.2);
  else scale = 1.0;

  // Micro shake on impact.
  const shake = p < 0.3 ? Math.sin(p * 80) * 6 * (1 - p / 0.3) : 0;

  // Tone-coded accent ribbon
  const toneColor = headline.tone === "win" ? PALETTE.good
    : headline.tone === "loss" ? PALETTE.bad
    : headline.tone === "wow" ? PALETTE.accent
    : PALETTE.cta;

  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.translate(W / 2 + shake, 360);
  ctx.scale(scale, scale);

  // Brand chip
  ctx.fillStyle = toneColor;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, -110, -270, 220, 70, 35);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "#0d1757";
  ctx.font = `900 48px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(copy.brand, 0, -235);

  // Headline lines — auto-fit each
  const lines = headline.lines.flatMap(l => l.split("\n"));
  let y = -100;
  for (const line of lines) {
    const size = fitText(ctx, line, W - 120, `900 {px}px "Baloo 2", system-ui, sans-serif`, 96, 56);
    ctx.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`;
    ctx.fillStyle = PALETTE.text;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillText(line, 0, y);
    y += size + 14;
  }
  ctx.restore();
}

// ACT 2 — Letter dramatic zoom.
function drawLetter(ctx: CanvasRenderingContext2D, tMs: number, letter: string, copy: Copy) {
  const p = actProgress(tMs, ACTS.letter);
  if (p <= 0) return;
  const fade = actAlpha(tMs, ACTS.letter);
  if (fade <= 0) return;
  const opacity = clamp01(p / 0.2) * fade;
  // Dramatic zoom: starts at 0.5 → overshoots 1.2 → settles 1.0.
  let scale: number;
  if (p < 0.35) scale = lerp(0.5, 1.25, easeOutBack(p / 0.35));
  else if (p < 0.55) scale = lerp(1.25, 1.0, (p - 0.35) / 0.2);
  else scale = 1.0;
  // Slow rotation kiss for drama
  const rot = Math.sin(p * Math.PI) * 0.08;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(W / 2, 540);
  ctx.scale(scale, scale);
  ctx.rotate(rot);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `800 36px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(copy.letterLabel, 0, -200);

  const chipR = 170;
  const grad = ctx.createLinearGradient(0, -chipR, 0, chipR);
  grad.addColorStop(0, PALETTE.accent);
  grad.addColorStop(1, PALETTE.accent2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(245,158,11,0.65)";
  ctx.shadowBlur = 60;
  ctx.beginPath();
  ctx.arc(0, 0, chipR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#0d1757";
  ctx.font = `900 260px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(letter.toUpperCase(), 0, 10);
  ctx.restore();
}

// ACT 3 — Category rows cascading in with score punch.
function drawEntries(ctx: CanvasRenderingContext2D, tMs: number, entries: ClipEntry[]) {
  const p = actProgress(tMs, ACTS.cats);
  if (p <= 0) return;
  const fade = actAlpha(tMs, ACTS.cats);
  if (fade <= 0) return;
  const list = entries.slice(0, 4);
  const localStart = ACTS.cats.start;
  const rowMs = (ACTS.cats.end - ACTS.cats.start - 600) / Math.max(list.length, 1);
  const startY = 420;
  const rowH = 130;

  list.forEach((e, i) => {
    const rowT = localStart + i * rowMs;
    if (tMs < rowT) return;
    const rp = clamp01((tMs - rowT) / 500);
    const y = startY + i * rowH;
    const slide = (1 - easeOutCubic(rp)) * 120;
    const punch = rp < 0.3 ? 1 + (1 - rp / 0.3) * 0.15 : 1;

    ctx.save();
    ctx.globalAlpha *= rp * fade;
    ctx.translate(slide, 0);
    ctx.translate(W / 2, y);
    ctx.scale(punch, punch);
    ctx.translate(-W / 2, -y);

    // Row background
    const rowGrad = ctx.createLinearGradient(50, 0, W - 50, 0);
    rowGrad.addColorStop(0, "rgba(255,255,255,0.12)");
    rowGrad.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = rowGrad;
    roundRect(ctx, 50, y - 50, W - 100, 100, 22);
    ctx.fill();

    // Category label
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 26px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(e.category, 26).toUpperCase(), 80, y - 18);

    // Word — auto-fit
    const wordColor = e.score >= 10 ? PALETTE.good : e.score >= 5 ? PALETTE.accent : PALETTE.bad;
    ctx.fillStyle = wordColor;
    const size = fitText(ctx, e.word || "—", W - 260, `900 {px}px "Baloo 2", system-ui, sans-serif`, 46, 28);
    ctx.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`;
    ctx.fillText(truncate(e.word || "—", 26), 80, y + 22);

    // Points pill — count-up animation
    const pointsT = clamp01((rp - 0.3) / 0.5);
    const shown = Math.round(e.score * easeOutCubic(pointsT));
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `900 42px "Baloo 2", system-ui, sans-serif`;
    ctx.fillText(e.score > 0 ? `+${shown}` : "0", W - 80, y);

    ctx.restore();
  });
}

// ACT 4 — Final total score with confetti.
function drawScore(
  ctx: CanvasRenderingContext2D, tMs: number,
  totalScore: number, playerName: string, copy: Copy, confetti: Particle[],
) {
  const p = actProgress(tMs, ACTS.score);
  if (p <= 0) return;
  const fade = actAlpha(tMs, ACTS.score);
  if (fade <= 0) return;
  const local = tMs - ACTS.score.start;

  // Centerpiece: huge score with bounce
  const scale = p < 0.3 ? easeOutBack(p / 0.3) : 1 + Math.sin((p - 0.3) * 12) * 0.03 * Math.max(0, 1 - (p - 0.3) * 4);

  ctx.save();
  ctx.globalAlpha *= fade;
  // Dim background ever so slightly for focus
  ctx.fillStyle = `rgba(0,0,0,${0.25 * clamp01(p * 3) * fade})`;
  ctx.fillRect(0, 0, W, H);

  ctx.translate(W / 2, H / 2 - 80);
  ctx.scale(scale, scale);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = `800 34px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncate(playerName, 22), 0, -180);

  ctx.fillStyle = PALETTE.accent;
  ctx.font = `900 78px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(copy.subtitleScore, 0, -100);

  // Count-up score
  const shown = Math.round(totalScore * easeOutCubic(clamp01(p / 0.5)));
  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 260px "Baloo 2", system-ui, sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillText(String(shown), 0, 60);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 38px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(copy.pts.toUpperCase(), 0, 200);
  ctx.restore();

  // Confetti starts the moment the score appears.
  drawConfetti(ctx, confetti, local);
}

// ACT 5 — CTA card.  Full-screen "¿PUEDES GANARME?" + URL.
function drawCta(ctx: CanvasRenderingContext2D, tMs: number, copy: Copy) {
  const p = actProgress(tMs, ACTS.cta);
  if (p <= 0) return;
  const opacity = easeInOutCubic(clamp01(p / 0.3));

  // Full-screen tinted overlay
  ctx.save();
  ctx.fillStyle = `rgba(13,4,32,${opacity * 0.92})`;
  ctx.fillRect(0, 0, W, H);

  // Big CTA text — multi-line
  const scale = lerp(0.85, 1.0, easeOutBack(clamp01(p / 0.35)));
  ctx.translate(W / 2, H / 2 - 80);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;

  const lines = copy.cta.split("\n");
  let y = -90;
  for (const line of lines) {
    const size = fitText(ctx, line, W - 100, `900 {px}px "Baloo 2", system-ui, sans-serif`, 130, 70);
    ctx.font = `900 ${size}px "Baloo 2", system-ui, sans-serif`;
    ctx.fillStyle = PALETTE.accent;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(line, 0, y);
    y += size + 8;
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // URL pill
  const pillY = y + 80;
  ctx.fillStyle = PALETTE.cta;
  roundRect(ctx, -260, pillY - 40, 520, 80, 40);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 36px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText("🎮 " + copy.ctaSub, 0, pillY);
  ctx.restore();
}

function subtitleFor(tMs: number, copy: Copy): string {
  if (tMs < ACTS.letter.start) return copy.subtitleHook;
  if (tMs < ACTS.cats.start) return copy.subtitleLetter;
  if (tMs < ACTS.score.start) return copy.subtitleCats;
  if (tMs < ACTS.cta.start) return copy.subtitleScore;
  return copy.subtitleCta;
}

// Master draw — composites every act for a given timestamp.
function drawFrame(
  ctx: CanvasRenderingContext2D,
  tMs: number,
  data: {
    letter: string; entries: ClipEntry[]; totalScore: number; playerName: string;
    headline: { lines: string[]; tone: string }; confetti: Particle[];
  },
  copy: Copy,
) {
  drawBackground(ctx, tMs);
  drawHook(ctx, tMs, data.headline, copy);
  drawLetter(ctx, tMs, data.letter, copy);
  drawEntries(ctx, tMs, data.entries);
  drawScore(ctx, tMs, data.totalScore, data.playerName, copy, data.confetti);
  drawCta(ctx, tMs, copy);

  // Subtitle + tagline hide during CTA (CTA replaces them).
  if (tMs < ACTS.cta.start) {
    drawSubtitle(ctx, subtitleFor(tMs, copy), tMs);
    drawTagline(ctx, copy.tagline);
  }
}

// ── Component ───────────────────────────────────────────────────────────────
export function ClipGenerator(props: ClipGeneratorProps) {
  const { open, onClose, playerName, letter, entries, totalScore, language = "es", context, onShared } = props;
  const lang = (["es", "en", "pt", "fr"].includes(language) ? language : "es") as Lang;
  const copy = STRINGS[lang];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const cancelRef = useRef<boolean>(false);
  const recRafRef = useRef<number | null>(null);
  const recTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const [rendering, setRendering] = useState(false);

  // Stable per-open data — headline + confetti seed shouldn't change on re-render.
  const dataRef = useRef<{
    headline: { lines: string[]; tone: string };
    confetti: Particle[];
  } | null>(null);
  if (open && !dataRef.current) {
    dataRef.current = {
      headline: pickHeadline(lang, totalScore, entries, context),
      confetti: makeConfetti(totalScore + entries.length + letter.charCodeAt(0)),
    };
  }
  useEffect(() => { if (!open) dataRef.current = null; }, [open]);

  const canRecord = typeof window !== "undefined"
    && "MediaRecorder" in window
    && typeof (HTMLCanvasElement.prototype as any).captureStream === "function";

  // Preview loop
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    startRef.current = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) % (DURATION_MS + 1500);
      const data = dataRef.current;
      if (data) drawFrame(ctx, Math.min(elapsed, DURATION_MS), {
        letter, entries, totalScore, playerName,
        headline: data.headline, confetti: data.confetti,
      }, copy);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [open, letter, entries, totalScore, playerName, copy]);

  // Cancellation when modal closes
  useEffect(() => {
    if (open) { cancelRef.current = false; return; }
    cancelRef.current = true;
    if (recRafRef.current != null) cancelAnimationFrame(recRafRef.current);
    if (recTimeoutRef.current != null) clearTimeout(recTimeoutRef.current);
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch { /* noop */ }
    recStreamRef.current?.getTracks().forEach(tr => { try { tr.stop(); } catch { /* noop */ } });
    recRafRef.current = null;
    recTimeoutRef.current = null;
    recorderRef.current = null;
    recStreamRef.current = null;
  }, [open]);

  if (!open) return null;

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const shareOrDownload = async (blob: Blob, name: string, mime: string) => {
    const file = new File([blob], name, { type: mime });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: copy.shareTitle, text: copy.shareTitle });
        onShared?.();
        return;
      } catch { /* fall through */ }
    }
    downloadFile(blob, name);
    onShared?.();
  };

  // For the static PNG, freeze the SCORE frame — that's the most shareable
  // single image (big number + name + confetti caught mid-air).
  const handleDownloadImage = async () => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const data = dataRef.current;
    if (!data) return;
    // Pick a frame ~1.4s into the score act: by then the entries have faded
    // (fade-out at ACTS.cats.end + 350ms ≈ 8050ms) and only the score card
    // + confetti remain — perfect single-frame still for sharing.
    const frameMs = ACTS.score.start + 1400;
    drawFrame(ctx, frameMs, {
      letter, entries, totalScore, playerName,
      headline: data.headline, confetti: data.confetti,
    }, copy);
    c.toBlob(async (blob) => {
      if (!blob) return;
      await shareOrDownload(blob, `stop-${letter}-${totalScore}.png`, "image/png");
    }, "image/png", 0.95);
  };

  const handleGenerateVideo = async () => {
    if (!canRecord) return;
    cancelRef.current = false;
    setRendering(true);
    let stream: MediaStream | null = null;
    try {
      const rec = document.createElement("canvas");
      rec.width = W; rec.height = H;
      const ctx = rec.getContext("2d");
      if (!ctx) return;
      const data = dataRef.current;
      if (!data) return;
      stream = (rec as any).captureStream(FPS) as MediaStream;
      recStreamRef.current = stream;

      const candidates = [
        "video/mp4;codecs=h264", "video/mp4",
        "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
        "",
      ];
      let recorder: MediaRecorder | null = null;
      let mime = "";
      for (const m of candidates) {
        try {
          if (m && (window as any).MediaRecorder?.isTypeSupported && !(window as any).MediaRecorder.isTypeSupported(m)) continue;
          recorder = m
            ? new MediaRecorder(stream, { mimeType: m, videoBitsPerSecond: 5_000_000 })
            : new MediaRecorder(stream, { videoBitsPerSecond: 5_000_000 });
          mime = recorder.mimeType || m || "video/webm";
          break;
        } catch { /* try next */ }
      }
      if (!recorder) return;
      recorderRef.current = recorder;
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => {
        recorder!.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      recorder.start();
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (cancelRef.current) { resolve(); return; }
          const tMs = performance.now() - t0;
          drawFrame(ctx, Math.min(tMs, DURATION_MS), {
            letter, entries, totalScore, playerName,
            headline: data.headline, confetti: data.confetti,
          }, copy);
          if (tMs >= DURATION_MS) { resolve(); return; }
          recRafRef.current = requestAnimationFrame(tick);
        };
        recRafRef.current = requestAnimationFrame(tick);
      });
      if (cancelRef.current) return;
      await new Promise<void>(r => { recTimeoutRef.current = setTimeout(() => r(), 800); });
      if (cancelRef.current) return;

      try { recorder.stop(); } catch { /* noop */ }
      const blob = await done;
      if (cancelRef.current) return;
      await shareOrDownload(blob, `stop-${letter}-${totalScore}.${ext}`, mime);
    } finally {
      stream?.getTracks().forEach(tr => { try { tr.stop(); } catch { /* noop */ } });
      recStreamRef.current = null;
      recorderRef.current = null;
      recRafRef.current = null;
      recTimeoutRef.current = null;
      setRendering(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          className="relative w-full max-w-sm flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label={copy.close}
            className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="rounded-3xl overflow-hidden mx-auto shadow-2xl"
            style={{ aspectRatio: `${W} / ${H}`, width: "100%", maxWidth: 340, background: "#0d0420" }}>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </div>

          <p className="text-center text-white/55 text-xs px-4">{copy.recordingHint}</p>

          <div className="flex flex-col gap-2">
            {canRecord ? (
              <button
                onClick={handleGenerateVideo}
                disabled={rendering}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white disabled:opacity-60 text-base"
                style={{ background: "linear-gradient(135deg, #ec4899, #a855f7, #4f46e5)", boxShadow: "0 10px 30px rgba(168,85,247,0.4)" }}
              >
                {rendering ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {copy.rendering}</>
                ) : (
                  <><Share2 className="w-5 h-5" /> {copy.generateVideo}</>
                )}
              </button>
            ) : (
              <p className="text-center text-white/60 text-xs px-2">{copy.notSupported}</p>
            )}

            <button
              onClick={handleDownloadImage}
              disabled={rendering}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm disabled:opacity-50"
              style={{ background: "rgba(251,191,36,0.18)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }}
            >
              <Download className="w-4 h-4" /> {copy.downloadImg}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
