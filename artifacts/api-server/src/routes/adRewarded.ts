import { Router, type Request, type Response } from "express";

const router = Router();

type AdResult = { rewarded: boolean; createdAt: number };
const results = new Map<string, AdResult>();
const TTL_MS = 2 * 60 * 1000;

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, result] of results) {
    if (result.createdAt < cutoff) results.delete(id);
  }
}

router.post("/admob-result", (req: Request, res: Response) => {
  cleanup();
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : "";
  const rewarded = req.body?.rewarded === true;
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(requestId)) {
    return res.status(400).json({ error: "invalid_request_id" });
  }
  results.set(requestId, { rewarded, createdAt: Date.now() });
  return res.json({ ok: true });
});

router.get("/admob-result/:requestId", (req: Request, res: Response) => {
  cleanup();
  const requestId = req.params.requestId;
  const result = results.get(requestId);
  if (!result) return res.json({ ready: false });
  results.delete(requestId);
  return res.json({ ready: true, rewarded: result.rewarded });
});

export default router;
