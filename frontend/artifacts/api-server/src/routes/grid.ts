import { Router, type IRouter } from "express";
import {
  GetAuditLogsResponse,
  GetGridSummaryResponse,
  GetNodesResponse,
} from "@workspace/api-zod";
import { demoAuditLogs, demoNodes, demoSummary } from "../data/demo-grid";

// Read-only UI fixtures. Production requests go directly to the Java service.
const router: IRouter = Router();
router.get("/grid/summary", (_req, res) =>
  res.json(GetGridSummaryResponse.parse(demoSummary)),
);
router.get("/nodes", (_req, res) =>
  res.json(GetNodesResponse.parse(demoNodes)),
);
router.get("/audit-logs", (_req, res) =>
  res.json(GetAuditLogsResponse.parse(demoAuditLogs)),
);
router.post(["/nodes", "/trades"], (_req, res) => {
  res
    .status(503)
    .json({
      error:
        "This read-only demo cannot execute writes. Connect the Java backend to continue.",
      code: "JAVA_BACKEND_REQUIRED",
    });
});
export default router;
