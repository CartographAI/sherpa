import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { AISDKError, CoreMessage } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SSEStreamingApi, streamSSE } from "hono/streaming";

import { Host } from "./host.js";
import { mcpManager } from "./mcpTools/mcpManager.js"; // Import the singleton instance
import { validatePath } from "./mcpTools/mcpFilesystem.js";
import { TreeGenerator, TreeNode } from "./mcpTools/tree.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { log } from "./utils/logger.js";

let host: Host;
const app = new Hono();
app.use(cors());
if (process.env.NODE_ENV === "development") {
  app.use("*", logger());
}

app.get("/api/health", (c) => c.json({ ok: true }));

// Store connected clients
const clients: Record<string, { stream: SSEStreamingApi }> = {};

async function sendMessageToClient(clientId: string, data: CoreMessage) {
  try {
    if (clientId in clients) {
      await clients[clientId].stream.writeSSE({
        data: JSON.stringify(data),
        event: "message",
      });
    }
  } catch (error) {
    log.error("Error sending SSE message to client:", error);
  }
}

async function sendTextStreamToClient(clientId: string, stream: AsyncIterable<string>) {
  try {
    for await (const textPart of stream) {
      if (clientId in clients) {
        await clients[clientId].stream.writeSSE({
          data: textPart,
          event: "stream",
        });
      }
    }
  } catch (error) {
    if (AISDKError.isInstance(error)) {
      log.error("AISDKError when consuming stream:", error.message);
    } else {
      log.error("Unexpected error when consuming stream:", error);
    }
  }
}

function uuid() {
  return crypto.randomUUID();
}

app.get("/api/events/:chatId", (c) => {
  const chatId = c.req.param("chatId");
  if (!chatId) return c.json({ error: "chatId is required" }, 400);
  if (clients[chatId]) return c.json({ error: "Another chat with this chatId is already connected" }, 400);

  return streamSSE(c, async (stream) => {
    log.debug(`client ${chatId} connected`);
    clients[chatId] = { stream };

    await stream.writeSSE({
      data: "Connected to stream",
      event: "connected",
      id: uuid(),
    });

    c.req.raw.signal.addEventListener("abort", () => {
      log.debug(`client ${chatId} disconnected`);
      delete clients[chatId];
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
    log.error("Error getting directories:", error);
    return c.json({ error: "Failed to get directories" }, 500);
  }
});

// Endpoint to get MCP server configuration with status
app.get("/api/mcp-config", (c) => {
  try {
    // Use the manager instance to get the config with status
    const configWithStatus = mcpManager.getConfigWithStatus();
    return c.json(configWithStatus);
  } catch (error) {
    // getConfigWithStatus might throw if called before init, though unlikely here
    // It also handles internal logging
    return c.json({ error: "Failed to load MCP configuration" }, 500);
  }
});

app.get("/api/tree", async (c) => {
  try {
    const client = host.toolsToClientMap["list_allowed_directories"];
    if (!client) {
      return c.json({ error: "Tool not available" }, 500);
    }

    const { path: targetPath, maxDepth } = c.req.query();

    if (!targetPath) {
      return c.json({ error: "Path parameter is required" }, 400);
    }
    const result = await client.callTool("list_allowed_directories", {});
    const allowedDirectory = (result.content[0].text as string).replace("Allowed directory:\n", "");

    // Create a new TreeGenerator instance with the maxDepth option if provided
    const treeGenerator = new TreeGenerator({
      maxDepth: maxDepth ? parseInt(maxDepth) : undefined,
    });
    const absolutePath = path.resolve(allowedDirectory, targetPath);
    const validPath = await validatePath(absolutePath, allowedDirectory);

    const treeStructure: TreeNode = treeGenerator.generateTree(validPath, allowedDirectory);

    return c.json({ tree: treeStructure });
  } catch (error) {
    log.error("Error getting tree structure:", error);
    return c.json({ error: "Failed to get tree structure" }, 500);
  }
});

app.post("/api/file-tokens", async (c) => {
  try {
    const client = host.toolsToClientMap["list_allowed_directories"];
    if (!client) {
      return c.json({ error: "Tool not available" }, 500);
    }

    // Get paths from the request body
    const { paths: filePaths } = await c.req.json();

    if (!Array.isArray(filePaths) || !filePaths.every((p) => typeof p === "string")) {
      return c.json({ error: "Invalid paths parameter. Must be an array of strings." }, 400);
    }

    const listAllowedDirectoriesResult = await client.callTool("list_allowed_directories", {});
    const allowedDirectory = (listAllowedDirectoriesResult.content[0].text as string).replace(
      "Allowed directory:\n",
      "",
    );

    // Validate each path (optional, but good practice)
    for (const filePath of filePaths) {
      const absolutePath = path.resolve(allowedDirectory, filePath);
      await validatePath(absolutePath, allowedDirectory);
    }

    const readFilesClient = host.toolsToClientMap["read_files"];
    if (!readFilesClient) {
      return c.json({ error: "read_files tool not available" }, 500);
    }

    // Call read_files with the provided paths
    const readFilesResult = await readFilesClient.callTool("read_files", { paths: filePaths });

    let totalTokens = 0;
    for (const fileContent of readFilesResult.content) {
      if (fileContent.type === "text") {
        const textContent = fileContent.text;
        totalTokens += textContent.length;
      }
    }

    totalTokens = Math.round(totalTokens / 4);

    return c.json({ count: totalTokens });
  } catch (error) {
    log.error("Error getting file tokens:", error);
    return c.json({ error: "Failed to get file tokens" }, 500);
  }
});

app.post("/api/chat/:chatId", async (c) => {
  const chatId = c.req.param("chatId");
  if (!chatId) return c.json({ error: "Chat ID is required" }, 400);
  const { userPrompt, previousMessages, model, modelProvider, apiKey, userFiles } = await c.req.json();
  host.setModel({ model, modelProvider, apiKey });

  try {
    await host.processQuery({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      previousMessages,
      onMessage: (message: CoreMessage) => sendMessageToClient(chatId, message),
      onTextStream: (stream: AsyncIterable<string>) => sendTextStreamToClient(chatId, stream),
      userFiles: userFiles,
    });
    return c.json({ status: "completed" }, 202); // Return 202 Accepted
  } catch (error) {
    log.error("Error processing query:", error);
    return c.json({ status: "error", message: (error as any).message }, 400);
  }
});

// Serve web app (index.html at the root path "/", assets at "/_app/*" and favicon at "/favicon.png")

// Hono expects the root/path in serveStatic to be relative to the working directory
// where this file is being executed from. This finds the relative path from the working directory
// to the parent folder of this file, then we can use it to point to the web build files.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relativePathToScript = path.relative(process.cwd(), __dirname);

app.get("/", serveStatic({ root: relativePathToScript, path: "web/index.html" }));
app.get("/chat/*", serveStatic({ root: relativePathToScript, path: "web/index.html" }));
app.get("/favicon.png", serveStatic({ root: relativePathToScript, path: "web/favicon.png" }));
app.use("/_app/*", serveStatic({ root: `${relativePathToScript}/web` }));

export function serveApi(setHost: Host) {
  host = setHost;
  serve({
    fetch: app.fetch,
    port: 3031,
  });
  log.info("Server is running. Open http://localhost:3031 in your browser to use the app.");
}
