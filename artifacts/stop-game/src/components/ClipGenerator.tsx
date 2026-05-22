import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Video, Loader2, Share2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CLIP GENERATOR
// Renders the player's game result as an animated 9:16 vertical canvas so it
// can be:
//   1) Downloaded as a static PNG "story card" (instant, works everywhere)
//   2) Recorded as a short (~8 s) video via MediaRecorder + canvas.captureStream
//      (Chrome/Firefox/Edge/Android Safari 14.1+).  Degrades gracefully to
//      PNG-only on browsers without MediaRecorder support.
//   3) Shared via the Web Share API (mobile) when files can be shared.
//
// All client-side — no server, no ffmpeg, no object storage.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClipEntry {
  category: string;
  word: string;
  score: number;
}

export interface ClipGeneratorProps {
  open: boolean;
  onClose: () => void;
  playerName: string;
  letter: string;
  entries: ClipEntry[];         // top categories + words
  totalScore: number;
  language?: string;
  /** Fires once whenever the user successfully downloads or shares. */
  onShared?: () => void;
}

const W = 720;
const H = 1280;
const DURATION_MS = 8000;
const FPS = 30;

const PALETTE = {
  bgTop:    "#1a0f2e",
  bgBottom: "#2d1b4e",
  accent:   "#fbbf24",
  accent2:  "#f59e0b",
  good:     "#22c55e",
  text:     "#ffffff",
  muted:    "rgba(255,255,255,0.65)",
};

const STRINGS: Record<string, {
  brand: string; round: string; pts: string; title: string;
  tryIt: string; downloadImg: string; generateVideo: string; rendering: string;
  share: string; close: string; recordingHint: string; notSupported: string;
}> = {
  es: { brand: "STOP", round: "LETRA", pts: "puntos", title: "¡Mi partida en STOP!",
    tryIt: "stopjuegodepalabras.com", downloadImg: "Descargar imagen",
    generateVideo: "Generar vídeo", rendering: "Renderizando…", share: "Compartir",
    close: "Cerrar", recordingHint: "Tarda ~10 s · listo para TikTok / Reels",
    notSupported: "Tu navegador no permite grabar vídeo · usa la imagen" },
  en: { brand: "STOP", round: "LETTER", pts: "points", title: "My STOP game!",
    tryIt: "stopjuegodepalabras.com", downloadImg: "Download image",
    generateVideo: "Generate video", rendering: "Rendering…", share: "Share",
    close: "Close", recordingHint: "Takes ~10 s · ready for TikTok / Reels",
    notSupported: "Your browser can't record video · use the image" },
  pt: { brand: "STOP", round: "LETRA", pts: "pontos", title: "A minha partida no STOP!",
    tryIt: "stopjuegodepalabras.com", downloadImg: "Descarregar imagem",
    generateVideo: "Gerar vídeo", rendering: "A renderizar…", share: "Partilhar",
    close: "Fechar", recordingHint: "Demora ~10 s · pronto para TikTok / Reels",
    notSupported: "O teu browser não grava vídeo · usa a imagem" },
  fr: { brand: "STOP", round: "LETTRE", pts: "points", title: "Ma partie STOP !",
    tryIt: "stopjuegodepalabras.com", downloadImg: "Télécharger l'image",
    generateVideo: "Générer la vidéo", rendering: "Rendu en cours…", share: "Partager",
    close: "Fermer", recordingHint: "~10 s · prêt pour TikTok / Reels",
    notSupported: "Ton navigateur ne grave pas la vidéo · utilise l'image" },
};

// ── Drawing primitives ──────────────────────────────────────────────────────
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function drawBackground(ctx: CanvasRenderingContext2D, tMs: number) {
  // Animated gradient with subtle hue drift.
  const drift = (Math.sin(tMs / 1500) + 1) * 0.5;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(0.5 + drift * 0.1, "#3b1e6e");
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Floating soft blobs — cheap "confetti" feel.
  for (let i = 0; i < 14; i++) {
    const x = (i * 137 + tMs * 0.03) % (W + 200) - 100;
    const y = (i * 211 + tMs * 0.05) % (H + 200) - 100;
    const r = 40 + ((i * 17) % 30);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,193,7,${0.07 + (i % 3) * 0.02})`);
    grad.addColorStop(1, "rgba(255,193,7,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drawBrand(ctx: CanvasRenderingContext2D, tMs: number, s: typeof STRINGS["es"]) {
  // 0–1 s : STOP logo scales in from 0 to 1
  const p = clamp01(tMs / 900);
  const scale = easeOutBack(p);
  ctx.save();
  ctx.translate(W / 2, 220);
  ctx.scale(scale, scale);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `900 220px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillText(s.brand, 0, 0);
  ctx.restore();
}

