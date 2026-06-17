import { Router, Response } from "express";
import { db } from "../db/client";
import { chatMessages, inventoryItems, transactions } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { streamChat, getChatSystemPrompt } from "../services/claude";
import { isConfigured } from "../config";

const router = Router();

// GET /api/chat/messages
router.get("/messages", async (req, res) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    const limit = parseInt(req.query.limit as string || "50");

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// POST /api/chat/send — streaming chat
router.post("/send", async (req, res: Response) => {
  if (!isConfigured.anthropic) {
    return res.status(400).json({
      error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env file.",
    });
  }

  const { message, sessionId = "default" } = req.body as { message: string; sessionId?: string };

  try {
    // Get context for system prompt
    const invStats = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems);

    const txStats = await db
      .select({ todayRevenue: sql<number>`sum(case when date = current_date then amount else 0 end)` })
      .from(transactions);

    // Get conversation history (last 20 messages)
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(20);

    const historyMessages = history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Save user message
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content: message,
    });

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const systemPrompt = getChatSystemPrompt({
      todayRevenue: Number(txStats[0]?.todayRevenue || 0),
      activeProducts: Number(invStats[0]?.count || 0),
    });

    let fullResponse = "";

    await streamChat(
      [
        ...historyMessages,
        { role: "user", content: message },
      ],
      systemPrompt,
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }
    );

    // Save assistant response
    await db.insert(chatMessages).values({
      sessionId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Chat error";
    res.write(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
    res.end();
  }
});

// DELETE /api/chat/messages — clear chat history
router.delete("/messages", async (req, res) => {
  try {
    const sessionId = (req.query.sessionId as string) || "default";
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    res.json({ message: "Chat cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear chat" });
  }
});

export default router;
