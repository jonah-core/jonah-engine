import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import { verifyAuditRecord } from "./core/audit";

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL as string);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

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
      parsed.signatureVersion
    );

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Verification failed" });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
