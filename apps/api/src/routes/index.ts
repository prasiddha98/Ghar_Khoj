import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import usersRouter from "./users";
import interactionsRouter from "./interactions";
import messagesRouter from "./messages";
import verificationRouter from "./verification";
import recommendationsRouter from "./recommendations";
import adminRouter from "./admin";
import authRouter from "./auth";
import storageRouter from "./storage";
import tenantPreferencesRouter from "./tenantPreferences";
import matchesRouter from "./matches";
import contractsRouter from "./contracts";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(roomsRouter);
router.use(usersRouter);
router.use(interactionsRouter);
router.use(messagesRouter);
router.use(verificationRouter);
router.use(recommendationsRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(tenantPreferencesRouter);
router.use(matchesRouter);
router.use(contractsRouter);

export default router;
