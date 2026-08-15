import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import app from "./app";
import { startDailyCron } from "./lib/dailyCron";
import { revokeFakePremium } from "./lib/permanentPremium";
import { ensureIndexes } from "@workspace/db";

// ---- PÁGINAS PARA POLÍTICA DE PRIVACIDAD Y ELIMINACIÓN DE CUENTA ----
app.get('/privacy', (req, res) => {
  return res.send(`
    <!DOCTYPE html><html><head><title>Política de Privacidad - STOP</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.5;">
      <h1>Política de Privacidad de STOP</h1>
      <p><strong>Última actualización:</strong> 4 de junio de 2026</p>
      <h2>Información que recopilamos</h2>
      <p>Para jugar a STOP, puedes iniciar sesión con Google, Facebook o Instagram. Recopilamos tu nombre, correo electrónico e identificador de la red social. También guardamos tus partidas, puntuaciones, logros y progreso en el juego.</p>
      <h2>Uso de los datos</h2>
      <p>Los datos se utilizan para operar el juego, mostrar clasificaciones, y mejorar la experiencia del usuario. No vendemos ni compartimos tus datos con terceros.</p>
      <h2>Eliminación de datos</h2>
      <p>Puedes eliminar tu cuenta y todos tus datos desde nuestra <a href="https://www.stopjuegodepalabras.com/delete-account">página de eliminación de cuenta</a> o enviando un correo a dorynex@stopjuegodepalabras.com.</p>
      <h2>Contacto</h2><p>dorynex@stopjuegodepalabras.com</p>
      <p><a href="https://www.stopjuegodepalabras.com">Volver al juego</a></p>
    </body></html>
  `);
});

app.get('/delete-account', (req, res) => {
  return res.send(`
    <!DOCTYPE html><html><head><title>Eliminar Cuenta - STOP</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.5;">
      <h1>Solicitud de Eliminación de Cuenta</h1>
      <p>Para eliminar permanentemente tu cuenta y todos tus datos asociados (partidas, puntuaciones, logros, etc.), sigue estos pasos:</p>
      <ol>
        <li>Envía un correo electrónico a <strong>dorynex@stopjuegodepalabras.com</strong> desde la dirección de correo que usas en STOP.</li>
        <li>El asunto debe ser: <strong>"ELIMINAR MI CUENTA"</strong>.</li>
        <li>Incluye en el mensaje tu nombre de usuario (si lo recuerdas).</li>
      </ol>
      <p>Procesaremos tu solicitud en un plazo máximo de 7 días. Una vez eliminada, no podrás recuperar tus datos.</p>
      <p><a href="https://www.stopjuegodepalabras.com">Volver al juego</a></p>
    </body></html>
  `);
});

// ---- RUTA PARA EL FORMULARIO DE CONTACTO ----
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    console.log(`📩 Nuevo mensaje de contacto:`, { name, email, message });
    return res.json({ ok: true, message: "Mensaje enviado correctamente" });
  } catch (error) {
    console.error("Error en /api/contact:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeKey) {
    console.warn("STRIPE_SECRET_KEY not set — skipping Stripe initialization");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl } as any);
    console.log("Stripe schema ready");
    const stripeSync = await getStripeSync();
    const domains = process.env["REPLIT_DOMAINS"] || process.env["REPLIT_DEV_DOMAIN"] || process.env["RAILWAY_PUBLIC_DOMAIN"] || "";
    const webhookHost = domains.split(",")[0].replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (webhookHost) {
      console.log("Setting up managed Stripe webhook...");
      await stripeSync.findOrCreateManagedWebhook(`https://${webhookHost}/api/stripe/webhook`);
      console.log("Stripe webhook configured");
    }
    console.log("Syncing Stripe data...");
    stripeSync.syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: Error) => console.error("Stripe sync error:", err.message));
  } catch (error: unknown) {
    console.error("Failed to initialize Stripe:", error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  app.listen(port, () => console.log(`Server listening on port ${port}`));
  ensureIndexes().catch((err: unknown) => console.error("[ensureIndexes] failed at startup:", err instanceof Error ? err.message : err));
  startDailyCron();
  revokeFakePremium();
  initStripe().catch((err: unknown) => console.error("Stripe init failed:", err instanceof Error ? err.message : err));
}

void main().catch((err: unknown) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
