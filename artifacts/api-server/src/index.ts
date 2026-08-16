import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import app from "./app";
import { startDailyCron } from "./lib/dailyCron";
import { revokeFakePremium } from "./lib/permanentPremium";
import { ensureIndexes } from "@workspace/db";

// Railway deployment trigger: keep the API service in sync with the frontend build.
// The root build copies artifacts/stop-game/dist into the API public directory.

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
      <p><a href="https://www.stopjuegodepalabras.com">Volver al juego</a></p>`);
});
