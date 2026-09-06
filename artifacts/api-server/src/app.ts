import path from "path";
import { existsSync } from "fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import adminPanel from "./routes/admin";
import { WebhookHandlers } from "./webhookHandlers";
import { generalLimiter } from "./middlewares/rateLimit";

const app: Express = express();

// Trust the platform proxy so req.ip resolves correctly behind the LB
// (otherwise rate-limit keys all collapse to the proxy IP and never trigger).
app.set("trust proxy", 1);

// Stripe webhook MUST be registered before express.json() so it receives raw Buffer
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer — express.json() ran first");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      return res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

// CORS allowlist. Locked down because the session cookie is now sameSite=None,
// which means browsers WILL send it on cross-origin credentialed fetches. With
// the previous `origin: true` reflection, any malicious site could call
// /api/auth/me with credentials and steal the bearer token returned in the
// JSON response. The allowlist ensures only our known frontends can read
// authenticated responses; everything else gets a credential-less response
// (browser blocks the read).
const CORS_ALLOWLIST = new Set<string>([
  "https://stop-el-juego.replit.app",
  "https://stopjuegodepalabras.com",
  "https://www.stopjuegodepalabras.com",
  process.env["APP_ORIGIN"] || "",
].filter(Boolean));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ALLOWLIST.has(origin)) return cb(null, true);
      if (process.env.NODE_ENV !== "production") {
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith(".replit.dev") || host.endsWith(".kirk.replit.dev")) {
            return cb(null, true);
          }
        } catch { /* malformed origin */ }
      }
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", generalLimiter);
app.use("/api", router);

app.use("/test", adminPanel);

const MIN_APP_VERSION = "1.3.4.0";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.replit.stop_el_juego.twa";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const dbv = pb[i] ?? 0;
    if (da !== dbv) return da < dbv ? -1 : 1;
  }
  return 0;
}

app.get('/api/check-version', (req, res) => {
  const version = req.query.v as string | undefined;
  if (!version) {
    res.json({ allowed: true });
    return;
  }
  const isAllowed = compareVersions(version, MIN_APP_VERSION) >= 0;
  res.json({
    allowed: isAllowed,
    updateUrl: isAllowed ? null : PLAY_STORE_URL,
    message: isAllowed
      ? null
      : "Tu versión de STOP es muy antigua. Actualiza desde Google Play para seguir jugando."
  });
});

if (process.env["SERVE_CLIENT"] === "1") {
  const clientDist =
    process.env["CLIENT_DIST_PATH"] ||
    path.resolve(process.cwd(), "artifacts/stop-game/dist/public");
  if (!existsSync(path.join(clientDist, "index.html"))) {
    console.warn(
      `[SERVE_CLIENT] index.html not found at ${clientDist} — the client build is missing or mislocated. Run "pnpm run build:railway" before starting.`,
    );
  }
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(
      path.join(clientDist, ".well-known", "assetlinks.json"),
      { dotfiles: "allow" },
      (err) => {
        if (err && !res.headersSent)
          res.status(404).json({ error: "assetlinks.json not found" });
      },
    );
  });
  app.use(express.static(clientDist, { dotfiles: "allow" }));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Global JSON error handler. Keep detailed diagnostics in server logs only;
// clients receive a stable generic response that cannot disclose internals.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API ERROR]", err?.message ?? err, err?.stack);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
