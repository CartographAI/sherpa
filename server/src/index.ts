#!/usr/bin/env node

import { CoreMessage } from "ai";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SSEStreamingApi, streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { createHost } from "./host";

const app = new Hono();
app.use("*", logger());
app.use(cors());

app.get("/api/health", (c) => c.json({ ok: true }));

// Store connected clients
const clients: Record<string, { stream: SSEStreamingApi }> = {};
const clientId = "1"; // Assume we only ever have 1 client for now

async function sendMessageToClient(data: CoreMessage) {
  await clients[clientId].stream.writeSSE({
    data: JSON.stringify(data),
    event: "message",
  });
}

function uuid() {
  return crypto.randomUUID();
}

app.get("/api/events", (c) => {
  return streamSSE(c, async (stream) => {
    clients[clientId] = { stream };

    await stream.writeSSE({
      data: "Connected to stream",
      event: "connected",
      id: uuid(),
    });

    c.req.raw.signal.addEventListener("abort", () => {
      console.log("client disconnected", clientId);
      delete clients[clientId];
    });

    // Keep the connection open
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await stream.writeSSE({
        data: "Heartbeat",
        event: "heartbeat",
        id: uuid(),
      });
      if (c.req.raw.signal.aborted) break;
    }
  });
});

app.post("/api/chat", async (c) => {
  const { userPrompt, model, apiKey } = await c.req.json();
  const host = await createHost({ model, apiKey });
  await sendMessageToClient({ role: "user", content: userPrompt });

  try {
    await host.processQuery({ userPrompt, onStepComplete: sendMessageToClient });
    return c.json({ status: "completed" }, 202); // Return 202 Accepted
  } catch (error) {
    console.error("Error processing query:", error);
    return c.json({ status: "error", message: (error as any).message }, 400);
  }
});

app.use(
  "/_app/*",
  serveStatic({
    root: "./dist/web",
  }),
);
app.get("/favicon.png", serveStatic({ path: "./dist/web/favicon.png" }));
app.get("/", serveStatic({ path: "./dist/web/index.html" }));

serve({
  fetch: app.fetch,
  port: 3031,
});
