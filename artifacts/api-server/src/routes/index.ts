import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import rankingRouter from "./ranking";
import roomsRouter from "./rooms";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/game", gameRouter);
router.use("/ranking", rankingRouter);
router.use("/rooms", roomsRouter);
router.use("/auth", authRouter);

export default router;
