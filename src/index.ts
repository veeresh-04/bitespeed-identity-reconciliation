import express from "express";
import { identifyHandler } from "./controllers/identify";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});

// Identity reconciliation endpoint
app.post("/identify", identifyHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
