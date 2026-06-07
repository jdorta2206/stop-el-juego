import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import app from "./app";
import { startDailyCron } from "./lib/dailyCron";
import { revokeFakePremium } from "./lib/permanentPremium";
import { ensureIndexes } from "@workspace/db";

// NOTE: /api/check-version lives in app.ts (registered once, with a proper
// numeric version comparison). The duplicate definition that used to be here
// was removed — two handlers for the same path was confusing and the string
// comparison wrongly blocked multi-digit versions like "1.10.0".

// ---- PÁGINAS PARA POLÍTICA DE PRIVACIDAD Y ELIMINACIÓN DE CUENTA ----
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Política de Privacidad - STOP</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.5;">
      <h1>Política de Privacidad de STOP</h1>
      <p><strong>Última actualización:</strong> 4 de junio de 2026</p>
      <h2>Información que recopilamos</h2>
      <p>Para jugar a STOP, puedes iniciar sesión con Google, Facebook o Instagram. Recopilamos tu nombre, correo electrónico e identificador de la red social. También guardamos tus partidas, puntuaciones, logros y progreso en el juego.</p>
      <h2>Uso de los datos</h2>
      <p>Los datos se utilizan para operar el juego, mostrar clasificaciones, y mejorar la experiencia del usuario. No vendemos ni compartimos tus datos con terceros.</p>
      <h2>Eliminación de datos</h2>
      <p>Puedes eliminar tu cuenta y todos tus datos desde nuestra <a href="https://www.stopjuegodepalabras.com/delete-account">página de eliminación de cuenta</a> o enviando un correo a dorynex@stopjuegodepalabras.com.</p>
      <h2>Contacto</h2>
      <p>dorynex@stopjuegodepalabras.com</p>
      <p><a href="https://www.stopjuegodepalabras.com">Volver al juego</a></p>
    </body>
    </html>
  `);
});

app.get('/delete-account', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Eliminar Cuenta - STOP</title></head>
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
    </body>
    </html>
  `);
});
// ---- FIN DE LAS PÁGINAS ----

async function initStripe() {
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

    const domains =
      process.env["REPLIT_DOMAINS"] ||
      process.env["REPLIT_DEV_DOMAIN"] ||
      process.env["RAILWAY_PUBLIC_DOMAIN"] ||
      "";
    // Normalize to a bare host: tolerate values given as full URLs
    // (e.g. "https://foo.up.railway.app") so we never build "https://https://…".
    const webhookHost = domains
      .split(",")[0]
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (webhookHost) {
      console.log("Setting up managed Stripe webhook...");
      const webhookBaseUrl = `https://${webhookHost}`;
      await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log("Stripe webhook configured");
    }

    console.log("Syncing Stripe data...");
    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: Error) => console.error("Stripe sync error:", err.message));
  } catch (error: any) {
    console.error("Failed to initialize Stripe:", error.message);
  }
}

async function main() {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  // Start listening immediately so the deployment platform detects the port.
  // Stripe initializes in the background — it can take several seconds.
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Ensure all critical indexes exist before serving heavy traffic.
  // Idempotent — safe to run on every boot.
  ensureIndexes().catch((err: any) => {
    console.error("[ensureIndexes] failed at startup:", err?.message ?? err);
  });

  startDailyCron();
  // 🚫 One-shot cleanup at boot: revoke premium from any account without an
  // active Stripe subscription. Idempotent — only premium comes from Stripe now.
  revokeFakePremium();

  initStripe().catch((err) => {
    console.error("Stripe init failed:", err.message);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});