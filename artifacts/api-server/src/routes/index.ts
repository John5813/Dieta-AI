import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paymentRouter from "./payment-submit";
import aiRouter from "./ai";
import barcodeRouter from "./barcode";
import backupRouter from "./backup";
import privacyRouter from "./privacy";
import { payApi } from "./pay";
import leadsRouter from "./leads";
import checkoutRouter from "./checkout";
import { adminApi } from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paymentRouter);
router.use(aiRouter);
router.use(barcodeRouter);
router.use(backupRouter);
router.use(payApi);
router.use(leadsRouter);
router.use(checkoutRouter);
router.use(adminApi);
router.use("/privacy", privacyRouter);

export default router;
