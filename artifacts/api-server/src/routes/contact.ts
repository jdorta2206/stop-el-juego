import { Router, Request, Response } from "express";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: "Faltan campos obligatorios" });
    console.log(`📩 Nuevo mensaje de contacto:`, { name, email, message });
    return res.status(200).json({ ok: true, message: "Mensaje enviado correctamente" });
  } catch (error) {
    console.error("Error en /api/contact:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
