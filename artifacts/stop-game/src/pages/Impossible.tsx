import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Flame, Share2, Clock, Trophy, X as XIcon, Skull } from "lucide-react";
import { useT } from "@/i18n/useT";
import { usePlayer } from "@/hooks/use-player";
import { getApiUrl, shareText, publicLink } from "@/lib/utils";
import { recordExternalStat } from "@/hooks/useAchievements";

const API = getApiUrl();
const ROUND_MS = 60000;

interface Combo { date: string; language: string; letter: string; category: string; stats: { attempts: number; wins: number } }
interface Result { played: boolean; result?: { letter: string; category: string; attempted_word?: string; attemptedWord?: string; won: boolean; time_ms?: number; timeMs?: number } }

export default function Impossible() {
  const { t, lang } = useT();
  const { player } = usePlayer();
  const [combo, setCombo] = useState<Combo | null>(null);
  const [myAttempt, setMyAttempt] = useState<Result["result"] | null>(null);
  const [word, setWord] = useState("");
  const [phase, setPhase] = useState<"idle" | "playing" | "submitting" | "done">("idle");
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [outcome, setOutcome] = useState<{ won: boolean; word: string; timeMs: number; stats: { attempts: number; wins: number } } | null>(null);
  const startedAt = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Load combo + my prior attempt.
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    fetch(`${API}/api/impossible?language=${lang}`, { signal })
      .then(r => r.json())
      .then(d => { if (!signal.aborted) setCombo(d); })
      .catch(() => {});
    if (player?.id) {
      fetch(`${API}/api/impossible/me/${encodeURIComponent(player.id)}?language=${lang}`, { signal })
        .then(r => r.json())
        .then((d: Result) => {
          if (signal.aborted || !d.played || !d.result) return;
          setMyAttempt(d.result);
          setPhase("done");
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [lang, player?.id]);

  // Timer.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = Math.max(0, ROUND_MS - (Date.now() - startedAt.current));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        void submit("", true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, player?.id, lang, combo?.letter, combo?.category]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setRemaining(ROUND_MS);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const submit = useCallback(async (w: string, surrendered: boolean) => {
    if (!player || phase !== "playing") return;
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;
    setPhase("submitting");
    const timeMs = Math.min(ROUND_MS, Date.now() - startedAt.current);
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(API + "/api/impossible/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: player.id, playerName: player.name, language: lang,
          word: w, timeMs, surrendered,
        }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) throw new Error("impossible-submit-" + r.status);
      if (controller.signal.aborted) return;
      if (data.alreadyPlayed && data.result) {
        setMyAttempt(data.result);
      } else {
        setOutcome({ won: !!data.won, word: data.word ?? w, timeMs, stats: data.stats });
        setMyAttempt({ letter: combo?.letter ?? "?", category: combo?.category ?? "", attemptedWord: data.word ?? w, won: !!data.won, timeMs });
      }
      setPhase("done");
    } catch {
      if (!controller.signal.aborted) setPhase("playing");
    } finally {
      window.clearTimeout(timeoutId);
      if (submitAbortRef.current === controller) submitAbortRef.current = null;
    }
  }, [player, phase, lang, combo]);

  useEffect(() => () => {
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
  }, [player?.id, lang]);
