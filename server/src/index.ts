import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SSEStreamingApi, streamSSE } from "hono/streaming";
import { createHost } from "./host";

const app = new Hono();
app.use("*", logger());
app.use(cors());

app.get("/api/health", (c) => c.json({ ok: true }));

// Store connected clients
const clients: Record<string, { stream: SSEStreamingApi }> = {};
const clientId = "1"; // Assume we only ever have 1 client for now

async function sendMessageToClient(data: any) {
  await clients[clientId].stream.writeSSE({
    data: JSON.stringify(data),
    event: "message",
    id: data.id,
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
  const { userPrompt } = await c.req.json();
  const host = await createHost();
  await sendMessageToClient({ id: uuid(), role: "user", content: userPrompt });

  try {
    await host.processQuery({ userPrompt, onStepComplete: console.log });
    await sendMessageToClient({ id: uuid(), role: "assistant", content: "Hardcoded assistant message" });

    return c.json({ status: "completed" }, 202); // Return 202 Accepted
  } catch (error) {
    console.error("Error processing query:", error);
    await sendMessageToClient({ id: uuid(), role: "assistant", content: "Error: " + (error as any).message });
    return c.json({ status: "error", message: (error as any).message }, 500);
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

export default { ...app, idleTimeout: 60, port: 3031 };
