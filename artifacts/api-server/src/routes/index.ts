import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import rankingRouter from "./ranking";
import roomsRouter from "./rooms";
import authRouter from "./auth";
import stripeRouter from "./stripe";
import presenceRouter from "./presence";
import friendsRouter from "./friends";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/game", gameRouter);
router.use("/ranking", rankingRouter);
router.use("/rooms", roomsRouter);
router.use("/auth", authRouter);
router.use("/stripe", stripeRouter);
router.use("/presence", presenceRouter);
router.use("/friends", friendsRouter);

export default router;