function drawLetter(ctx: CanvasRenderingContext2D, tMs: number, letter: string, s: typeof STRINGS["es"]) {
  // 1 – 2.5 s : letter chip pops in
  if (tMs < 900) return;
  const local = clamp01((tMs - 900) / 700);
  const scale = easeOutBack(local);
  const opacity = local;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(W / 2, 470);
  ctx.scale(scale, scale);

  // Label
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 34px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s.round, 0, -110);

  // Big letter chip
  const chipR = 130;
  const grad = ctx.createLinearGradient(0, -chipR, 0, chipR);
  grad.addColorStop(0, PALETTE.accent);
  grad.addColorStop(1, PALETTE.accent2);
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(245,158,11,0.55)";
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(0, 0, chipR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#0d1757";
  ctx.font = `900 200px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(letter.toUpperCase(), 0, 8);
  ctx.restore();
}

function drawEntries(ctx: CanvasRenderingContext2D, tMs: number, entries: ClipEntry[]) {
  // 2.5 – 6 s : categories + words reveal staggered
  if (tMs < 1700) return;
  const list = entries.slice(0, 4);
  const startY = 740;
  const rowH = 110;
  list.forEach((e, i) => {
    const localStart = 1700 + i * 350;
    if (tMs < localStart) return;
    const p = clamp01((tMs - localStart) / 450);
    const y = startY + i * rowH;
    const slide = (1 - easeOutCubic(p)) * 80;

    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(slide, 0);

    // Row bg
    const rowGrad = ctx.createLinearGradient(60, 0, W - 60, 0);
    rowGrad.addColorStop(0, "rgba(255,255,255,0.10)");
    rowGrad.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = rowGrad;
    roundRect(ctx, 60, y - 40, W - 120, 80, 18);
    ctx.fill();

    // Category
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 24px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(e.category, 28).toUpperCase(), 90, y - 12);

    // Word
    ctx.fillStyle = e.score >= 10 ? PALETTE.good : (e.score >= 5 ? PALETTE.accent : PALETTE.text);
    ctx.font = `900 38px "Baloo 2", system-ui, sans-serif`;
    ctx.fillText(truncate(e.word || "—", 22), 90, y + 18);

    // Points pill on right
    if (e.score > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = PALETTE.accent;
      ctx.font = `900 36px "Baloo 2", system-ui, sans-serif`;
      ctx.fillText(`+${e.score}`, W - 90, y);
    }
    ctx.restore();
  });
}

function drawFinalScore(ctx: CanvasRenderingContext2D, tMs: number, totalScore: number, playerName: string, s: typeof STRINGS["es"]) {
  // 6 – 7.5 s : big total score with celebratory pop
  if (tMs < 5800) return;
  const local = clamp01((tMs - 5800) / 700);
  const scale = easeOutBack(local);
  ctx.save();
  ctx.globalAlpha = local;
  ctx.translate(W / 2, 1110);
  ctx.scale(scale, scale);

  // Player name
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 30px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(truncate(playerName, 28), 0, -70);

  // Big score
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `900 130px "Baloo 2", system-ui, sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillText(String(totalScore), 0, 8);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 34px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(s.pts.toUpperCase(), 0, 90);
  ctx.restore();
}

function drawWatermark(ctx: CanvasRenderingContext2D, tMs: number, s: typeof STRINGS["es"]) {
  // 7+ s : URL CTA bar fades in
  if (tMs < 6500) return;
  const opacity = clamp01((tMs - 6500) / 600);
  ctx.save();
  ctx.globalAlpha = opacity * 0.95;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 100, H - 80, W - 200, 56, 28);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 26px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎮 " + s.tryIt, W / 2, H - 52);
  ctx.restore();
}

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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  tMs: number,
  props: { letter: string; entries: ClipEntry[]; totalScore: number; playerName: string },
  s: typeof STRINGS["es"],
) {
  drawBackground(ctx, tMs);
  drawBrand(ctx, tMs, s);
  drawLetter(ctx, tMs, props.letter, s);
  drawEntries(ctx, tMs, props.entries);
  drawFinalScore(ctx, tMs, props.totalScore, props.playerName, s);
  drawWatermark(ctx, tMs, s);
}

