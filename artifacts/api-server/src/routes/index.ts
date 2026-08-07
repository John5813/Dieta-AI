import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentRouter from "./payment-submit";
import aiRouter from "./ai";
import privacyRouter from "./privacy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paymentRouter);
router.use(aiRouter);
router.use("/privacy", privacyRouter);

export default router;
