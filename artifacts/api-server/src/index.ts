import "./lib/facebookGraphCompat";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, markStripeReady } from "./stripeClient";
import app from "./app";
import { startDailyCron, stopDailyCron } from "./lib/dailyCron";
import { revokeFakePremium } from "./lib/permanentPremium";
import { ensureIndexes } from "@workspace/db";
import { loadRevokedPlayerIds } from "./lib/playerRevocation";
import contactRouter from "./routes/contact";
import { closeDbPool } from "@workspace/db";

// Railway deployment trigger: keep the API service in sync with the frontend build.
// The root build copies artifacts/stop-game/dist into the API public directory.

// NOTE: /api/check-version lives in app.ts (registered once, with a proper
// numeric version comparison). The duplicate definition that used to be here
// was removed — two handlers for the same path was confusing and the string
// comparison wrongly blocked multi-digit versions like "1.10.0".

// ---- PÁGINAS PARA POLÍTICA DE PRIVACIDAD Y ELIMINACIÓN DE CUENTA ----
app.use("/api/contact", contactRouter);

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



const STRIPE_STARTUP_TIMEOUT_MS = 60_000;

async function withStartupTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${STRIPE_STARTUP_TIMEOUT_MS}ms`));
        }, STRIPE_STARTUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function initStripe(): Promise<boolean> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — skipping Stripe initialization");
    return false;
  }
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeKey) {
    console.warn("STRIPE_SECRET_KEY not set — skipping Stripe initialization");
    return false;
  }

  try {
    console.log("Initializing Stripe schema...");
    await withStartupTimeout(runMigrations({ databaseUrl } as any), "Stripe schema migration");
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
      await withStartupTimeout(\n        stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log("Stripe webhook configured");
    }

    console.log("Syncing Stripe data...");
    await withStartupTimeout(stripeSync.syncBackfill(), "Stripe backfill");
    console.log("Stripe data synced");

    // Do not accept webhooks, or run Premium cleanup, until the local Stripe
    // mirror has completed its initial synchronization successfully.
    markStripeReady();
    return true;
  } catch (error: any) {
    console.error("Failed to initialize Stripe:", error.message);
    return false;
  }
}

let httpServer: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — stopping server`);
  stopDailyCron();
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
  }
  try { await closeDbPool(); } catch (error: any) { console.error("[shutdown] DB pool close failed:", error?.message ?? error); }
}

process.once("SIGTERM", () => { void shutdown("SIGTERM").finally(() => process.exit(0)); });
process.once("SIGINT", () => { void shutdown("SIGINT").finally(() => process.exit(0)); });

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
  httpServer = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Ensure the DB schema is ready before starting tasks that query tables
  // created by the bootstrap (notably play_subscriptions). Keep the port open
  // so Railway can observe the instance; /healthz remains 503 until ready.
  try {
    await ensureIndexes();
    await loadRevokedPlayerIds();
  } catch (err: any) {
    console.error("[ensureIndexes] failed at startup:", err?.message ?? err);
    process.exit(1);
    return;
  }

  startDailyCron();

  // Stripe backfill must finish before the premium cleanup. Otherwise an
  // active Stripe subscription may not yet exist in the local mirror and the
  // cleanup could revoke legitimate Premium during the startup race.
  const stripeInitialized = await initStripe();

  // Never run Premium cleanup against an incomplete Stripe mirror. If Stripe
  // initialization/backfill failed, local absence of a subscription is not
  // evidence that the customer no longer has an active Stripe entitlement.
  if (stripeInitialized) {
    await revokeFakePremium();
  } else {
    console.warn("[Premium cleanup] skipped because Stripe initialization/sync did not complete successfully");
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

// No-op change solely to force Railway to rebuild the API service after the startup schema fix.
