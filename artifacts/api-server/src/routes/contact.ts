import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { contactLimiter } from "../middlewares/rateLimit";

const router = Router();

let contactTableReady: Promise<void> | null = null;

function ensureContactTable(): Promise<void> {
  if (!contactTableReady) {
    contactTableReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id bigserial PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined).catch((error) => {
      console.error("[contact] failed to initialize contact_messages:", error);
      // A transient DB failure must not permanently poison the initializer.
      contactTableReady = null;
      throw error;
    });
  }
  return contactTableReady;
}

router.post("/", contactLimiter, async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    if (name.length > 120 || email.length > 320 || message.length > 5000) {
      return res.status(400).json({ error: "El mensaje supera el límite permitido" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Correo electrónico no válido" });
    }

    await ensureContactTable();
    await db.execute(sql`
      INSERT INTO contact_messages (name, email, message)
      VALUES (${name}, ${email}, ${message})
    `);

    return res.status(201).json({ ok: true, message: "Mensaje recibido correctamente" });
  } catch (error) {
    console.error("Error en /api/contact:", error);
    return res.status(500).json({ error: "No se pudo guardar el mensaje. Inténtalo de nuevo." });
  }
});

export default router;
