    try { return JSON.parse(localStorage.getItem(storageKey(playerId)) || "{}"); }
    catch { return {}; }
  });
  const syncedRef = useRef(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      setBests(JSON.parse(localStorage.getItem(storageKey(playerId)) || "{}"));
    } catch {
      setBests({});
    }
    syncedRef.current = false;
    syncAbortRef.current?.abort();
  }, [playerId]);

  // ── Sync from server on mount (server is authoritative) ─────────────────
  useEffect(() => {
    if (!playerId || syncedRef.current) return;
    syncedRef.current = true;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncBestsFromServer(playerId, controller.signal).then(serverBests => {
      setBests(prev => {
        const authoritative: BestScores = {};
        for (const [m, score] of Object.entries(serverBests)) {
          if (typeof score === "number" && Number.isFinite(score) && score >= 0) {
            authoritative[m as GameMode] = score;
          }
        }
        try { localStorage.setItem(storageKey(playerId), JSON.stringify(authoritative)); } catch {}
        return authoritative;
      });
    });
  }, [playerId]);

  useEffect(() => () => syncAbortRef.current?.abort(), [playerId]);

  const best = bests[mode] ?? 0;

  const updateBest = useCallback((score: number): { isNew: boolean; diff: number } => {
    const prev = bests[mode] ?? 0;
    const isNew = score > prev;
    if (isNew) {
      const updated: BestScores = { ...bests, [mode]: score };
      try { localStorage.setItem(storageKey(playerId), JSON.stringify(updated)); } catch {}
      setBests(updated);
      if (playerId) saveBestsToServer(playerId, updated);
    }
    return { isNew, diff: score - prev };
  }, [bests, mode, playerId]);

  return { best, updateBest };
}