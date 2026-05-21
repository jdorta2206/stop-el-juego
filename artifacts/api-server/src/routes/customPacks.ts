import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customCategoryPacksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { isUserPremium } from "../lib/premiumStatus";
import { writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Cap how many packs a single user can own — keeps the UI manageable and
// prevents a runaway client from spamming the table.
const MAX_PACKS_PER_USER = 20;

// Categories count must match the classic game's 7-row board so the existing
// solo UI doesn't need to handle variable-length packs.
const CATEGORIES_PER_PACK = 7;

const PackInputSchema = z.object({
  playerId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(30),
  icon: z.string().trim().min(1).max(8).default("✨"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#f9a825"),
  language: z.enum(["es", "en", "pt", "fr"]).default("es"),
  categories: z
    .array(z.string().trim().min(1).max(30))
    .length(CATEGORIES_PER_PACK),
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

// GET /api/custom-packs/:playerId — list all packs for a player.
// Non-premium users get an empty list (we never leak previously-created
// packs from when they were premium until they re-subscribe).
router.get("/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId ?? "").trim();
  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
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

// POST /api/custom-packs — create a new pack (premium-gated).
router.post("/", writeLimiter, async (req, res) => {
  const parsed = PackInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pack data", issues: parsed.error.issues });
    return;
  }
  const { playerId, name, icon, color, language, categories } = parsed.data;
  const premium = await isUserPremium(playerId);
  if (!premium) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }
  const existing = await db
    .select({ id: customCategoryPacksTable.id })
    .from(customCategoryPacksTable)
    .where(eq(customCategoryPacksTable.playerId, playerId));
  if (existing.length >= MAX_PACKS_PER_USER) {
    res.status(409).json({
      error: `Maximum ${MAX_PACKS_PER_USER} custom packs reached`,
    });
    return;
  }
  const [row] = await db
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
  res.status(201).json({ data: packRowToApi(row) });
});

// PUT /api/custom-packs/:id — update a pack (premium-gated, must own it).
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
  const premium = await isUserPremium(playerId);
  if (!premium) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }
  const updated = await db
    .update(customCategoryPacksTable)
    .set({
      name,
      icon,
      color,
      language,
      categoriesJson: JSON.stringify(categories),
      updatedAt: new Date(),
    })
    .where(and(
      eq(customCategoryPacksTable.id, id),
      eq(customCategoryPacksTable.playerId, playerId),
    ))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Pack not found" });
    return;
  }
  res.json({ data: packRowToApi(updated[0]) });
});

// DELETE /api/custom-packs/:id?playerId=... — remove a pack (must own it).
// Premium check intentionally skipped here so a user who downgrades can
// still clean up their old packs.
router.delete("/:id", writeLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const playerId = String(req.query.playerId ?? "").trim();
  if (!Number.isFinite(id) || !playerId) {
    res.status(400).json({ error: "Invalid id or playerId" });
    return;
  }
  const deleted = await db
    .delete(customCategoryPacksTable)
    .where(and(
      eq(customCategoryPacksTable.id, id),
      eq(customCategoryPacksTable.playerId, playerId),
    ))
    .returning({ id: customCategoryPacksTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Pack not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
