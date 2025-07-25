// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("✅ OpenAI chat proxy is running.");
});
app.post("/api/chat", async (req, res) => {
    const { messages, model = "gpt-4o-mini", stream = false } = req.body;
  
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid or missing 'messages' array." });
    }
  
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OpenAI API key in environment." });
    }
  
    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
        }),
      });
  
      const data = await openaiRes.json();
  
      if (!openaiRes.ok) {
        return res.status(openaiRes.status).json({ error: data.error?.message || "OpenAI error" });
      }
  
      // ✅ Send the full OpenAI response (not just .message.content)
      res.json(data);
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  
app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
});