// ── Component ───────────────────────────────────────────────────────────────
export function ClipGenerator(props: ClipGeneratorProps) {
  const { open, onClose, playerName, letter, entries, totalScore, language = "es", onShared } = props;
  const s = STRINGS[language] ?? STRINGS.es;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  // Set to true when the modal closes so any in-flight recording/render aborts
  // and no stray share/download fires after the user dismissed the modal.
  const cancelRef = useRef<boolean>(false);
  const recRafRef = useRef<number | null>(null);
  const recTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const [rendering, setRendering] = useState(false);
  const [lastBlob, setLastBlob] = useState<{ url: string; kind: "image" | "video"; ext: string } | null>(null);

  // Detect if browser can record video at all.
  const canRecord = typeof window !== "undefined"
    && "MediaRecorder" in window
    && typeof (HTMLCanvasElement.prototype as any).captureStream === "function";

  // Preview animation while modal is open — loops every DURATION_MS.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    startRef.current = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) % (DURATION_MS + 1500);
      drawFrame(ctx, Math.min(elapsed, DURATION_MS), { letter, entries, totalScore, playerName }, s);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [open, letter, entries, totalScore, playerName, s]);

  // Free blob URLs when modal closes / new blob.
  useEffect(() => {
    return () => { if (lastBlob) URL.revokeObjectURL(lastBlob.url); };
  }, [lastBlob]);
  useEffect(() => { if (!open && lastBlob) { URL.revokeObjectURL(lastBlob.url); setLastBlob(null); } }, [open]); // eslint-disable-line

  // Hard cancellation when the modal closes — stops any in-flight recording,
  // releases MediaStream tracks, and prevents post-close share/download.
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
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Try Web Share API with a file; fallback to download.
  const shareOrDownload = async (blob: Blob, name: string, mime: string) => {
    const file = new File([blob], name, { type: mime });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: s.title, text: s.title });
        onShared?.();
        return;
      } catch { /* user cancelled or share failed — fall through */ }
    }
    downloadFile(blob, name);
    onShared?.();
  };

  const handleDownloadImage = async () => {
    // Render the final celebratory frame (DURATION_MS) to a fresh hi-res canvas
    // so the saved image always shows the score, regardless of preview position.
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, DURATION_MS - 100, { letter, entries, totalScore, playerName }, s);
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
      // Use a fresh offscreen canvas so the preview loop and the recorded
      // animation can't fight over the same context.  Pin to fixed FPS.
      const rec = document.createElement("canvas");
      rec.width = W; rec.height = H;
      const ctx = rec.getContext("2d");
      if (!ctx) return;
      stream = (rec as any).captureStream(FPS) as MediaStream;
      recStreamRef.current = stream;

      // Try MIME candidates in order; some browsers (e.g. Safari) lie via
      // isTypeSupported, so we also catch construction failures and fall back.
      const candidates = [
        "video/mp4;codecs=h264",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "", // last resort: let the browser pick
      ];
      let recorder: MediaRecorder | null = null;
      let mime = "";
      for (const m of candidates) {
        try {
          if (m && (window as any).MediaRecorder?.isTypeSupported && !(window as any).MediaRecorder.isTypeSupported(m)) continue;
          recorder = m
            ? new MediaRecorder(stream, { mimeType: m, videoBitsPerSecond: 4_000_000 })
            : new MediaRecorder(stream, { videoBitsPerSecond: 4_000_000 });
          mime = recorder.mimeType || m || "video/webm";
          break;
        } catch { /* try next candidate */ }
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
          drawFrame(ctx, Math.min(tMs, DURATION_MS), { letter, entries, totalScore, playerName }, s);
          if (tMs >= DURATION_MS) { resolve(); return; }
          recRafRef.current = requestAnimationFrame(tick);
        };
        recRafRef.current = requestAnimationFrame(tick);
      });
      if (cancelRef.current) return;

      // Hold the final frame for ~1 s.
      await new Promise<void>(r => { recTimeoutRef.current = setTimeout(() => r(), 1000); });
      if (cancelRef.current) return;

      try { recorder.stop(); } catch { /* already stopped on cancel */ }
      const blob = await done;
      if (cancelRef.current) return;
      await shareOrDownload(blob, `stop-${letter}-${totalScore}.${ext}`, mime);
    } finally {
      // Always release the capture stream so a new recording starts clean.
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
            aria-label={s.close}
            className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Canvas preview — scaled down to fit modal */}
          <div className="rounded-3xl overflow-hidden mx-auto shadow-2xl"
            style={{ aspectRatio: `${W} / ${H}`, width: "100%", maxWidth: 320, background: "#0d0420" }}>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </div>

          <p className="text-center text-white/55 text-xs px-4">{s.recordingHint}</p>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={rendering}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#0d1757" }}
            >
              <Download className="w-4 h-4" /> {s.downloadImg}
            </button>

            {canRecord ? (
              <button
                onClick={handleGenerateVideo}
                disabled={rendering}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #a855f7, #4f46e5)" }}
              >
                {rendering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {s.rendering}</>
                ) : (
                  <><Video className="w-4 h-4" /> {s.generateVideo}</>
                )}
              </button>
            ) : (
              <p className="text-center text-white/50 text-xs">{s.notSupported}</p>
            )}

            {/* Native share button for mobile — same payload as image */}
            {typeof navigator !== "undefined" && (navigator as any).canShare && (
              <button
                onClick={handleDownloadImage}
                disabled={rendering}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-white/70 text-sm"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <Share2 className="w-4 h-4" /> {s.share}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
