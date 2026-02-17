import express from "express";
import { computeScore } from "./core/kernel";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("JONAH ENGINE ONLINE");
});

/**
 * POST /api/v1/evaluate
 * Deterministic Rational Evaluation Endpoint
 */
app.post("/api/v1/evaluate", (req, res) => {
  try {
    const { epistemic, structural, risk, ethical } = req.body;

    const result = computeScore({
      epistemic,
      structural,
      risk,
      ethical,
    });

    res.json({
      version: "1.0.0",
      deterministic: true,
      result,
    });
  } catch (error) {
    res.status(400).json({
      error: "Invalid input format",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
