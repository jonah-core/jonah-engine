import express from "express";
import cors from "cors";

import { computeScore } from "./core/kernel";
import { governanceDescriptor } from "./core/governance";
import {
  buildEvaluationSignature,
  verifyEvaluationSignature
} from "./core/audit";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    engine: "JONAH_CORE",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   GOVERNANCE
========================= */

app.get("/api/v1/governance", (req,
