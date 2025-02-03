import * as path from "path";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SSEStreamingApi, streamSSE } from "hono/streaming";
import { CoreMessage } from "ai";

import { Host } from "./host";
import { SYSTEM_PROMPT } from "./prompts";
import { TreeGenerator, TreeNode } from "./mcpTools/tree";

let host: Host;
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

async function sendTextStreamToClient(stream: AsyncIterable<string>) {
  for await (const textPart of stream) {
    await clients[clientId].stream.writeSSE({
      data: textPart,
      event: "stream",
    });
  }
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

app.get("/api/directory", async (c) => {
  try {
    const client = host.toolsToClientMap["list_allowed_directories"];
    if (!client) {
      return c.json({ error: "Tool not available" }, 500);
    }

    const result = await client.callTool("list_allowed_directories", {});
    return c.json({ directory: (result.content[0].text as string).replace("Allowed directory:\n", "") });
  } catch (error) {
    console.error("Error getting directories:", error);
    return c.json({ error: "Failed to get directories" }, 500);
  }
});

app.get("/api/tree", async (c) => {
  try {
    const client = host.toolsToClientMap["tree"];
    if (!client) {
      return c.json({ error: "Tool not available" }, 500);
    }

    const { path, maxDepth } = c.req.query();

    if (!path) {
      return c.json({ error: "Path parameter is required" }, 400);
    }

    // Create a new TreeGenerator instance with the maxDepth option if provided
    const treeGenerator = new TreeGenerator({
      maxDepth: maxDepth ? parseInt(maxDepth) : undefined,
    });

    const treeStructure: TreeNode = treeGenerator.generateTree(path);

    return c.json({ tree: treeStructure });
  } catch (error) {
    console.error("Error getting tree structure:", error);
    return c.json({ error: "Failed to get tree structure" }, 500);
  }
});

app.post("/api/chat", async (c) => {
  const { userPrompt, previousMessages, model, modelProvider, apiKey } = await c.req.json();
  host.setModel({ model, modelProvider, apiKey });

  try {
    await host.processQuery({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      previousMessages,
      onMessage: sendMessageToClient,
      onTextStream: sendTextStreamToClient,
    });
    return c.json({ status: "completed" }, 202); // Return 202 Accepted
  } catch (error) {
    console.error("Error processing query:", error);
    return c.json({ status: "error", message: (error as any).message }, 400);
  }
});

// Serve web app (index.html at the root path "/", assets at "/_app/*" and favicon at "/favicon.png")

// Hono expects the root/path in serveStatic to be relative to the working directory
// where this file is being executed from. This finds the relative path from the working directory
// to the parent folder of this file, then we can use it to point to the web build files.
const relativePathToScript = path.relative(process.cwd(), __dirname);

app.get("/", serveStatic({ path: `${relativePathToScript}/web/index.html` }));
app.get("/favicon.png", serveStatic({ path: `${relativePathToScript}/web/favicon.png` }));
app.use(
  "/_app/*",
  serveStatic({
    root: `${relativePathToScript}/web`,
  }),
);

export function serveApi(setHost: Host) {
  host = setHost;
  serve({
    fetch: app.fetch,
    port: 3031,
  });
  console.log("Server is running. Open http://localhost:3031 in your browser to use the app.");
}
