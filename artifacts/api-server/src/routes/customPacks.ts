import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customCategoryPacksTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { isUserPremium } from "../lib/premiumStatus";
import { writeLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

const MAX_PACKS_PER_USER = 20;
const CATEGORIES_PER_PACK = 7;

const PackInputSchema = z.object({
  playerId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(30),
  icon: z.string().trim().min(1).max(8).default("✨"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#f9a825"),
  language: z.enum(["es", "en", "pt", "fr"]).default("es"),
  categories: z.array(z.string().trim().min(1).max(30)).length(CATEGORIES_PER_PACK),
});

function packRowToApi(row: typeof customCategoryPacksTable.$inferSelect) {
  let categories: string[] = [];
  try {
    const parsed = JSON.parse(row.categoriesJson);
    if (Array.isArray(parsed)) categories = parsed.map(String);
  } catch {
    // Corrupted row — return empty list, the UI will let the user re-edit.
  }
  return {
    id: row.id,
    playerId: row.playerId,
    name: row.name,
    icon: row.icon,
    color: row.color,
    language: row.language,
    categories,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId ?? "").trim();
  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
    return;
  }
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  const premium = await isUserPremium(playerId);
  if (!premium) {
    res.json({ data: [], premium: false });
    return;
  }
  const rows = await db
    .select()
    .from(customCategoryPacksTable)
    .where(eq(customCategoryPacksTable.playerId, playerId))
    .orderBy(desc(customCategoryPacksTable.updatedAt));
  res.json({ data: rows.map(packRowToApi), premium: true });
});

router.post("/", writeLimiter, async (req, res) => {
  const parsed = PackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pack data", issues: parsed.error.issues });
    return;
  }
  const { playerId, name, icon, color, language, categories } = parsed.data;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  const premium = await isUserPremium(playerId);
  if (!premium) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }

  // Serialize creation per player. Advisory locks also protect the zero-row
  // case, where SELECT ... FOR UPDATE cannot lock a non-existent row.
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${playerId}))`);

    const existing = await tx
      .select({ id: customCategoryPacksTable.id })
      .from(customCategoryPacksTable)
      .where(eq(customCategoryPacksTable.playerId, playerId));

    if (existing.length >= MAX_PACKS_PER_USER) return null;

    const [created] = await tx
      .insert(customCategoryPacksTable)
      .values({
        playerId,
        name,
        icon,
        color,
        language,
        categoriesJson: JSON.stringify(categories),
      })
      .returning();
    return created;
  });

  if (!row) {
    res.status(409).json({ error: `Maximum ${MAX_PACKS_PER_USER} custom packs reached` });
    return;
  }
  res.status(201).json({ data: packRowToApi(row) });
});

router.put("/:id", writeLimiter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pack data", issues: parsed.error.issues });
    return;
  }
  const { playerId, name, icon, color, language, categories } = parsed.data;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  const premium = await isUserPremium(playerId);
  if (!premium) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }
  const updated = await db
    .update(customCategoryPacksTable)
    .set({ name, icon, color, language, categoriesJson: JSON.stringify(categories), updatedAt: new Date() })
    .where(and(eq(customCategoryPacksTable.id, id), eq(customCategoryPacksTable.playerId, playerId)))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Pack not found" });
    return;
  }
  res.json({ data: packRowToApi(updated[0]) });
});

router.delete("/:id", writeLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const playerId = String(req.query.playerId ?? "").trim();
  if (!Number.isFinite(id) || !playerId) {
    res.status(400).json({ error: "Invalid id or playerId" });
    return;
  }
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  const deleted = await db
    .delete(customCategoryPacksTable)
    .where(and(eq(customCategoryPacksTable.id, id), eq(customCategoryPacksTable.playerId, playerId)))
    .returning({ id: customCategoryPacksTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Pack not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
