import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CreateMessageRequestSchema, ProgressNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

import { BaseClient } from "./baseClient";
import { createServer } from "./mcpFilesystem";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

export class FilesystemClient extends BaseClient {
  allowedDirectories: string[];
  clientName: string = "mcp-filesystem-client";

  constructor(allowedDirectories: string[]) {
    super();
    this.allowedDirectories = allowedDirectories;
  }

  async connect(): Promise<void> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = await createServer(this.allowedDirectories);
    server.connect(serverTransport);

    const client = new Client(
      {
        name: this.clientName,
        version: "0.0.1",
      },
      {
        capabilities: {
          experimental: {},
          sampling: {},
          roots: {},
        },
      },
    );
    await client.connect(clientTransport);
    console.log(`${this.clientName} connected to MCP server`);
    this.session = client;
    const response = await this.listTools();
    const tools = response.tools;
    console.log(
      `${this.clientName} tools:`,
      tools.map((tool) => tool.name),
    );

    client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      console.log(`${this.clientName} got MCP notif`, notification);
    });

    client.setRequestHandler(CreateMessageRequestSchema, (request) => {
      console.log(`${this.clientName} got MCP request`, request);
      return { _meta: {} };
    });
  }
}

export async function createFilesystemClient(allowedDirectories: string[]): Promise<FilesystemClient> {
  const client = new FilesystemClient(allowedDirectories);
  await client.connect();
  return client;
}
