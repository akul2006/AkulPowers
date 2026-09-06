import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gridRouter from "./grid";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gridRouter);

export default router;
