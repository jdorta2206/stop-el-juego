import { Router, Request, Response } from "express";

const router = Router();

// 📬 Endpoint para recibir mensajes de contacto
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;

    // Validar campos obligatorios
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Aquí puedes hacer lo que quieras con los datos:
    // 1. Guardarlos en una base de datos
    // 2. Enviar un correo electrónico con nodemailer
    // 3. Enviar una notificación a Slack/Discord/Telegram
    // 4. Guardar en un archivo de logs (temporal)

    // Ejemplo: solo los mostramos por consola (mientras pruebas)
    console.log(`📩 Nuevo mensaje de contacto:`);
    console.log(`  Nombre: ${name}`);
    console.log(`  Email: ${email}`);
    console.log(`  Mensaje: ${message}`);

    // Podrías guardarlos en la base de datos si tienes una tabla de contactos
    // await db.insert(contactsTable).values({ name, email, message, createdAt: new Date() });

    // También podrías enviar un correo con Nodemailer (ver opción más abajo)

    // Respuesta de éxito
    res.status(200).json({ ok: true, message: "Mensaje enviado correctamente" });
  } catch (error) {
    console.error("Error en /api/contact:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
