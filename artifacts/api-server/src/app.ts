import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

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
