import path from "path";
import { existsSync } from "fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
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
  // Dev domain (Replit preview). Pulled from env so it can be rotated without
  // a code change. APP_ORIGIN also covers the canonical prod domain above.
  process.env["APP_ORIGIN"] || "",
].filter(Boolean));

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin requests (server-to-server, curl) have no Origin header —
      // allow them since CORS isn't being enforced anyway.
      if (!origin) return cb(null, true);
      if (CORS_ALLOWLIST.has(origin)) return cb(null, true);
      // Allow any *.replit.dev preview URL (dev environments rotate hosts).
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith(".replit.dev") || host.endsWith(".kirk.replit.dev")) {
          return cb(null, true);
        }
      } catch { /* malformed origin */ }
      // Unknown origin → reject by passing false. The browser will then
      // refuse to expose any response body to the calling script.
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" })); // small body cap protects against memory abuse
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// 🛡️ Global per-key rate limit covering ALL /api/* requests.
// Per-route stricter limits are layered inside individual routers.
app.use("/api", generalLimiter);

app.use("/api", router);

// 🚂 Single-service mode (e.g. Railway): serve the built game client from the
// same origin as the API so the whole app runs as ONE deployable. Gated behind
// SERVE_CLIENT so Replit (which serves the client from a separate Vite service)
// is completely unaffected — this block never runs unless SERVE_CLIENT=1.
if (process.env["SERVE_CLIENT"] === "1") {
  const clientDist =
    process.env["CLIENT_DIST_PATH"] ||
    path.resolve(process.cwd(), "artifacts/stop-game/dist/public");
  if (!existsSync(path.join(clientDist, "index.html"))) {
    console.warn(
      `[SERVE_CLIENT] index.html not found at ${clientDist} — the client build is missing or mislocated. Run "pnpm run build:railway" before starting.`,
    );
  }
  app.use(express.static(clientDist));
  // SPA fallback: any GET that isn't an /api route returns index.html so
  // client-side routing (wouter) works on hard refresh / deep links. The regex
  // treats both `/api` and `/api/...` as API paths so they never fall through
  // to the HTML shell.
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// 🛡️ Global JSON error handler — prevents the server from sending HTML 500s
// (which break the client because it expects JSON). Express 5 auto-forwards
// async errors here, so unhandled exceptions in any route now return a clean
// 500 with JSON body and stay logged on the server side.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API ERROR]", err?.message ?? err, err?.stack);
  if (res.headersSent) return;
  res.status(500).json({
    error: "Internal server error",
    message: err?.message ?? "Unknown error",
  });
});

export default app;
