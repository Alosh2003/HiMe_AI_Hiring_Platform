import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import jobsRouter from "./jobs";
import candidatesRouter from "./candidates";
import companiesRouter from "./companies";
import applicationsRouter from "./applications";
import adminRouter from "./admin";
import matchingRouter from "./matching";

const router: IRouter = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/jobs", jobsRouter);
router.use("/candidates", candidatesRouter);
router.use("/companies", companiesRouter);
router.use("/applications", applicationsRouter);
router.use("/admin", adminRouter);
router.use("/ai", matchingRouter);

export default router;
