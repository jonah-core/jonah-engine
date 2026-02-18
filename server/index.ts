import express from "express";
import crypto from "crypto";
import Redis from "ioredis";
import { evaluateGovernance } from "./core/governance";
import { verifyAuditRecord } from "./core/audit";

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL as string);

// ─────────────────────────────
// CONFIG
// ─────────────────────────────

const ACTIVE_KEY_ID = process.env.JONAH_ACTIVE_KEY_ID as string;
const KEY_MAP = JSON.parse(process.env.JONAH_KEYS as string);

// ─────────────────────────────
// UTIL
// ─────────────────────────────

function computeHmac(payload: any, previousHash: string) {
  const secret = KEY_MAP[ACTIVE_KEY_ID];

  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");
}

async function getPreviousHash(): Promise<string> {
  const lastId = await redis.get("audit:last");

  if (!lastId) return "0000000000000000";

  const lastRecord = await redis.get(`audit:${lastId}`);
  if (!lastRecord) return "0000000000000000";

  return JSON.parse(lastRecord).hash;
}

// ─────────────────────────────
// HEALTH
// ─────────────────────────────

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ─────────────────────────────
// EVALUATE
// ─────────────────────────────

app.post("/evaluate", async (req, res) => {
  try {
    const payload = req.body;

    const governance = evaluateGovernance(payload);

    const previousHash = await getPreviousHash();

    const hash = computeHmac(payload, previousHash);

    const evaluationId = crypto.randomUUID();

    const record = {
      id: evaluationId,
      payload,
      hash,
      previousHash,
      signatureVersion: ACTIVE_KEY_ID,
      governanceScore: governance.governanceScore,
      governanceFlags: governance.flags,
      riskLevel: governance.riskLevel,
      timestamp: Date.now()
    };

    await redis.set(`audit:${evaluationId}`, JSON.stringify(record));
    await redis.set("audit:last", evaluationId);

    res.json({
      evaluationId,
      hash,
      signatureVersion: ACTIVE_KEY_ID,
      governanceScore: governance.governanceScore,
      governanceFlags: governance.flags,
      riskLevel: governance.riskLevel
    });

  } catch (err) {
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ─────────────────────────────
// VERIFY
// ─────────────────────────────

app.get("/verify/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const record = await redis.get(`audit:${id}`);
    if (!record) {
      return res.status(404).json({ error: "Not found" });
    }

    const parsed = JSON.parse(record);

    const result = verifyAuditRecord(
      id,
      parsed.payload,
      parsed.hash,
      parsed.previousHash,
      KEY_MAP[parsed.signatureVersion]
    );

    res.json({
      ...result,
      signatureVersion: parsed.signatureVersion
    });

  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─────────────────────────────

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
