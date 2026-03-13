import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import rankingRouter from "./ranking";
import roomsRouter from "./rooms";
import authRouter from "./auth";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/game", gameRouter);
router.use("/ranking", rankingRouter);
router.use("/rooms", roomsRouter);
router.use("/auth", authRouter);
router.use("/stripe", stripeRouter);

export default router;
