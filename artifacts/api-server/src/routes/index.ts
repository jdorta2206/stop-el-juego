import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import rankingRouter from "./ranking";
import progressRouter from "./progress";
import roomsRouter from "./rooms";
import authRouter from "./auth";
import stripeRouter from "./stripe";
import presenceRouter from "./presence";
import analyticsRouter from "./analytics";
import friendsRouter from "./friends";
import dailyRouter from "./daily";
import impossibleRouter from "./impossible";
import notificationsRouter from "./notifications";
import tournamentsRouter from "./tournaments";
import seasonRouter from "./season";
import inventoryRouter from "./inventory";
import rewardsRouter from "./rewards";
import playBillingRouter from "./playBilling";
import customPacksRouter from "./customPacks";
import guestStatsRouter from "./guestStats";
import halloweenRouter from "./halloween";
import { indexesReady } from "@workspace/db";

const router: IRouter = Router();

router.use(healthRouter);

// The HTTP listener starts before schema bootstrap so Railway can detect the
// port. Keep every DB-backed API route unavailable until the schema is ready;
// /healthz above remains the readiness probe and intentionally returns 503.
router.use((_req, res, next): void => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }
  next();
});
router.use("/game", gameRouter);
router.use("/ranking", rankingRouter);
router.use("/ranking", progressRouter);
router.use("/rooms", roomsRouter);
router.use("/auth", authRouter);
router.use("/stripe", stripeRouter);
router.use("/presence", presenceRouter);
router.use("/analytics", analyticsRouter);
router.use("/friends", friendsRouter);
router.use("/daily", dailyRouter);
router.use("/impossible", impossibleRouter);
router.use("/notifications", notificationsRouter);
router.use("/tournaments", tournamentsRouter);
router.use("/season", seasonRouter);
router.use("/inventory", inventoryRouter);
router.use("/rewards", rewardsRouter);
router.use("/billing/play", playBillingRouter);
router.use("/custom-packs", customPacksRouter);
router.use("/guest-stats", guestStatsRouter);
router.use("/halloween", halloweenRouter);

export default router;
